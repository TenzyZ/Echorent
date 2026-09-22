# Backend contract

## Purpose

This document is the contract between the frontend and the backend. Seng owns the frontend. The frontend is this repository. Tenzy owns the backend. Tenzy also owns the voice agent. The voice agent runs on the AssemblyAI service.

The user describes a trip by voice. The agent understands the trip. The agent offers one or more cars. The UI shows the cars in a slider. The UI shows the current understanding.

In this document, the client is the frontend on the WebSocket. The server is the AssemblyAI service.

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

Returns the credentials for one voice session.

Response, status 200:

```json
{
  "token": "string",
  "agent_id": "string"
}
```

- `token` is a temporary token for the AssemblyAI Voice Agent API.
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
wss://agents.assembly.com/v1/ws?token=<temp token>
```

There is no browser SDK for this API. The client uses the WebSocket support of the platform. The frontend adds no new dependency.

The client sends this message first:

```json
{
  "type": "session.update",
  "session": { "agent": { "agent_id": "<agent_id from the token response>" } }
}
```

Audio format, both directions:

| Direction | Encoding | Sample rate | Channels |
| --- | --- | --- | --- |
| Client to server | base64 PCM16 | 24 kHz | mono |
| Server to client | base64 PCM16 | 24 kHz | mono |

The client sends audio in `input_audio_buffer.append`. The server sends audio in `reply.audio`.

## Message reference

### Client to server

| Message | Fields | Use |
| --- | --- | --- |
| `session.update` | `session.agent.agent_id` | Selects the stored agent. The client sends this message first. |
| `input_audio_buffer.append` | base64 PCM16 audio | Sends user audio to the server. |
| `input_audio_buffer.terminate` | none | Ends the audio input from the client. |
| `input_text.message` | typed text | Sends typed input from the user. This message is an extension of this contract. |
| `tool.result` | `tool_call_id`, `output` | Answers a `tool.call`. `output` is a JSON string. |

### Server to client

| Message | Fields | Use |
| --- | --- | --- |
| `session.created` | — | The server created the session. |
| `input.speech.started` | — | The user started to speak. |
| `input.speech.stopped` | — | The user stopped speaking. |
| `transcript.user.delta` | user text | Holds the full user text so far. It replaces the previous value. |
| `transcript.agent.delta` | agent text | Holds one new piece of agent text. The client appends the piece. |
| `reply.audio` | base64 PCM16 audio | Carries agent speech. The client plays the audio. |
| `reply.done` | `interrupted` (boolean, optional) | The reply ended. `interrupted` is true after a barge-in. |
| `tool.call` | `tool_call_id`, `name`, `arguments` | The agent requests a tool. `arguments` is a JSON string. |
| `error` | error data | The server reports an error. |

## Tools

Tools execute on the client. The agent config in the backend owns the tool manifest. The client must answer every `tool.call` with one `tool.result`. The client sends `output` as a JSON string.

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
2. `reply.done` with `interrupted: true`.

The client stops the playback. The client empties the audio queue.

## Language

The agent detects the language automatically. The agent config sets no `language_codes`. The UI renders transcript text with `dir="auto"`.

## Open questions

| Question | Status | Effect |
| --- | --- | --- |
| Does the AssemblyAI service accept `input_text.message` directly? Or must the backend proxy the WebSocket for typed input? | Open | Until the answer is known, typed input stays an extension of this contract. |
