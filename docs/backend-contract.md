# Backend contract

## Purpose

This document is the contract between the frontend and the backend. Seng owns the frontend. The frontend is this repository. Tenzy owns the backend. Tenzy also owns the voice agent. The voice agent runs on the AssemblyAI service.

The user describes a trip by voice. The agent understands the trip. The agent offers one or more cars. The UI shows the cars in a slider. The UI shows the current understanding.

In this document, the client is the frontend on the WebSocket. The server is the AssemblyAI Voice Agent API. The protocol below matches the published AssemblyAI documentation.

## Endpoints

### `GET /api/locations`

Returns the supported pickup locations. EchoRent supports two locations only. The body is the array from `shared/locations.json`.

| Field | Type | Meaning |
| --- | --- | --- |
| `code` | string | unique id of the location |
| `name` | string | name of the airport |
| `currency` | string | currency of the prices at this location |

### `GET /api/cars?airport=<code>`

Returns the car catalog for one location. `<code>` is a `code` from `GET /api/locations`. The request without `airport` returns status 400. An unknown `airport` returns status 404. The body is the array stored under that code in `shared/cars.json`. Each location has its own prices. Each price uses the `currency` of the location. See that file for the full data.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | unique id of the car |
| `name` | string | name of the car |
| `category` | string | class of the car |
| `transmission` | string | type of the transmission |
| `seats` | number | number of seats |
| `bags` | number | number of bags |
| `pricePerDay` | number | price for one day |
| `currency` | string | currency of the price |

### `GET /api/voice/token`

Returns the credentials for one voice session. The backend gets the token from `GET https://agents.assemblyai.com/v1/token` with its AssemblyAI API key in the `Authorization` header. The API key never reaches the client.

Response, status 200:

```json
{
  "token": "string",
  "agent_id": "string"
}
```

- `token` is a temporary token for the AssemblyAI Voice Agent API. Each token is single-use and starts one session. The client must fetch a fresh token for every WebSocket connection, including reconnects.
- `agent_id` is the id of the stored voice agent.

If the backend cannot create a token, it returns a status other than 200. The body is:

```json
{
  "error": "string"
}
```

`error` holds a short description of the problem. This error shape matches the stub API in `server/server.mjs`.

## WebSocket session

The client opens this URL. Replace `<temp token>` with the token from `GET /api/voice/token`:

```
wss://agents.assemblyai.com/v1/ws?token=<temp token>
```

There is no browser SDK for this API. The client uses the WebSocket support of the platform. The frontend adds no new dependency.

The client sends this message first:

```json
{
  "type": "session.update",
  "session": { "agent_id": "<agent_id from the token response>" }
}
```

The server answers with `session.ready`. The client sends audio only after `session.ready`. Audio sent before `session.ready` is an error.

Audio format, both directions:

| Direction | Encoding | Sample rate | Channels |
| --- | --- | --- | --- |
| Client to server | base64 PCM16 | 24 kHz | mono |
| Server to client | base64 PCM16 | 24 kHz | mono |

The agent config sets `input.format.encoding` and `output.format.encoding` to `audio/pcm`, the default. The client sends audio in `input.audio`. The server sends audio in `reply.audio`.

## Message reference

### Client to server

| Message | Fields | Use |
| --- | --- | --- |
| `session.update` | `session.agent_id` | Selects the stored agent. The client sends this message first. |
| `input.audio` | `audio` | Sends one chunk of user audio, base64 PCM16. Send at real time, not faster. |
| `session.end` | none | Ends the session. The server emits `session.ended` and closes the socket. |
| `conversation.message` | `role`, `content` | Adds a typed message to the conversation. `role` is `"user"` for typed input. It does not make the agent reply. |
| `reply.create` | `instructions` (optional) | Makes the agent reply now. The client sends it after `conversation.message` for typed input. |
| `tool.result` | `call_id`, `result` | Answers a `tool.call`. `result` is a JSON string. |

### Server to client

