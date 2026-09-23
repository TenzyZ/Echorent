import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { createReservationCore, validStoredRequest } from "./reservation-core.mjs";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function keys(value, expected) {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function dateTime(part) {
  return `${part.date}T${part.time}`;
}

export function createReservationService({
  dataDir = process.env.ECHORENT_DATA_DIR || join(import.meta.dirname, "data"),
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.ECHORENT_EMAIL_FROM,
  notifyTo = process.env.ECHORENT_NOTIFY_TO,
  now = () => new Date(),
  cars = DEMO_INVENTORY,
  sendEmail,
  fetchImpl = fetch,
  appendLine,
} = {}) {
  const path = join(dataDir, "reservation-requests.jsonl");
  let cache;
  let tail = Promise.resolve();

  async function load() {
    if (cache) return cache;
    let source;
    try { source = await readFile(path, "utf8"); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      source = "";
    }
    const requests = [];
    const byId = new Map();
    for (const line of source.split("\n")) {
      if (!line) continue;
      const entry = JSON.parse(line);
      if (validStoredRequest(entry) && !byId.has(entry.request_id)) {
        const request = { ...entry, notifications: {} };
        requests.push(request);
        byId.set(entry.request_id, request);
      } else if (entry?.type === "notification" && byId.has(entry.request_id)
        && ["internal", "traveller"].includes(entry.role) && ["sent", "failed"].includes(entry.status)
        && typeof entry.timestamp === "string"
        && (entry.provider_id === undefined || (entry.status === "sent" && typeof entry.provider_id === "string"))
        && (entry.error === undefined || (entry.status === "failed" && record(entry.error)))
        && keys(entry, ["type", "request_id", "role", "status", "timestamp",
          ...(entry.provider_id === undefined ? [] : ["provider_id"]), ...(entry.error === undefined ? [] : ["error"])])) {
        byId.get(entry.request_id).notifications[entry.role] = entry;
      } else {
        throw new Error("corrupt reservation store");
      }
    }
    cache = { requests, byId };
    return cache;
  }

  async function append(entry) {
    try {
      if (appendLine) return await appendLine(entry);
      await mkdir(dirname(path), { recursive: true });
      const file = await open(path, "a");
      try {
        await file.writeFile(`${JSON.stringify(entry)}\n`);
        await file.sync();
      } finally { await file.close(); }
    } finally { cache = undefined; }
  }

  const store = {
    async claim(candidate) {
      const index = await load();
      for (const prior of index.requests) {
        if (prior.email_key !== candidate.email_key) continue;
        const sameRental = prior.rental.airport === candidate.rental.airport
          && dateTime(prior.rental.pickup) === dateTime(candidate.rental.pickup)
          && dateTime(prior.rental.return) === dateTime(candidate.rental.return)
          && prior.rental.driver_age === candidate.rental.driver_age;
        if (sameRental && prior.car.car_id === candidate.car.car_id) return { outcome: "replayed", request: prior };
        if (prior.rental.airport === candidate.rental.airport
          && dateTime(candidate.rental.pickup) < dateTime(prior.rental.return)
          && dateTime(prior.rental.pickup) < dateTime(candidate.rental.return)) return { outcome: "conflict" };
      }
      try { await append({ ...candidate, notifications: undefined }); }
      catch (error) { error.code = "request_not_saved"; throw error; }
      return { outcome: "created", request: candidate };
    },
    recordNotification: append,
    async get(requestId) { return (await load()).byId.get(requestId); },
  };

  const core = createReservationCore({ store, apiKey, from, notifyTo, now, cars, sendEmail, fetchImpl });
  return {
    createBookingRequest(input) {
      const operation = tail.then(() => core.createBookingRequest(input));
      tail = operation.then(() => {}, () => {});
      return operation;
    },
  };
}
