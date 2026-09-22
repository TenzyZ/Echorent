# Frontend + Voice Integration v1 contract

## Runtime boundary

EchoRent supports demo searches at DXB and SIN. The browser transports tool arguments and renders results; `backend/search.mjs` owns validation, eligibility, pricing, ordering, and inventory selection.

The only runtime tool is the client-handled `search_cars` stored-agent tool:

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

## Deferred

Booking, reservation requests, agreement submission, renter verification, Google authentication, email, database persistence, human approval, payment, live provider inventory, and additional airports are not active. `RenterForm` and `AgreementCard` remain Storybook-only visual components.
