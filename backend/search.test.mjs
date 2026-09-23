import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { searchCars } from "./search.mjs";
import { createServer } from "./server.mjs";

const NOW = new Date("2026-09-22T00:00:00Z");
const REQUIRED = ["pickup_airport", "pickup_date", "pickup_time", "return_date", "return_time", "driver_age"];
const CAR_KEYS = ["car_id", "airport", "name", "category", "transmission", "seats", "bags", "daily_rate", "currency"];
// Frozen contract values, written out independently of demo-inventory.mjs.
const FROZEN_CARS = {
  DXB: [
    { car_id: "demo-dxb-1", airport: "DXB", name: "Toyota Corolla", category: "economy", transmission: "automatic", seats: 5, bags: 2, daily_rate: 120, currency: "AED" },
    { car_id: "demo-dxb-2", airport: "DXB", name: "Nissan X-Trail", category: "suv", transmission: "automatic", seats: 5, bags: 4, daily_rate: 210, currency: "AED" },
    { car_id: "demo-dxb-3", airport: "DXB", name: "BMW 3 Series", category: "premium", transmission: "automatic", seats: 5, bags: 2, daily_rate: 320, currency: "AED" },
  ],
  SIN: [
    { car_id: "demo-sin-1", airport: "SIN", name: "Toyota Corolla Altis", category: "economy", transmission: "automatic", seats: 5, bags: 2, daily_rate: 60, currency: "SGD" },
    { car_id: "demo-sin-2", airport: "SIN", name: "Honda HR-V", category: "suv", transmission: "automatic", seats: 5, bags: 3, daily_rate: 95, currency: "SGD" },
    { car_id: "demo-sin-3", airport: "SIN", name: "BMW 3 Series", category: "premium", transmission: "automatic", seats: 5, bags: 2, daily_rate: 160, currency: "SGD" },
  ],
};
const golden = {
  pickup_airport: "SIN",
  pickup_date: "September 24",
  pickup_time: "07:00",
  return_date: "October 17",
  return_time: "19:00",
  driver_age: 24,
};

function result(overrides = {}, options = {}) {
  return searchCars({ ...golden, ...overrides }, { now: NOW, ...options });
}

