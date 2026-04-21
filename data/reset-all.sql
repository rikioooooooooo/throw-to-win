-- Reset all production data
-- Run: npx wrangler d1 execute throw-to-win-db --remote --file=data/reset-all.sql

DELETE FROM throws;
DELETE FROM devices;
DELETE FROM challenges;
