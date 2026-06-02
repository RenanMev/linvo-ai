# Quickstart: Linvo AI MVP - Identificacao de Cliente

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop
- Chrome stable
- OpenAI-compatible API key or configured provider key for the backend

## Environment

Create `apps/server/.env` from `.env.example` after scaffold:

```env
PORT=8791
DATABASE_URL=replace_with-local-server-db
JWT_ACCESS_SECRET=replace-with-local-secret
JWT_REFRESH_SECRET=replace-with-local-secret
PASSWORD_PEPPER=replace-with-local-secret
IDENTITY_HASH_SECRET=replace-with-local-secret
AI_API_KEY=replace-with-provider-key
AI_MODEL=gpt-4.1-mini
IDENTIFICATION_CONFIDENCE_MIN=0.72
```

## Setup

```powershell
cd "C:\Users\Renan\Documents\Extesão Chrome\linvo ai"
pnpm install
docker compose up -d postgres
pnpm --filter @linvo-ai/server prisma:migrate dev
pnpm dev
```

## Load Extension

1. Build extension with `pnpm --filter @linvo-ai/extension build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load unpacked extension from `apps/extension/dist`.
5. Open the extension sidepanel and register/login.

## Validation Scenarios

### Scenario A: Login works

1. Open sidepanel.
2. Register a new user.
3. Close and reopen sidepanel.

Expected:

- Session restores without entering password again.
- `GET /auth/me` succeeds.

### Scenario B: Identify selected customer

1. Open `tests/e2e/crm-fixture.html` or the local fixture server.
2. Login in sidepanel.
3. Click floating `Identificar cliente`.
4. Select the visible card/conversation for `Cliente A`.

Expected:

- Toast shows `Identificando cliente...` then `Cliente identificado.`
- Sidepanel shows `Cliente A`.
- Backend creates one `Customer`, one `CustomerCase` and one `IdentificationRun`.

### Scenario C: Do not confuse background contact

1. Use fixture with `Cliente A` active and `Cliente B` in sidebar.
2. Select the active `Cliente A` conversation.

Expected:

- Response marks `Cliente A` as active.
- No record is created for `Cliente B`.

### Scenario D: Cancel selection

1. Click `Identificar cliente`.
2. Press `Escape`.

Expected:

- Overlay disappears.
- Toast shows cancellation.
- No network request is sent to `/assist/client-identification`.

### Scenario E: Low confidence

1. Use fixture with generic text and no reliable customer identifiers.
2. Select the generic container.

Expected:

- API returns `saved: false`.
- Sidepanel shows `Cliente nao confirmado`.
- Database does not create `Customer` or `CustomerCase`.
- `IdentificationRun` may be stored with `saved: false` and no screenshot.

## Test Commands

```powershell
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Expected Results

- All shared contract tests pass.
- Auth e2e tests pass.
- Client identification e2e tests pass with Postgres.
- Playwright extension test proves picker, payload and sidepanel update.
- No persisted row contains `data:image/`.
