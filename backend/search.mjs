import { DEMO_INVENTORY } from "./demo-inventory.mjs";

const DAY_MS = 86_400_000;
const MAX_RENTAL_MINUTES = 30 * 24 * 60;
const MAX_CARS = 3;
const REQUIRED_FIELDS = [
  "pickup_airport",
  "pickup_date",
  "pickup_time",
  "return_date",
  "return_time",
  "driver_age",
];
const AIRPORTS = Object.freeze({
  DXB: Object.freeze({ name: "Dubai International", timeZone: "Asia/Dubai" }),
  SIN: Object.freeze({ name: "Singapore Changi", timeZone: "Asia/Singapore" }),
});
const MONTHS = Object.freeze({
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
});

const missingDetails = Object.freeze({
  pickup_airport: "Ask for the pickup airport.",
  pickup_date: "Ask for the pickup date.",
  pickup_time: "Ask for the pickup time.",
  return_date: "Ask for the return date.",
  return_time: "Ask for the return time.",
  driver_age: "Ask for the driver's age.",
});

function failure(errors) {
  return { ok: false, demo: true, errors };
}

function error(field, code, detail) {
  return { field, code, detail };
}

function localNowParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
}

function calendarDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) return null;
  return { year, month, day };
}

function dayNumber(date) {
  return Date.UTC(date.year, date.month - 1, date.day) / DAY_MS;
}

function addDays(date, days) {
  const value = new Date((dayNumber(date) + days) * DAY_MS);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function parseDate(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "today" || normalized === "tomorrow") return { relative: normalized };
  const match = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/.exec(normalized);
  const month = match && MONTHS[match[1]];
  const day = match && Number(match[2]);
  return month && day >= 1 && day <= 31 ? { month, day } : null;
}

function parseTime(value) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute, text: value };
}

// First occurrence of the month/day on or after `from`, trying from's year then the next.
// A day that does not exist in from's year (February 29) falls through to the next year.
function resolveDate(spec, today, from) {
  if (spec.relative) return addDays(today, spec.relative === "tomorrow" ? 1 : 0);
  const sameYear = calendarDate(from.year, spec.month, spec.day);
  if (sameYear && dayNumber(sameYear) >= dayNumber(from)) return sameYear;
  return calendarDate(from.year + 1, spec.month, spec.day);
}

function formatDate(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function weekday(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" })
    .format(new Date(dayNumber(date) * DAY_MS));
}

function dateTimeMinutes(date, time) {
  return dayNumber(date) * 24 * 60 + time.hour * 60 + time.minute;
}

export function searchCars(request, { now = new Date(), cars = DEMO_INVENTORY } = {}) {
  const input = request && typeof request === "object" && !Array.isArray(request) ? request : {};
  const missing = REQUIRED_FIELDS
    .filter((field) => input[field] === undefined || input[field] === null || input[field] === "")
    .map((field) => error(field, "missing_field", missingDetails[field]));
  if (missing.length) return failure(missing);

  const airport = typeof input.pickup_airport === "string" && Object.hasOwn(AIRPORTS, input.pickup_airport)
    ? AIRPORTS[input.pickup_airport]
    : null;
  const pickupDateSpec = parseDate(input.pickup_date);
  const returnDateSpec = parseDate(input.return_date);
  const pickupTime = parseTime(input.pickup_time);
  const returnTime = parseTime(input.return_time);
  const errors = [];

  if (!airport) errors.push(error("pickup_airport", "unsupported_airport", "Ask whether pickup is DXB or SIN."));
  if (!pickupDateSpec) errors.push(error("pickup_date", "invalid_date", "Ask for the pickup date again using a month and day, today, or tomorrow."));
  if (!pickupTime) errors.push(error("pickup_time", "invalid_time", "Ask for the pickup time again in HH:MM local time."));
  if (!returnDateSpec) errors.push(error("return_date", "invalid_date", "Ask for the return date again using a month and day, today, or tomorrow."));
  if (!returnTime) errors.push(error("return_time", "invalid_time", "Ask for the return time again in HH:MM local time."));
  if (!Number.isInteger(input.driver_age) || input.driver_age < 0 || input.driver_age > 99) {
    errors.push(error("driver_age", "invalid_age", "Ask for a whole-number driver age from 0 to 99."));
  } else if (input.driver_age < 21) {
    errors.push(error("driver_age", "driver_underage", "The driver must be at least 21. Ask whether an eligible driver will drive."));
  }
  if (errors.length) return failure(errors);

  const local = localNowParts(now, airport.timeZone);
  const today = { year: local.year, month: local.month, day: local.day };
  const pickupDate = resolveDate(pickupDateSpec, today, today);
  const returnDate = pickupDate && resolveDate(returnDateSpec, today, pickupDate);
  if (!pickupDate) return failure([error("pickup_date", "invalid_date", "Ask for a valid pickup calendar date.")]);
  if (!returnDate) return failure([error("return_date", "invalid_date", "Ask for a valid return calendar date.")]);

  if (dayNumber(pickupDate) === dayNumber(today)) {
    const requestedSeconds = (pickupTime.hour * 60 + pickupTime.minute) * 60;
    const currentSeconds = (local.hour * 60 + local.minute) * 60 + local.second;
    if (requestedSeconds < currentSeconds) {
      return failure([error("pickup_time", "pickup_in_past", "The requested pickup time has passed. Ask for the pickup date and time again.")]);
    }
  }

  const pickupMinutes = dateTimeMinutes(pickupDate, pickupTime);
  const returnMinutes = dateTimeMinutes(returnDate, returnTime);
  if (returnMinutes <= pickupMinutes) {
    return failure([error(
      "return_date",
      "return_not_after_pickup",
      `Pickup is ${weekday(pickupDate)} ${formatDate(pickupDate)} ${pickupTime.text}. Ask for the return date and time again.`,
    )]);
  }
  if (returnMinutes - pickupMinutes > MAX_RENTAL_MINUTES) {
    return failure([error("return_date", "rental_too_long", "Rental duration must be 30 days or less. Ask for the return date and time again.")]);
  }

  const resultCars = cars
    .filter((car) => car.airport === input.pickup_airport)
    .slice()
    .sort((a, b) => a.daily_rate - b.daily_rate || a.car_id.localeCompare(b.car_id))
    .slice(0, MAX_CARS)
    .map((car) => ({ ...car }));

  return {
    ok: true,
    demo: true,
    notice: "Demo cars and prices, not live availability.",
    rental: {
      airport: input.pickup_airport,
      airport_name: airport.name,
      pickup: { date: formatDate(pickupDate), weekday: weekday(pickupDate), time: pickupTime.text },
      return: { date: formatDate(returnDate), weekday: weekday(returnDate), time: returnTime.text },
      driver_age: input.driver_age,
    },
    cars: resultCars,
  };
}
