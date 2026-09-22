import assert from "node:assert/strict";
import { test } from "node:test";
import { createResendSender } from "./email.mjs";

test("Resend sender uses server-only fetch with stable idempotency header and plain text", async () => {
  const calls = [];
  const send = createResendSender({ apiKey: "fake-key", from: "EchoRent <from@example.test>", fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return new Response('{"id":"mail-1"}', { status: 200 });
  } });
  assert.deepEqual(await send({ to: "to@example.test", subject: "Pending", text: "Pending request", idempotencyKey: "ER-ABC/internal" }), { id: "mail-1" });
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers["Idempotency-Key"], "ER-ABC/internal");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    from: "EchoRent <from@example.test>", to: ["to@example.test"], subject: "Pending", text: "Pending request",
  });
});

test("Resend sender rejects with PII-safe diagnostics for non-2xx, invalid body, timeout, and network failure", async () => {
  const mail = { to: "traveller@example.test", subject: "Pending", text: "Secret body text", idempotencyKey: "x" };
  const apiKey = "re_SECRETKEY_123";
  const cases = [
    [async () => new Response(JSON.stringify({ statusCode: 400, name: "validation_error", message: "API key is invalid" }), { status: 400 }),
      { provider: "resend", operation: "send", status: 400, code: "validation_error", message: "API key is invalid" }],
    [async () => new Response(JSON.stringify({ name: "validation_error", message: "You can only send testing emails to your own email address (owner@example.test). Key re_SECRETKEY_123" }), { status: 403 }),
      { provider: "resend", operation: "send", status: 403, code: "validation_error", message: "You can only send testing emails to your own email address ([redacted]). Key [redacted]" }],
    [async () => new Response("bad gateway", { status: 502 }), { provider: "resend", operation: "send", status: 502, code: "http_error" }],
    [async () => new Response("{}", { status: 200 }), { provider: "resend", operation: "send", status: 200, code: "invalid_response" }],
    [(_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
      { provider: "resend", operation: "send", code: "timeout" }],
    [async () => { throw new TypeError("fetch failed"); }, { provider: "resend", operation: "send", code: "network_error" }],
  ];
  for (const [fetchImpl, diagnostic] of cases) {
    const error = await createResendSender({ apiKey, from: "from@example.test", fetchImpl, timeoutMs: 5 })(mail).then(() => null, (e) => e);
    assert.deepEqual(error.diagnostic, diagnostic);
    const exposed = JSON.stringify(error.diagnostic) + error.message + (error.stack ?? "");
    for (const secret of [apiKey, "Bearer", "Authorization", "traveller@example.test", "owner@example.test", "Secret body text"]) {
      assert.equal(exposed.includes(secret), false, secret);
    }
  }
});
