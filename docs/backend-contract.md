# Reservation Request + Email Acknowledgement v1 contract

## Runtime boundary

EchoRent supports demo searches at DXB and SIN. The browser transports tool arguments and renders results; `backend/search.mjs` owns validation, eligibility, pricing, ordering, and inventory selection.

The runtime search tool is the client-handled `search_cars` stored-agent tool:

```text
tool.call(search_cars)
→ POST /api/search_cars with the unchanged arguments object
→ canonical searchCars()
→ one response body
→ same exact body as tool.result and parsed for the UI adapter
```

The browser must not infer cars from transcripts, run a second search, use frontend inventory, or fabricate fallback cars.

## `GET /api/voice/token`

The backend requests a single-use temporary token from `GET https://agents.assemblyai.com/v1/token` with `expires_in_seconds=60` and `max_session_duration_seconds=1800`. `ASSEMBLYAI_API_KEY` and `ECHORENT_TOOL_SECRET` remain server-side. `AGENT_ID_ECHORENT` is configured server-side; this route returns its value as `agent_id` because the browser needs it for the stored-agent `session.update`. The agent ID value must not be hardcoded in frontend source.

Success (`200`, `Cache-Control: no-store`):

```json
{"token":"temporary-token","agent_id":"stored-agent-id"}
```

Failures:

- Missing server configuration: `503 {"error":"voice_unavailable"}`
- Upstream, network, timeout, or invalid response: `502 {"error":"token_unavailable"}`
- Wrong method: `405 {"error":"method_not_allowed"}`

Every response from this route uses `Cache-Control: no-store`.

## `POST /api/search_cars`

The request body is the exact parsed `tool.call.arguments` object. This local browser route does not use `ECHORENT_TOOL_SECRET`.

Responses:

- Canonical `ok: true` or `ok: false`: HTTP `200`
- Malformed JSON: `400 {"error":"invalid_json"}`
- Wrong method: `405 {"error":"method_not_allowed"}`
- Internal failure: `500 {"error":"server_error"}`

`POST /tools/search_cars` remains the bearer-protected legacy HTTP-tool route and uses the same `searchCars()` path.

## Backend car to UI mapping

| Backend | UI |
| --- | --- |
| `car_id` | `id` |
| `name` | `name` |
| `economy`, `suv`, `premium` | `Economy`, `SUV`, `Premium` |
| `automatic` | `Automatic` |
| `seats` | `seats` |
| `bags` | `bags` |
| `daily_rate` | `pricePerDay` |
| `currency` | `currency` |

The adapter preserves backend count, order, IDs, and values. It performs no filtering, sorting, pricing, eligibility, or inventory lookup.

## Voice session

The session starts only from a user gesture. The browser obtains a temporary token, opens `wss://agents.assemblyai.com/v1/ws?token=<token>`, and sends `session.update` with the returned `agent_id` as its first message. It waits for `session.ready` before sending PCM16 mono 24 kHz microphone frames.

The client handles live user and agent transcripts, `reply.audio`, barge-in, `session.error`, and clean `session.end`. Text input sends `conversation.message` followed by `reply.create`. There is no reconnect or `session.resume` in v1.

For `search_cars`, valid canonical response text is preserved exactly for `tool.result` and parsed once for UI presentation. Business validation responses (`ok: false`) are data, not transport failures. Network, timeout, non-200, unknown-tool, and malformed-body failures return a structured result containing `is_error: true`; no cars are fabricated.

Tool results are held while an agent reply is in flight, released in call order after normal `reply.done`, and dropped after interrupted `reply.done`. This ordering remains subject to the authorized live browser verification.

`select_car` is a client-local tool. It validates `car_id` against the latest released successful search result. If all earlier calls have been sent or dropped, the locally validated selection may update the UI immediately; otherwise it waits for release. `tool.result` still waits for normal `reply.done`, and an interrupted unsent early selection is reverted. It does not fetch or create a request. The UI retains that search's exact arguments and authoritative result; backend state remains authoritative for reservation creation and status. Email is typed into a dedicated form and never enters a conversation message or tool argument.

