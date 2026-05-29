# Contract: Extension UI and Runtime Messages

## Surfaces

- Content script floating action: starts identification flow on the active page.
- Content script picker overlay: captures manual target.
- Content script toast: shows short status/error messages.
- Background service worker: owns authenticated API calls.
- Sidepanel: login/register/session restore and customer result/recent list.

## Content Picker States

| State | Trigger | User-visible behavior |
|---|---|---|
| `idle` | Page loaded or previous flow completed | Floating action is available. |
| `selecting` | User clicks `Identificar cliente` | Overlay appears; hovered element is highlighted. |
| `capturing` | User clicks valid target | Overlay locks briefly while context is captured. |
| `identifying` | Request sent to background | Toast says identification is running. |
| `identified` | API returns saved or unsaved result | Toast summarizes result; sidepanel state updates. |
| `cancelled` | User presses `Escape` | Overlay removed; no API call. |
| `error` | Capture/API/auth fails | Toast shows short pt-BR error. |

## Picker Rules

- Overlay root id: `linvo-ai-picker-root`.
- Overlay must use high z-index and pointer event handling only while selecting.
- Hover highlight follows the deepest meaningful element under pointer.
- Elements inside Linvo AI overlay/action/toast are ignored.
- Click on invalid target keeps picker active and shows local hint.
- `Escape` removes overlay and event listeners.
- Picker cleanup must run after success, cancel, error or extension context invalidation.

## ManualSelection Payload

```json
{
  "source": "user",
  "selectedAt": "2026-05-21T17:29:59.000Z",
  "label": "Maria Silva - TK-1048",
  "textExcerpt": "Maria Silva TK-1048 Problema com boleto...",
  "boundingBox": {
    "top": 120,
    "left": 320,
    "width": 620,
    "height": 260
  }
}
```

## Runtime Message: identify client

Content script sends to background:

```json
{
  "type": "assist/client-identification.request",
  "request": {
    "requestId": "uuid",
    "url": "https://crm.example.com/tickets/123",
    "pageTitle": "CRM - Atendimento",
    "capturedAt": "2026-05-21T17:30:00.000Z",
    "manualSelection": {},
    "selectedText": "compact text",
    "surroundingText": "compact surrounding text",
    "domSummary": {},
    "screenshotDataUrl": "data:image/jpeg;base64,..."
  }
}
```

Background responds:

```json
{
  "ok": true,
  "response": {
    "status": "ok",
    "requestId": "uuid",
    "saved": true,
    "confidence": 0.91,
    "activeClient": {},
    "case": {},
    "evidence": [],
    "warnings": []
  }
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "errorCode": "AUTH_REQUIRED",
    "message": "Entre novamente para identificar clientes."
  }
}
```

## Background Auth Behavior

- If access token is valid, call API directly.
- If access token expired and refresh token exists, refresh once and retry.
- If refresh fails, clear session and return `AUTH_REQUIRED`.
- Background never receives or stores user password.

## Sidepanel Views

### Logged out

Must show:
- Login form.
- Register switch/link.
- Backend connection error if API unavailable.

### Logged in empty state

Must show:
- Current user email.
- Message that no client is identified yet.
- Recent customers list empty state.

### Identification result

Must show:
- Customer display name or "Cliente nao confirmado".
- Case/protocol when available.
- Subject/status when available.
- Confidence indicator.
- Warnings.
- Evidence snippets.
- Recent customers/cases for current domain.

### Auth expired

Must show:
- Clear prompt to login again.
- No stale action that calls protected API.

## Toast Copy

- Selecting: `Selecione o cliente base na pagina.`
- Identifying: `Identificando cliente...`
- Saved: `Cliente identificado.`
- Not saved: `Cliente nao confirmado.`
- Cancelled: `Identificacao cancelada.`
- Auth required: `Entre novamente para identificar clientes.`
- Generic error: `Nao foi possivel identificar o cliente agora.`

## Accessibility Requirements

- Picker must cancel with `Escape`.
- Toast should use live-region semantics where practical.
- Sidepanel forms must have labels and keyboard-submit behavior.
- Focus must not remain trapped after picker cleanup.
