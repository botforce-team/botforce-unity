-- Migration: 0009_time_recording_modes.sql
-- Description: Support for different time recording modes per project
-- BOTFORCE Unity

-- ============================================================================
-- TIME RECORDING MODE ENUM
-- ============================================================================

CREATE TYPE time_recording_mode AS ENUM ('hours', 'start_end');

COMMENT ON TYPE time_recording_mode IS 'hours = direct entry, start_end = start/end time with break';

-- ============================================================================
-- ADD TIME RECORDING MODE TO PROJECTS
-- ============================================================================

ALTER TABLE projects
ADD COLUMN time_recording_mode time_recording_mode DEFAULT 'hours' NOT NULL;

COMMENT ON COLUMN projects.time_recording_mode IS 'How time entries are recorded: hours (direct) or start_end (with break)';

-- ============================================================================
-- ADD START/END TIME FIELDS TO TIME ENTRIES
-- ============================================================================

ALTER TABLE time_entries
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME,
ADD COLUMN break_minutes INTEGER DEFAULT 0;

-- Add check constraint for start_end mode
ALTER TABLE time_entries
ADD CONSTRAINT check_time_entry_mode CHECK (
  -- Either direct hours entry (start/end null)
  (start_time IS NULL AND end_time IS NULL)
  OR
  -- Or start/end mode (both must be present)
  (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
);

-- ============================================================================
-- HELPER: Auto-calculate hours from start/end time
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_hours_from_time()
RETURNS TRIGGER AS $$
DECLARE
  total_minutes INTEGER;
  break_mins INTEGER;
BEGIN
  -- Only calculate if start_time and end_time are provided
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    -- Calculate total minutes between start and end
    total_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;

    -- Subtract break minutes
    break_mins := COALESCE(NEW.break_minutes, 0);
    total_minutes := total_minutes - break_mins;

    -- Convert to hours (round to 2 decimal places)
    NEW.hours := ROUND(total_minutes / 60.0, 2);

    -- Ensure hours is positive
    IF NEW.hours <= 0 THEN
      RAISE EXCEPTION 'Working hours must be positive after subtracting break time';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_hours
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION calculate_hours_from_time();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN time_entries.start_time IS 'Start time of work (for start_end mode)';
COMMENT ON COLUMN time_entries.end_time IS 'End time of work (for start_end mode)';
COMMENT ON COLUMN time_entries.break_minutes IS 'Break duration in minutes (for start_end mode)';
