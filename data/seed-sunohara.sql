INSERT OR REPLACE INTO devices (id, display_name, personal_best, country, total_throws, first_seen, last_seen)
VALUES ('sunohara-founder', 'すの', 7.25, 'JP', 1, datetime('now'), datetime('now'));

INSERT INTO throws (id, device_id, height_meters, airtime_seconds, country, challenge_nonce, anomaly_score)
VALUES ('throw-sunohara-001', 'sunohara-founder', 7.25, 2.43, 'JP', 'founder-seed', 0);
