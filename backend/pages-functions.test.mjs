import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { input, post, sql, startRuntime, stopRuntime } from "./d1-store.test.mjs";
import { searchCars } from "./search.mjs";
import { onRequest as token } from "../functions/api/voice/token.js";
import { onRequest as search } from "../functions/api/search_cars.js";
import { onRequest as reservation } from "../functions/api/reservation_requests.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = [
  "functions/api/voice/token.js",
  "functions/api/search_cars.js",
  "functions/api/reservation_requests.js",
];
const request = (path, method, body) => new Request("http://localhost" + path, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test("P1 each Pages route exports onRequest", () => {
  for (const handler of [token, search, reservation]) assert.equal(typeof handler, "function");
});

test("P2 token adapter config and fake provider", async () => {
  const unavailable = await token({ request: request("/api/voice/token", "GET"), env: {} });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "voice_unavailable" });
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://agents.assemblyai.com/v1/token?expires_in_seconds=60&max_session_duration_seconds=1800");
      assert.equal(options.headers.Authorization, "Bearer fake-key");
      return Response.json({ token: "fake-temporary-token" });
    };
    const response = await token({
      request: request("/api/voice/token", "GET"),
      env: { ASSEMBLYAI_API_KEY: "fake-key", AGENT_ID_ECHORENT: "fake-agent" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { token: "fake-temporary-token", agent_id: "fake-agent" });
  } finally { globalThis.fetch = originalFetch; }
});

test("P3 search adapter canonical POST and JSON 405", async () => {
  const terms = {
    pickup_airport: "SIN", pickup_date: "December 20", pickup_time: "07:00",
    return_date: "December 23", return_time: "07:00", driver_age: 30,
  };
  const response = await search({ request: request("/api/search_cars", "POST", terms) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, searchCars(terms));
  const wrong = await search({ request: request("/api/search_cars", "GET") });
  assert.equal(wrong.status, 405);
  assert.deepEqual(await wrong.json(), { error: "method_not_allowed" });
});

test("P4 local Pages DB binding, create/replay and method/config errors", { timeout: 45_000 }, async () => {
  const runtime = await startRuntime();
  try {
    assert.match(runtime.output(), /env\.DB/);
    const value = await input(runtime);
    const first = await post(runtime, "/api/reservation_requests", value);
    const replay = await post(runtime, "/api/reservation_requests", value);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.request.request_id, first.body.request.request_id);
    assert.equal(sql(runtime, "SELECT count(*) AS n FROM reservation_requests")[0].n, 1);
    const wrong = await post(runtime, "/api/reservation_requests", {}, "PUT");
    assert.equal(wrong.status, 405);
    assert.deepEqual(wrong.body, { error: "method_not_allowed" });
    const missing = await reservation({ request: request("/api/reservation_requests", "POST", value), env: {} });
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).errors[0].code, "reservations_unavailable");
  } finally { await stopRuntime(runtime); }
});

test("P5 Functions import graph stays Web-safe", async () => {
  const seen = new Set();
  async function visit(path) {
    const absolute = resolve(repo, path);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const source = await readFile(absolute, "utf8");
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"]node:/);
    assert.doesNotMatch(absolute.replaceAll("\\", "/"), /backend\/(?:reservations|server)\.mjs$/);
    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith(".")) await visit(resolve(dirname(absolute), match[1]));
    }
  }
  for (const path of paths) await visit(path);
  assert.ok(seen.size >= paths.length);
});
