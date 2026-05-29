# Contract: Auth API

## Base URL

Local default: `http://127.0.0.1:8791`

All responses are JSON.

## Shared Types

### AuthUser

```json
{
  "id": "uuid",
  "email": "attendant@example.com",
  "name": "Renan"
}
```

### AuthTokens

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-token",
  "expiresIn": 900
}
```

### AuthError

```json
{
  "status": "error",
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Email ou senha invalidos.",
  "requestId": "optional-request-id"
}
```

## POST /auth/register

Creates a user and returns an authenticated session.

### Request

```json
{
  "email": "attendant@example.com",
  "password": "minimum-8-chars",
  "name": "Renan"
}
```

### Success 201

```json
{
  "status": "ok",
  "user": {
    "id": "uuid",
    "email": "attendant@example.com",
    "name": "Renan"
  },
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "opaque-token",
    "expiresIn": 900
  }
}
```

### Errors

- `400 INVALID_REQUEST`: malformed email, weak password or invalid body.
- `409 EMAIL_ALREADY_EXISTS`: user already exists.

## POST /auth/login

Authenticates an existing user.

### Request

```json
{
  "email": "attendant@example.com",
  "password": "minimum-8-chars"
}
```

### Success 200

```json
{
  "status": "ok",
  "user": {
    "id": "uuid",
    "email": "attendant@example.com",
    "name": "Renan"
  },
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "opaque-token",
    "expiresIn": 900
  }
}
```

### Errors

- `400 INVALID_REQUEST`: invalid body.
- `401 INVALID_CREDENTIALS`: email/password mismatch.
- `403 USER_DISABLED`: user exists but cannot login.

## POST /auth/refresh

Rotates refresh token and returns a new access token.

### Request

```json
{
  "refreshToken": "opaque-token"
}
```

### Success 200

```json
{
  "status": "ok",
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "new-opaque-token",
    "expiresIn": 900
  }
}
```

### Errors

- `400 INVALID_REQUEST`: invalid body.
- `401 REFRESH_TOKEN_INVALID`: token missing, expired, unknown or revoked.

## POST /auth/logout

Revokes the current refresh token.

### Request

```json
{
  "refreshToken": "opaque-token"
}
```

### Success 200

```json
{
  "status": "ok"
}
```

## GET /auth/me

Requires `Authorization: Bearer <accessToken>`.

### Success 200

```json
{
  "status": "ok",
  "user": {
    "id": "uuid",
    "email": "attendant@example.com",
    "name": "Renan"
  }
}
```

### Errors

- `401 AUTH_REQUIRED`: missing, expired or invalid access token.

## Token Rules

- Access token TTL default: 15 minutes.
- Refresh token TTL default: 30 days.
- Refresh token must be stored in DB as hash only.
- Refresh token rotation invalidates the previous token.
- Extension storage may store current tokens, but never password.
