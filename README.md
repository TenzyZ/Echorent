# EchoRent

Voice-first airport car-rental agent for DXB and SIN, powered by AssemblyAI, with conversational vehicle search and human-approved reservation requests.

Built by Tenzy and Seng for the AssemblyAI Voice Agent Hackathon.

## Run locally

Use Node.js 22 or newer for Wrangler and the local D1 tests.

Set these server environment variables without exposing their values to the browser:

- `ASSEMBLYAI_API_KEY`
- `AGENT_ID_ECHORENT`
- `ECHORENT_TOOL_SECRET`
- `RESEND_API_KEY`
- `ECHORENT_EMAIL_FROM`
- `ECHORENT_NOTIFY_TO` (one internal notification email address)
- `ECHORENT_DATA_DIR` (optional; defaults to `backend/data`)

```powershell
npm ci
npm run server
npm run dev
```

Use Chrome or Edge for this MVP browser demo.

Run verification with:

```powershell
npm run test:backend
npm test
npm run build
npm run build-storybook
```

Shen can select a returned demo car through `select_car`. The traveller types
an email in the dedicated form, reviews the car and rental dates, and presses
Send request. The backend re-runs canonical search, stores a pending request,
then attempts an internal notification and traveller acknowledgement. Requests
are never confirmed by this flow. Exact submissions reuse the original request;
overlapping requests for the same email and airport return a generic conflict.

The local Node server uses append-only JSONL and serializes reservation decisions.
Cloudflare Pages serves the Vite build and runs exactly the three browser API
routes through Pages Functions. Its reservation store is D1. The shared
reservation core re-runs search and creates only pending requests. D1 claims a
request with one conditional INSERT: exact submissions replay the same ID,
overlapping same-email/same-airport periods conflict, and touching periods may
create separately. Both stores persist before email. Only failed or unsent
notification roles retry with the same request/role idempotency key; sent roles
remain sent. No authentication was added.

For a no-secret local Pages check:

```powershell
npm run build
npx wrangler d1 migrations apply echorent --local
npx wrangler pages dev
```

The local Pages D1 binding uses top-level `preview_database_id: "DB"`; this is
not the remote production database ID. Production `echorent` and Preview
`echorent-preview` require separate D1 databases. The zero UUIDs in
`wrangler.jsonc` are placeholders until Tenzy supplies the real IDs. Configure
`ASSEMBLYAI_API_KEY`, `AGENT_ID_ECHORENT`, `RESEND_API_KEY`,
`ECHORENT_EMAIL_FROM`, and `ECHORENT_NOTIFY_TO` as server-side secrets for
the relevant Pages environments. A missing DB binding returns
`reservations_unavailable`.

Resend retains idempotency keys for 24 hours. If it accepts an email and the
process crashes before sent status is saved, a later retry may depend on
provider idempotency behavior.
Do not run a real email or publish the stored AssemblyAI agent until independent
review and Tenzy's explicit authorization.
