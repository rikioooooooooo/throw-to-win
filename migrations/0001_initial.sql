-- Throw To Win — Initial D1 Schema
-- Tables: throws, devices, challenges

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  total_throws INTEGER NOT NULL DEFAULT 0,
  personal_best REAL NOT NULL DEFAULT 0,
  country TEXT NOT NULL DEFAULT 'XX',
  flagged INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_devices_flagged ON devices(flagged);

CREATE TABLE IF NOT EXISTS throws (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  height_meters REAL NOT NULL,
  airtime_seconds REAL NOT NULL,
  country TEXT NOT NULL DEFAULT 'XX',
  challenge_nonce TEXT NOT NULL,
  anomaly_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_throws_height ON throws(height_meters DESC);
CREATE INDEX IF NOT EXISTS idx_throws_country_height ON throws(country, height_meters DESC);
CREATE INDEX IF NOT EXISTS idx_throws_device ON throws(device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS challenges (
  nonce TEXT PRIMARY KEY,
  device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expires_at);
