CREATE TABLE reservation_requests (
  request_id TEXT PRIMARY KEY CHECK(
    length(request_id) = 15
    AND substr(request_id, 1, 7) GLOB 'ER-[0-9A-F][0-9A-F][0-9A-F][0-9A-F]'
    AND substr(request_id, 8, 4) GLOB '[0-9A-F][0-9A-F][0-9A-F][0-9A-F]'
    AND substr(request_id, 12) GLOB '[0-9A-F][0-9A-F][0-9A-F][0-9A-F]'
  ),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status = 'pending'),
  email TEXT NOT NULL,
  email_key TEXT NOT NULL,
  airport TEXT NOT NULL CHECK(airport IN ('DXB', 'SIN')),
  pickup_at TEXT NOT NULL CHECK(
    length(pickup_at) = 16
    AND substr(pickup_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND substr(pickup_at, 11) GLOB 'T[0-9][0-9]:[0-9][0-9]'
  ),
  return_at TEXT NOT NULL CHECK(
    length(return_at) = 16
    AND substr(return_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND substr(return_at, 11) GLOB 'T[0-9][0-9]:[0-9][0-9]'
  ),
  driver_age INTEGER NOT NULL,
  car_id TEXT NOT NULL,
  car_json TEXT NOT NULL,
  rental_json TEXT NOT NULL,
  from_address TEXT NOT NULL,
  notify_to_json TEXT NOT NULL,
  CHECK(pickup_at < return_at),
  UNIQUE(email_key, airport, pickup_at, return_at)
);

CREATE TABLE reservation_notifications (
  request_id TEXT NOT NULL REFERENCES reservation_requests(request_id),
  role TEXT NOT NULL CHECK(role IN ('internal', 'traveller')),
  status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
  provider_id TEXT CHECK(status = 'sent' OR provider_id IS NULL),
  error_json TEXT CHECK(status = 'failed' OR error_json IS NULL),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(request_id, role)
);
