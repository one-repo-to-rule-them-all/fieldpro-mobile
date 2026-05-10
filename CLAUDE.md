# FieldPro Mobile — Claude Context File

FieldPro Mobile is the React Native field worker app for the FieldPro platform. It targets the `Employee` role — field workers who view assigned jobs, check in/out via GPS, and complete task checklists. The backend is the FieldPro FastAPI service; this repo is the mobile client only.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and configure API URL
cp .env.example .env
# Android emulator → EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
# Physical device on LAN → EXPO_PUBLIC_API_URL=http://<your-machine-ip>:8000

# 3. Start the dev server — always use --clear after .env changes
REACT_NATIVE_PACKAGER_HOSTNAME=<your-lan-ip> npx expo start --host lan --clear
# Press 'a' for Android emulator, scan QR with Expo Go for physical device
```

**Demo login (Employee role)**

| Email | Password |
|-------|----------|
| carlos@demo.fieldpro.app | Employee123! |

> **Backend dependency:** The FieldPro FastAPI backend must be running locally. See the [fieldpro repo](../fieldpro). `ALLOWED_HOSTS=*` is already set in `docker-compose.override.yml` for LAN device access.

> **Windows Firewall:** Inbound rules required for port 8000 (backend) and 8081 (Metro bundler) when testing on a physical device.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK (managed workflow) |
| Language | TypeScript (strict) |
| Routing | Expo Router v3 (file-based, typed routes) |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| HTTP client | Axios |
| Token storage | Expo SecureStore (encrypted keychain) |
| GPS | Expo Location |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| CI/CD | GitHub Actions + EAS Build |
| Build profiles | `development`, `preview` (internal APK), `production` (AAB) |

---

## Project Structure

```
app/
  _layout.tsx              <- Root layout — QueryClient, SafeArea, auth gate
  (auth)/login.tsx         <- Login screen
  (app)/
    _layout.tsx            <- Bottom tab navigator (My Jobs, More)
    index.tsx              <- My Jobs list (in-progress + scheduled)
    jobs/[id].tsx          <- Job detail — info, check-in strip, task list
    more.tsx               <- Profile + logout
components/
  jobs/
    CheckInStrip.tsx       <- GPS check-in/out bar
    TaskList.tsx           <- Task rows — complete, skip (with reason), undo
  ui/
    StatusBadge.tsx        <- Work order status pill
hooks/
  use-work-orders.ts       <- All TanStack Query hooks for work orders + tasks
lib/
  api.ts                   <- Axios instance, SecureStore auth, interceptors, API fns
stores/
  auth-store.ts            <- Zustand — user, tokens, login, logout, hydrate
types/
  index.ts                 <- Shared types (mirrors FieldPro web types/index.ts)
