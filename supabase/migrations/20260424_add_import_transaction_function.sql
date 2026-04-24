-- Migration: Add transaction-safe import function for attendees and checkins
-- Created: 2026-04-24
-- Purpose: Ensure atomicity when importing attendees and their checkin records
--          If any error occurs, all changes are rolled back automatically

CREATE OR REPLACE FUNCTION import_attendees_with_checkins(
  p_event_id TEXT,
  p_attendee_data JSONB,
  p_checkin_data JSONB
)
RETURNS TABLE(
  success BOOLEAN,
  imported_count INTEGER,
  error_message TEXT,
  failed_row_index INTEGER,
  failed_value TEXT
) AS $$
DECLARE
  v_error_msg TEXT;
  v_failed_row INT;
  v_failed_value TEXT;
  v_imported INT := 0;
  v_item JSONB;
  v_attendee_id TEXT;
BEGIN
  BEGIN
    -- Transaction begins here (implicit in function)

    -- 1. Validate input
    IF p_attendee_data IS NULL OR jsonb_array_length(p_attendee_data) = 0 THEN
      RETURN QUERY SELECT false, 0, 'No attendee data provided'::TEXT, NULL::INTEGER, NULL::TEXT;
      RETURN;
    END IF;

    -- 2. Insert/update attendees
    INSERT INTO attendees (
      event_id, court_id, name_prefix, full_name, phone,
      organization, job_position, province, region, qr_image_url,
      slip_url, food_type, travel_mode, travel_other,
      coordinator_prefix_other, coordinator_name, coordinator_phone,
      hotel_name, ticket_token, created_at, updated_at
    )
    SELECT
      p_event_id,
      (item->>'court_id')::TEXT,
      (item->>'name_prefix')::TEXT,
      (item->>'full_name')::TEXT,
      (item->>'phone')::TEXT,
      (item->>'organization')::TEXT,
      (item->>'job_position')::TEXT,
      (item->>'province')::TEXT,
      NULLIF((item->>'region')::TEXT, '')::INTEGER,
      (item->>'qr_image_url')::TEXT,
      (item->>'slip_url')::TEXT,
      (item->>'food_type')::TEXT,
      (item->>'travel_mode')::TEXT,
      (item->>'travel_other')::TEXT,
      (item->>'coordinator_prefix_other')::TEXT,
      (item->>'coordinator_name')::TEXT,
      (item->>'coordinator_phone')::TEXT,
      (item->>'hotel_name')::TEXT,
      (item->>'ticket_token')::TEXT,
      NOW(),
      NOW()
    FROM jsonb_array_elements(p_attendee_data) AS item
    ON CONFLICT (ticket_token) DO UPDATE SET
      event_id = EXCLUDED.event_id,
      court_id = EXCLUDED.court_id,
      name_prefix = EXCLUDED.name_prefix,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      organization = EXCLUDED.organization,
      job_position = EXCLUDED.job_position,
      province = EXCLUDED.province,
      region = EXCLUDED.region,
      qr_image_url = EXCLUDED.qr_image_url,
      slip_url = EXCLUDED.slip_url,
      food_type = EXCLUDED.food_type,
      travel_mode = EXCLUDED.travel_mode,
      travel_other = EXCLUDED.travel_other,
      coordinator_prefix_other = EXCLUDED.coordinator_prefix_other,
      coordinator_name = EXCLUDED.coordinator_name,
      coordinator_phone = EXCLUDED.coordinator_phone,
      hotel_name = EXCLUDED.hotel_name,
      updated_at = NOW();

    -- Get count of inserted/updated rows
    GET DIAGNOSTICS v_imported = ROW_COUNT;

    -- 3. Insert/update checkins if provided
    IF p_checkin_data IS NOT NULL AND jsonb_array_length(p_checkin_data) > 0 THEN
      INSERT INTO attendee_checkins (
        attendee_id, round, checked_in_at, created_at, updated_at
      )
      SELECT
        a.id,
        (item->>'round')::INTEGER,
        (item->>'checked_in_at')::TIMESTAMP WITH TIME ZONE,
        NOW(),
        NOW()
      FROM jsonb_array_elements(p_checkin_data) AS item
      INNER JOIN attendees a ON a.ticket_token = (item->>'ticket_token') AND a.event_id = p_event_id
      ON CONFLICT (attendee_id, round) DO UPDATE SET
        checked_in_at = EXCLUDED.checked_in_at,
        updated_at = NOW();
    END IF;

    -- 4. Success: return results
    RETURN QUERY SELECT true, v_imported, NULL::TEXT, NULL::INTEGER, NULL::TEXT;

  EXCEPTION WHEN OTHERS THEN
    -- Any error automatically rolls back entire transaction
    -- Extract key information from error
    RAISE WARNING 'Import transaction failed: %', SQLERRM;

    RETURN QUERY SELECT
      false,
      0,
      SQLERRM::TEXT,
      NULL::INTEGER,
      NULL::TEXT;

  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission if using separate roles
-- GRANT EXECUTE ON FUNCTION import_attendees_with_checkins(TEXT, JSONB, JSONB) TO authenticated;
-- GRANT EXECUTE ON FUNCTION import_attendees_with_checkins(TEXT, JSONB, JSONB) TO service_role;
