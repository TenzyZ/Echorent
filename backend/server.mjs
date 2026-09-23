import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { handleReservationRequest, handleSearchCars, handleVoiceToken } from "./http.mjs";
import { createReservationService } from "./reservations.mjs";

function authorized(header, secret) {
  if (!secret || typeof header !== "string") return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requestToWeb(request) {
  return new Request(new URL(request.url, "http://127.0.0.1"), {
    method: request.method,
    headers: request.headers,
    ...(request.method === "GET" || request.method === "HEAD" ? {} : {
      body: Readable.toWeb(request), duplex: "half",
    }),
  });
}

function send(response, webResponse) {
  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
  if (!webResponse.body) return response.end();
  Readable.fromWeb(webResponse.body).pipe(response);
}

export function createServer({
  secret = process.env.ECHORENT_TOOL_SECRET,
  apiKey = process.env.ASSEMBLYAI_API_KEY,
  agentId = process.env.AGENT_ID_ECHORENT,
  now = () => new Date(),
  cars = DEMO_INVENTORY,
  fetchImpl = fetch,
  tokenTimeoutMs = 5_000,
  logger = console.log,
  reservationOptions = {},
} = {}) {
  const { createBookingRequest } = createReservationService({ now, cars, ...reservationOptions });
  return createHttpServer(async (request, response) => {
    const path = request.url?.split("?", 1)[0];
    const headers = { "Content-Type": "application/json; charset=utf-8" };
    if (path === "/tools/search_cars") {
      if (request.method !== "POST") return send(response, new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers }));
      if (!authorized(request.headers.authorization, secret)) {
        return send(response, new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers }));
      }
    }
    if (path === "/api/voice/token") {
      return send(response, await handleVoiceToken(requestToWeb(request), { apiKey, agentId, fetchImpl, tokenTimeoutMs }));
    }
    if (path === "/api/reservation_requests") {
      return send(response, await handleReservationRequest(requestToWeb(request), { createBookingRequest, logger }));
    }
    if (path === "/api/search_cars" || path === "/tools/search_cars") {
      return send(response, await handleSearchCars(requestToWeb(request), { now, cars, logger, route: path }));
    }
    return send(response, new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.ECHORENT_TOOL_SECRET) {
    console.error("ECHORENT_TOOL_SECRET is required.");
    process.exitCode = 1;
  } else {
    const port = Number(process.env.PORT || 3001);
    createServer().listen(port, "127.0.0.1", () => console.log(JSON.stringify({ event: "listening", host: "127.0.0.1", port })));
  }
}
