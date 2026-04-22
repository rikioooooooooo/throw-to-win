PRAGMA foreign_keys = OFF;
UPDATE throws SET device_id = 'c0128795-1fee-461d-8959-ae78b2d08708' WHERE device_id = 'sunohara-main-device';
UPDATE devices SET id = 'c0128795-1fee-461d-8959-ae78b2d08708' WHERE id = 'sunohara-main-device';
PRAGMA foreign_keys = ON;
