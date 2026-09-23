import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { onRequest as reservationAdapter } from "../functions/api/reservation_requests.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(repo, "node_modules", "wrangler", "bin", "wrangler.js");
const stateParent = resolve(repo, ".wrangler", "test-state");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function dateWord(days) {
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-US", {
    month: "long", day: "numeric", timeZone: "UTC",
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

export async function startRuntime() {
  const root = resolve(stateParent, randomUUID());
  const site = join(root, "site");
  const persist = join(root, "db");
  await mkdir(site, { recursive: true });
  await writeFile(join(site, "index.html"), "<!doctype html><title>EchoRent local test</title>");
  await writeFile(join(site, "_worker.js"), `
import { onRequest as token } from "../../../../functions/api/voice/token.js";
import { onRequest as search } from "../../../../functions/api/search_cars.js";
import { onRequest as reservation } from "../../../../functions/api/reservation_requests.js";
const attempts = new Map();
globalThis.fetch = async (url, init) => {
  if (String(url) !== "https://api.resend.com/emails") throw new Error("Provider network disabled");
  const key = init.headers["Idempotency-Key"];
  const count = (attempts.get(key) ?? 0) + 1;
  attempts.set(key, count);
  console.log("TEST_EMAIL_KEY " + key);
  const email = JSON.parse(init.body).to;
  if (email.includes("failonce@b.test") && key.endsWith("/traveller") && count === 1)
    return Response.json({ name: "FakeFailure", message: "private@b.test failure" }, { status: 503 });
  return Response.json({ id: "fake-" + key.split("/")[1] + "-" + count });
};
export default { async fetch(request, env, ctx) {
  const path = new URL(request.url).pathname;
  if (path === "/api/voice/token") return token({ request, env, ctx });
  if (path === "/api/search_cars") return search({ request, env, ctx });
  if (path === "/api/reservation_requests") return reservation({ request, env, ctx });
  return env.ASSETS.fetch(request);
} };
`);
  const childEnv = { ...process.env, XDG_CONFIG_HOME: join(root, "config") };
  function cli(args, ok = true) {
    const result = spawnSync(process.execPath, [wrangler, ...args], {
      cwd: repo, env: childEnv, encoding: "utf8", timeout: 30_000,
    });
    if (ok && result.status !== 0) throw new Error(`Wrangler failed: ${result.stderr || result.stdout}`);
    return result;
  }
  try {
    cli(["d1", "migrations", "apply", "echorent", "--local", "--persist-to", persist]);
  } catch (error) {
    await stopRuntime({ root, child: null });
    throw error;
  }
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    wrangler, "pages", "dev", site, "--ip", "127.0.0.1", "--port", String(port),
    "--persist-to", persist, "--binding", "RESEND_API_KEY=fake",
    "--binding", "ECHORENT_EMAIL_FROM=from@example.test",
    "--binding", "ECHORENT_NOTIFY_TO=notify@example.test",
    "--show-interactive-dev-session=false",
  ], { cwd: repo, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Pages exited: ${output}`);
      try {
        const response = await fetch(`${base}/api/voice/token`, { signal: AbortSignal.timeout(500) });
        if (response.status === 503) return { root, persist, base, child, cli, output: () => output };
      } catch { /* Wait for startup. */ }
      await sleep(100);
    }
    throw new Error(`Pages startup timed out: ${output}`);
  } catch (error) {
    await stopRuntime({ root, child });
    throw error;
  }
}

export async function stopRuntime({ root, child }) {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((done) => child.once("exit", done)), sleep(2_000)]);
    if (child.exitCode === null && process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { encoding: "utf8" });
    }
  }
  if (!root.startsWith(stateParent + sep)) throw new Error("Unsafe test cleanup path");
  await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
}

export function sql(runtime, command, ok = true) {
  const result = runtime.cli([
    "d1", "execute", "echorent", "--local", "--persist-to", runtime.persist,
    "--command", command, "--json",
  ], ok);
  return ok ? JSON.parse(result.stdout).at(-1).results : result;
}

export async function post(runtime, path, body, method = "POST") {
  const response = await fetch(runtime.base + path, {
    method, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

export async function input(runtime, {
  airport = "DXB", start = 10, end = 13, email = "a@b.test", age = 30, car = 0,
} = {}) {
  const search = {
    pickup_airport: airport, pickup_date: dateWord(start), pickup_time: "07:00",
    return_date: dateWord(end), return_time: "07:00", driver_age: age,
  };
  const result = await post(runtime, "/api/search_cars", search);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  return {
    search, car_id: result.body.cars[car].car_id, email, reviewed_rental: result.body.rental,
  };
}

async function reset(runtime) {
  sql(runtime, "DELETE FROM reservation_notifications; DELETE FROM reservation_requests");
}

function count(runtime) {
  return sql(runtime, "SELECT count(*) AS n FROM reservation_requests")[0].n;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) test("D1-D16 real local Pages D1 reservation semantics", { timeout: 180_000 }, async (t) => {
  const runtime = await startRuntime();
  try {
    await t.test("D1 first creation and pending notifications", async () => {
      await reset(runtime);
      const result = await post(runtime, "/api/reservation_requests", await input(runtime));
      assert.equal(result.status, 201);
      assert.equal(result.body.request.status, "pending");
      assert.deepEqual(result.body.notifications, { internal: { status: "sent" }, traveller: { status: "sent" } });
      assert.equal(count(runtime), 1);
    });
    await t.test("D2 exact replay retains ID and sent roles", async () => {
      await reset(runtime);
      const value = await input(runtime);
      const first = await post(runtime, "/api/reservation_requests", value);
      const second = await post(runtime, "/api/reservation_requests", value);
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.body.replayed, true);
      assert.equal(second.body.request.request_id, first.body.request.request_id);
      assert.equal(count(runtime), 1);
      assert.equal(sql(runtime, "SELECT count(*) AS n FROM reservation_notifications")[0].n, 2);
    });
    await t.test("D3 normalized email key", async () => {
      await reset(runtime);
      assert.equal((await post(runtime, "/api/reservation_requests", await input(runtime, { email: " A@B.test " }))).status, 201);
      assert.equal(sql(runtime, "SELECT email_key FROM reservation_requests")[0].email_key, "a@b.test");
    });
    await t.test("D4 overlap, changed car and age conflict without email", async () => {
      await reset(runtime);
      const first = await input(runtime);
      assert.equal((await post(runtime, "/api/reservation_requests", first)).status, 201);
      const variants = [
        await input(runtime, { start: 11, end: 14 }),
        await input(runtime, { car: 1 }),
        await input(runtime, { age: 31 }),
      ];
      const before = runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0;
      for (const value of variants) {
        const result = await post(runtime, "/api/reservation_requests", value);
        assert.equal(result.status, 409);
        assert.deepEqual(result.body.existing_request, { status: "pending" });
      }
      assert.equal(count(runtime), 1);
      assert.equal(runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0, before);
    });
    await t.test("D5 touching windows, other airport and email are independent", async () => {
      await reset(runtime);
      for (const options of [{}, { start: 13, end: 16 }, { airport: "SIN" }, { email: "other@b.test" }]) {
        assert.equal((await post(runtime, "/api/reservation_requests", await input(runtime, options))).status, 201);
      }
      assert.equal(count(runtime), 4);
    });
    await t.test("D6 validation, stale review and canonical failure write nothing", async () => {
      await reset(runtime);
      const valid = await input(runtime);
      const cases = [
        { ...valid, email: "bad" },
        { ...valid, car_id: "missing" },
        { ...valid, reviewed_rental: { ...valid.reviewed_rental, driver_age: 31 } },
        { ...valid, extra: true },
        { ...valid, search: { ...valid.search, pickup_airport: "LHR" } },
      ];
      const before = runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0;
      for (const value of cases) assert.notEqual((await post(runtime, "/api/reservation_requests", value)).status, 201);
      assert.equal(count(runtime), 0);
      assert.equal(runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0, before);
    });
    await t.test("D7 missing DB/config returns 503 without writes", async () => {
      await reset(runtime);
      const value = await input(runtime);
      for (const env of [{}, { RESEND_API_KEY: "fake", ECHORENT_EMAIL_FROM: "from@example.test", ECHORENT_NOTIFY_TO: "notify@example.test" }]) {
        const response = await reservationAdapter({ request: new Request(runtime.base + "/api/reservation_requests", { method: "POST", body: JSON.stringify(value) }), env });
        assert.equal(response.status, 503);
        assert.equal((await response.json()).errors[0].code, "reservations_unavailable");
      }
      assert.equal(count(runtime), 0);
    });
    await t.test("D8 pending only, confirmed rejected by schema", async () => {
      await reset(runtime);
      const result = await post(runtime, "/api/reservation_requests", await input(runtime));
      assert.equal(result.body.request.status, "pending");
      assert.doesNotMatch(JSON.stringify(result.body), /confirmed|guaranteed/i);
      const row = sql(runtime, "SELECT status FROM reservation_requests")[0];
      assert.equal(row.status, "pending");
      const rejected = sql(runtime, `INSERT INTO reservation_requests (
        request_id, created_at, status, email, email_key, airport, pickup_at, return_at,
        driver_age, car_id, car_json, rental_json, from_address, notify_to_json
      ) SELECT 'ER-AAAAAAAAAAAA', created_at, 'confirmed', email, 'other@b.test',
        airport, pickup_at, return_at, driver_age, car_id, car_json, rental_json,
        from_address, notify_to_json FROM reservation_requests LIMIT 1`, false);
      assert.notEqual(rejected.status, 0);
    });
    await t.test("D9-D10 failure persists and replay retries only failed role", async () => {
      await reset(runtime);
      const value = await input(runtime, { email: "failonce@b.test" });
      const first = await post(runtime, "/api/reservation_requests", value);
      assert.equal(first.status, 201);
      assert.equal(first.body.notifications.traveller.status, "failed");
      assert.equal(count(runtime), 1);
      assert.doesNotMatch(JSON.stringify(first.body), /FakeFailure|private@b\.test/);
      const failed = sql(runtime, "SELECT error_json FROM reservation_notifications WHERE role='traveller'")[0];
      assert.match(failed.error_json, /FakeFailure/);
      assert.doesNotMatch(failed.error_json, /private@b\.test/);
      const second = await post(runtime, "/api/reservation_requests", value);
      assert.equal(second.status, 200);
      assert.equal(second.body.request.request_id, first.body.request.request_id);
      assert.equal(second.body.notifications.traveller.status, "sent");
      await sleep(50);
      const keys = runtime.output().match(new RegExp(`TEST_EMAIL_KEY ${first.body.request.request_id}/(internal|traveller)`, "g")) ?? [];
      assert.equal(keys.filter((key) => key.endsWith("/internal")).length, 1);
      assert.equal(keys.filter((key) => key.endsWith("/traveller")).length, 2);
    });
    await t.test("D11 sent notification is sticky on replay", async () => {
      await reset(runtime);
      const value = await input(runtime);
      const first = await post(runtime, "/api/reservation_requests", value);
      assert.equal(first.status, 201);
      const before = runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0;
      assert.equal((await post(runtime, "/api/reservation_requests", value)).status, 200);
      await sleep(50);
      assert.equal(runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0, before);
      sql(runtime, `INSERT INTO reservation_notifications (
        request_id, role, status, provider_id, error_json, updated_at
      ) VALUES ('${first.body.request.request_id}', 'traveller', 'failed', NULL, '{"code":"late_failure"}', 'later')
      ON CONFLICT(request_id, role) DO UPDATE SET
        status=excluded.status, provider_id=excluded.provider_id,
        error_json=excluded.error_json, updated_at=excluded.updated_at
      WHERE reservation_notifications.status <> 'sent'`);
      assert.deepEqual(sql(runtime, "SELECT status FROM reservation_notifications ORDER BY role").map((row) => row.status), ["sent", "sent"]);
    });
    await t.test("D12 claim failure sends no email", async () => {
      await reset(runtime);
      sql(runtime, "CREATE TRIGGER fail_claim BEFORE INSERT ON reservation_requests BEGIN SELECT RAISE(FAIL, 'test claim failure'); END");
      try {
        const before = runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0;
        const result = await post(runtime, "/api/reservation_requests", await input(runtime));
        assert.equal(result.status, 500);
        assert.equal(result.body.errors[0].code, "request_not_saved");
        assert.equal(count(runtime), 0);
        assert.equal(runtime.output().match(/TEST_EMAIL_KEY/g)?.length ?? 0, before);
      } finally { sql(runtime, "DROP TRIGGER fail_claim"); }
    });
    await t.test("D13 twenty identical submissions create one logical request", async () => {
      await reset(runtime);
      const value = await input(runtime);
      const results = await Promise.all(Array.from({ length: 20 }, () => post(runtime, "/api/reservation_requests", value)));
      assert.equal(results.filter(({ status }) => status === 201).length, 1);
      assert.equal(results.filter(({ status }) => status === 200).length, 19);
      assert.equal(new Set(results.map(({ body }) => body.request?.request_id)).size, 1);
      assert.equal(count(runtime), 1);
      assert.equal(sql(runtime, "SELECT count(*) AS n FROM reservation_notifications")[0].n, 2);
      await sleep(50);
      const id = results[0].body.request.request_id;
      const keys = runtime.output().match(new RegExp(`TEST_EMAIL_KEY ${id}/(?:internal|traveller)`, "g")) ?? [];
      assert.deepEqual(new Set(keys), new Set([`TEST_EMAIL_KEY ${id}/internal`, `TEST_EMAIL_KEY ${id}/traveller`]));
    });
    await t.test("D14 twenty overlapping submissions create one and conflict otherwise", async () => {
      await reset(runtime);
      const values = await Promise.all(Array.from({ length: 20 }, (_, index) => input(runtime, {
        start: 10, end: 13, email: "overlap@b.test", age: 30,
      }).then((value) => ({ ...value, search: { ...value.search, pickup_time: `07:${String(index).padStart(2, "0")}` } }))));
      for (const value of values) {
        const found = await post(runtime, "/api/search_cars", value.search);
        assert.equal(found.body.ok, true);
        value.reviewed_rental = found.body.rental;
      }
      const results = await Promise.all(values.map((value) => post(runtime, "/api/reservation_requests", value)));
      assert.equal(results.filter(({ status }) => status === 201).length, 1);
      assert.equal(results.filter(({ status }) => status === 409).length, 19);
      assert.equal(count(runtime), 1);
    });
    await t.test("D15 ten independent emails with duplicates create ten rows", async () => {
      await reset(runtime);
      const values = await Promise.all(Array.from({ length: 10 }, (_, index) => input(runtime, { email: `user${index}@b.test` })));
      const results = await Promise.all(values.flatMap((value) => [
        post(runtime, "/api/reservation_requests", value),
        post(runtime, "/api/reservation_requests", value),
      ]));
      assert.equal(results.filter(({ status }) => status === 201).length, 10);
      assert.equal(results.filter(({ status }) => status === 200).length, 10);
      assert.equal(count(runtime), 10);
    });
    await t.test("D16 schema rejects duplicate, bad ID, reversed time and orphan", async () => {
      await reset(runtime);
      const created = await post(runtime, "/api/reservation_requests", await input(runtime));
      assert.equal(created.status, 201);
      const id = created.body.request.request_id;
      const sqlRow = sql(runtime, "SELECT * FROM reservation_requests")[0];
      const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
      const insert = (overrides = {}) => {
        const row = { ...sqlRow, request_id: "ER-ABCDEF123456", ...overrides };
        const keys = ["request_id","created_at","status","email","email_key","airport","pickup_at","return_at","driver_age","car_id","car_json","rental_json","from_address","notify_to_json"];
        return `INSERT INTO reservation_requests (${keys.join(",")}) VALUES (${keys.map((key) => typeof row[key] === "number" ? row[key] : quote(row[key])).join(",")})`;
      };
      for (const statement of [
        insert(),
        insert({ request_id: "ER-bad-id", email_key: "other@b.test" }),
        insert({ request_id: "ER-ABCDEF123457", email_key: "other@b.test", pickup_at: sqlRow.return_at }),
        `INSERT INTO reservation_notifications (request_id,role,status,updated_at) VALUES ('ER-AAAAAAAAAAAA','internal','failed','now')`,
      ]) assert.notEqual(sql(runtime, statement, false).status, 0);
      assert.equal(count(runtime), 1);
      assert.equal(sql(runtime, "SELECT request_id FROM reservation_requests")[0].request_id, id);
    });
  } finally {
    await stopRuntime(runtime);
  }
});