## `POST /api/reservation_requests`

The traveller reviews the selected car, airport, pickup, and return before pressing Send request. The browser sends `{ "search": <exact released search_cars arguments>, "car_id": "...", "email": "...", "reviewed_rental": <that released result's rental> }`. No other top-level fields are accepted, and `reviewed_rental` must have the exact `rental` shape. PUT/PATCH return `405 method_not_allowed`.

The backend re-runs `searchCars(search)` and verifies the returned car. If the canonical `rental` (airport, airport name, pickup and return date, weekday, and time, driver age) differs from `reviewed_rental`, for example because a relative date such as `tomorrow` resolves differently after airport-local midnight, it returns `409 search_expired` with nothing persisted and no email sent; the traveller must search again. It then validates email and server email configuration, then makes a durable decision. The local Node server appends a new request to `reservation-requests.jsonl`, while Pages inserts into D1. Both store literal `status: "pending"` before any email attempt. The result includes the authoritative request and separate `notifications.internal` and `notifications.traveller` statuses (`sent` or `failed`). Notification failure does not erase a saved request. A failed notification record and the server's request log carry a PII-safe `error` diagnostic (`provider`, `operation`, HTTP `status`, Resend error `code`, sanitized `message`, or `timeout`/`network_error`); it never reaches the browser. The traveller UI and Shen report only the traveller acknowledgement status. Missing configuration or the Pages DB binding returns `503 reservations_unavailable` before persistence.

For the same normalized email, exact car, airport, canonical pickup/return, and driver age replay the original pending request and ID. Only roles lacking a durable `sent` record are retried with the same `${request_id}/<role>` idempotency key. Same-airport overlapping intervals that are not exact replay return `409 existing_request`, with only `{ "status": "pending" }` under `existing_request`. The unauthenticated conflict response contains no persisted request details. Touching intervals, non-overlapping intervals, different emails, and cross-airport rentals may create separate requests.

JSONL is local demo persistence for one process. The index is rebuilt from disk after restart and corrupt data fails closed. Decisions serialize through email delivery. Resend currently keeps idempotency keys for 24 hours; a provider acceptance followed by a crash before the sent record is appended can require provider idempotency on retry.

## Cloudflare Pages and D1

Cloudflare Pages serves the static Vite build. Only `/api/voice/token`,
`/api/search_cars`, and `/api/reservation_requests` run as Pages Functions.
The Functions and Node server use the same Web-safe search, reservation, and
email logic. The bearer-protected `/tools/search_cars` route stays Node-only.
No authentication was added.

Node development retains the JSONL store and its whole-operation queue.
Cloudflare uses D1 with one atomic conditional INSERT to claim an overlapping
window. An exact request replays its existing ID; a different overlap for the
same normalized email and airport conflicts. Touching windows are allowed.
D1 notification UPSERTs keep `sent` sticky. Only failed or unsent roles retry
using `${request_id}/${role}`. Request status remains pending; email failure
cannot roll back the request.

Use Node.js 22 or newer. For local Pages development run `npm run build`,
`npx wrangler d1 migrations apply echorent --local`, then
`npx wrangler pages dev`. The top-level `preview_database_id: "DB"` is for
local Pages D1, not the remote production database. Production `echorent`
and Preview `echorent-preview` require separate D1 databases; the zero UUIDs
in `wrangler.jsonc` are placeholders. Keep `ASSEMBLYAI_API_KEY`,
`AGENT_ID_ECHORENT`, `RESEND_API_KEY`, `ECHORENT_EMAIL_FROM`, and
`ECHORENT_NOTIFY_TO` server-side.

## Deferred

Confirmation, approval/rejection, modification, cancellation, agreement submission, Google authentication, SMS, payment, live provider inventory, and additional airports are not active. `RenterForm` and `AgreementCard` remain Storybook-only visual components. No model-facing create, modify, cancel, or generic send_email tool is active.
