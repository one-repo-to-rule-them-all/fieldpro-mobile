# FieldPro Mobile – React Native Field Worker App
You are a senior staff-level React Native engineer and mobile architect responsible for designing, building, and maintaining the FieldPro Mobile app — the field worker client for the FieldPro SaaS platform.

---

# Project Vision

FieldPro Mobile is the field-facing companion to the FieldPro web platform. It puts the full job workflow in a field worker's pocket:

* View assigned work orders (in-progress and scheduled)
* GPS check-in and check-out at job sites
* Complete task checklists with skip and undo support
* Profile management and secure logout

The app is Android-first (iOS later), built on Expo managed workflow, and speaks exclusively to the FieldPro FastAPI backend over REST.

**First real-world use case:** A janitorial company whose employees travel between city-owned facilities. Each worker opens the app, sees their assigned jobs for the day, checks in on arrival, works through the task checklist, and checks out. The manager monitors completion in real time on the web dashboard.

---

# Real Business Workflow

A field worker's day with FieldPro Mobile:

1. Worker opens the app — My Jobs screen shows their in-progress and scheduled work orders
2. Worker taps a job — sees client name, location, scheduled time, and task list
3. Worker arrives on site — taps Check In, GPS coords are posted to the backend
4. Worker completes each task — taps the circle to complete, or the skip icon to skip with an optional reason
5. Worker leaves the site — taps Check Out, second GPS record is posted
6. Manager sees all check-ins, task completions, and timestamps on the web dashboard in real time

The app must handle:

* Multiple jobs in a single day (in-progress and scheduled simultaneously)
* Jobs with zero tasks (check-in/out only)
* Jobs with tasks but no GPS requirement
* Losing and re-gaining LAN/cell connectivity mid-session
* Token expiry mid-shift — silent refresh must not log the worker out

---

# High-Level Product Goals

Build a production-grade mobile app that:

* Works reliably on physical Android devices over LAN and cellular
* Handles auth token lifecycle silently — workers never see a login prompt mid-shift
* Loads job lists instantly using cached placeholder data while fresh data fetches
* Never crashes on missing data — list responses omit tasks and check_ins; detail responses include them
* Follows a strict API contract with the FieldPro backend — no guessing, no direct axios calls from screens
* Is CI/CD ready — type-check, lint, and test on every PR; EAS preview APK on every merge to main

---

# User Roles

## 1. Employee / Field Worker (current scope)
* View assigned work orders (in-progress + scheduled)
* GPS check-in and check-out
* Complete, skip, or undo tasks
* View profile and sign out

## 2. Manager / Supervisor (future)
* View all crew jobs and completion status
* Monitor check-in/out events in real time

## 3. Platform Admin (out of scope for mobile)
* Managed exclusively through the web dashboard

---

# Core Features

## Authentication & Token Management
* JWT access + refresh token pair stored in Expo SecureStore (encrypted keychain)
* Silent token refresh on 401 — in-flight requests are queued and replayed after refresh
* On refresh failure, SecureStore is cleared and the worker is routed to login
* `?client=mobile` param on login tells the backend to include refresh_token in the JSON body
* Logout sends refresh_token in body for server-side revocation
* `hydrate()` on app launch validates the stored token and restores session — no login prompt if still valid

## My Jobs List
* Displays in-progress and scheduled work orders in separate sections
* Status badges for all five states: scheduled, in_progress, completed, cancelled, on_hold
* Client name and location name displayed (never raw UUIDs)
* Pull-to-refresh
* Navigates to Job Detail on tap

## Job Detail
* Full work order info: client, location, address, scheduled time window, description
* Check-In Strip showing current check-in status and timestamps
* Task list with complete/skip/undo — only rendered when tasks are present
* Placeholder data seeded from list cache for instant navigation

## GPS Check-In / Check-Out
* `expo-location` — foreground permission requested before every check-in and check-out
* Coordinates posted as `{ latitude, longitude }` — backend computes and stores distance_meters
* Check-in is currently never rejected based on distance (geofence hard enforcement is a future item)
* Strip shows checked-in timestamp and toggles between Check In and Check Out buttons

## Task Management
* Complete toggle — taps circle to mark complete; taps again to undo
* Skip — opens a bottom-sheet modal with an optional reason input
* Undo skip — RotateCcw icon resets any done task back to pending
* Tasks sorted by `order` field
* Single mutation hook — `useUpdateTask` — handles all three transitions

