import assert from "node:assert/strict";
import { test } from "node:test";
import { handleReservationRequest, handleSearchCars, handleVoiceToken } from "./http.mjs";
import { searchCars } from "./search.mjs";

const url = "http://localhost/api/search_cars";
const now = new Date("2026-09-22T00:00:00Z");
const search = {
  pickup_airport: "DXB", pickup_date: "October 7", pickup_time: "07:00",
  return_date: "October 10", return_time: "07:00", driver_age: 30,
};
const request = (method, body, path = url) => new Request(path, {
  method, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
});
const assertJson = (response, noStore) => {
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), noStore ? "no-store" : null);
};

test("H1-H2 token shape and server-only upstream request", async () => {
  const apiKey = "secret-assembly-key";
  let called = 0;
  const response = await handleVoiceToken(request("GET", undefined, "http://localhost/api/voice/token"), {
    apiKey, agentId: "agent-one",
    fetchImpl: async (upstream, init) => {
      called += 1;
      assert.equal(upstream.href, "https://agents.assemblyai.com/v1/token?expires_in_seconds=60&max_session_duration_seconds=1800");
      assert.equal(init.method, "GET");
      assert.equal(init.headers.Authorization, `Bearer ${apiKey}`);
      return Response.json({ token: "temporary", ignored: "private" });
    },
  });
  assert.equal(called, 1);
  assert.equal(response.status, 200);
  assertJson(response, true);
  assert.deepEqual(await response.json(), { token: "temporary", agent_id: "agent-one" });
});

test("H3-H4 token methods and missing config", async () => {
  for (const method of ["POST", "PUT", "HEAD"]) {
    const response = await handleVoiceToken(request(method, undefined, "http://localhost/api/voice/token"));
    assert.equal(response.status, 405);
    assertJson(response, true);
    assert.deepEqual(await response.json(), { error: "method_not_allowed" });
  }
  for (const config of [{ apiKey: "", agentId: "a" }, { apiKey: "key", agentId: "" }]) {
    const response = await handleVoiceToken(request("GET"), {
      ...config, fetchImpl: () => { throw new Error("unexpected fetch"); },
    });
    assert.equal(response.status, 503);
    assertJson(response, true);
  }
});

test("H5 token upstream failures hide credentials", async () => {
  const key = "secret-assembly-key";
  const cases = [
    async () => new Response("bad", { status: 500 }),
    async () => new Response("{", { status: 200 }),
    async () => Response.json({ nope: true }),
    async () => { throw new Error(key); },
    async (_, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error(key)))),
  ];
  for (const fetchImpl of cases) {
    const response = await handleVoiceToken(request("GET"), {
      apiKey: key, agentId: "agent-one", fetchImpl, tokenTimeoutMs: 5,
    });
    assert.equal(response.status, 502);
    assertJson(response, true);
    assert.deepEqual(await response.json(), { error: "token_unavailable" });
  }
});

test("H6-H8 search transport and canonical parity", async () => {
  for (const body of ["{", "[]", "null", "x".repeat(65_537)]) {
    const response = await handleSearchCars(request("POST", body));
    assert.equal(response.status, 400);
    assertJson(response, false);
    assert.deepEqual(await response.json(), { error: "invalid_json" });
  }
  assert.deepEqual(await (await handleSearchCars(request("GET"))).json(), { error: "method_not_allowed" });
  for (const airport of ["DXB", "SIN", "LHR"]) {
    const input = { ...search, pickup_airport: airport };
    const response = await handleSearchCars(request("POST", input), { now, logger: () => {} });
    assert.equal(response.status, 200);
    assertJson(response, false);
    assert.deepEqual(await response.json(), searchCars(input, { now }));
  }
});

test("H9-H10 reservation transport and isolated logging", async () => {
  for (const method of ["GET", "PUT"]) {
    const response = await handleReservationRequest(request(method));
    assert.equal(response.status, 405);
    assertJson(response, true);
  }
  for (const body of ["{", "[]", "null"]) {
    const response = await handleReservationRequest(request("POST", body));
    assert.equal(response.status, 400);
    assertJson(response, true);
  }
  const body = { ok: true, request: { request_id: "ER-ABCDEF123456" } };
  const response = await handleReservationRequest(request("POST", {}), {
    createBookingRequest: async () => ({ status: 201, body }),
    logger: () => { throw new Error("logger failed"); },
  });
  assert.equal(response.status, 201);
  assertJson(response, true);
  assert.deepEqual(await response.json(), body);
  const thrown = await handleReservationRequest(request("POST", {}), {
    createBookingRequest: async () => { throw new Error("secret-key"); },
    logger: () => {},
  });
  assert.equal(thrown.status, 500);
  assert.deepEqual(await thrown.json(), { error: "store_unavailable" });
  const logs = [];
  const searchResponse = await handleSearchCars(request("POST", search), {
    now, logger: () => { throw new Error("logger failed"); },
  });
  assert.equal(searchResponse.status, 200);
  await handleReservationRequest(request("POST", { email: "private@example.test" }), {
    createBookingRequest: async () => ({ status: 500, body: { error: "store_unavailable" } }),
    logger: (line) => logs.push(line),
  });
  assert.doesNotMatch(logs.join(""), /private@example|secret-key/);
});
