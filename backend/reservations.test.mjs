import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "./server.mjs";
import { createReservationService } from "./reservations.mjs";
import { searchCars } from "./search.mjs";

const search = {
  pickup_airport: "DXB", pickup_date: "October 7", pickup_time: "07:00",
  return_date: "October 10", return_time: "07:00", driver_age: 30,
};
const fixedNow = () => new Date("2026-09-22T00:00:00Z");
// reviewed_rental is the released backend result's rental, as the browser holds it.
const reviewed = (terms, now = fixedNow()) => searchCars(terms, { now }).rental;
const input = { search, car_id: "demo-dxb-1", email: " Traveller@Example.test ", reviewed_rental: reviewed(search) };
const withSearch = (changes, extra = {}) => {
  const terms = { ...search, ...changes };
  return { ...input, search: terms, reviewed_rental: reviewed(terms), ...extra };
};

async function fixture(run) {
  const dataDir = await mkdtemp(join(tmpdir(), "echorent-reservations-"));
  const sent = [];
  const failRoles = new Set();
  const sendEmail = async (mail) => {
    sent.push(mail);
    const role = mail.idempotencyKey.split("/")[1];
    if (failRoles.has(role)) throw new Error("fake delivery failure");
    return { id: `provider-${sent.length}` };
  };
  const options = { dataDir, apiKey: "fake-key", from: "EchoRent <from@example.test>", notifyTo: "notify@example.test", now: fixedNow, sendEmail };
  const service = () => createReservationService(options);
  const lines = async () => (await readFile(join(dataDir, "reservation-requests.jsonl"), "utf8"))
    .trim().split("\n").map(JSON.parse);
  try { await run({ dataDir, sent, failRoles, service, lines, options }); }
  finally { await rm(dataDir, { recursive: true, force: true }); }
}

test("creates only pending from canonical car and rental, then sends two plain-text messages", async () => fixture(async ({ service, sent, lines }) => {
  const { status, body } = await service().createBookingRequest(input);
  assert.equal(status, 201);
  assert.match(body.request.request_id, /^ER-[0-9A-F]{12}$/);
  assert.equal(body.request.status, "pending");
  assert.equal(body.request.car.car_id, "demo-dxb-1");
  assert.equal(body.request.rental.pickup.date, "2026-10-07");
  assert.deepEqual(body.notifications, { internal: { status: "sent" }, traveller: { status: "sent" } });
  const records = await lines();
  assert.equal(records.filter(({ type }) => type === "request").length, 1);
  assert.equal(records[0].status, "pending");
  assert.deepEqual(sent.map(({ to }) => to), [["notify@example.test"], "Traveller@Example.test"]);
  for (const mail of sent) {
    assert.equal(typeof mail.text, "string");
    assert.match(mail.text, new RegExp(body.request.request_id));
    assert.match(mail.text, /pending/i);
    assert.doesNotMatch(mail.text + mail.subject, /\u2014/);
    assert.equal("html" in mail, false);
  }
  const id = body.request.request_id;
  const [internal, traveller] = sent;
  assert.equal(internal.subject, `EchoRent | New reservation request | ${id}`);
  for (const line of [`Request ID: ${id}`, "Status: Pending", "Email: Traveller@Example.test",
    "Airport: Dubai International (DXB)", "Vehicle: Toyota Corolla (demo-dxb-1)",
    "Pickup: Wednesday 2026-10-07 at 07:00", "Return: Saturday 2026-10-10 at 07:00", "Driver age: 30",
    "demo inventory and does not represent live vehicle availability", "No vehicle has been reserved or guaranteed.",
    "Human review is required"]) assert.ok(internal.text.includes(line), line);
  assert.equal(traveller.subject, `EchoRent | Request received | ${id}`);
  for (const line of ["We received your EchoRent reservation request.", `Request ID: ${id}`, "Status: Pending human review",
    "Rental summary", "Vehicle: Toyota Corolla", "Airport: Dubai International (DXB)",
    "Pickup: Wednesday 2026-10-07 at 07:00", "Return: Saturday 2026-10-10 at 07:00",
    "It is not a confirmed rental, and the vehicle is not reserved or guaranteed.", "demo inventory, not live rental availability"]) {
    assert.ok(traveller.text.includes(line), line);
  }
  for (const mail of sent) {
    const all = mail.subject + mail.text;
    assert.doesNotMatch(all, /\bconfirmed\b(?! rental)|\bbooked\b|\bapprove|\breject|https?:|\bshortly\b|\bwithin\b|\bhours?\b|\bdays?\b|\bwill be (accepted|approved)/i);
    assert.doesNotMatch(all, /\b(is|are) (reserved|guaranteed)\b|\byour (car|vehicle) has been reserved/i);
  }
  assert.doesNotMatch(traveller.text, /Driver age|Traveller@Example|demo-dxb-1/);
  assert.deepEqual(sent.map(({ idempotencyKey }) => idempotencyKey), [
    `${body.request.request_id}/internal`, `${body.request.request_id}/traveller`,
  ]);
}));

