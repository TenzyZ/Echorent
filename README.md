# EchoRent

Voice-first airport car-rental agent for DXB and SIN, powered by AssemblyAI, with conversational vehicle search and human-approved reservation requests.

Built by Tenzy and Seng for the AssemblyAI Voice Agent Hackathon.

## Run locally

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

Persistence is append-only JSONL for one server process. Reservation decisions
serialize, so email latency can delay another request. Resend retains idempotency
keys for 24 hours. If it accepts an email and the process crashes before the
sent line is saved, a later retry may depend on provider idempotency behavior.
Do not run a real email or publish the stored AssemblyAI agent until independent
review and Tenzy's explicit authorization.
