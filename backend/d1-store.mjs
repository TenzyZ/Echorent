function dateTime(part) {
  return `${part.date}T${part.time}`;
}

function requestFromRow(row, notifications = []) {
  return {
    type: "request",
    request_id: row.request_id,
    created_at: row.created_at,
    status: row.status,
    email: row.email,
    email_key: row.email_key,
    from: row.from_address,
    notify_to: JSON.parse(row.notify_to_json),
    car: JSON.parse(row.car_json),
    rental: JSON.parse(row.rental_json),
    notifications: Object.fromEntries(notifications.map((entry) => [entry.role, {
      type: "notification",
      request_id: entry.request_id,
      role: entry.role,
      status: entry.status,
      ...(entry.provider_id === null ? {} : { provider_id: entry.provider_id }),
      ...(entry.error_json === null ? {} : { error: JSON.parse(entry.error_json) }),
      timestamp: entry.updated_at,
    }])),
  };
}

export function createD1Store(db) {
  return {
    async claim(candidate) {
      const pickupAt = dateTime(candidate.rental.pickup);
      const returnAt = dateTime(candidate.rental.return);
      let result;
      try {
        result = await db.prepare(`INSERT INTO reservation_requests (
          request_id, created_at, status, email, email_key, airport, pickup_at, return_at,
          driver_age, car_id, car_json, rental_json, from_address, notify_to_json
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM reservation_requests
          WHERE email_key = ? AND airport = ? AND pickup_at < ? AND ? < return_at
        )`).bind(
          candidate.request_id, candidate.created_at, candidate.status, candidate.email,
          candidate.email_key, candidate.rental.airport, pickupAt, returnAt,
          candidate.rental.driver_age, candidate.car.car_id, JSON.stringify(candidate.car),
          JSON.stringify(candidate.rental), candidate.from, JSON.stringify(candidate.notify_to),
          candidate.email_key, candidate.rental.airport, returnAt, pickupAt,
        ).run();
      } catch (cause) {
        const error = new Error("request_not_saved", { cause });
        error.code = "request_not_saved";
        throw error;
      }
      if (result.meta.changes === 1) return { outcome: "created", request: candidate };
      const exact = await db.prepare(`SELECT request_id FROM reservation_requests
        WHERE email_key = ? AND airport = ? AND pickup_at = ? AND return_at = ?
          AND driver_age = ? AND car_id = ?`).bind(
        candidate.email_key, candidate.rental.airport, pickupAt, returnAt,
        candidate.rental.driver_age, candidate.car.car_id,
      ).first();
      return exact
        ? { outcome: "replayed", request: await this.get(exact.request_id) }
        : { outcome: "conflict" };
    },
    async recordNotification(entry) {
      await db.prepare(`INSERT INTO reservation_notifications (
        request_id, role, status, provider_id, error_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id, role) DO UPDATE SET
        status = excluded.status,
        provider_id = excluded.provider_id,
        error_json = excluded.error_json,
        updated_at = excluded.updated_at
      WHERE reservation_notifications.status <> 'sent'`).bind(
        entry.request_id, entry.role, entry.status, entry.provider_id ?? null,
        entry.error ? JSON.stringify(entry.error) : null, entry.timestamp,
      ).run();
    },
    async get(requestId) {
      const [requests, notifications] = await db.batch([
        db.prepare("SELECT * FROM reservation_requests WHERE request_id = ?").bind(requestId),
        db.prepare("SELECT * FROM reservation_notifications WHERE request_id = ?").bind(requestId),
      ]);
      return requests.results[0] ? requestFromRow(requests.results[0], notifications.results) : null;
    },
  };
}
