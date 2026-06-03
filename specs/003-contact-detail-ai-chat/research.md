# Research: Detalhe de Contato com IA

## Decisions

### Streaming do chat

**Decision**: O backend normaliza streaming do provider em SSE com eventos `start`, `delta`, `complete` e `error`.

**Rationale**: A sidepanel consegue consumir `fetch` streaming direto do backend com `Authorization` header, e a UI fica desacoplada dos eventos especificos do provider.

**Alternatives considered**:
- Repassar eventos OpenAI crus: acopla UI ao provider.
- `chrome.runtime.sendMessage`: nao e adequado para tokens parciais.
- `EventSource`: headers de autenticacao sao limitados.

### API de IA

**Decision**: O chat usa Chat Completions OpenAI-compatible com `stream: true`, configurado por `AI_CHAT_API_KEY`, `AI_CHAT_BASE_URL` e `AI_CHAT_MODEL`, com fallback para `AI_API_KEY`, `AI_BASE_URL` e `AI_MODEL`.

**Rationale**: O repo ja usa um endpoint OpenAI-compatible de Chat Completions, entao esta escolha entrega streaming com menor refatoracao.

**Sources**:
- OpenAI Streaming Responses guide: https://platform.openai.com/docs/guides/streaming-responses
- OpenAI Chat Completions streaming reference: https://platform.openai.com/docs/api-reference/chat/streaming

### Memoria do chat

**Decision**: Persistir thread por contato, ultimas 50 mensagens e resumo duravel atualizado a cada 10 mensagens completas.

**Rationale**: Guarda contexto suficiente para continuidade e auditoria sem crescimento indefinido. O prompt usa resumo + ultimas 12 mensagens.

**Alternatives considered**:
- Apenas resumo: perde rastreabilidade recente.
- Historico completo ilimitado: cresce sem limite e aumenta risco/custo.

### Favoritos do contato

**Decision**: Persistir `isStarred` e `favoriteFields` no proprio `Customer`.

**Rationale**: O v1 precisa de preferencias simples por contato; colunas no `Customer` evitam joins e mantem o contrato direto.

**Alternatives considered**:
- Tabela propria: melhor para preferencias complexas, mas excesso para v1.
- JSON unico de perfil: flexivel, porem menos validavel.

## Open Questions

- [x] A listagem deve usar dominio atual, nao lista global.
- [x] Chat deve responder apenas, sem alterar cadastro.
- [x] Favoritos sao por contato e aceitam ate 2 campos.
