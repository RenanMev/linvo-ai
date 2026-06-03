# Contract: Customer Chat API

## GET /assist/customers/:customerId/chat

Carrega a memoria de IA do contato.

### Response 200

```json
{
  "status": "ok",
  "customerId": "11111111-1111-4111-8111-111111111111",
  "summary": "Cliente prefere WhatsApp e costuma perguntar sobre suporte tecnico.",
  "messages": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "role": "user",
      "content": "O que preciso lembrar deste cliente?",
      "status": "completed",
      "sequence": 1,
      "createdAt": "2026-06-03T12:00:00.000Z"
    }
  ]
}
```

## POST /assist/customers/:customerId/chat/stream

Envia pergunta e recebe resposta por SSE.

### Request

```json
{
  "message": "O que devo lembrar antes de atender este cliente?"
}
```

### SSE Events

```text
event: start
data: {"messageId":"44444444-4444-4444-8444-444444444444"}

event: delta
data: {"text":"Ele prefere"}

event: complete
data: {"message":{"id":"44444444-4444-4444-8444-444444444444","role":"assistant","content":"Ele prefere WhatsApp.","status":"completed","sequence":2,"createdAt":"2026-06-03T12:00:02.000Z"},"summary":"Cliente prefere WhatsApp."}
```

### Error event

```text
event: error
data: {"message":"Nao foi possivel responder agora."}
```

## POST /assist/customers/:customerId/chat/clear

Limpa mensagens e resumo do cliente.

### Response 200

```json
{
  "status": "ok",
  "customerId": "11111111-1111-4111-8111-111111111111",
  "deletedMessages": 12
}
```
