# Contract: Customer Detail API

## GET /assist/customers?domain=

Lista contatos do usuario autenticado. Quando `domain` for informado, retorna apenas contatos do dominio normalizado.

### Response 200

```json
{
  "status": "ok",
  "domain": "painel.nvoip.com.br",
  "customers": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "displayName": "Renan Devs",
      "domain": "painel.nvoip.com.br",
      "lastSeenAt": "2026-06-03T12:00:00.000Z",
      "maskedIdentifiers": { "protocol": "10703030" },
      "cases": [],
      "isStarred": true,
      "favoriteFields": ["protocol", "phone"]
    }
  ]
}
```

## GET /assist/customers/:customerId

Retorna detalhe fresco do contato.

### Response 200

```json
{
  "status": "ok",
  "customer": {
    "id": "11111111-1111-4111-8111-111111111111",
    "displayName": "Renan Devs",
    "domain": "painel.nvoip.com.br",
    "lastSeenAt": "2026-06-03T12:00:00.000Z",
    "maskedIdentifiers": { "phone": "(55) *****-3122" },
    "cases": [],
    "notes": "Cliente prefere WhatsApp.",
    "isStarred": false,
    "favoriteFields": ["phone", "email"]
  }
}
```

## POST /assist/customers/update

Extende o contrato existente.

### Request

```json
{
  "customerId": "11111111-1111-4111-8111-111111111111",
  "displayName": "Renan Devs",
  "isStarred": true,
  "favoriteFields": ["protocol", "caseStatus"],
  "maskedIdentifiers": {
    "phone": "(55) *****-3122"
  },
  "notes": "Cliente prefere WhatsApp."
}
```

### Response 200

Retorna o contato atualizado e a lista recente, mantendo o contrato atual.
