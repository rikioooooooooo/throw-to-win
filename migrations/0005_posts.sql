-- Post-throw comments thread
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  height_meters REAL NOT NULL DEFAULT 0,
  country TEXT NOT NULL DEFAULT 'XX',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_posts_created_desc ON posts(created_at DESC) WHERE deleted = 0;
CREATE INDEX IF NOT EXISTS idx_posts_device_created ON posts(device_id, created_at DESC);
