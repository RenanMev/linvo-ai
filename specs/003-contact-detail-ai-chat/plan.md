# Implementation Plan: Detalhe de Contato com IA

## Context

**Spec**: `specs/003-contact-detail-ai-chat/spec.md`
**Branch**: `main`
**Inputs**: Sidepanel React, NestJS, Prisma/PostgreSQL, contratos Zod compartilhados.

## Summary

Adicionar um perfil de contato dentro da sidepanel. A listagem vira apenas navegacao do dominio atual; o detalhe concentra edicao, favoritos e chat com IA. O backend ganha contratos de detalhe e chat, persistencia de preferencias no `Customer`, thread/mensagens para memoria da IA e streaming SSE normalizado.

## Constitutional Gates

- [x] Library-first boundary identified: contratos e helpers de resolucao de favoritos ficam em `packages/shared`.
- [x] Core behavior observable through API/UI contracts.
- [x] Contract/integration tests planned before implementation.
- [x] Initial structure uses existing 3 projects: shared, server, extension.
- [x] Framework features used directly: Nest controllers/services, Prisma, React state.
- [x] Realistic integration preferred: API e extension testadas com contratos reais e fetch stream mockado.

### Complexity Tracking

| Exception | Reason | Requirement Link |
|---|---|---|
| Streaming direto pela sidepanel | Necessario para deltas de resposta com headers de auth | FR-012 |

## Technical Decisions

| Decision | Rationale | Requirement Link |
|---|---|---|
| `Customer.isStarred` e `favoriteFieldsJson` | Preferencias simples por contato sem tabela extra | FR-007 |
| `CustomerAiThread` + `CustomerAiMessage` | Historico limitado e resumo duravel por cliente | FR-010, FR-011 |
| SSE normalizado | UI desacoplada do provider | FR-012 |
| `AI_CHAT_*` com fallback | Chat pode usar provider/modelo proprio sem quebrar dev local | NFR-004 |
| Busca client-side | Lista atual carrega ate 100 contatos por dominio | FR-004 |

## Project Structure

```text
packages/shared/src/contracts/customer.ts
packages/shared/src/contracts/customer-chat.ts
apps/server/prisma/schema.prisma
apps/server/src/assist/customer.repository.ts
apps/server/src/assist/customer-chat.repository.ts
apps/server/src/assist/customer-chat.service.ts
apps/server/src/assist/client-identification.controller.ts
apps/server/src/ai/ai-client.service.ts
apps/extension/src/sidepanel/contacts-view.tsx
apps/extension/src/sidepanel/contact-detail-view.tsx
apps/extension/src/lib/api-client.ts
```

## Generated Design Artifacts

- `research.md`: decisoes de streaming, provider, memoria e favoritos.
- `data-model.md`: entidades Prisma e regras de validacao.
- `contracts/`: APIs de detalhe/chat e contrato de UI.
- `quickstart.md`: cenarios manuais de validacao.
- `tasks.md`: tarefas ordenadas test-first.
