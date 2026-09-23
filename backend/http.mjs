import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { searchCars } from "./search.mjs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const NO_STORE = { ...JSON_HEADERS, "Cache-Control": "no-store" };

function json(status, body, noStore = false) {
  return new Response(JSON.stringify(body), { status, headers: noStore ? NO_STORE : JSON_HEADERS });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.body ?? []) {
    size += chunk.byteLength;
    if (size <= 65_536) chunks.push(chunk);
  }
  if (size > 65_536) throw new SyntaxError("request too large");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SyntaxError("request must be a JSON object");
  return body;
}

export async function handleVoiceToken(request, {
  apiKey, agentId, fetchImpl = fetch, tokenTimeoutMs = 5_000,
} = {}) {
  if (request.method !== "GET") return json(405, { error: "method_not_allowed" }, true);
  if (!apiKey || !agentId) return json(503, { error: "voice_unavailable" }, true);
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
    return json(200, { token: body.token, agent_id: agentId }, true);
  } catch {
    return json(502, { error: "token_unavailable" }, true);
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleSearchCars(request, {
  now = () => new Date(), cars = DEMO_INVENTORY, logger = console.log, route = "/api/search_cars",
} = {}) {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  let rawArguments;
  try { rawArguments = await readJson(request); }
  catch { return json(400, { error: "invalid_json" }); }
  const started = performance.now();
  let result = null;
  try { result = searchCars(rawArguments, { now: typeof now === "function" ? now() : now, cars }); }
  catch { /* Only a generic server fault reaches the caller. */ }
  const response = json(result ? 200 : 500, result ?? { error: "server_error" });
  const ok = result?.ok === true;
  try {
    logger(JSON.stringify({
      timestamp: new Date().toISOString(), route, raw_arguments: rawArguments, ok,
      error_codes: result && !ok ? result.errors.map(({ code }) => code) : [],
      normalized_rental: ok ? result.rental : null,
      car_ids: ok ? result.cars.map(({ car_id }) => car_id) : [],
      duration_ms: Math.round(performance.now() - started),
    }));
  } catch { /* Logging must not change responses. */ }
  return response;
}

export async function handleReservationRequest(request, {
  createBookingRequest, logger = console.log, route = "/api/reservation_requests",
} = {}) {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, true);
  let input;
  try { input = await readJson(request); }
  catch { return json(400, { error: "invalid_json" }, true); }
  const started = performance.now();
  let outcome;
  try { outcome = await createBookingRequest(input); }
  catch { outcome = { status: 500, body: { error: "store_unavailable" } }; }
  const response = json(outcome.status, outcome.body, true);
  try {
    logger(JSON.stringify({
      route, ok: outcome.body.ok === true,
      error_codes: outcome.body.errors?.map(({ code }) => code) ?? [],
      request_id: outcome.body.request?.request_id,
      car_id: outcome.body.request?.car?.car_id,
      airport: outcome.body.request?.rental?.airport,
      replayed: outcome.body.replayed,
      notifications: outcome.body.notifications,
      notification_errors: outcome.notification_errors,
      duration_ms: Math.round(performance.now() - started),
    }));
  } catch { /* Logging must not change responses. */ }
  return response;
}
