# FieldPro Mobile — Claude Context File

FieldPro Mobile is the React Native field worker app for the FieldPro platform. It targets the `Employee` role — field workers who need to view their assigned jobs, check in/out of job sites via GPS, and complete tasks. The backend is the existing FieldPro FastAPI service; this repo is the mobile client only.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and configure API URL
cp .env.example .env
# Android emulator → EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
# Physical device on LAN → EXPO_PUBLIC_API_URL=http://<your-machine-ip>:8000

# 3. Start the dev server
npm start
# Press 'a' for Android emulator, scan QR with Expo Go for physical device
```

**Demo login (Employee role)**

| Email | Password |
|-------|----------|
| carlos@demo.fieldpro.app | Employee123! |

> **Backend dependency:** The FieldPro FastAPI backend must be running locally.
> See the [FieldPro repo](../fieldpro) for setup. Also see the **Backend Dependency** section
> below for a required one-time change before auth works on mobile.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.74 + Expo SDK 51 (managed workflow) |
| Language | TypeScript (strict) |
| Routing | Expo Router v3 (file-based, typed routes) |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| HTTP client | Axios |
| Token storage | Expo SecureStore (encrypted keychain) |
| GPS | Expo Location |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| CI/CD | GitHub Actions + EAS Build |
| Build profiles | `development` (dev client APK), `preview` (internal APK), `production` (AAB) |

---

## Project Structure

```
fieldpro-mobile/
├── app/
│   ├── _layout.tsx              # Root layout — QueryClient, SafeArea, auth gate
│   ├── (auth)/
│   │   └── login.tsx            # Login screen
│   └── (app)/
│       ├── _layout.tsx          # Bottom tab navigator (Jobs, More)
│       ├── index.tsx            # My Jobs list
│       ├── jobs/
│       │   └── [id].tsx         # Job detail — info, check-in strip, task list
│       └── more.tsx             # Profile + logout
├── components/
│   ├── jobs/
│   │   ├── CheckInStrip.tsx     # GPS check-in / check-out bar
│   │   └── TaskList.tsx         # Task rows — complete, skip, undo
│   └── ui/
│       └── StatusBadge.tsx      # Work order status pill
├── hooks/
│   └── use-work-orders.ts       # All TanStack Query hooks for work orders + tasks
├── lib/
│   └── api.ts                   # Axios instance, SecureStore auth, interceptors, API fns
├── stores/
│   └── auth-store.ts            # Zustand — user, tokens, login, logout, hydrate
├── types/
│   └── index.ts                 # Shared types (mirrors FieldPro web types/index.ts)
├── .github/
│   └── workflows/
│       └── ci.yml               # Type-check, lint, test, EAS preview build on main
├── app.json                     # Expo config — bundle IDs, permissions, plugins
├── eas.json                     # EAS build profiles (development, preview, production)
├── tailwind.config.js           # NativeWind / Tailwind config + brand colors
├── babel.config.js
├── tsconfig.json
└── .env.example
```

---

## Key Patterns

### Auth — SecureStore instead of cookies

The web frontend uses `httpOnly` cookies for the refresh token. React Native has no browser cookie jar, so both tokens live in **Expo SecureStore**.

```
ACCESS_TOKEN_KEY  = "fieldpro_access_token"
REFRESH_TOKEN_KEY = "fieldpro_refresh_token"
```

Token helpers are in `lib/api.ts` → `tokenStorage`. Never access SecureStore directly outside this module.

On app launch, `auth-store.ts` → `hydrate()` reads the access token, calls `GET /auth/me`, and sets the user. If the token is missing or expired it clears storage and routes to login.

### Axios interceptors

`lib/api.ts` wires two interceptors:

1. **Request** — attaches `Authorization: Bearer <token>` from SecureStore on every call.
2. **Response** — on 401, queues in-flight requests, attempts a token refresh via `POST /auth/refresh` (body: `{ refresh_token }`), replays the queue on success, clears storage and routes to login on failure.

All API surface is exposed through named modules — `authApi`, `workOrdersApi`, `tasksApi`. Do **not** call `axios` directly from screens or hooks; go through these modules so the interceptors fire.

### TanStack Query hooks

All data fetching lives in `hooks/`. Pattern mirrors the FieldPro web frontend:

```ts
export const workOrderKeys = {
  all:    () => ["work-orders"],
  lists:  () => [...workOrderKeys.all(), "list"],
  list:   (filters) => [...workOrderKeys.lists(), filters],
  detail: (id) => [...workOrderKeys.all(), "detail", id],
};
```

After any mutation (check-in, check-out, task update), **always invalidate both** the detail key and the lists key:

```ts
onSuccess: (updated) => {
  queryClient.setQueryData(workOrderKeys.detail(id), updated);   // immediate
  queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() }); // background
},
```

Detail queries use `placeholderData` to seed from the list cache while the full fetch runs — navigation feels instant.

### Navigation

Expo Router file-based routing. The root `_layout.tsx` owns the auth gate — it calls `hydrate()` on mount and watches `isAuthenticated` + `isLoading` to redirect:
- Not authenticated → `/(auth)/login`
- Authenticated + in auth group → `/(app)`

The `jobs/[id]` route is hidden from the tab bar (`href: null`) and navigated to programmatically via `router.push`.

### Styling (NativeWind)

Use Tailwind utility classes via `className` prop. Custom design tokens are in `tailwind.config.js`:

```
bg-surface        → #0f172a  (page background)
bg-surface-card   → #1e293b  (card / sheet background)
bg-surface-muted  → #334155  (subtle fills)
brand-400/500/600 → sky blue ramp
```

For dynamic colors (e.g. status badge fills) that can't be expressed as a static class, use inline `style={{ backgroundColor: "#..." }}` — don't fight NativeWind for runtime values.

### GPS / Location

`expo-location` is used only in `jobs/[id].tsx` during check-in and check-out. Always request `requestForegroundPermissionsAsync()` before each call — do not assume permission persists. The permission prompt text is configured in `app.json` → `plugins`.

Coordinates are posted to the backend as `{ latitude, longitude }`. The backend computes `distance_meters` from the job site and stores it. For MVP, this is informational only — check-in is never rejected based on distance (geofence hard-enforcement is a future item).

### TypeScript types

`types/index.ts` mirrors `frontend/src/types/index.ts` in the FieldPro web repo. When the backend schema gains a new field, update **both** files. Future plan: extract `@fieldpro/types` as a shared workspace package to eliminate the manual sync.

---

## Backend Dependency — Required Change Before Auth Works

The FieldPro backend's `POST /auth/login` currently returns the refresh token only as an `httpOnly` cookie — React Native can't read it.

**Required change:** Add a `?client=mobile` query parameter. When present, include `refresh_token` in the JSON response body (in addition to the cookie). Web behavior is unchanged.

```python
# backend/app/api/v1/auth.py  — login endpoint
@router.post("/login")
async def login(
    credentials: LoginRequest,
    client: str | None = Query(default=None),  # "mobile" → include token in body
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    ...
    response.set_cookie("refresh_token", refresh_token, httponly=True, ...)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        **({"refresh_token": refresh_token} if client == "mobile" else {}),
    }
