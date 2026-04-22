INSERT INTO devices (id, first_seen, last_seen, total_throws, personal_best, country, flagged, display_name)
VALUES ('sunohara-main-device', datetime('now'), datetime('now'), 1, 12.81, 'JP', 0, 'すの');

INSERT INTO throws (id, device_id, height_meters, airtime_seconds, country, challenge_nonce, anomaly_score)
VALUES ('throw-manual-1281', 'sunohara-main-device', 12.81, 3.23, 'JP', 'manual-restore', 0);
