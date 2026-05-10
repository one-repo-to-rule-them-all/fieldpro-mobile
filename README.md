# FieldPro Mobile

React Native field worker app for the FieldPro platform — Android-first, iOS eventually.

## Prerequisites

- Node 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`
- Android Studio + emulator, or a physical Android device with Expo Go

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and set your API URL
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL — use 10.0.2.2:8000 for Android emulator
# or your machine's LAN IP for a physical device

# 3. Start the dev server
npm start
# Press 'a' to open on Android emulator
```

## Backend

The FieldPro FastAPI backend must be running. From the fieldpro repo:

```bash
docker compose up -d
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_data.py
```

Demo field worker login: `carlos@demo.fieldpro.app` / `Employee123!`

> **Note:** One backend change is required before auth works on mobile — the
> `POST /api/v1/auth/login` endpoint needs a `?client=mobile` query param that
> returns `refresh_token` in the JSON response body (not only as a cookie).
> See the system design doc for details.

## Project Structure

```
app/
  (auth)/login.tsx        ← Login screen
  (app)/
    index.tsx             ← My Jobs list
    jobs/[id].tsx         ← Job detail, check-in, tasks
    more.tsx              ← Profile + logout
components/
  jobs/
    CheckInStrip.tsx      ← GPS check-in/out bar
    TaskList.tsx          ← Task rows with complete/skip/undo
  ui/
    StatusBadge.tsx
hooks/
  use-work-orders.ts      ← TanStack Query hooks
lib/
  api.ts                  ← Axios client + SecureStore auth
stores/
  auth-store.ts           ← Zustand auth state
types/
  index.ts                ← Mirrors FieldPro web types
```

## CI/CD

GitHub Actions runs type-check, lint, and tests on every PR. On merge to `main`,
an EAS preview APK is built automatically.

**Required secrets:**
- `EXPO_TOKEN` — from [expo.dev](https://expo.dev) account settings

## EAS Setup (first time)

```bash
eas login
eas build:configure   # links project to EAS, fills projectId in app.json
```

Then update `app.json` → `extra.eas.projectId` with the generated ID.