function code(response) {
  return response.errors[0].code;
}

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("searchCars date and state contract", () => {
  test("T1 golden SIN request normalizes dates and weekdays", () => {
    const response = result();
    assert.equal(response.ok, true);
    assert.deepEqual(response.rental.pickup, { date: "2026-09-24", weekday: "Thursday", time: "07:00" });
    assert.deepEqual(response.rental.return, { date: "2026-10-17", weekday: "Saturday", time: "19:00" });
  });

  test("T2 changing one field leaves unrelated normalized fields unchanged", () => {
    const first = result();
    const changed = result({ return_time: "20:00" });
    assert.deepEqual(changed.rental.pickup, first.rental.pickup);
    assert.equal(changed.rental.return.date, first.rental.return.date);
    assert.equal(changed.rental.driver_age, first.rental.driver_age);
    assert.equal(changed.rental.return.time, "20:00");
  });

  test("T3 December pickup and January return cross the year boundary", () => {
    const response = searchCars({ ...golden, pickup_date: "December 28", return_date: "January 3" }, { now: NOW });
    assert.equal(response.rental.pickup.date, "2026-12-28");
    assert.equal(response.rental.return.date, "2027-01-03");
  });

  test("T4 past calendar day moves to next year but past time today fails", () => {
    const wrapped = result({ pickup_date: "September 21", return_date: "September 22" });
    assert.equal(wrapped.rental.pickup.date, "2027-09-21");
    assert.equal(wrapped.rental.return.date, "2027-09-22");

    // 06:00Z is 14:00 in Singapore, so a 07:00 pickup today has passed.
    const late = { now: new Date("2026-09-22T06:00:00Z") };
    const past = searchCars({ ...golden, pickup_date: "today", pickup_time: "07:00", return_date: "tomorrow" }, late);
    assert.deepEqual(past.errors.map(({ field, code: c }) => [field, c]), [["pickup_time", "pickup_in_past"]]);

    // Today's month/day with a passed time must fail, not roll to 2027.
    const pastMonthDay = searchCars({ ...golden, pickup_date: "September 22", pickup_time: "07:00", return_date: "September 23" }, late);
    assert.equal(pastMonthDay.ok, false);
    assert.equal(code(pastMonthDay), "pickup_in_past");
  });

  test("T5 same-day chronology uses the time, not unequal-field rules", () => {
    assert.equal(result({ return_date: "September 24", return_time: "19:00" }).ok, true);
    assert.equal(code(result({ pickup_time: "19:00", return_date: "September 24", return_time: "07:00" })), "return_not_after_pickup");
    assert.equal(code(result({ return_date: "September 24", return_time: "07:00" })), "return_not_after_pickup");
    const sameClock = result({ return_date: "September 25", return_time: "07:00" });
    assert.equal(sameClock.ok, true);
    assert.equal(sameClock.rental.return.date, "2026-09-25");
  });

  test("T6 rental over 30 days returns rental_too_long", () => {
    assert.equal(code(result({ return_date: "November 1" })), "rental_too_long");
    const exactly30 = result({ return_date: "October 24", return_time: "07:00" });
    assert.equal(exactly30.ok, true);
    assert.equal(exactly30.rental.return.date, "2026-10-24");
    assert.equal(code(result({ return_date: "October 24", return_time: "07:01" })), "rental_too_long");
  });

  test("T7 today and tomorrow use airport-local dates around the UTC boundary", () => {
    const boundaryNow = new Date("2026-09-21T20:30:00Z");
    for (const airport of ["DXB", "SIN"]) {
      const response = searchCars({
        ...golden,
        pickup_airport: airport,
        pickup_date: "today",
        pickup_time: "07:00",
        return_date: "tomorrow",
      }, { now: boundaryNow });
      assert.equal(response.rental.pickup.date, "2026-09-22");
      assert.equal(response.rental.return.date, "2026-09-23");
    }
  });

  test("T8 accepts common month forms and rejects malformed calendar dates", () => {
    assert.equal(result({ pickup_date: "Sept 24" }).ok, true);
    assert.equal(result({ pickup_date: "September 24th" }).ok, true);
    for (const pickup_date of ["February 30", "April 31", "next Friday", "this weekend", "in three days", "the 24th"]) {
      assert.equal(code(result({ pickup_date })), "invalid_date", pickup_date);
    }
    assert.equal(code(result({ return_date: "next Friday" })), "invalid_date");
  });

  test("T8b February 29 resolves into the next leap year only when it is the next occurrence", () => {
    const leap = (now) => searchCars({ ...golden, pickup_date: "February 29", return_date: "March 2" }, { now: new Date(now) });
    for (const now of ["2027-03-01T00:00:00Z", "2027-01-10T00:00:00Z"]) {
      const response = leap(now);
      assert.equal(response.ok, true, now);
      assert.deepEqual(response.rental.pickup, { date: "2028-02-29", weekday: "Tuesday", time: "07:00" });
      assert.equal(response.rental.return.date, "2028-03-02");
    }
    // After 2028-02-29 the next occurrence is 2032, outside the current-or-next-year rule.
    assert.equal(code(leap("2028-03-01T00:00:00Z")), "invalid_date");
  });

  test("T9 validates canonical 24-hour times", () => {
    assert.equal(result({ pickup_time: "07:00", return_time: "23:59" }).ok, true);
    for (const pickup_time of ["24:00", "7:00", "07:60", "7pm"]) {
      assert.equal(code(result({ pickup_time })), "invalid_time", pickup_time);
    }
  });

  test("T10 ignores flight_arrival", () => {
    const response = searchCars({ ...golden, flight_arrival: "05:00" }, { now: NOW });
    assert.equal(response.ok, true);
    assert.equal(JSON.stringify(response.rental).includes("flight"), false);
    assert.equal(JSON.stringify(response).includes("05:00"), false);
  });
});

