# Implementation Plan: Linvo AI MVP - Identificacao de Cliente

## Context

**Spec**: `specs/001-linvo-ai-mvp-client-identification/spec.md`
**Branch**: `001-linvo-ai-mvp-client-identification`
**Inputs**: Nova pasta `linvo ai`; MVP Chrome extension + NestJS backend; login email/senha; IA via chave de servidor; persistencia em Postgres; foco em CRM generico com selecao assistida.

## Summary

Criar uma base nova e pequena, mas preparada para crescer: contratos compartilhados em `packages/shared`, extensao MV3 em `apps/extension` e API NestJS em `apps/server`. O fluxo principal sera test-first: contratos, auth, picker assistido, captura de contexto, endpoint de identificacao, persistencia e UI da sidepanel.

## Constitutional Gates

- [x] Library-first boundary identified: contratos Zod, normalizacao de identidade e prompts ficam em `packages/shared`.
- [x] Core behavior observable through API contracts, UI states and e2e CRM fake.
- [x] Contract/integration tests planned before implementation.
- [x] Initial structure uses <=3 projects/services: extension, server, shared.
- [x] Framework features used directly: NestJS modules/guards/pipes, Prisma, Chrome MV3 APIs.
- [x] Realistic integration environment preferred: Postgres via Docker and Playwright for extension flow.

### Complexity Tracking

| Exception | Reason | Requirement Link |
|---|---|---|
| NestJS has more boilerplate than Fastify | Explicit user preference and better module boundaries for auth + assist | FR-002, FR-005, FR-015 |

## Technical Decisions

| Decision | Rationale | Requirement Link |
|---|---|---|
| Use `pnpm` workspace | Keeps extension, server and shared contracts in one base | FR-001, FR-002 |
| Use NestJS modules `AuthModule`, `AssistModule`, `AiModule` | Clear ownership for login, identification and AI calls | FR-004, FR-015, FR-017 |
| Use Prisma + Postgres | Durable backend-first persistence and migrations | FR-021, FR-022, FR-023 |
| Use Zod contracts in shared package | Runtime validation at HTTP and extension boundaries | FR-016 |
| Put AI key only in server env | Prevents secret exposure in extension | FR-017 |
| Use manual selection as primary target signal | Makes generic CRM identification safer | FR-008, FR-018 |
| Persist only above confidence threshold | Avoids wrong customer/case records | FR-021, SC-003 |
| Do not persist screenshots | Limits sensitive data retention | NFR-002, SC-005 |
| Hash canonical identifiers | Enables reuse without storing raw sensitive identity | FR-022, NFR-004 |

## Project Structure

```text
linvo ai/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  docker-compose.yml
  .env.example
  apps/
    extension/
      package.json
      public/
        manifest.json
      src/
        background/
          index.ts
          auth-orchestrator.ts
          client-identification-orchestrator.ts
        content/
          index.ts
          client-picker.ts
          context-capture.ts
          floating-action.ts
          toast.ts
        sidepanel/
          index.html
          index.tsx
          app.tsx
          auth-view.tsx
          customer-view.tsx
          recent-customers-view.tsx
        lib/
          api-client.ts
          auth-session.ts
          runtime-messages.ts
        styles/
          globals.css
      tests/
        client-picker.test.ts
        context-capture.test.ts
        runtime-messages.test.ts
    server/
      package.json
      prisma/
        schema.prisma
        migrations/
      src/
        main.ts
        app.module.ts
        config/
          env.schema.ts
        auth/
          auth.module.ts
          auth.controller.ts
          auth.service.ts
          jwt-auth.guard.ts
          password.service.ts
          refresh-token.service.ts
        assist/
          assist.module.ts
          client-identification.controller.ts
          client-identification.service.ts
          identity.service.ts
          customer.repository.ts
        ai/
          ai.module.ts
          ai-client.service.ts
          client-identification.prompt.ts
        prisma/
          prisma.module.ts
          prisma.service.ts
      tests/
        auth.e2e-spec.ts
        client-identification.e2e-spec.ts
        identity.service.spec.ts
    shared/
      package.json
      src/
        index.ts
        contracts/
          auth.ts
          client-identification.ts
          customer.ts
          errors.ts
        identity/
          canonicalize.ts
          mask.ts
        prompts/
          client-identification.ts
        limits.ts
  tests/
    e2e/
      crm-fixture.html
      client-identification.spec.ts
  specs/
    001-linvo-ai-mvp-client-identification/
```

## Data Flow

1. User opens sidepanel and logs in.
2. Sidepanel stores tokens in extension storage through background-owned session helpers.
3. Content script shows floating `Identificar cliente` action on allowed pages.
4. User starts picker and selects a DOM element representing the client base.
5. Content script captures selection text, nearby text, DOM summary, URL, page title and screenshot if available.
6. Content script sends runtime message to background.
7. Background refreshes token if needed and calls `POST /assist/client-identification`.
8. Server validates payload, builds AI prompt and requests structured JSON.
9. Server validates AI output, computes confidence and resolves canonical customer/case identity.
10. Server persists only if confidence is sufficient.
11. Server returns result and recent customer/case summary.
12. Background returns response to content and sidepanel; page shows toast and sidepanel updates state.

## Error Handling

- Invalid request: `400 INVALID_REQUEST`.
- Missing/expired auth without refresh: `401 AUTH_REQUIRED`.
- Forbidden user/session: `403 FORBIDDEN`.
- AI key missing: `503 AI_UNAVAILABLE`.
- AI timeout/invalid JSON: `502 IDENTIFICATION_FAILED`.
- Low confidence: `200 ok` with `saved: false`, warnings and no created customer/case.
- Screenshot unavailable: continue without screenshot and include warning only if it affects confidence.

## Observability

- Every identification request carries `requestId`.
- Server logs request status, user id, domain, duration, AI status and saved/not saved.
- Logs must omit screenshot, raw selected text and raw PII.
- Tests assert that persisted `IdentificationRun` does not contain screenshot data.

## Generated Design Artifacts

- `research.md`: technical decisions and rejected alternatives.
- `data-model.md`: entities, relationships and validation rules.
- `contracts/auth-api.md`: auth endpoints and token behavior.
- `contracts/client-identification-api.md`: identification endpoint and payload shape.
- `contracts/extension-ui-contract.md`: picker, toast, sidepanel and runtime message behavior.
- `quickstart.md`: setup and validation scenarios.
- `tasks.md`: implementation checklist ordered test-first.