test("rejects malformed requests, email, cars, and canonical search failures before any side effect", async () => fixture(async ({ service, sent, dataDir }) => {
  const create = service().createBookingRequest;
  const bad = [
    ...["status", "confirmed", "approved", "force", "create_separate", "request_id"].map((key) => ({ ...input, [key]: true })),
    { ...input, email: "bad address@example.test" }, { ...input, email: "a".repeat(65) + "@example.test" },
    { ...input, email: "a@" + "b".repeat(250) + ".test" }, { ...input, email: "bad\r\n@example.test" },
    { ...input, email: "" }, { search, car_id: "demo-dxb-9", email: input.email },
    { ...input, car_id: "demo-sin-1" },
    { ...input, search: { ...search, pickup_airport: "LHR" } },
    { ...input, search: { ...search, pickup_date: "today", pickup_time: "00:00" } },
    { ...input, search: { ...search, pickup_date: "not a date" } },
    { ...input, search: { pickup_airport: "DXB" } },
  ];
  for (const request of bad) assert.equal((await create(request)).body.ok, false);
  const { reviewed_rental: _omitted, ...withoutReviewed } = input;
  const malformed = [
    withoutReviewed,
    { ...input, reviewed_rental: null },
    { ...input, reviewed_rental: { ...input.reviewed_rental, status: "confirmed" } },
    { ...input, reviewed_rental: { ...input.reviewed_rental, pickup: { date: "2026-10-07", time: "07:00" } } },
  ];
  for (const request of malformed) assert.equal((await create(request)).body.errors[0].code, "invalid_request");
  assert.equal(sent.length, 0);
  await assert.rejects(readFile(join(dataDir, "reservation-requests.jsonl")));
}));

test("reviewed rental that no longer matches the canonical re-search expires before any side effect", async () => fixture(async ({ options, sent, dataDir }) => {
  const relative = { ...search, pickup_date: "tomorrow", pickup_time: "10:00", return_date: "tomorrow", return_time: "18:00" };
  const beforeMidnight = new Date("2026-09-22T19:50:00Z"); // DXB 23:50
  const afterMidnight = new Date("2026-09-22T20:05:00Z"); // DXB 00:05 next day
  const shown = reviewed(relative, beforeMidnight);
  assert.equal(shown.pickup.date, "2026-09-23");
  const late = createReservationService({ ...options, now: () => afterMidnight });
  const request = { ...input, search: relative, reviewed_rental: shown };
  const expired = await late.createBookingRequest(request);
  assert.equal(expired.status, 409);
  assert.equal(expired.body.errors[0].code, "search_expired");
  assert.equal("request" in expired.body || "existing_request" in expired.body, false);
  for (const changed of [
    { ...shown, driver_age: 31 }, { ...shown, airport_name: "Other" },
    { ...shown, return: { ...shown.return, time: "19:00" } },
  ]) assert.equal((await late.createBookingRequest({ ...request, reviewed_rental: changed })).status, 409);
  assert.equal(sent.length, 0);
  await assert.rejects(readFile(join(dataDir, "reservation-requests.jsonl")));
  const onTime = createReservationService({ ...options, now: () => beforeMidnight });
  const created = await onTime.createBookingRequest(request);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.request.rental, shown);
  assert.equal(sent.length, 2);
}));

test("missing email configuration rejects before persistence", async () => fixture(async ({ options, sent, dataDir }) => {
  for (const missing of [{ apiKey: "" }, { from: "invalid from" }, { notifyTo: "bad recipient" },
    { notifyTo: "notify@example.test,second@example.test" }]) {
    const service = createReservationService({ ...options, ...missing });
    assert.equal((await service.createBookingRequest(input)).status, 503);
  }
  assert.equal(sent.length, 0);
  await assert.rejects(readFile(join(dataDir, "reservation-requests.jsonl")));
}));

test("persistence failure sends zero email", async () => fixture(async ({ options, sent }) => {
  const service = createReservationService({ ...options, appendLine: async () => { throw new Error("disk failure"); } });
  const result = await service.createBookingRequest(input);
  assert.equal(result.body.errors[0].code, "request_not_saved");
  assert.equal(sent.length, 0);
}));

