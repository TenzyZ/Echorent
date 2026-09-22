// Provider failures carry a PII-safe diagnostic: HTTP status, Resend error name, and a
// sanitized message. Never the key, headers, recipients, or email body.
export class EmailSendError extends Error {
  constructor({ status, code, message }) {
    super(`email_send_failed: ${code}`);
    this.diagnostic = {
      provider: "resend", operation: "send", ...(status ? { status } : {}), code,
      ...(message ? { message: sanitize(message) } : {}),
    };
  }
}

function sanitize(message) {
  return String(message).replace(/[^\s@<>"',;:()]+@[^\s@<>"',;:()]+/g, "[redacted]").replace(/\bre_\w+/g, "[redacted]").slice(0, 200);
}

export function createResendSender({ apiKey, from, fetchImpl = fetch, timeoutMs = 5_000 }) {
  return async ({ to, subject, text, idempotencyKey, from: messageFrom = from }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ from: messageFrom, to: Array.isArray(to) ? to : [to], subject, text }),
          signal: controller.signal,
        });
      } catch {
        throw new EmailSendError({ code: controller.signal.aborted ? "timeout" : "network_error" });
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new EmailSendError({
          status: response.status,
          code: typeof body?.name === "string" ? body.name : "http_error",
          message: typeof body?.message === "string" ? body.message : undefined,
        });
      }
      if (typeof body?.id !== "string" || !body.id) throw new EmailSendError({ status: response.status, code: "invalid_response" });
      return { id: body.id };
    } finally {
      clearTimeout(timeout);
    }
  };
}
