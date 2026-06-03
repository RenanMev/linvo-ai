# Data Model: Detalhe de Contato com IA

## Entities

### Customer

Extende o contato existente.

| Field | Type | Required | Notes |
|---|---|---|---|
| isStarred | boolean | yes | Default `false`; usado para ordenar e destacar contato. |
| favoriteFieldsJson | json | yes | Array com ate 2 valores de `CustomerFavoriteField`. |

### CustomerAiThread

Uma memoria de IA por contato.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Identidade da thread. |
| userId | uuid | yes | Isolamento por usuario. |
| customerId | uuid | yes | Unico; cascade quando contato e apagado. |
| summary | text | no | Resumo duravel em pt-BR. |
| messageCountSinceSummary | int | yes | Reinicia apos atualizar resumo. |
| createdAt | timestamptz | yes | Criacao. |
| updatedAt | timestamptz | yes | Ultima alteracao. |

### CustomerAiMessage

Historico recente do chat.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Identidade da mensagem. |
| threadId | uuid | yes | FK para `CustomerAiThread`. |
| role | enum | yes | `user` ou `assistant`. |
| content | text | yes | Texto integral da pergunta/resposta. |
| status | enum | yes | `completed`, `streaming`, `interrupted`, `error`. |
| sequence | int | yes | Ordem monotona dentro da thread. |
| createdAt | timestamptz | yes | Criacao. |
| updatedAt | timestamptz | yes | Ultima alteracao. |

## Relationships

- `User` 1:N `CustomerAiThread`.
- `Customer` 1:1 `CustomerAiThread`.
- `CustomerAiThread` 1:N `CustomerAiMessage`.

## Validation Rules

- `favoriteFieldsJson` aceita no maximo 2 campos validos e remove duplicatas.
- Dados de caso favoritos usam o caso mais recente.
- A thread e criada sob demanda no primeiro carregamento/envio de chat.
- Depois de salvar uma mensagem nova, manter apenas as ultimas 50 mensagens por thread.
- Resumo e atualizado a cada 10 mensagens completas desde o ultimo resumo.
