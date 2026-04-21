# GitFlow — PR Lifecycle Intelligence Platform

🦊 **Flo**, the GitFlow Red Panda mascot is waiting inside the `implementation_plan.md` artifact!

GitFlow is a production-ready system that tracks, processes, and visualizes GitHub Pull Request lifecycles in real-time.

## Requirements

- Node.js `>=20.9.0`
- npm `>=10`

## Architecture
- **apps/sentinel**: Webhook Ingress (Express) & WebSocket broadcaster.
- **apps/auditor**: Background Queue Worker (BullMQ + Redis).
- **apps/cockpit**: Real-time Next.js Dashboard (shadcn/ui + Tremor + Tailwind).
- **packages/db**: shared Prisma schema (PostgreSQL)
- **packages/shared**: shared logic, metric evaluation rules

## Setup & Run Locally

### 1. Start Infrastructure
Start the Redis and PostgreSQL instances locally:
```bash
docker-compose up -d
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your GitHub App credentials:
```bash
cp .env.example .env
```
Fill in the `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET`, and `GITHUB_PRIVATE_KEY`.

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
Run prisma migrations from root
```bash
npm run db:push
npm run db:generate
```

### 5. Start Development Servers
Run this Turborepo command from the root to start Sentinel, Auditor, and Cockpit simultaneously:
```bash
npm run dev
```

### 6. View Cockpit
Open `http://localhost:3000` to view the Real-time Dashboard and see your metrics flow.

Cockpit is on Next.js 16 and uses ESLint CLI with the flat config exported by `eslint-config-next`.

### 7. Trigger Webhooks
Point your GitHub App webhook URL to your Sentinel service using a tunnel (e.g. ngrok or Localtunnel) pointing at port **3001**.
```bash
npx localtunnel --port 3001 --subdomain my-gitflow-sentinel
```

### 8. Commit Ingestion Notes

- Realtime commit ingestion requires the GitHub App to subscribe to the `Push` webhook event.
- The app must have repository `Contents` read permission to fetch commit details for historical backfill.
- Auditor now runs periodic auto-sync using `scripts/sync.ts` so backfill is automatic by default.

Auto-sync controls (from `.env`):

- `AUTO_SYNC_ENABLED` (`true` by default)
- `AUTO_SYNC_RUN_ON_BOOT` (`true` by default)
- `AUTO_SYNC_INTERVAL_MINUTES` (`2` by default)

## Beta Versioning

Beta progression is tracked in [BETA_VERSION](BETA_VERSION):

- Baseline: `1.0.0.0`
- Bump: `npm run version:beta`
- Show current: `npm run version:beta:show`

## Quality Gate

Run the full local quality pipeline before opening PRs or release commits:

```bash
npm run ci:check
```

This runs lint, typecheck, tests, build, and production audit (critical threshold).

For full advisory visibility (including non-critical gate levels):

```bash
npm run audit:prod:full
```

## Security Configuration

- Sentinel ingress now supports:
	- CORS allowlist via `ALLOWED_ORIGINS`
	- event allowlist via `ALLOWED_GITHUB_EVENTS`
	- request body size limits via `WEBHOOK_BODY_LIMIT`
	- webhook rate limiting via `WEBHOOK_RATE_LIMIT_WINDOW_MS` and `WEBHOOK_RATE_LIMIT_MAX`
	- basic hardening response headers
- Cockpit repositories API supports optional read token enforcement in production with `COCKPIT_READ_API_TOKEN`.