.github/workflows/ci.yml   <- Type-check, lint, test, EAS preview build on main
app.json                   <- Expo config — bundle IDs, permissions, plugins
eas.json                   <- EAS build profiles
tailwind.config.js         <- NativeWind / Tailwind config + brand tokens
```

---

## Key Patterns

### Auth — SecureStore instead of cookies

The web frontend uses `httpOnly` cookies. React Native has no cookie jar, so both tokens live in **Expo SecureStore**.

```
ACCESS_TOKEN_KEY  = "fieldpro_access_token"
REFRESH_TOKEN_KEY = "fieldpro_refresh_token"
```

Token helpers are in `lib/api.ts` -> `tokenStorage`. Never access SecureStore directly outside this module.

On app launch, `auth-store.ts` -> `hydrate()` reads the access token, calls `GET /auth/me`, and sets the user. If missing or expired it clears storage and routes to login.

### Axios interceptors

`lib/api.ts` wires two interceptors:

1. **Request** — attaches `Authorization: Bearer <token>` from SecureStore on every call.
2. **Response** — on 401, queues in-flight requests, refreshes via `POST /auth/refresh` (body: `{ refresh_token }`), replays queue on success, clears storage on failure.

All API surface is exposed through named modules — `authApi`, `workOrdersApi`, `tasksApi`. Never call `axios` directly from screens or hooks; go through these so the interceptors fire.

### All API endpoints use trailing slashes

FastAPI redirects requests without trailing slashes (307). React Native's HTTP client strips the `Authorization` header on redirect. All endpoints in `lib/api.ts` therefore include trailing slashes:

```ts
api.get("/work-orders/")   // correct
api.get("/work-orders")    // wrong — 307 drops auth header
```

### TanStack Query hooks

All data fetching lives in `hooks/use-work-orders.ts`. Pattern:

```ts
export const workOrderKeys = {
  all:    () => ["work-orders"],
  lists:  () => [...workOrderKeys.all(), "list"],
  list:   (filters) => [...workOrderKeys.lists(), filters],
  detail: (id) => [...workOrderKeys.all(), "detail", id],
};
```

After any mutation (check-in, check-out, task update), always invalidate **both** the detail key and the lists key:

```ts
onSuccess: (updated) => {
  queryClient.setQueryData(workOrderKeys.detail(id), updated);
  queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
},
```

### Placeholder data and optional fields

`useWorkOrder` seeds the detail screen from the list cache while the full fetch runs. List endpoint responses do **not** embed `tasks` or `check_ins` — those only come back on the detail endpoint. Therefore:

- `WorkOrder.tasks` is `Task[] | undefined` (optional in `types/index.ts`)
- `WorkOrder.check_ins` is `CheckIn[] | undefined` (optional in `types/index.ts`)
- All access uses optional chaining (`?.`) in screens and hooks

Never assume `tasks` or `check_ins` are present on a `WorkOrder` that came from the list cache or placeholder data.

### Navigation

Expo Router file-based routing. The root `_layout.tsx` owns the auth gate — calls `hydrate()` on mount, watches `isAuthenticated` + `isLoading`:
- Not authenticated -> `/(auth)/login`
- Authenticated + in auth group -> `/(app)`

The `jobs/[id]` route is hidden from the tab bar (`href: null`) and navigated to programmatically via `router.push`.

### Styling (NativeWind)

Use Tailwind utility classes via `className` prop. Custom tokens in `tailwind.config.js`:

```
bg-surface        -> #0f172a  (page background)
bg-surface-card   -> #1e293b  (card/sheet background)
bg-surface-muted  -> #334155  (subtle fills)
brand-400/500/600 -> sky blue ramp
```

For dynamic colors use inline `style={{ backgroundColor: "#..." }}` — don't fight NativeWind for runtime values.

### GPS / Location

`expo-location` is used only in `jobs/[id].tsx`. Always call `requestForegroundPermissionsAsync()` before each use — do not assume permission persists. Coordinates are posted as `{ latitude, longitude }`. The backend computes and stores `distance_meters`. Check-in is currently never rejected based on distance (geofence hard enforcement is TODO #7).

### TypeScript types

`types/index.ts` mirrors `frontend/src/types/index.ts` in the FieldPro web repo. When the backend schema gains a new field, update **both** files. Future: extract `@fieldpro/types` as a shared workspace package.

---

## Backend Contract

### Authentication

- `POST /api/v1/auth/login?client=mobile` — `?client=mobile` tells the backend to include `refresh_token` in the JSON body. Without it the mobile client cannot read the refresh token.
- `POST /api/v1/auth/refresh` — accepts `refresh_token` in the request **body**.
- `POST /api/v1/auth/logout` — mobile sends `{ refresh_token }` in body for server-side revocation.

### Work orders

- `GET /api/v1/work-orders/` — `status` is a repeatable param (`?status=scheduled&status=in_progress`). List response does **not** embed `tasks` or `check_ins`.
- `GET /api/v1/work-orders/{id}/` — full detail response including `tasks` and `check_ins`.
- `POST /api/v1/work-orders/{id}/checkin/` — body: `{ latitude, longitude }`
- `POST /api/v1/work-orders/{id}/checkout/` — body: `{ latitude, longitude }`
- `PATCH /api/v1/work-orders/{id}/tasks/{taskId}/` — body: `{ status, skip_reason? }`

### TrustedHostMiddleware

`ALLOWED_HOSTS=*` is set in `docker-compose.override.yml`. The backend's `Settings` class declares `ALLOWED_HOSTS` as a Pydantic field so the env var is actually read. Do not remove this declaration from `config.py`.

---

## Known Issues Fixed (do not re-introduce)

| Issue | Root cause | Fix |
|-------|-----------|-----|
| Refresh token never reached SecureStore | Backend returned token only in cookie | `?client=mobile` param; backend now includes token in JSON body |
| LAN IP blocked | `TrustedHostMiddleware` fallback; `ALLOWED_HOSTS` not declared in `Settings` | Declared field; `ALLOWED_HOSTS=*` in override |
| `status` list filter rejected | Backend param was single enum | `list[WorkOrderStatus]` + `.in_()` |
| Check-in/out 404 | Mobile URLs had hyphens (`/check-in`) | Backend routes use no hyphens (`/checkin`) |
| Task update 404 | `PATCH /tasks/{id}` doesn't exist | Correct: `PATCH /work-orders/{wo}/tasks/{id}` |
| Auth header dropped on redirect | FastAPI 307 on missing trailing slash | All endpoints in `api.ts` include trailing slash |
| Logout didn't revoke server-side | Sent empty body | Now sends `{ refresh_token }` in body |
| Login error generic | Backend wraps as `{ error: { message, code } }` | `login.tsx` reads `err?.response?.data?.error?.message` |
| `tasks.length` crash on list screen | List response has no `tasks` | `tasks?.length` optional chain |
| `check_ins.find()` crash on detail | Placeholder data has no `check_ins` | `check_ins?.find()` optional chain |
| `tasks.length` crash on detail | Same placeholder data issue | `tasks?.length` optional chain |
| `useUpdateTask` crash on optimistic update | `old.tasks.map` when old is list-cache placeholder | `old.tasks?.map` |
| Type mismatch | `tasks: Task[]` required but absent from list responses | `tasks?: Task[]` and `check_ins?: CheckIn[]` |
| `parseISO(scheduled_date)` crash on detail screen | `scheduled_date` undefined on list-cache placeholder; `parseISO(undefined)` throws | Wrapped date display block in `(workOrder.scheduled_start_time \|\| workOrder.scheduled_date) &&` guard |
| CI test job fails | `jest` exits non-zero with zero test files | `--passWithNoTests` flag |

---

## Open Work

### Must-do before first EAS build

| # | Item |
|---|------|
| 1 | Add app icon + splash screen assets to `assets/` |
| 2 | Run `eas build:configure` — fills `projectId` in `app.json` |
| 3 | Add `EXPO_TOKEN` secret to GitHub repo (Settings -> Secrets) |

### Short-term

| # | Item |
|---|------|
| 4 | OpenAPI -> TypeScript type-gen pipeline (eliminates manual `types/index.ts` sync) |
| 5 | Unit tests for `use-work-orders.ts` hooks and `api.ts` token refresh logic |
| 6 | Error boundary at root layout level |
| 7 | Geofence hard enforcement on check-in |

### Future

| # | Item |
|---|------|
| 8 | Push notifications (requires ARQ worker in backend + FCM) |
| 9 | Offline-first sync (WatermelonDB or MMKV + write queue) |
| 10 | iOS build + App Store submission |
| 11 | Photo uploads on tasks |
| 12 | Android signing keystore (EAS Secrets, not in repo) |

---

## Build Scope

### Verified end-to-end on device

| Area | Status |
|------|--------|
| Expo Router v3 + TypeScript strict | Done |
| Auth gate (login, hydrate, logout) | Done |
| SecureStore token storage + Axios interceptors | Done |
| Token refresh with in-flight request queue | Done |
| My Jobs list screen (in-progress + scheduled) | Done |
| Job Detail screen (info, time, description) | Done |
| GPS check-in / check-out | Done |
| Task list — complete, skip (with reason), undo | Done |
| StatusBadge, CheckInStrip, TaskList components | Done |
| NativeWind styling + brand tokens | Done |
| TanStack Query hooks + cache invalidation | Done |
| Placeholder data seeding from list cache | Done |
| GitHub Actions CI (type-check, lint, test, EAS build) | Done |
| EAS build profiles (dev, preview, production) | Done |
| Physical device LAN access | Done |

### Not yet built

| Item | Notes |
|------|-------|
| App icon + splash screen assets | Required for EAS build |
| Push notifications | Blocked on FieldPro backend ARQ worker |
| Offline-first sync | Post-MVP |
| Photo uploads | Backend model exists; mobile UI not built |
| iOS submission | Needs Mac or EAS remote build + Apple dev account |

---

## Useful Commands

```bash
# Dev server (always --clear after .env change)
REACT_NATIVE_PACKAGER_HOSTNAME=<lan-ip> npx expo start --host lan --clear

# Android emulator
npm run android

# Type-check
npm run type-check

# Lint
npm run lint

# Tests
npm test

# EAS: configure (first time)
eas build:configure

# EAS: preview APK
eas build --platform android --profile preview

# EAS: production AAB
eas build --platform android --profile production

# EAS: submit
eas submit --platform android

# Clear Metro cache
expo start --clear
```
