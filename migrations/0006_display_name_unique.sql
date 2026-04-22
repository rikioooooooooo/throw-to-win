-- Dedupe existing display_names before adding UNIQUE constraint.
-- Keep the device with the earliest first_seen; rename others with _2, _3 suffixes.

UPDATE devices
SET display_name = (
  SELECT
    CASE
      WHEN ranked.rn = 1 THEN ranked.display_name
      WHEN length(ranked.display_name) + length('_' || ranked.rn) <= 20
        THEN ranked.display_name || '_' || ranked.rn
      ELSE substr(ranked.display_name, 1, 20 - length('_' || ranked.rn)) || '_' || ranked.rn
    END
  FROM (
    SELECT id, display_name, first_seen,
      ROW_NUMBER() OVER (
        PARTITION BY display_name
        ORDER BY first_seen ASC, id ASC
      ) as rn
    FROM devices
    WHERE display_name != ''
  ) ranked
  WHERE ranked.id = devices.id
)
WHERE id IN (
  SELECT id FROM devices
  WHERE display_name IN (
    SELECT display_name FROM devices
    WHERE display_name != ''
    GROUP BY display_name
    HAVING COUNT(*) > 1
  )
);

-- Add partial unique index (empty display_name is exempt)
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_display_name_unique
  ON devices(display_name)
  WHERE display_name != '';
