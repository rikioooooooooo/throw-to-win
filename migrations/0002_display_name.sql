-- Add display_name column to devices table
ALTER TABLE devices ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