describe("required fields and domain validation", () => {
  test("T11 each omitted required field gets its exact missing_field error", async (t) => {
    for (const field of REQUIRED) {
      for (const [label, apply] of [
        ["deleted", (request) => delete request[field]],
        ["null", (request) => { request[field] = null; }],
        ["empty string", (request) => { request[field] = ""; }],
      ]) {
        await t.test(`${field} ${label}`, () => {
          const request = { ...golden };
          apply(request);
          const response = searchCars(request, { now: NOW });
          assert.equal(response.ok, false);
          assert.deepEqual(response.errors.map(({ field: errorField, code: errorCode }) => [errorField, errorCode]), [[field, "missing_field"]]);
        });
      }
    }
  });

  test("T12 rejects unsupported airports, including prototype keys and non-strings", () => {
    for (const pickup_airport of ["LHR", "dxb", "toString", "constructor", "__proto__", "hasOwnProperty", ["DXB"], { DXB: true }, 1]) {
      const response = result({ pickup_airport });
      assert.equal(response.ok, false, JSON.stringify(pickup_airport));
      assert.deepEqual(response.errors.map(({ field, code: c }) => [field, c]), [["pickup_airport", "unsupported_airport"]]);
    }
  });

  test("T13 enforces the demo age policy", () => {
    assert.equal(code(result({ driver_age: 20 })), "driver_underage");
    assert.equal(result({ driver_age: 21 }).ok, true);
    assert.equal(code(result({ driver_age: 150 })), "invalid_age");
  });

  test("T15 identical inputs and injected now produce identical results", () => {
    assert.deepEqual(result(), result());
  });
});

describe("inventory contract", () => {
  test("T16 inventory is frozen, exact, and airport/currency scoped", () => {
    assert.equal(Object.isFrozen(DEMO_INVENTORY), true);
    assert.equal(DEMO_INVENTORY.length, 6);
    assert.equal(DEMO_INVENTORY.every(Object.isFrozen), true);
    for (const airport of ["DXB", "SIN"]) {
      const response = result({ pickup_airport: airport });
      assert.equal(response.ok, true);
      assert.equal(response.cars.length, 3);
      assert.deepEqual(response.cars, FROZEN_CARS[airport]);
      for (const car of response.cars) assert.deepEqual(Object.keys(car).sort(), [...CAR_KEYS].sort());
    }
  });

  test("T17 all IDs are demo IDs and response is marked demo", () => {
    const response = result();
    assert.equal(response.demo, true);
    assert.equal(response.cars.length, 3);
    assert.equal(response.cars.every((car) => car.car_id.startsWith("demo-")), true);
  });

  test("T18 output is ordered, has three cars, and remains below 8 KiB", () => {
    const response = result();
    assert.deepEqual(response.cars.map(({ car_id }) => car_id), ["demo-sin-1", "demo-sin-2", "demo-sin-3"]);
    assert.equal(response.cars.length, 3);
    assert.ok(Buffer.byteLength(JSON.stringify(response)) < 8 * 1024);
  });

  test("T19 empty injected inventory succeeds with no cars", () => {
    const response = result({}, { cars: [] });
    assert.equal(response.ok, true);
    assert.deepEqual(response.cars, []);
  });

  test("T21 unsorted inventory sorts by rate then car_id and returns at most three", () => {
    const car = (car_id, airport, daily_rate) => ({
      car_id, airport, name: car_id, category: "economy", transmission: "automatic", seats: 5, bags: 2, daily_rate, currency: airport === "SIN" ? "SGD" : "AED",
    });
    const cars = [
      car("demo-sin-z", "SIN", 90),
      car("demo-sin-b", "SIN", 40),
      car("demo-dxb-x", "DXB", 1),
      car("demo-sin-e", "SIN", 50),
      car("demo-sin-a", "SIN", 40),
      car("demo-sin-c", "SIN", 30),
    ];
    const response = result({}, { cars });
    assert.deepEqual(response.cars.map(({ car_id }) => car_id), ["demo-sin-c", "demo-sin-a", "demo-sin-b"]);
    assert.deepEqual(result({}, { cars: [...cars].reverse() }).cars, response.cars);
  });
});