```

Also verify that `POST /auth/refresh` accepts `refresh_token` in the request **body** (not only via cookie) — the mobile interceptor sends it there.

---

## Known Issues / Gotchas

| Issue | Detail |
|-------|--------|
| Auth broken until backend patched | `?client=mobile` login param not yet implemented in FieldPro backend — refresh token never reaches SecureStore |
| Android emulator API URL | Must be `10.0.2.2:8000`, not `localhost:8000` — emulator NAT doesn't resolve the host machine as localhost |
| NativeWind + Expo Router hot reload | Occasionally requires `expo start --clear` after changing `tailwind.config.js` |
| `lucide-react-native` bundle size | All icons are imported as named exports — keep imports specific, never `import * from 'lucide-react-native'` |
| EAS project ID placeholder | `app.json` → `extra.eas.projectId` is `"YOUR_EAS_PROJECT_ID"` — must be replaced after running `eas build:configure` |
| Android signing not configured | No keystore yet — EAS Build will prompt during first production build; store the keystore in EAS Secrets, not in the repo |

---

## Open Work

### Must-do before first build
| # | Item |
|---|------|
| 1 | Patch FieldPro backend login endpoint (`?client=mobile`) |
| 2 | Run `eas build:configure` and fill `projectId` in `app.json` |
| 3 | Add `EXPO_TOKEN` secret to GitHub repo (Settings → Secrets) for CI builds |
| 4 | Add placeholder app icon and splash assets to `assets/` |

### Short-term
| # | Item |
|---|------|
| 5 | OpenAPI → TypeScript type-gen pipeline (eliminates manual `types/index.ts` sync) |
| 6 | Unit tests for `use-work-orders.ts` hooks and `api.ts` token refresh logic |
| 7 | Error boundary at root layout level |
| 8 | Geofence hard-enforcement on check-in (soft warning is currently informational only) |

### Future
| # | Item |
|---|------|
| 9 | Push notifications (requires ARQ worker in FieldPro backend + EAS Push or FCM) |
| 10 | Offline-first sync (WatermelonDB or MMKV + write queue) |
| 11 | iOS build + App Store submission |
| 12 | Manager/Admin screens (crew assignment, work order creation) |

---

## Build Scope

### ✅ Scaffolded (ready to run once backend is patched)

| Area | Status |
|------|--------|
| Expo Router v3 + TypeScript strict | ✅ |
| Auth gate (login, hydrate, logout) | ✅ |
| SecureStore token storage + Axios interceptors | ✅ |
| My Jobs list screen (in-progress + scheduled) | ✅ |
| Job Detail screen (info, time, description) | ✅ |
| GPS check-in / check-out | ✅ |
| Task list — complete, skip (with reason), undo | ✅ |
| StatusBadge, CheckInStrip, TaskList components | ✅ |
| NativeWind styling + brand tokens | ✅ |
| TanStack Query hooks + cache invalidation | ✅ |
| GitHub Actions CI (type-check, lint, test, EAS build) | ✅ |
| EAS build profiles (dev, preview, production) | ✅ |

### ❌ Not Yet Built

| Item | Notes |
|------|-------|
| App icon + splash screen assets | Placeholder required for EAS build |
| Push notifications | Blocked on FieldPro backend ARQ worker |
| Offline-first | Post-MVP |
| Manager / Admin views | Out of scope for field worker MVP |
| iOS submission | Needs Mac or EAS remote build + Apple dev account |

---

## Useful Commands

```bash
# Start dev server
npm start

# Start directly on Android emulator
npm run android

# Type-check (no emit)
npm run type-check

# Lint
npm run lint

# Run tests
npm test

# EAS: configure project (first time — fills projectId in app.json)
eas build:configure

# EAS: build preview APK for internal testing
eas build --platform android --profile preview

# EAS: build production AAB for Play Store
eas build --platform android --profile production

# EAS: submit to Play Store (requires google-services-key.json)
eas submit --platform android

# Clear Metro cache (when hot reload behaves strangely)
expo start --clear
```
