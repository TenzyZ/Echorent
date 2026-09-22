import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { searchCars } from "./search.mjs";

function authorized(header, secret) {
  if (!secret || typeof header !== "string") return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
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
  now = () => new Date(),
  cars = DEMO_INVENTORY,
  logger = console.log,
} = {}) {
  return createHttpServer(async (request, response) => {
    if (request.url !== "/tools/search_cars") return send(response, 404, { error: "not_found" });
    if (request.method !== "POST") return send(response, 405, { error: "method_not_allowed" });
    if (!authorized(request.headers.authorization, secret)) return send(response, 401, { error: "unauthorized" });

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
    createServer().listen(port, () => console.log(JSON.stringify({ event: "listening", port })));
  }
}
