# Contract: Client Identification API

## POST /assist/client-identification

Identifies the active customer/case from a manually selected CRM area.

Requires `Authorization: Bearer <accessToken>`.

## Request

```json
{
  "requestId": "uuid-or-client-id",
  "url": "https://crm.example.com/tickets/123",
  "pageTitle": "CRM - Atendimento",
  "capturedAt": "2026-05-21T17:30:00.000Z",
  "manualSelection": {
    "source": "user",
    "selectedAt": "2026-05-21T17:29:59.000Z",
    "label": "Cliente: Maria Silva - TK-1048",
    "textExcerpt": "Maria Silva TK-1048 Problema com boleto...",
    "boundingBox": {
      "top": 120,
      "left": 320,
      "width": 620,
      "height": 260
    }
  },
  "selectedText": "Maria Silva TK-1048 Problema com boleto...",
  "surroundingText": "Fila aberta Maria Silva TK-1048 Ultima mensagem...",
  "domSummary": {
    "selectedTag": "section",
    "selectedRole": "region",
    "ariaLabel": "Conversa ativa",
    "nearbyHeadings": ["Atendimento", "Maria Silva"],
    "candidateLabels": ["Maria Silva", "Bruno Costa"]
  },
  "screenshotDataUrl": "data:image/jpeg;base64,..."
}
```

## Request Rules

- `requestId` is required and must be unique per user for idempotency.
- `url` and `pageTitle` are required.
- `manualSelection.textExcerpt` is required for MVP identification.
- `selectedText` must be a compact text excerpt, not raw HTML.
- `surroundingText` and `domSummary` are optional but strongly recommended.
- `screenshotDataUrl` is optional and must be size-limited.
- Server derives `domain` from `url`; client-provided domain is ignored if present.

## Success 200: Saved

```json
{
  "status": "ok",
  "requestId": "uuid-or-client-id",
  "saved": true,
  "confidence": 0.91,
  "activeClient": {
    "id": "uuid",
    "displayName": "Maria Silva",
    "maskedIdentifiers": {
      "phone": "(11) *****-1234"
    }
  },
  "case": {
    "id": "uuid",
    "protocol": "TK-1048",
    "subject": "Problema com boleto",
    "status": "Aberto"
  },
  "evidence": [
    "Nome visivel no cabecalho selecionado",
    "Protocolo TK-1048 visivel na area selecionada"
  ],
  "warnings": [],
  "recentCustomers": [
    {
      "id": "uuid",
      "displayName": "Maria Silva",
      "lastSeenAt": "2026-05-21T17:30:01.000Z",
      "cases": [
        {
          "id": "uuid",
          "protocol": "TK-1048",
          "subject": "Problema com boleto",
          "lastSeenAt": "2026-05-21T17:30:01.000Z"
        }
      ]
    }
  ]
}
```

## Success 200: Not Saved

```json
{
  "status": "ok",
  "requestId": "uuid-or-client-id",
  "saved": false,
  "confidence": 0.44,
  "activeClient": null,
  "case": null,
  "evidence": [],
  "warnings": [
    "Nao foi possivel confirmar qual cliente esta ativo."
  ],
  "recentCustomers": []
}
```

## Error Response

```json
{
  "status": "error",
  "requestId": "uuid-or-client-id",
  "errorCode": "IDENTIFICATION_FAILED",
  "message": "Nao foi possivel identificar o cliente agora."
}
```

## Error Codes

- `INVALID_REQUEST`: schema validation failed.
- `AUTH_REQUIRED`: missing or expired access token.
- `AI_UNAVAILABLE`: server AI key/config missing.
- `IDENTIFICATION_FAILED`: AI request failed, timed out or returned invalid JSON.
- `RATE_LIMITED`: per-user temporary rate limit.
- `INTERNAL_ERROR`: unexpected server error.

## AI Output Contract

The AI response must be parsed into this logical shape before persistence:

```json
{
  "activeClient": {
    "name": "Maria Silva",
    "identifiers": {
      "phone": "11999991234",
      "email": null,
      "document": null
    }
  },
  "case": {
    "protocol": "TK-1048",
    "subject": "Problema com boleto",
    "status": "Aberto"
  },
  "confidence": 0.91,
  "evidence": [
    "Nome e protocolo aparecem na area selecionada."
  ],
  "warnings": []
}
```

## Prompt Requirements

- Explain that Linvo AI is identifying the customer currently being attended.
- Treat manual selection as the strongest focus signal.
- Use surrounding text and screenshot only to support the selected target.
- Ignore extension UI labels and CRM navigation text.
- Return only verifiable facts.
- If uncertain, lower confidence and add warning instead of inventing.
- Return strict JSON without markdown.

## Persistence Rules

- If `confidence < IDENTIFICATION_CONFIDENCE_MIN`, return `saved: false`.
- If a customer identity hash already exists for `(userId, domain)`, update `lastSeenAt`.
- If a case hash already exists for `(userId, domain)`, update `lastSeenAt`.
- If customer is new and confidence is sufficient, create `Customer`.
- If case is new and confidence is sufficient, create `CustomerCase`.
- Always create an `IdentificationRun` without screenshot data.

## GET /assist/customers?domain=crm.example.com

Lists recent customers/cases for the authenticated user and domain.

### Success 200

```json
{
  "status": "ok",
  "domain": "crm.example.com",
  "customers": [
    {
      "id": "uuid",
      "displayName": "Maria Silva",
      "maskedIdentifiers": {
        "phone": "(11) *****-1234"
      },
      "lastSeenAt": "2026-05-21T17:30:01.000Z",
      "cases": [
        {
          "id": "uuid",
          "protocol": "TK-1048",
          "subject": "Problema com boleto",
          "status": "Aberto",
          "lastSeenAt": "2026-05-21T17:30:01.000Z"
        }
      ]
    }
  ]
}
```
