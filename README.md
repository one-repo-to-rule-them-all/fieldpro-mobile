# FieldPro Mobile

React Native field worker app for the FieldPro platform — Android-first, iOS eventually.

Field workers use this app to view their assigned jobs, GPS check-in/out of job sites, and complete task checklists. It targets the `Employee` role and speaks directly to the FieldPro FastAPI backend.

---

## Prerequisites

- Node 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`
- Android Studio + emulator, or a physical Android device with Expo Go
- FieldPro backend running locally (see [fieldpro repo](../fieldpro))

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and set your API URL
cp .env.example .env
# Android emulator → EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
# Physical device on LAN → EXPO_PUBLIC_API_URL=http://<your-machine-ip>:8000

# 3. Start the dev server (use --clear after any .env change)
REACT_NATIVE_PACKAGER_HOSTNAME=<your-lan-ip> npx expo start --host lan --clear

# Press 'a' for Android emulator, scan QR with Expo Go for physical device
```

**Demo login (Employee role)**

| Email | Password |
|-------|----------|
| carlos@demo.fieldpro.app | Employee123! |

---

## Backend

The FieldPro FastAPI backend must be running. From the fieldpro repo:

```bash
docker compose up -d
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_data.py
```

> **Physical device on LAN:** `ALLOWED_HOSTS=*` is set in `docker-compose.override.yml`. Make sure Windows Firewall allows inbound traffic on ports **8000** (backend) and **8081** (Metro bundler).

---

## Project Structure

```
app/
  _layout.tsx              ← Root layout — QueryClient, SafeArea, auth gate
  (auth)/login.tsx         ← Login screen
  (app)/
    _layout.tsx            ← Bottom tab navigator (My Jobs, More)
    index.tsx              ← My Jobs list (in-progress + scheduled)
    jobs/[id].tsx          ← Job detail — info, check-in strip, task list
    more.tsx               ← Profile + logout
components/
  jobs/
    CheckInStrip.tsx       ← GPS check-in/out bar
    TaskList.tsx           ← Task rows — complete, skip (with reason), undo
  ui/
    StatusBadge.tsx        ← Work order status pill
hooks/
  use-work-orders.ts       ← All TanStack Query hooks
lib/
  api.ts                   ← Axios client, SecureStore auth, interceptors, API fns
stores/
  auth-store.ts            ← Zustand — user, login, logout, hydrate
types/
  index.ts                 ← Shared types (mirrors FieldPro web types/index.ts)
.github/workflows/ci.yml   ← Type-check, lint, test, EAS preview build on main
```

---

## Known Issues / Fixed

| Issue | Status |
|-------|--------|
| `?client=mobile` login param — refresh token missing from JSON body | ✅ Fixed in backend |
| `TrustedHostMiddleware` blocking LAN IP from phone | ✅ Fixed — `ALLOWED_HOSTS=*` in dev override + declared in `Settings` class |
| `GET /work-orders` rejected `status` list (single enum only) | ✅ Fixed — backend now accepts `list[WorkOrderStatus]` |
| Check-in/out URL mismatch (`/check-in` vs `/checkin`) | ✅ Fixed in `lib/api.ts` |
| 307 redirect stripping `Authorization` header | ✅ Fixed — trailing slashes on all API endpoints |
| Task update wrong endpoint (`/tasks/{id}` → `/work-orders/{wo}/tasks/{id}`) | ✅ Fixed in `lib/api.ts` + `use-work-orders.ts` |
| Logout not revoking token server-side | ✅ Fixed — now sends `refresh_token` in body |
| Login error always showed generic fallback | ✅ Fixed — reads `error.message` from `{ error: { message, code } }` shape |
| `tasks.length` crash on My Jobs list | ✅ Fixed — list endpoint doesn't embed tasks; guarded with `?.` |
| `check_ins.find()` crash on Job Detail | ✅ Fixed — placeholder data from list cache lacks `check_ins`; guarded with `?.` |
| `tasks.length` crash on Job Detail | ✅ Fixed — same placeholder data issue; guarded with `?.` |
| `useUpdateTask` crash when cache entry lacks `tasks` | ✅ Fixed — `old.tasks?.map` |
| `WorkOrder.tasks` / `check_ins` typed as required but absent from list responses | ✅ Fixed — now `tasks?: Task[]` and `check_ins?: CheckIn[]` |
| `parseISO(scheduled_date)` crash on Job Detail with placeholder data | ✅ Fixed — wrapped date display in guard; `scheduled_date` may be undefined on list-cache placeholder |
| CI test job fails with zero test files | ✅ Fixed — `--passWithNoTests` flag added |

---

## TODO

| # | Priority | Item | Notes |
|---|----------|------|-------|
| 1 | 🔴 Must | App icon + splash screen assets | Required for EAS build — add `icon.png`, `splash.png`, `adaptive-icon.png` to `assets/` |
| 2 | 🔴 Must | `eas build:configure` + fill `projectId` in `app.json` | Run once, then commit |
| 3 | 🔴 Must | Add `EXPO_TOKEN` secret to GitHub repo | Settings → Secrets → Actions |
| 4 | 🟡 Should | OpenAPI → TypeScript type sync | Wire `npx openapi-typescript` into CI; eliminates manual `types/index.ts` sync |
| 5 | 🟡 Should | Unit tests for hooks and token refresh logic | Zero test files currently; coverage gap in `use-work-orders.ts` and `api.ts` interceptors |
| 6 | 🟡 Should | Error boundary at root layout | No crash recovery UI — unhandled errors show red screen with no escape |
| 7 | 🟡 Should | Geofence hard enforcement on check-in | Currently informational — distance stored but check-in never rejected |
| 8 | 🟠 Future | Push notifications | Blocked on ARQ worker in FieldPro backend |
| 9 | 🟠 Future | Offline-first sync | Post-MVP — WatermelonDB or MMKV + write queue |
| 10 | 🟠 Future | iOS build | Needs Mac or EAS remote build + Apple dev account |
| 11 | 🟠 Future | Photo uploads on tasks | Backend attachment model exists; mobile UI not built |
| 12 | 🟠 Future | Android signing keystore | EAS Build will prompt on first production build; store in EAS Secrets |

---

## CI/CD

GitHub Actions runs on every PR and push to `main`:

- **Type-check** — `tsc --noEmit`
- **Lint** — `expo lint`
- **Tests** — `jest --passWithNoTests` (placeholder until test files exist)
- **EAS Preview APK** — built on merge to `main` (requires `EXPO_TOKEN` secret)

**Required secrets:**
- `EXPO_TOKEN` — from [expo.dev](https://expo.dev) account settings (not yet added)

---

## EAS Setup (first time)

```bash
eas login
eas build:configure   # links project to EAS, fills projectId in app.json
```

Then commit the updated `app.json`.

---

## Useful Commands

```bash
# Dev server — always use --clear after .env changes
REACT_NATIVE_PACKAGER_HOSTNAME=<lan-ip> npx expo start --host lan --clear

# Android emulator directly
npm run android

# Type-check
npm run type-check

# Lint
npm run lint

# Tests
npm test

# EAS: build preview APK
eas build --platform android --profile preview

# EAS: build production AAB
eas build --platform android --profile production

# EAS: submit to Play Store
eas submit --platform android
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK (managed workflow) |
| Language | TypeScript (strict) |
| Routing | Expo Router v3 (file-based) |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| HTTP client | Axios |
| Token storage | Expo SecureStore |
| GPS | Expo Location |
| Styling | NativeWind v4 (Tailwind CSS) |
| CI/CD | GitHub Actions + EAS Build |
