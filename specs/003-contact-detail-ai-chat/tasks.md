# Tasks: Detalhe de Contato com IA

## Phase 1: Contracts and Tests

- [x] T001 Atualizar contratos de cliente em `packages/shared/src/contracts/customer.ts`.
- [x] T002 Criar contratos de chat em `packages/shared/src/contracts/customer-chat.ts`.
- [x] T003 Atualizar testes de contratos em `packages/shared/tests/contracts.test.ts`.
- [x] T004 Criar migracao Prisma para favoritos e chat.

## Phase 2: Backend

- [x] T005 Estender `CustomerRepository` para listar por estrela, detalhe, favoritos e estrela.
- [x] T006 Criar repositorio/servico de chat com thread, mensagens, retencao e clear.
- [x] T007 Estender `AiClientService` com chat streaming e resumo.
- [x] T008 Adicionar rotas `GET /assist/customers/:customerId`, `GET/POST /assist/customers/:customerId/chat`.
- [x] T009 Adicionar testes de backend para detalhe, update, chat e streaming.

## Phase 3: Extension

- [x] T010 Detectar dominio ativo na sidepanel e carregar contatos por dominio.
- [x] T011 Recriar `ContactsView` como lista com busca e favoritos.
- [x] T012 Criar `ContactDetailView` com abas, edicao, estrela, apagar e favoritos.
- [x] T013 Implementar fetch streaming direto no client da extension.
- [x] T014 Atualizar testes de UI e orchestrator.

## Phase 4: Validation

- [x] T015 Rodar `pnpm --filter @linvo-ai/shared test`.
- [x] T016 Rodar `pnpm --filter @linvo-ai/server test`.
- [x] T017 Rodar `pnpm --filter @linvo-ai/extension test`.
- [x] T018 Rodar typecheck/build relevante.