test("each email failure preserves a pending request and only failed role retries", async () => fixture(async ({ service, sent, failRoles, lines }) => {
  failRoles.add("traveller");
  const first = (await service().createBookingRequest(input)).body;
  assert.equal(first.ok, true);
  assert.deepEqual(first.notifications, { internal: { status: "sent" }, traveller: { status: "failed" } });
  failRoles.clear();
  const second = (await service().createBookingRequest({ ...input, email: "traveller@example.test" })).body;
  assert.equal(second.replayed, true);
  assert.equal(second.request.request_id, first.request.request_id);
  assert.equal(second.request.created_at, first.request.created_at);
  assert.deepEqual(sent.map(({ idempotencyKey }) => idempotencyKey), [
    `${first.request.request_id}/internal`, `${first.request.request_id}/traveller`, `${first.request.request_id}/traveller`,
  ]);
  assert.equal((await lines()).filter(({ type }) => type === "request").length, 1);
  const third = (await service().createBookingRequest(input)).body;
  assert.equal(third.replayed, true);
  assert.equal(sent.length, 3);
}));

test("internal and both failures retain pending, and missing notification lines retry", async () => fixture(async ({ service, sent, failRoles, lines, dataDir }) => {
  failRoles.add("internal"); failRoles.add("traveller");
  const first = (await service().createBookingRequest(input)).body;
  assert.equal(first.request.status, "pending");
  assert.equal(first.notifications.internal.status, "failed");
  assert.equal(first.notifications.traveller.status, "failed");
  failRoles.delete("internal");
  const second = (await service().createBookingRequest(input)).body;
  assert.equal(second.notifications.internal.status, "sent");
  assert.equal(second.notifications.traveller.status, "failed");
  const records = (await lines()).filter(({ type }) => type === "request");
  await writeFile(join(dataDir, "reservation-requests.jsonl"), `${JSON.stringify(records[0])}\n`);
  failRoles.clear();
  const replay = (await service().createBookingRequest(input)).body;
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.notifications, { internal: { status: "sent" }, traveller: { status: "sent" } });
  assert.equal(sent.length, 6);
}));

test("Resend rejection persists a PII-safe diagnostic, stays off the public body, and exact replay retries", async () => fixture(async ({ options, lines }) => {
  const calls = [];
  let reply = () => new Response(JSON.stringify({ statusCode: 400, name: "validation_error", message: "API key is invalid" }), { status: 400 });
  const fetchImpl = async (_url, init) => { calls.push(init.headers["Idempotency-Key"]); return reply(); };
  const resend = () => createReservationService({ ...options, sendEmail: undefined, fetchImpl });
  const first = await resend().createBookingRequest(input);
  assert.equal(first.status, 201);
  assert.deepEqual(first.body.notifications, { internal: { status: "failed" }, traveller: { status: "failed" } });
  const diagnostic = { provider: "resend", operation: "send", status: 400, code: "validation_error", message: "API key is invalid" };
  assert.deepEqual(first.notification_errors, { internal: diagnostic, traveller: diagnostic });
  assert.equal(JSON.stringify(first.body).includes("validation_error"), false);
  assert.deepEqual((await lines()).filter(({ type }) => type === "notification").map(({ error }) => error), [diagnostic, diagnostic]);
  reply = () => new Response('{"id":"mail-ok"}', { status: 200 });
  const replay = await resend().createBookingRequest(input);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.request.request_id, first.body.request.request_id);
  assert.deepEqual(replay.body.notifications, { internal: { status: "sent" }, traveller: { status: "sent" } });
  assert.deepEqual(replay.notification_errors, {});
  const id = first.body.request.request_id;
  assert.deepEqual(calls, [`${id}/internal`, `${id}/traveller`, `${id}/internal`, `${id}/traveller`]);
  assert.equal((await lines()).filter(({ type }) => type === "request").length, 1);
}));

test("a failed internal notification retries without resending the successful acknowledgement", async () => fixture(async ({ service, sent, failRoles }) => {
  failRoles.add("internal");
  const first = (await service().createBookingRequest(input)).body;
  assert.equal(first.notifications.traveller.status, "sent");
  failRoles.clear();
  const replay = (await service().createBookingRequest(input)).body;
  assert.equal(replay.replayed, true);
  assert.deepEqual(sent.map(({ idempotencyKey }) => idempotencyKey), [
    `${first.request.request_id}/internal`, `${first.request.request_id}/traveller`, `${first.request.request_id}/internal`,
  ]);
}));