describe("T14 HTTP transport behavior", () => {
  const secret = "local-test-secret";
  const logs = [];
  let server;
  let baseUrl;
  let browserUrl;

  const post = (body, url = baseUrl) => fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body,
  });

  before(async () => {
    server = createServer({ secret, now: NOW, logger: (line) => logs.push(line) });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const root = `http://127.0.0.1:${server.address().port}`;
    baseUrl = `${root}/tools/search_cars`;
    browserUrl = `${root}/api/search_cars`;
  });

  after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  test("missing and wrong secrets return 401", async () => {
    const missing = await fetch(baseUrl, { method: "POST", body: JSON.stringify(golden) });
    const wrong = await fetch(baseUrl, { method: "POST", headers: { Authorization: "Bearer wrong" }, body: JSON.stringify(golden) });
    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
  });

  test("GET returns 405", async () => {
    assert.equal((await fetch(baseUrl)).status, 405);
  });

  test("non-JSON returns 400", async () => {
    const response = await fetch(baseUrl, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, body: "not json" });
    assert.equal(response.status, 400);
  });

  test("JSON that is not an object returns 400", async () => {
    for (const body of ["null", "[]", "42", "\"x\""]) {
      assert.equal((await post(body)).status, 400, body);
    }
  });

  test("valid semantic failures remain HTTP 200", async () => {
    const response = await post(JSON.stringify({ ...golden, driver_age: 20 }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).errors[0].code, "driver_underage");
  });

  test("browser search needs no bearer secret and matches canonical searchCars", async () => {
    const response = await fetch(browserUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(golden),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result());
  });

  test("browser and legacy routes return the same canonical result", async () => {
    const body = JSON.stringify(golden);
    const browser = await fetch(browserUrl, { method: "POST", body });
    const legacy = await post(body);
    assert.equal(browser.status, 200);
    assert.equal(legacy.status, 200);
    assert.deepEqual(await browser.json(), await legacy.json());
  });

  test("browser search preserves canonical business failures", async () => {
    for (const [overrides, expected] of [
      [{ driver_age: 20 }, "driver_underage"],
      [{ pickup_airport: "LHR" }, "unsupported_airport"],
    ]) {
      const response = await fetch(browserUrl, { method: "POST", body: JSON.stringify({ ...golden, ...overrides }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).errors[0].code, expected);
    }
  });

  test("browser search rejects malformed JSON and wrong methods", async () => {
    assert.equal((await fetch(browserUrl, { method: "POST", body: "not json" })).status, 400);
    assert.equal((await fetch(browserUrl)).status, 405);
  });

  test("logs never contain the tool secret", async () => {
    await post(JSON.stringify(golden));
    assert.ok(logs.length > 0);
    assert.equal(logs.some((line) => line.includes(secret)), false);
  });

  test("a throwing logger does not change the response or crash the process", async () => {
    const rejections = [];
    const onRejection = (error) => rejections.push(error);
    process.on("unhandledRejection", onRejection);
    const throwing = createServer({ secret, now: NOW, logger: () => { throw new Error("log sink down"); } });
    await new Promise((resolve) => throwing.listen(0, "127.0.0.1", resolve));
    try {
      const url = `http://127.0.0.1:${throwing.address().port}/tools/search_cars`;
      for (let i = 0; i < 2; i += 1) {
        const response = await post(JSON.stringify(golden), url);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).ok, true);
      }
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(rejections, []);
    } finally {
      process.off("unhandledRejection", onRejection);
      await new Promise((resolve) => throwing.close(resolve));
    }
  });
});

test("browser route passes injected inventory through canonical searchCars", async () => {
  const car = (car_id, daily_rate) => ({
    car_id, airport: "SIN", name: car_id, category: "economy", transmission: "automatic",
    seats: 5, bags: 2, daily_rate, currency: "SGD",
  });
  const cars = [car("demo-sin-z", 90), car("demo-sin-a", 40), car("demo-sin-b", 40)];
  await withServer({ secret: "secret", now: NOW, cars, logger: () => {} }, async (root) => {
    const response = await fetch(`${root}/api/search_cars`, { method: "POST", body: JSON.stringify(golden) });
    assert.deepEqual(await response.json(), searchCars(golden, { now: NOW, cars }));
  });
});