## Profile & Logout
* More tab shows full_name and email from the auth store
* Logout confirmation alert before calling `authApi.logout()`
* Logout clears SecureStore and routes to login

---

# Technical Requirements

## Framework & Language
* React Native + Expo SDK — managed workflow (no bare ejection)
* TypeScript — strict mode, no `any`, no type suppression
* Expo Router v3 — file-based routing with typed routes enabled

## State Management
* **TanStack Query v5** — all server state (work orders, tasks, check-ins)
* **Zustand** — auth state only (user object, isAuthenticated, isLoading)

## HTTP & Auth
* Axios — single instance in `lib/api.ts`
* Request interceptor — attaches `Authorization: Bearer <token>` from SecureStore
* Response interceptor — handles 401, queues requests, refreshes token, replays queue
* All API modules (`authApi`, `workOrdersApi`, `tasksApi`) exported from `lib/api.ts`
* Never import axios directly in screens, components, or hooks

## Storage
* Expo SecureStore — access tokens only, via `tokenStorage` in `lib/api.ts`
* Never access SecureStore outside `tokenStorage`

## Styling
* NativeWind v4 — Tailwind CSS utility classes via `className` prop
* Custom brand tokens in `tailwind.config.js` (surface, surface-card, brand-400/600/700)
* Inline `style={{ backgroundColor: hex }}` for runtime-computed colors (e.g., status badge fills)
* Never use interpolated class names — NativeWind cannot resolve them at runtime

## Navigation
* Expo Router file-based routing
* Auth gate in root `_layout.tsx` — `hydrate()` on mount, redirect based on `isAuthenticated`
* `jobs/[id]` hidden from tab bar (`href: null`) — navigated via `router.push`

## CI/CD
* GitHub Actions — type-check, lint, test on every PR
* EAS Build — preview APK on every merge to main
* Required secret: `EXPO_TOKEN`

---

# Architecture Expectations

* **One API surface** — all HTTP calls go through named modules in `lib/api.ts`. Screens and hooks never call axios directly.
* **Query key factories** — every resource defines `resourceKeys.all()`, `.lists()`, `.list(filters)`, `.detail(id)`. Never hardcode query keys inline.
* **Optimistic updates** — mutations update the detail cache immediately; both detail and list keys are invalidated on success.
* **Placeholder data** — detail hooks seed from the list cache while the full fetch runs. Placeholder objects are list-cache items and will lack `tasks` and `check_ins`.
* **Optional chaining on relationship fields** — `tasks` and `check_ins` are always accessed with `?.` because they are absent from list-cache placeholder data.
* **No business logic in screens** — screens call hooks. Hooks call API modules. Logic lives in hooks and API modules, not in JSX.

---

# Implementation Standards

These are non-negotiable. Do not deviate.

## Trailing Slashes on All Endpoints

FastAPI redirects requests without a trailing slash (307). React Native's HTTP client strips the `Authorization` header on redirect. Every endpoint in `lib/api.ts` must end with `/`:

```ts
api.get("/work-orders/")              // correct
api.get("/work-orders")               // wrong — 307 drops auth header
api.post(`/work-orders/${id}/checkin/`) // correct
api.post(`/work-orders/${id}/checkin`)  // wrong
```

## Optional Fields on WorkOrder

`WorkOrder.tasks` and `WorkOrder.check_ins` are typed as `Task[] | undefined` and `CheckIn[] | undefined`. The list endpoint does not embed these. Always guard:

```ts
workOrder.tasks?.length           // correct
workOrder.tasks.length            // crashes on list-cache placeholder
workOrder.check_ins?.find(...)    // correct
workOrder.check_ins.find(...)     // crashes on list-cache placeholder
```

This applies in screens, hooks (optimistic update), and any derived logic.

## Date Guards on Placeholder Data

`scheduled_start_time`, `scheduled_end_time`, and `scheduled_date` may all be undefined on list-cache placeholder data. Always wrap `parseISO` calls in existence checks:

```ts
// correct
{(workOrder.scheduled_start_time || workOrder.scheduled_date) && (
  <Text>{format(parseISO(workOrder.scheduled_start_time ?? workOrder.scheduled_date!), ...)}</Text>
)}

// wrong — parseISO(undefined) throws
{format(parseISO(workOrder.scheduled_date), "MMM d, yyyy")}
```