| Message | Fields | Use |
| --- | --- | --- |
| `session.ready` | `session_id`, `config` | The session is established. The client starts audio after this message. |
| `session.updated` | `config` | Confirms a mid-session `session.update`. |
| `session.ended` | `session_duration_seconds` | The last message before the server closes the socket. |
| `input.speech.started` | — | The user started to speak. |
| `input.speech.stopped` | — | The user stopped to speak. |
| `transcript.user.delta` | `text` | Holds the full user text so far. It replaces the previous value. |
| `transcript.user` | `text` | Holds the final user text of the turn. The client can ignore it. |
| `reply.started` | `reply_id` | The agent started a reply. |
| `reply.audio` | `data` | Carries agent speech, base64 PCM16. The client plays the audio. |
| `transcript.agent.delta` | `delta` | Holds one new piece of agent text. The client appends the piece. |
| `transcript.agent` | `text`, `interrupted` | Holds the final agent text of the reply. The client can ignore it. |
| `reply.done` | `status` | The reply ended. `status` is `"completed"` or `"interrupted"`. |
| `tool.call` | `call_id`, `name`, `arguments` | The agent requests a tool. `arguments` is an object, not a string. |
| `session.error` | `code`, `message` | The server reports an error. |

## Tools

Tools execute on the client. The agent config in the backend owns the tool manifest. The client must answer every `tool.call` with one `tool.result`. The client sends `result` as a JSON string.

Timing rule: the client sends `tool.result` when `reply.done` is the last received message. The client collects `tool.call` messages and sends the results in the `reply.done` handler. A `tool.result` during a reply causes errors. On `reply.done` with `status: "interrupted"`, the client discards the collected results.

### `update_trip`

Purpose: record the trip facts that the agent understood.

| Argument | Type | Meaning |
| --- | --- | --- |
| `airport` | string, optional | the pickup location, one `code` from `GET /api/locations` |
| `dates` | string, optional | the dates of the trip |
| `passengers` | number, optional | the number of passengers |
| `luggage` | number, optional | the number of luggage items |

Client obligation: the client stores these values. The UI then shows the current trip. The UI reads car data for the stored `airport` only.

### `suggest_cars`

Purpose: show a set of car cards.

| Argument | Type | Meaning |
| --- | --- | --- |
| `cars` | array | the cars to show, in order |
| `cars[].car_id` | string | the `id` of a car from `GET /api/cars` |
| `cars[].reason` | string | one sentence that explains the fit |

Client obligation: the client replaces the current card set with this set. The UI shows one card at a time in a slider. The user swipes right for the next card.

## Barge-in

A barge-in occurs when the user speaks during an agent reply. Two signals tell the client about a barge-in:

1. `input.speech.started` during a reply.
2. `reply.done` with `status: "interrupted"`.

The client stops the playback. The client empties the audio queue. The server also sends `transcript.agent` with `interrupted: true` and the text trimmed to the spoken part.

## Reconnect

- Tokens are single-use. A reconnect needs a fresh token from `GET /api/voice/token`.
- The server keeps a session for 30 seconds after a disconnect. The client can send `session.resume` with the `session_id` from `session.ready` to continue the session. This is optional.
- A WebSocket close without `session.end` keeps the session open for the 30-second grace window. The window is billable. The client sends `session.end` for a clean stop.

## Language

The agent detects the input language automatically. The agent config sets no `input.language_codes`. Input detection covers 18 languages with code-switching.

Output voices exist for six languages: English, Spanish, German, French, Italian, Portuguese. `output.voice` is fixed for the life of a session. The agent can understand other input languages but speaks with the configured voice.

The UI renders transcript text with `dir="auto"`.

## Open questions

| Question | Status | Effect |
| --- | --- | --- |
| Can the stored agent hold tools of `type: "function"` that emit `tool.call` on the socket? Or must the client declare them in `session.tools` after `session.ready`? | Open | If the stored agent cannot hold function tools, `GET /api/voice/token` also returns the tool manifest and the client sends a second `session.update` with `session.tools`. |