describe("voice token route", () => {
  const apiKey = "private-api-key";
  const agentId = "private-agent-id";
  const token = "single-use-token";
  const okFetch = async () => new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  test("returns exactly token and agent_id with no-store", async () => {
    await withServer({ apiKey, agentId, fetchImpl: okFetch, logger: () => {} }, async (root) => {
      const response = await fetch(`${root}/api/voice/token`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { token, agent_id: agentId });
    });
  });

  test("uses the expected upstream URL, query, and bearer header", async () => {
    let request;
    const fetchImpl = async (url, options) => {
      request = { url: String(url), options };
      return okFetch();
    };
    await withServer({ apiKey, agentId, fetchImpl, logger: () => {} }, async (root) => {
      assert.equal((await fetch(`${root}/api/voice/token`)).status, 200);
    });
    assert.equal(request.url, "https://agents.assemblyai.com/v1/token?expires_in_seconds=60&max_session_duration_seconds=1800");
    assert.equal(request.options.method, "GET");
    assert.equal(request.options.headers.Authorization, `Bearer ${apiKey}`);
  });

  test("never returns or logs server credentials", async () => {
    const logs = [];
    await withServer({ apiKey, agentId, fetchImpl: okFetch, logger: (line) => logs.push(line) }, async (root) => {
      const body = await (await fetch(`${root}/api/voice/token`)).text();
      assert.equal(body.includes(apiKey), false);
      assert.equal(logs.some((line) => [apiKey, token, agentId].some((secret) => line.includes(secret))), false);
    });
  });

  test("missing API key or agent ID returns 503 without an upstream call", async () => {
    for (const config of [{ apiKey: "", agentId }, { apiKey, agentId: "" }]) {
      let calls = 0;
      await withServer({ ...config, fetchImpl: async () => { calls += 1; return okFetch(); }, logger: () => {} }, async (root) => {
        const response = await fetch(`${root}/api/voice/token`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: "voice_unavailable" });
        assert.equal(response.headers.get("cache-control"), "no-store");
      });
      assert.equal(calls, 0);
    }
  });

  test("upstream non-2xx, malformed JSON, and missing token return 502", async () => {
    const fetches = [
      async () => new Response("no", { status: 500 }),
      async () => new Response("not json", { status: 200 }),
      async () => new Response("{}", { status: 200 }),
    ];
    for (const fetchImpl of fetches) {
      await withServer({ apiKey, agentId, fetchImpl, logger: () => {} }, async (root) => {
        const response = await fetch(`${root}/api/voice/token`);
        assert.equal(response.status, 502);
        assert.deepEqual(await response.json(), { error: "token_unavailable" });
      });
    }
  });

  test("network errors and timeouts return 502", async () => {
    const fetches = [
      async () => { throw new Error("offline"); },
      (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    ];
    for (const fetchImpl of fetches) {
      await withServer({ apiKey, agentId, fetchImpl, tokenTimeoutMs: 5, logger: () => {} }, async (root) => {
        assert.equal((await fetch(`${root}/api/voice/token`)).status, 502);
      });
    }
  });

  test("POST returns 405 and every response disables caching", async () => {
    await withServer({ apiKey, agentId, fetchImpl: okFetch, logger: () => {} }, async (root) => {
      const response = await fetch(`${root}/api/voice/token`, { method: "POST" });
      assert.equal(response.status, 405);
      assert.deepEqual(await response.json(), { error: "method_not_allowed" });
      assert.equal(response.headers.get("cache-control"), "no-store");
    });
  });
});