test("restart preserves exact replay and overlap conflict; conflict discloses existence only", async () => fixture(async ({ service, sent, lines }) => {
  const first = (await service().createBookingRequest(input)).body;
  const restarted = service();
  const replay = (await restarted.createBookingRequest(input)).body;
  assert.equal(replay.request.request_id, first.request.request_id);
  assert.equal(replay.replayed, true);
  assert.equal(sent.length, 2);
  const conflict = await restarted.createBookingRequest({ ...input, car_id: "demo-dxb-2" });
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.body.existing_request, { status: "pending" });
  const serialized = JSON.stringify(conflict.body);
  for (const secret of [first.request.request_id, "Traveller", "demo-dxb", "2026-10", "driver_age", "30"]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(sent.length, 2);
  assert.equal((await lines()).filter(({ type }) => type === "request").length, 1);
}));

test("partial overlap and changed age conflict; touching, cross-airport, different email, separate dates create", async () => fixture(async ({ service, sent, lines }) => {
  const create = service().createBookingRequest;
  await create(input);
  const partial = withSearch({ pickup_date: "October 9", return_date: "October 12" });
  assert.equal((await create(partial)).body.errors[0].code, "existing_request");
  assert.equal((await create(withSearch({ driver_age: 31 }))).body.errors[0].code, "existing_request");
  const touch = withSearch({ pickup_date: "October 10", return_date: "October 12" });
  const separate = withSearch({ pickup_date: "October 15", return_date: "October 17" });
  const cross = withSearch({ pickup_airport: "SIN" }, { car_id: "demo-sin-1" });
  const other = { ...input, email: "other@example.test" };
  const created = await Promise.all([create(touch), create(separate), create(cross), create(other)]);
  assert.ok(created.every(({ status }) => status === 201));
  assert.equal(new Set(created.map(({ body }) => body.request.request_id)).size, 4);
  assert.equal((await lines()).filter(({ type }) => type === "request").length, 5);
  assert.equal(sent.length, 10);
}));

test("concurrent identical and overlapping submissions serialize decisions", async () => fixture(async ({ service, lines, sent }) => {
  const create = service().createBookingRequest;
  const same = await Promise.all(Array.from({ length: 6 }, () => create(input)));
  assert.equal(same.filter(({ status }) => status === 201).length, 1);
  assert.equal(same.filter(({ body }) => body.replayed).length, 5);
  assert.equal(sent.length, 2);
  assert.equal((await lines()).filter(({ type }) => type === "request").length, 1);
  const distinct = withSearch({ pickup_date: "November 1", return_date: "November 4" });
  const [a, b] = await Promise.all([create(distinct), create({ ...distinct, car_id: "demo-dxb-2" })]);
  assert.deepEqual([a.status, b.status], [201, 409]);
}));

test("corrupt JSONL fails closed without email", async () => fixture(async ({ service, sent, dataDir }) => {
  await writeFile(join(dataDir, "reservation-requests.jsonl"), '{broken\n');
  const result = await service().createBookingRequest(input);
  assert.equal(result.body.errors[0].code, "store_unavailable");
  await writeFile(join(dataDir, "reservation-requests.jsonl"), '{"type":"request","status":"pending"}\n');
  assert.equal((await service().createBookingRequest(input)).body.errors[0].code, "store_unavailable");
  assert.equal(sent.length, 0);
}));

test("HTTP route rejects PUT/PATCH and logs no email or key", async () => fixture(async ({ options }) => {
  const logs = [];
  const server = createServer({ reservationOptions: options, logger: (line) => logs.push(line) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const method of ["PUT", "PATCH"]) {
      assert.equal((await fetch(`${root}/api/reservation_requests`, { method })).status, 405);
    }
    const response = await fetch(`${root}/api/reservation_requests`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).request.status, "pending");
    assert.doesNotMatch(logs.join(" "), /Traveller|Example|fake-key|notify@example/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
}));

test("HTTP route logs provider failure code without key, auth header, or addresses", async () => fixture(async ({ options }) => {
  const logs = [];
  const fetchImpl = async () => new Response(JSON.stringify({ name: "validation_error", message: "The example.test domain is not verified" }), { status: 403 });
  const server = createServer({ reservationOptions: { ...options, sendEmail: undefined, fetchImpl }, logger: (line) => logs.push(line) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reservation_requests`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal("notification_errors" in body, false);
    const log = JSON.parse(logs.at(-1));
    assert.equal(log.notification_errors.traveller.status, 403);
    assert.equal(log.notification_errors.traveller.code, "validation_error");
    assert.doesNotMatch(logs.join(" "), /Traveller@|notify@example|fake-key|Bearer|Authorization/i);
  } finally { await new Promise((resolve) => server.close(resolve)); }
}));
