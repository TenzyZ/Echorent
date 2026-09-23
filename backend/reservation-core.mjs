import { DEMO_INVENTORY } from "./demo-inventory.mjs";
import { createResendSender } from "./email.mjs";
import { searchCars } from "./search.mjs";

const SEARCH_FIELDS = ["pickup_airport", "pickup_date", "pickup_time", "return_date", "return_time", "driver_age"];
const CONFLICT = {
  ok: false, demo: true,
  errors: [{ field: "rental", code: "existing_request", detail: "A pending request already exists for this traveller and an overlapping rental period. Changing a submitted request is not available yet." }],
  existing_request: { status: "pending" },
};

function fail(status, code, field = "request") {
  return { status, body: { ok: false, demo: true, errors: [{ field, code, detail: code }] } };
}

function emailAddress(value) {
  if (typeof value !== "string") return null;
  const email = value.trim();
  const parts = email.split("@");
  return email.length <= 254 && parts.length === 2 && parts[0].length <= 64
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validInput(input) {
  return input && typeof input === "object" && !Array.isArray(input)
    && Object.keys(input).length === 4
    && ["search", "car_id", "email", "reviewed_rental"].every((key) => Object.hasOwn(input, key))
    && input.search && typeof input.search === "object" && !Array.isArray(input.search)
    && Object.keys(input.search).length === SEARCH_FIELDS.length
    && SEARCH_FIELDS.every((key) => Object.hasOwn(input.search, key))
    && typeof input.car_id === "string" && rentalShape(input.reviewed_rental);
}

const RENTAL_PART = ["date", "weekday", "time"];

function rentalShape(value) {
  const part = (p) => record(p) && keys(p, RENTAL_PART) && RENTAL_PART.every((key) => typeof p[key] === "string");
  return record(value) && keys(value, ["airport", "airport_name", "pickup", "return", "driver_age"])
    && typeof value.airport === "string" && typeof value.airport_name === "string"
    && Number.isInteger(value.driver_age) && part(value.pickup) && part(value.return);
}

// The traveller consented to the released result's rental. A relative date re-resolved after
// airport-local midnight must not silently become a different rental.
function sameRental(reviewed, canonical) {
  return reviewed.airport === canonical.airport && reviewed.airport_name === canonical.airport_name
    && reviewed.driver_age === canonical.driver_age
    && RENTAL_PART.every((key) => reviewed.pickup[key] === canonical.pickup[key]
      && reviewed.return[key] === canonical.return[key]);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function keys(value, expected) {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

export function validStoredRequest(entry) {
  if (!record(entry) || !keys(entry, ["type", "request_id", "created_at", "status", "email", "email_key", "from", "notify_to", "car", "rental"])) return false;
  const { car, rental } = entry;
  const parts = (part) => record(part) && keys(part, ["date", "weekday", "time"])
    && ["date", "weekday", "time"].every((key) => typeof part[key] === "string");
  return entry.type === "request" && entry.status === "pending"
    && /^ER-[0-9A-F]{12}$/.test(entry.request_id) && typeof entry.created_at === "string"
    && typeof entry.email === "string" && emailAddress(entry.email) === entry.email
    && entry.email_key === entry.email.toLowerCase()
    && typeof entry.from === "string" && Array.isArray(entry.notify_to) && entry.notify_to.length > 0
    && entry.notify_to.every((address) => typeof address === "string" && emailAddress(address) === address)
    && record(car) && keys(car, ["car_id", "airport", "name", "category", "transmission", "seats", "bags", "daily_rate", "currency"])
    && ["car_id", "airport", "name", "category", "transmission", "currency"].every((key) => typeof car[key] === "string")
    && ["seats", "bags", "daily_rate"].every((key) => typeof car[key] === "number")
    && record(rental) && keys(rental, ["airport", "airport_name", "pickup", "return", "driver_age"])
    && typeof rental.airport === "string" && typeof rental.airport_name === "string"
    && rental.airport === car.airport && Number.isInteger(rental.driver_age)
    && parts(rental.pickup) && parts(rental.return);
}

function dateTime(part) {
  return `${part.date}T${part.time}`;
}

function latestStatus(request, role) {
  return request.notifications[role]?.status ?? "failed";
}

function when(part) {
  return `${part.weekday} ${part.date} at ${part.time}`;
}

function mailFor(request, role) {
  const { request_id, car, rental, email, notify_to } = request;
  const airport = `${rental.airport_name} (${rental.airport})`;
  if (role === "internal") return {
    from: request.from,
    to: notify_to,
    subject: `EchoRent | New reservation request | ${request_id}`,
    text: [
      "EchoRent reservation request", "",
      "A new reservation request is ready for human review.", "",
      `Request ID: ${request_id}`, "Status: Pending", "",
      "Traveller", `Email: ${email}`, "",
      "Rental", `Airport: ${airport}`, `Vehicle: ${car.name} (${car.car_id})`,
      `Pickup: ${when(rental.pickup)}`, `Return: ${when(rental.return)}`, `Driver age: ${rental.driver_age}`, "",
      "Important",
      "This request uses demo inventory and does not represent live vehicle availability.",
      "No vehicle has been reserved or guaranteed.", "",
      "Human review is required before this request can become a confirmed rental.", "",
      "EchoRent",
    ].join("\n"),
  };
  return {
    from: request.from,
    to: email,
    subject: `EchoRent | Request received | ${request_id}`,
    text: [
      "Hi,", "",
      "We received your EchoRent reservation request.", "",
      `Request ID: ${request_id}`, "Status: Pending human review", "",
      "Rental summary", `Vehicle: ${car.name}`, `Airport: ${airport}`,
      `Pickup: ${when(rental.pickup)}`, `Return: ${when(rental.return)}`, "",
      "This email is an acknowledgement only. It is not a confirmed rental, and the vehicle is not reserved or guaranteed.", "",
      "EchoRent currently uses demo inventory, not live rental availability.", "",
      "Please keep your request ID for reference.", "",
      "EchoRent",
    ].join("\n"),
  };
}

function publicResult(request, replayed) {
  return {
    ok: true, demo: true, replayed,
    request: {
      request_id: request.request_id,
      created_at: request.created_at,
      status: "pending",
      car: request.car,
      rental: request.rental,
    },
    notifications: {
      internal: { status: latestStatus(request, "internal") },
      traveller: { status: latestStatus(request, "traveller") },
    },
  };
}

export function createReservationCore({
  store,
  apiKey,
  from,
  notifyTo,
  now = () => new Date(),
  cars = DEMO_INVENTORY,
  sendEmail,
  fetchImpl = fetch,
} = {}) {
  const sender = sendEmail ?? (apiKey && from ? createResendSender({ apiKey, from, fetchImpl }) : null);
  const recipients = typeof notifyTo === "string" ? [notifyTo.trim()] : [];

  async function notify(request) {
    const roles = ["internal", "traveller"].filter((role) => latestStatus(request, role) !== "sent");
    const outcomes = await Promise.allSettled(roles.map((role) => sender({
      ...mailFor(request, role), idempotencyKey: `${request.request_id}/${role}`,
    })));
    for (let index = 0; index < roles.length; index += 1) {
      const outcome = outcomes[index];
      const entry = {
        type: "notification", request_id: request.request_id, role: roles[index],
        status: outcome.status === "fulfilled" ? "sent" : "failed",
        ...(outcome.status === "fulfilled" ? { provider_id: outcome.value.id } : {}),
        ...(outcome.status === "rejected" && record(outcome.reason?.diagnostic) ? { error: outcome.reason.diagnostic } : {}),
        timestamp: new Date().toISOString(),
      };
      await store.recordNotification(entry);
      request.notifications[roles[index]] = entry;
    }
    return store.get(request.request_id);
  }

  async function decide(email, canonical, car) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const candidate = {
      type: "request", request_id: `ER-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`,
      created_at: new Date().toISOString(), status: "pending",
      email, email_key: email.toLowerCase(), from, notify_to: recipients, car, rental: canonical.rental,
      notifications: {},
    };
    let claim;
    try { claim = await store.claim(candidate); }
    catch (error) { return fail(500, error?.code === "request_not_saved" ? "request_not_saved" : "store_unavailable"); }
    if (claim.outcome === "conflict") return { status: 409, body: CONFLICT };
    let request = claim.request;
    const replay = claim.outcome === "replayed";
    try {
      request = await notify(request);
      const errors = Object.fromEntries(["internal", "traveller"]
        .filter((role) => request.notifications[role]?.error).map((role) => [role, request.notifications[role].error]));
      return { status: replay ? 200 : 201, body: publicResult(request, Boolean(replay)), notification_errors: errors };
    } catch {
      return fail(500, "store_unavailable");
    }
  }

  function createBookingRequest(input) {
    if (!validInput(input)) return Promise.resolve(fail(400, "invalid_request"));
    const canonical = searchCars(input.search, { now: typeof now === "function" ? now() : now, cars });
    if (!canonical.ok) return Promise.resolve({ status: 400, body: canonical });
    const car = canonical.cars.find(({ car_id }) => car_id === input.car_id);
    if (!car) return Promise.resolve(fail(400, "invalid_car", "car_id"));
    if (!sameRental(input.reviewed_rental, canonical.rental)) return Promise.resolve(fail(409, "search_expired", "rental"));
    const email = emailAddress(input.email);
    if (!email) return Promise.resolve(fail(400, "invalid_email", "email"));
    const fromAddress = typeof from === "string" && from.includes("<")
      ? /^\s*[^<>]+<([^<>]+)>\s*$/.exec(from)?.[1] : from;
    if (!store || typeof apiKey !== "string" || !apiKey.trim() || !emailAddress(fromAddress)
      || !recipients.length || recipients.some((address) => !emailAddress(address))) {
      return Promise.resolve(fail(503, "reservations_unavailable"));
    }
    return decide(email, canonical, car);
  }

  return { createBookingRequest };
}
