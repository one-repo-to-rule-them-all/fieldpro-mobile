---
type: problems
date: 2026-05-09
project: FieldPro Mobile
---

## Goal
A production-grade React Native field worker app for FieldPro — Android-first, iOS eventually — backed by the existing FastAPI backend.

## Why
FieldPro's field worker web surface (`(field)/` route group) is functional but not native. Field workers need a real mobile app that's fast, store-deployable, and eventually offline-capable. This is also the first real mobile app in the Mobile workspace — a learning vehicle with a well-defined API contract already in place.

## Tangible Outcomes
- A working React Native app (Expo) that field workers can install on Android
- Login, My Jobs list, Job Detail, GPS check-in/out, and task completion all functional
- EAS Build CI/CD pipeline producing a .APK on every merge to main
- Code quality: TypeScript strict, linted, jest coverage on hooks and utilities
- Documented enough that the next session can pick up and keep building

## Open Problems
1. Backend needs a `?client=mobile` login param to return refresh_token in the JSON body (not just as a cookie) — small change, must be done before auth works
2. Verify the refresh endpoint accepts `refresh_token` in the request body, not only via cookie
3. Decide whether geofence hard-enforcement is in or out of MVP scope
4. EAS account + Android signing keystore need to be set up before CI builds run
5. Shared types strategy — copy `types/index.ts` from web for now, extract `@fieldpro/types` workspace package later
