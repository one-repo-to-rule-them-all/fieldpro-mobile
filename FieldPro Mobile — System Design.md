# FieldPro Mobile — System Design

**Date:** 2026-05-09
**Type:** React Native field worker app (Android-first, iOS eventually)
**Backend:** Existing FieldPro FastAPI — no new backend service required

---

## 1. What We're Building

A production-grade React Native mobile app for FieldPro field workers (the `Employee` role). The web frontend already has a `(field)/` route group that serves as the screen blueprint. The mobile app replaces that surface with a native experience — faster, offline-capable, and store-deployable.

**In scope (MVP):**
- Login / logout with JWT auth
- My Jobs — list of assigned work orders (scheduled + in-progress)
- Job Detail — work order info, tasks, client/location
- GPS check-in / check-out
- Task completion (mark done, skip with reason, undo)
- Pull-to-refresh

**Out of scope (post-MVP):**
- Push notifications
- Offline-first sync (cache reads, but no write queue)
- Manager/Admin views
- Invoice or crew management

---

## 2. Stack Decision

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React Native + Expo SDK 51** (managed workflow) | Fastest path to Android + iOS; no native build toolchain to maintain upfront |
| Language | **TypeScript** | Matches existing web codebase; shared type patterns |
| Routing | **Expo Router v3** (file-based) | Consistent with Next.js App Router mental model; deep linking built-in |
| Server state | **TanStack Query v5** | Same library as web frontend; same hook patterns (`useWorkOrders`, etc.) |
| UI state | **Zustand** | Same library as web frontend |
| HTTP client | **Axios** | Same as web `api.ts`; interceptor pattern for token refresh |
| Token storage | **Expo SecureStore** | Encrypted native keychain — replaces `httpOnly` cookie |
| GPS | **Expo Location** | Managed API; foreground location for check-in |
| UI components | **React Native Paper** or **NativeWind** | Decision: NativeWind (Tailwind-in-RN) keeps styling muscle memory consistent |
| CI/CD | **GitHub Actions + EAS Build** | Expo Application Services for OTA + store builds |

**Expo managed vs bare:** Start managed. Eject to bare only if we hit a native module wall (unlikely for this feature set). EAS Build handles managed builds for both platforms without a Mac for Android.

---

## 3. Auth Flow — The Key Difference From Web

The web frontend relies on `httpOnly` cookies for the refresh token. React Native has no browser cookie jar, so we need SecureStore for both tokens.

### Login
```
POST /api/v1/auth/login
  body: { email, password }
  response: { access_token, token_type }
  (refresh_token set as httpOnly cookie in web — not usable in RN)
```

**Problem:** The refresh token cookie can't be read by RN. Two options:

| Option | Approach | Trade-off |
|---|---|---|
| A | Store access token only; re-login on expiry | Simple, bad UX |
| B ✅ | Add `include_refresh_token: true` param to login response so mobile gets it in the body | Small backend change, correct long-term |
| C | Long-lived access token (extended expiry for mobile) | Security regression — not acceptable |

**Decision: Option B.** Add an optional `?client=mobile` query param to `POST /auth/login`. When present, include `refresh_token` in the JSON response body (in addition to the cookie). Mobile stores both in SecureStore; web behavior unchanged.

### Token Refresh
```
POST /api/v1/auth/refresh
  body: { refresh_token: "<stored token>" }   ← mobile sends in body, not cookie
  response: { access_token }
```

Same intercept pattern as web `api.ts` — Axios 401 interceptor queues requests and replays after refresh. Refresh token also cycled on each refresh (rotation already in backend).

### Logout
Clear both tokens from SecureStore. Optionally call `POST /api/v1/auth/logout` to invalidate server-side.

---

## 4. API Integration

Mobile `api.ts` mirrors the web version with three changes:

1. **Base URL** — configurable via `EXPO_PUBLIC_API_URL` env var (points to `localhost:8000` in dev, Fly.io URL in production)
2. **Token source** — reads from `SecureStore` instead of in-memory state
3. **Refresh endpoint** — sends `refresh_token` in request body

All existing `/api/v1/` endpoints are consumed as-is. No new endpoints needed except the `?client=mobile` login param.

```
GET  /api/v1/work-orders?assigned_to=me&status=scheduled,in_progress
GET  /api/v1/work-orders/:id
POST /api/v1/work-orders/:id/check-in    { latitude, longitude }
POST /api/v1/work-orders/:id/check-out   { latitude, longitude }
PATCH /api/v1/tasks/:id                  { status: "completed" | "skipped", skip_reason? }
```

---

## 5. Screen Map

```
(auth)/
  login.tsx                ← email + password, JWT exchange

(app)/
  _layout.tsx              ← bottom tab navigator (2 tabs: Jobs, More)
  index.tsx                ← My Jobs list (scheduled + in-progress WOs)
  jobs/
    [id].tsx               ← Job Detail: info, check-in strip, task list
  more.tsx                 ← Placeholder (profile, logout)
```

