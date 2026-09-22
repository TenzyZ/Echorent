import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { createReservationService } from "./reservations.mjs";
import { searchCars } from "./search.mjs";

function authorized(header, secret) {
  if (!secret || typeof header !== "string") return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= 65_536) chunks.push(chunk);
  }
  if (size > 65_536) throw new SyntaxError("request too large");
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new SyntaxError("request must be a JSON object");
  return body;
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
    if (path === "/api/reservation_requests") {
      const noStore = { "Cache-Control": "no-store" };
      if (request.method !== "POST") return send(response, 405, { error: "method_not_allowed" }, noStore);
      let input;
      try { input = await readJson(request); }
      catch { return send(response, 400, { error: "invalid_json" }, noStore); }
      const started = performance.now();
      let outcome;
      try { outcome = await createBookingRequest(input); }
      catch { outcome = { status: 500, body: { error: "store_unavailable" } }; }
      send(response, outcome.status, outcome.body, noStore);
      try {
        logger(JSON.stringify({
          route: path, ok: outcome.body.ok === true,
          error_codes: outcome.body.errors?.map(({ code }) => code) ?? [],
          request_id: outcome.body.request?.request_id,
          car_id: outcome.body.request?.car?.car_id,
          airport: outcome.body.request?.rental?.airport,
          replayed: outcome.body.replayed,
          notifications: outcome.body.notifications,
          notification_errors: outcome.notification_errors,
          duration_ms: Math.round(performance.now() - started),
        }));
      } catch { /* Logging must not change the response. */ }
      return;
    }
    if (path === "/api/voice/token") {
      const noStore = { "Cache-Control": "no-store" };
      if (request.method !== "GET") return send(response, 405, { error: "method_not_allowed" }, noStore);
      if (!apiKey || !agentId) return send(response, 503, { error: "voice_unavailable" }, noStore);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), tokenTimeoutMs);
      try {
        const url = new URL("https://agents.assemblyai.com/v1/token");
        url.searchParams.set("expires_in_seconds", "60");
        url.searchParams.set("max_session_duration_seconds", "1800");
        const upstream = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (!upstream.ok) throw new Error("token request failed");
        const body = await upstream.json();
        if (!body || typeof body.token !== "string" || !body.token) throw new Error("invalid token response");
        return send(response, 200, { token: body.token, agent_id: agentId }, noStore);
      } catch {
        return send(response, 502, { error: "token_unavailable" }, noStore);
      } finally {
        clearTimeout(timeout);
      }
    }

    const isLegacySearch = path === "/tools/search_cars";
    const isBrowserSearch = path === "/api/search_cars";
    if (!isLegacySearch && !isBrowserSearch) return send(response, 404, { error: "not_found" });
    if (request.method !== "POST") return send(response, 405, { error: "method_not_allowed" });
    if (isLegacySearch && !authorized(request.headers.authorization, secret)) {
      return send(response, 401, { error: "unauthorized" });
    }

    let rawArguments;
    try {
      rawArguments = await readJson(request);
    } catch {
      return send(response, 400, { error: "invalid_json" });
    }

    const started = performance.now();
    let result = null;
    try {
      result = searchCars(rawArguments, { now: typeof now === "function" ? now() : now, cars });
    } catch {
      // Genuine server fault; the generic 500 below is the only thing the caller sees.
    }
    send(response, result ? 200 : 500, result ?? { error: "server_error" });

    const ok = result?.ok === true;
    try {
      logger(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: path,
        raw_arguments: rawArguments,
        ok,
        error_codes: result && !ok ? result.errors.map(({ code }) => code) : [],
        normalized_rental: ok ? result.rental : null,
        car_ids: ok ? result.cars.map(({ car_id }) => car_id) : [],
        duration_ms: Math.round(performance.now() - started),
      }));
    } catch {
      // Logging must never change the sent response or crash the process.
    }
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
