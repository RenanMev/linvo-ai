# Data Model: Linvo AI MVP - Identificacao de Cliente

## Entities

### User

Represents an authenticated attendant.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Primary key. |
| email | string | yes | Unique, lowercase canonical email. |
| passwordHash | string | yes | Strong hash, never raw password. |
| name | string | no | Optional display name. |
| status | enum | yes | `active`, `disabled`. |
| createdAt | timestamptz | yes | Creation timestamp. |
| updatedAt | timestamptz | yes | Updated on profile/auth changes. |

### RefreshSession

Represents a refresh token issued to an extension session.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Primary key. |
| userId | uuid | yes | FK to `User`. |
| tokenHash | string | yes | Hash of refresh token. |
| userAgent | string | no | Optional extension/browser context. |
| createdAt | timestamptz | yes | Issued timestamp. |
| expiresAt | timestamptz | yes | Expiration timestamp. |
| revokedAt | timestamptz | no | Set on logout/revocation. |

### Customer

Represents a detected customer for one user and one CRM/domain.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Primary key. |
| userId | uuid | yes | FK to `User`; isolates attendants. |
| domain | string | yes | Hostname from CRM page. |
| identityHash | string | yes | Hash of canonical identity. |
| identityKind | enum | yes | `phone`, `email`, `document`, `protocol`, `name_context`, `unknown`. |
| displayName | string | no | Name verified by IA or selected text. |
| maskedIdentifiers | json | yes | Masked phone/email/document/protocol. |
| confidence | decimal | yes | Best confidence used to create/update. |
| firstSeenAt | timestamptz | yes | First successful identification. |
| lastSeenAt | timestamptz | yes | Updated on reuse. |
| createdAt | timestamptz | yes | Creation timestamp. |
| updatedAt | timestamptz | yes | Update timestamp. |

### CustomerCase

Represents a case, ticket, protocol or conversation attached to a customer.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Primary key. |
| userId | uuid | yes | FK to `User`. |
| customerId | uuid | no | FK to `Customer`; optional for protocol-only candidates if later allowed. |
| domain | string | yes | Hostname from CRM page. |
| caseHash | string | yes | Hash of canonical protocol/case identity. |
| caseKind | enum | yes | `protocol`, `conversation`, `subject_context`, `unknown`. |
| protocolDisplay | string | no | Masked or verified protocol label. |
| subjectDisplay | string | no | Short subject extracted by IA. |
| statusDisplay | string | no | Optional visible status from CRM. |
| confidence | decimal | yes | Best confidence used to create/update. |
| firstSeenAt | timestamptz | yes | First successful identification. |
| lastSeenAt | timestamptz | yes | Updated on reuse. |
| createdAt | timestamptz | yes | Creation timestamp. |
| updatedAt | timestamptz | yes | Update timestamp. |

### IdentificationRun

Represents one identification attempt. It stores audit-friendly metadata, not screenshots.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | uuid | yes | Primary key. |
| userId | uuid | yes | FK to `User`. |
| customerId | uuid | no | FK when saved/reused. |
| customerCaseId | uuid | no | FK when saved/reused. |
| requestId | string | yes | Client-generated request id. |
| domain | string | yes | Hostname from request URL. |
| pageUrlHash | string | yes | Hash of URL; raw full URL not required. |
| selectedLabel | string | no | Short redacted label from manual selection. |
| confidence | decimal | yes | Final confidence. |
| saved | boolean | yes | Whether customer/case was persisted. |
| evidenceJson | json | yes | Short evidence snippets without raw screenshot. |
| warningsJson | json | yes | Low confidence, missing fields, screenshot unavailable, etc. |
| durationMs | int | no | Processing duration. |
| createdAt | timestamptz | yes | Attempt timestamp. |

## Relationships

- `User` 1:N `RefreshSession`.
- `User` 1:N `Customer`.
- `User` 1:N `CustomerCase`.
- `User` 1:N `IdentificationRun`.
- `Customer` 1:N `CustomerCase`.
- `Customer` 1:N `IdentificationRun`.
- `CustomerCase` 1:N `IdentificationRun`.

## Unique Constraints

- `User.email` is unique.
- `RefreshSession.tokenHash` is unique.
- `Customer` is unique by `(userId, domain, identityHash)`.
- `CustomerCase` is unique by `(userId, domain, caseHash)`.
- `IdentificationRun` is unique by `(userId, requestId)`.

## Validation Rules

- Email must be lowercase and syntactically valid before persistence.
- Password must meet minimum length before hashing.
- Domain is derived server-side from request URL, not trusted from client input.
- `identityHash` is generated from normalized phone, email, document, protocol or selected contextual fallback.
- Raw phone/email/document should not be stored in `identityHash`, `pageUrlHash`, logs or evidence.
- `Customer` and `CustomerCase` can be created only when final confidence is at least `IDENTIFICATION_CONFIDENCE_MIN`.
- `IdentificationRun.evidenceJson` can store short redacted snippets, but never screenshot data URLs.
- `selectedLabel` must be truncated and redacted before persistence.

## Derived Identity Rules

- Prefer verified phone/email/document when present.
- Else prefer verified protocol/ticket for case identity.
- Else combine normalized display name with domain and strong selected context hash.
- If only generic labels are present, do not create customer/case.
- Same phone/email/document in different formatting must map to the same canonical hash.
- Same customer name with different protocols should reuse customer only when another stable identifier supports it.