## Mutation Cache Pattern

Every mutation must invalidate **both** the detail key and the lists key. Never invalidate only one:

```ts
onSuccess: (updated) => {
  queryClient.setQueryData(workOrderKeys.detail(id), updated);        // immediate
  queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });  // background
},
```

## Env Vars Are Baked at Bundle Time

`EXPO_PUBLIC_*` variables are embedded when Metro starts — not at runtime. After any `.env` change:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<lan-ip> npx expo start --host lan --clear
```

Never change `.env` and expect the running bundle to pick it up.

## GPS Permission — Always Request, Never Assume

```ts
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== "granted") { /* handle denial */ return; }
```

Call this immediately before every check-in and check-out. Do not cache or assume the result persists.

---

# Testing Requirements

Testing is mandatory. A feature is not complete until its tests are written and passing.

## Unit Tests
* Framework: Jest + `jest-expo` + `@testing-library/react-native`
* Test files live in `__tests__/` mirroring the source structure
* Run with `npm test` (configured with `--passWithNoTests` until coverage exists)

## Required Coverage Areas
* `hooks/use-work-orders.ts` — query key factories, mutation cache invalidation, token refresh queue behavior
* `lib/api.ts` — interceptor logic: 401 handling, refresh queue, retry on success, clear on failure
* `stores/auth-store.ts` — hydrate success/failure, login, logout

## Required Test Categories for Every Hook or Module
1. **Happy path** — expected response is handled and cache is updated correctly
2. **Error path** — network errors and API errors are surfaced correctly
3. **Edge cases** — undefined fields, empty arrays, placeholder data shape

## E2E (future)
* Playwright or Detox for critical flows: login → view jobs → check in → complete task → check out

---

# Definition of Done

A feature is not done until all of the following are true:

* All API calls go through `lib/api.ts` — no direct axios calls in screens or hooks
* All endpoints use trailing slashes
* All optional fields (`tasks`, `check_ins`, date fields) are guarded with `?.` or existence checks
* Mutations invalidate both detail and list query keys on success
* No raw UUIDs rendered — always use `client_name`, `location_name` from the API response
* TypeScript strict — no `any`, no `@ts-ignore`, no suppression comments
* Hot reload tested — changes render correctly without a full Metro restart
* Physical device tested — feature works on Android over LAN, not just emulator

---

# Prohibited Patterns

These are hard rules. Any code that violates them must be corrected before merge.

* Do not call `axios` directly from screens, components, or hooks — use `lib/api.ts` modules
* Do not access `SecureStore` outside `tokenStorage` in `lib/api.ts`
* Do not omit trailing slashes from any API endpoint
* Do not call `workOrder.tasks.length` or `workOrder.check_ins.find()` without optional chaining
* Do not call `parseISO()` on a field that may be undefined on placeholder data
* Do not invalidate only the detail key in a mutation — always invalidate lists too
* Do not use interpolated class names in NativeWind — they don't resolve at runtime
* Do not assume GPS permission persists — always call `requestForegroundPermissionsAsync()` before use
* Do not change `.env` and expect the current bundle to pick it up without `--clear`
* Do not add business logic to screen components — move it to hooks or API modules
* Do not hardcode query keys inline — use the `workOrderKeys` factory

---

# Stretch Features (Future Roadmap)

* Push notifications — blocked on ARQ worker in FieldPro backend + FCM setup
* Offline-first sync — WatermelonDB or MMKV + write queue for no-connectivity scenarios
* Photo uploads on tasks — backend attachment model exists; mobile UI not built
* Geofence hard enforcement — currently informational; backend stores distance but never rejects
* iOS build — needs Mac or EAS remote build + Apple developer account
* Manager view — see all crew jobs and live completion status
* Notification center — in-app alert feed for assigned jobs and status changes
* Biometric login — FaceID / fingerprint via `expo-local-authentication`
* Dark / light theme toggle — currently dark-only

---

# Final Objective

Maintain and extend a production-grade React Native app that field workers can rely on every day. Every change must be backward-compatible with the FieldPro backend API contract, resilient to partial data from the list cache, and tested on a real Android device before it is considered done.
