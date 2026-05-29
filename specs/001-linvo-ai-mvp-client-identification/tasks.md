# Tasks: Linvo AI MVP - Identificacao de Cliente

## Phase 1: Scaffold

- [x] T001 Create `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example` and `docker-compose.yml` at project root. Completion: `pnpm install` can resolve workspace packages.
- [x] T002 Create `packages/shared` with TypeScript build/test config and empty exports. Completion: `pnpm --filter @linvo-ai/shared typecheck` runs.
- [x] T003 Create `apps/server` NestJS skeleton with health endpoint. Completion: `GET /health` returns ok in local dev.
- [x] T004 Create `apps/extension` MV3 skeleton with background, content script and sidepanel entrypoints. Completion: extension build emits loadable `dist/manifest.json`.
- [x] T005 [P] Create `tests/e2e/crm-fixture.html` with two visible contacts and one active conversation. Completion: fixture can be opened in browser.

## Phase 2: Shared Contracts First

- [x] T006 Define auth schemas in `packages/shared/src/contracts/auth.ts`. Completion: schemas cover register, login, refresh, me and auth errors.
- [x] T007 Define client/customer schemas in `packages/shared/src/contracts/customer.ts`. Completion: schemas cover customer summaries and case summaries.
- [x] T008 Define identification schemas in `packages/shared/src/contracts/client-identification.ts`. Completion: request, success, low-confidence and error responses are represented.
- [x] T009 Define shared limits/errors in `packages/shared/src/limits.ts` and `packages/shared/src/contracts/errors.ts`. Completion: extension/server import same constants.
- [x] T010 Write shared contract tests in `packages/shared/tests/*.test.ts`. Completion: invalid payloads fail before implementation code exists.

## Phase 3: Backend Auth

- [x] T011 Add Prisma schema for `User` and `RefreshSession` in `apps/server/prisma/schema.prisma`. Completion: migration creates auth tables.
- [ ] T012 Write auth e2e tests in `apps/server/tests/auth.e2e-spec.ts`. Completion: tests cover register, login, refresh, logout and `/auth/me`.
- [x] T013 Implement `AuthModule`, `AuthController`, `AuthService`, `PasswordService` and `RefreshTokenService`. Completion: auth tests pass.
- [x] T014 Implement JWT guard and current-user decorator. Completion: protected test route rejects missing/expired token.

## Phase 4: Backend Identification Core

- [x] T015 Add Prisma models `Customer`, `CustomerCase` and `IdentificationRun`. Completion: migration creates unique constraints and indexes.
- [x] T016 [P] Implement identity helpers in `packages/shared/src/identity/canonicalize.ts` and `packages/shared/src/identity/mask.ts`. Completion: unit tests prove phone/email/document normalization and masking.
- [ ] T017 Write `identity.service.spec.ts` for backend upsert behavior. Completion: same canonical identity reuses existing customer/case.
- [ ] T018 Write `client-identification.e2e-spec.ts` for saved, low-confidence, invalid request and auth-required cases. Completion: tests fail until endpoint exists.
- [x] T019 Implement `AiModule` and `AiClientService` with timeout and JSON parsing. Completion: service can be mocked in tests.
- [x] T020 Implement client-identification prompt builder in `apps/server/src/ai/client-identification.prompt.ts`. Completion: prompt includes manual selection as strongest signal.
- [x] T021 Implement `AssistModule`, `ClientIdentificationController` and `ClientIdentificationService`. Completion: endpoint validates payload and returns contract-shaped response.
- [x] T022 Implement persistence repository in `apps/server/src/assist/customer.repository.ts`. Completion: save/reuse behavior passes tests.
- [x] T023 Implement `GET /assist/customers?domain=`. Completion: returns recent customers/cases for authenticated user only.
- [ ] T024 Add log redaction and screenshot non-persistence assertions. Completion: tests prove `data:image/` is not persisted.

## Phase 5: Extension Auth and API Client

- [x] T025 Define runtime message types in `apps/extension/src/lib/runtime-messages.ts`. Completion: content/background/sidepanel share typed messages.
- [x] T026 Implement background auth session store in `apps/extension/src/lib/auth-session.ts`. Completion: stores tokens, clears on logout, never stores password.
- [x] T027 Implement API client in `apps/extension/src/lib/api-client.ts`. Completion: attaches bearer token and parses shared schemas.
- [x] T028 Implement background auth orchestrator. Completion: login/register/refresh/logout messages work from sidepanel.
- [x] T029 Implement sidepanel auth view. Completion: user can register/login/logout from sidepanel.
- [x] T030 Implement sidepanel session restore. Completion: reopening sidepanel calls `/auth/me` or refreshes token.

## Phase 6: Extension Picker and Context Capture

- [ ] T031 Write picker unit tests in `apps/extension/tests/client-picker.test.ts`. Completion: tests cover hover, valid click, invalid target and `Escape`.
- [ ] T032 Write context capture tests in `apps/extension/tests/context-capture.test.ts`. Completion: tests cover text compaction, DOM summary and size limits.
- [x] T033 Implement floating action in `apps/extension/src/content/floating-action.ts`. Completion: button starts picker and avoids host UI overlap.
- [x] T034 Implement picker overlay in `apps/extension/src/content/client-picker.ts`. Completion: overlay cleans up after success/cancel/error.
- [x] T035 Implement context capture in `apps/extension/src/content/context-capture.ts`. Completion: produces contract-compatible payload without raw HTML.
- [x] T036 Implement screenshot capture request through background. Completion: failure is non-fatal and payload omits screenshot.
- [x] T037 Implement toast states in `apps/extension/src/content/toast.ts`. Completion: all contract copy states render.

## Phase 7: Extension Identification Flow

- [x] T038 Implement background client-identification orchestrator. Completion: refreshes token if needed and calls backend once per request.
- [x] T039 Wire content script action to picker, capture and background message. Completion: manual selection creates one request.
- [x] T040 Implement sidepanel customer/result view. Completion: shows current result, warnings, evidence and recent customers.
- [ ] T041 Implement recent customers loading for current domain. Completion: sidepanel calls `GET /assist/customers?domain=`.
- [x] T042 Handle auth-required errors across content and sidepanel. Completion: stale session prompts login and blocks protected action.

## Phase 8: E2E and Polish

- [ ] T043 Write Playwright e2e for login + identify selected fixture customer. Completion: selecting Cliente A saves only Cliente A.
- [ ] T044 Write Playwright e2e for picker cancellation. Completion: `Escape` sends no network request.
- [ ] T045 Write Playwright e2e for low-confidence fixture. Completion: response is unsaved and database has no customer/case.
- [x] T046 Run `pnpm typecheck`. Completion: all packages pass.
- [x] T047 Run `pnpm test`. Completion: shared, server and extension tests pass.
- [ ] T048 Run `pnpm test:e2e`. Completion: extension flow passes in Chrome.
- [ ] T049 Update SDD if implementation reveals requirement drift. Completion: spec/plan/tasks remain source of truth.

## Parallel Groups

- Group A: T002, T003, T004 and T005 can run after T001 because they create separate workspace areas.
- Group B: T006, T007, T008 and T009 can run in parallel because they touch separate shared contract files.
- Group C: T016 can run while backend auth T011-T014 is being implemented.
- Group D: T031 and T032 can run while backend identification T018-T023 is being implemented.
- Group E: T043, T044 and T045 can be drafted after T005 and completed after T038-T042.