**Tab 1 — Jobs:**
- Pulls `GET /work-orders?assigned_to=me` filtered to `scheduled` + `in_progress`
- Grouped: In Progress → Scheduled Today → Upcoming
- Pull-to-refresh
- Tap row → Job Detail

**Tab 2 — More:**
- Profile info (read-only for now)
- Logout button

**Job Detail (`jobs/[id]`):**
- Header: client name, location, scheduled time
- Status badge
- Check-in strip (compact horizontal — matches the FieldPro web fix already shipped)
  - "Check In" button → captures GPS → `POST /check-in`
  - "Check Out" button → `POST /check-out`
  - Geofence warning if outside radius (soft warn, not hard block for MVP)
- Task list: renders tasks via the same task state machine
  - Tap to complete / skip / undo
  - No "Add Task" on mobile (manager function only)

---

## 6. Data Model (Client-Side)

Types mirror `frontend/src/types/index.ts` exactly — shared source of truth once we set up the OpenAPI type-gen pipeline.

```typescript
// Key types consumed by the mobile app
WorkOrder      — id, title, status, scheduled_start_time, client_name, location_name, crew_id
Task           — id, title, status, skip_reason, work_order_id
CheckIn        — id, work_order_id, checked_in_at, latitude, longitude, distance_meters
```

No local DB (SQLite) for MVP. React Query cache is the only persistence. If the app is backgrounded and cache expires, the next foreground pull refreshes from the API.

---

## 7. Project Structure

```
Mobile/FieldPro/
├── app/
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (app)/
│   │   ├── _layout.tsx          ← bottom tab nav
│   │   ├── index.tsx            ← My Jobs
│   │   ├── jobs/
│   │   │   └── [id].tsx         ← Job Detail
│   │   └── more.tsx
│   └── _layout.tsx              ← root layout (auth gate, query client, theme)
├── components/
│   ├── jobs/
│   │   ├── JobCard.tsx
│   │   ├── CheckInStrip.tsx
│   │   └── TaskList.tsx
│   └── ui/
│       ├── StatusBadge.tsx
│       └── LoadingState.tsx
├── hooks/
│   ├── use-work-orders.ts
│   └── use-tasks.ts
├── lib/
│   └── api.ts                   ← Axios instance, interceptors, SecureStore auth
├── stores/
│   └── auth-store.ts            ← Zustand (user, token state)
├── types/
│   └── index.ts                 ← mirrors FieldPro web types
├── app.json                     ← Expo config
├── eas.json                     ← EAS Build profiles (dev, preview, production)
├── .env.example
├── docker-compose.yml           ← optional: run backend locally against mobile
└── package.json
```

---

## 8. CI/CD

```
GitHub Actions:
  on: push to main / PR

  jobs:
    type-check:   npx tsc --noEmit
    lint:         npx expo lint
    test:         jest

  on: push to main (after passing checks)
    eas-build:    eas build --platform android --profile preview
                  (generates .apk / AAB for testing)

  on: tag vX.Y.Z
    eas-submit:   eas submit --platform android  (Play Store)
```

OTA updates via EAS Update for JS-only changes (no native rebuild needed). Native rebuilds only when `app.json`, native modules, or SDK version changes.

---

## 9. Trade-off Analysis

| Decision | Alternative | Why we chose this |
|---|---|---|
| Expo managed | Bare RN | Managed removes native build complexity; we can eject later if needed |
| Expo Router | React Navigation | File-based routing matches Next.js patterns; deep linking free |
| NativeWind | React Native Paper | Tailwind utility classes = zero new mental model for someone already on Tailwind |
| TanStack Query | SWR / Apollo | Same library as web; hooks can be near-copy |
| SecureStore | AsyncStorage | AsyncStorage is unencrypted; tokens need SecureStore |
| Online-only MVP | Offline-first | Offline sync is a significant architecture addition; validate the app first |

**What I'd revisit as the app grows:**
- **Offline-first** — once field workers report connectivity issues on job sites, add WatermelonDB or MMKV + a write queue
- **Push notifications** — needs EAS Push or FCM; blocked on the ARQ background worker (same Tier 1 blocker as the web backend)
- **Shared type package** — when types diverge between web and mobile, extract `@fieldpro/types` as a workspace package

---

## 10. Open Problems

1. **Backend: `?client=mobile` login param** — small change needed before auth works on mobile
2. **Refresh token in body** — need to verify the backend's refresh endpoint accepts the token in the request body (not just via cookie)
3. **Geofence enforcement** — currently soft (distance stored, never rejected); decide if mobile enforces hard check-in rejection
4. **EAS account setup** — needs an Expo account linked to the GitHub repo before CI builds work
5. **Android signing keystore** — needed for Play Store; generate early and store in GitHub Secrets