test("T20 canonical agent preserves Shen identity and exposes search_cars plus client-local select_car", async () => {
  const agentPath = fileURLToPath(new URL("../agents/echorent.jsonc", import.meta.url));
  const source = await readFile(agentPath, "utf8");
  const agent = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(agent.name, "EchoRent");
  assert.match(agent.system_prompt, /^You are Shen, EchoRent's airport car-rental voice agent\./);
  assert.equal(agent.greeting, "Hi, welcome to EchoRent. My name is Shen. How may I help you?");
  assert.equal(agent.voice.voice_id, "eve");
  assert.equal(agent.output.voice, "eve");
  assert.doesNotMatch(JSON.stringify(agent), /\b(?:Ryan|George)\b/i);
  assert.equal(agent.system_prompt.length <= 4_000, true);
  assert.match(agent.system_prompt, /Keep every rental field's current value across turns/);
  assert.match(agent.system_prompt, /Never ask for a known field again unless .*backend reports that field invalid/);
  assert.match(agent.system_prompt, /Asking for a missing field never resets known fields/);
  assert.match(agent.system_prompt, /A correction replaces only its identified field, including after validation failure; preserve all others/);
  assert.match(agent.system_prompt, /both month and day are explicit, in either natural order/);
  for (const completeDate of ["September 24", "September 24th", "24 September", "24th of September"]) {
    assert.match(agent.system_prompt, new RegExp(completeDate));
  }
  assert.match(agent.system_prompt, /Never ask to repeat a complete date just to reformat it for the tool/);
  assert.match(agent.system_prompt, /stop speaking any earlier validation failure/);
  assert.match(agent.system_prompt, /successful later search_cars result supersedes earlier validation errors/);
  assert.match(agent.system_prompt, /next Friday/);
  assert.match(agent.system_prompt, /Extract and retain every usable field in a single utterance/);
  assert.match(agent.system_prompt, /no cars are available for that search/);
  assert.match(agent.system_prompt, /call select_car immediately, before speaking/);
  assert.match(agent.system_prompt, /request is still under review/);
  assert.match(agent.system_prompt, /Never claim a rental is confirmed, booked, reserved, or guaranteed/);
  assert.match(agent.system_prompt, /Do not proactively mention demo inventory in normal speech/);
  assert.doesNotMatch(agent.system_prompt, /Say once that the options are demo/);
  assert.equal(agent.tools.length, 2);
  const [tool, select] = agent.tools;
  assert.equal(tool.name, "search_cars");
  assert.equal("http" in tool, false);
  assert.equal(tool.execution_mode, "hold");
  assert.equal(tool.timeout_seconds, 10);
  assert.deepEqual(tool.parameters.required, REQUIRED);
  assert.deepEqual(tool.parameters.properties.pickup_airport.enum, ["DXB", "SIN"]);
  // AssemblyAI matches `pattern` with Python `re` against the whole value. Emulate that in JS:
  // a leading `(?i)` is a Python global flag (only valid at the start), so map it to the `i`
  // flag and anchor the rest. The pattern is never compiled as-is by JS.
  for (const field of ["pickup_date", "pickup_time", "return_date", "return_time"]) {
    const { pattern, examples } = tool.parameters.properties[field];
    const caseless = pattern.startsWith("(?i)");
    const body = caseless ? pattern.slice(4) : pattern;
    assert.equal(body.includes("(?i)"), false, `${field}: inline flags only at the start`);
    const expression = new RegExp(`^(?:${body})$`, caseless ? "i" : "");
    assert.ok(examples.length > 0);
    assert.equal(examples.every((example) => expression.test(example)), true, field);
  }
  assert.equal(select.name, "select_car");
  assert.deepEqual(select.parameters.required, ["car_id"]);
  assert.equal(select.execution_mode, "hold");
  assert.equal(select.timeout_seconds, 10);
  assert.equal("http" in select, false);
  assert.match(agent.system_prompt, /TYPE their email on screen/);
  assert.match(agent.system_prompt, /pending human review/);
  assert.equal(agent.tools.some(({ name }) => /create|booking|reserv|modify|cancel|state|get_car_details/i.test(name)), false);
  assert.equal("input" in agent, false);
  assert.equal("llm" in agent, false);
});
