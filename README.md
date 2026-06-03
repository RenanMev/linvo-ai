# Linvo AI

Linvo AI is a local-first Chrome extension and backend for AI-assisted customer identification in generic CRM screens. It helps support agents recognize the active customer or case from visible page context, save confirmed contacts, and reopen the right customer information later.

The project is organized as a pnpm monorepo with a browser extension, a NestJS API server, and shared TypeScript contracts.

## What It Does

- Identifies the active customer or case from selected CRM page content.
- Uses an OpenAI-compatible chat completion API to extract reliable customer facts.
- Stores customers, cases, DOM anchors, and identification runs in PostgreSQL.
- Detects duplicate customers before saving a new contact.
- Supports bulk identification from visible customer lists.
- Provides a Chrome side panel for login, pending confirmations, saved contacts, notes, and editable customer details.
- Adds a floating in-page action button and customer anchor menu.
- Keeps API payloads validated through shared Zod contracts.

## Repository Structure

```text
apps/
  extension/   Chrome Manifest V3 extension, side panel, content scripts
  server/      NestJS API, Prisma schema, auth, AI orchestration
packages/
  shared/      Shared contracts, prompts, limits, identity helpers
tests/
  e2e/         Playwright browser tests
infra/         Local infrastructure support
specs/         Product and implementation specs
```

## Tech Stack

- TypeScript
- pnpm workspaces
- React 19
- Vite
- Chrome Manifest V3
- NestJS
- Prisma 7
- PostgreSQL with pgvector image
- Vitest
- Playwright
- Zod

## Prerequisites

- Node.js 24 recommended
- pnpm 10.29.2
- Docker Desktop
- Chrome or Chromium
- An OpenAI-compatible API key for AI identification

## Environment Variables

Create a local server environment file before running the backend. The server loads either a repository-root `.env` file or `apps/server/.env`, depending on the current working directory. It expects:

```env
PORT=8791
DATABASE_URL=postgresql://linvo_ai:linvo_ai_dev@127.0.0.1:54329/linvo_ai
JWT_ACCESS_SECRET=replace-with-at-least-16-chars
JWT_REFRESH_SECRET=replace-with-at-least-16-chars
PASSWORD_PEPPER=replace-with-at-least-16-chars
IDENTITY_HASH_SECRET=replace-with-at-least-16-chars
AI_API_KEY=replace-with-provider-key
AI_BASE_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4.1-mini
IDENTIFICATION_CONFIDENCE_MIN=0.72
NODE_ENV=development
```

Optional:

```env
CORS_ALLOWED_ORIGINS=http://localhost:*,http://127.0.0.1:*,chrome-extension://*
JWT_AUDIENCE=linvo-ai-extension
JWT_ISSUER=linvo-ai-server
```

In production, `CORS_ALLOWED_ORIGINS` must be explicitly set.

## Local Setup

Install dependencies:

```powershell
pnpm install
```

Start PostgreSQL:

```powershell
pnpm db:up
```

Generate Prisma Client and apply migrations:

```powershell
pnpm prisma:generate
pnpm --filter @linvo-ai/server prisma:migrate
```

Run the server and extension watcher:

```powershell
pnpm dev
```

The backend listens on:

```text
http://127.0.0.1:8791
```

## Loading the Chrome Extension

Build the extension:

```powershell
pnpm --filter @linvo-ai/extension build
```

Then:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select `apps/extension/dist`.
5. Open the Linvo AI side panel.
6. Register or log in.

During development, you can run the extension build watcher with:

```powershell
pnpm --filter @linvo-ai/extension dev
```

After rebuilds, reload the unpacked extension in Chrome.

## Common Commands

Build all packages:

```powershell
pnpm build
```

Run type checks:

```powershell
pnpm typecheck
```

Run unit tests:

```powershell
pnpm test
```

Run browser E2E tests:

```powershell
pnpm test:e2e
```

Validate Prisma schema:

```powershell
pnpm --filter @linvo-ai/server prisma:validate
```

Stop local PostgreSQL:

```powershell
pnpm db:down
```

## Feature Notes

### Customer Identification

The extension lets the agent select visible page content. The backend sends a compact prompt to an AI provider and validates the response against shared contracts. If confidence is high and the identity is persistable, the customer is saved or matched with an existing record.

### Bulk Identification

The list picker captures visible list rows, extracts likely names, protocols, and phone numbers, and presents candidates in the side panel for review.

### Contact Workspace

The side panel includes a contact workspace for:

- Saved customers
- Recent cases
- Masked identifiers
- Notes
- Editable display name and case fields
- Delete and refresh actions

### Auth

The server supports register, login, refresh tokens, logout, current-user lookup, and local password reset flows. Access tokens are signed JWTs with issuer and audience validation.

### Privacy And Persistence

Sensitive identifiers are masked before being stored in customer summaries. Raw page URLs are hashed before persistence. AI prompts also redact common sensitive patterns before sending context where supported.

## Troubleshooting

If the extension cannot reach the server, confirm:

- The backend is running on `127.0.0.1:8791`.
- The extension was rebuilt after code changes.
- The unpacked extension was reloaded in Chrome.
- `DATABASE_URL` points to the Docker Postgres port `54329`.
- `AI_API_KEY` is configured when using AI-backed identification.

If PowerShell blocks pnpm scripts, use:

```powershell
pnpm.cmd <command>
```

If Prisma fails after schema changes, regenerate the client:

```powershell
pnpm prisma:generate
```

## Status

This is an MVP-style project intended for local development and validation of AI-assisted CRM customer identification workflows.
