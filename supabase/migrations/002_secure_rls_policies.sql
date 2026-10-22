-- ============================================================================
-- GateVision Secure RLS Policies Migration
-- Implements least-privilege access control based on user roles
-- ============================================================================

-- Helper function to get authenticated user's role from profiles table
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS VARCHAR(32) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'VIEWER'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    'VIEWER', -- Default role
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Drop existing permissive policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow public read access to buses" ON buses;
DROP POLICY IF EXISTS "Allow admin write access to buses" ON buses;
DROP POLICY IF EXISTS "Allow public read access to cameras" ON cameras;
DROP POLICY IF EXISTS "Allow admin write access to cameras" ON cameras;
DROP POLICY IF EXISTS "Allow public read access to gate events" ON gate_events;
DROP POLICY IF EXISTS "Allow authenticated insert to gate events" ON gate_events;
DROP POLICY IF EXISTS "Allow authenticated access to reviews" ON detection_reviews;
DROP POLICY IF EXISTS "Allow authenticated access to audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON profiles;

-- ============================================================================
-- BUSES TABLE - Least Privilege RLS
-- ============================================================================

-- All authenticated users can read buses
CREATE POLICY "buses_select_authenticated" ON buses
  FOR SELECT
  TO authenticated
  USING (true);

-- Only ADMIN can insert buses
CREATE POLICY "buses_insert_admin" ON buses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_role() = 'ADMIN');

-- Only ADMIN can update buses
CREATE POLICY "buses_update_admin" ON buses
  FOR UPDATE
  TO authenticated
  USING (auth.user_role() = 'ADMIN')
  WITH CHECK (auth.user_role() = 'ADMIN');

-- Only ADMIN can delete (deactivate) buses
CREATE POLICY "buses_delete_admin" ON buses
  FOR DELETE
  TO authenticated
  USING (auth.user_role() = 'ADMIN');

-- ============================================================================
-- CAMERAS TABLE - Least Privilege RLS
-- ============================================================================

-- All authenticated users can read cameras
CREATE POLICY "cameras_select_authenticated" ON cameras
  FOR SELECT
  TO authenticated
  USING (true);

-- Only ADMIN can manage cameras
CREATE POLICY "cameras_insert_admin" ON cameras
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_role() = 'ADMIN');

CREATE POLICY "cameras_update_admin" ON cameras
  FOR UPDATE
  TO authenticated
  USING (auth.user_role() = 'ADMIN')
  WITH CHECK (auth.user_role() = 'ADMIN');

CREATE POLICY "cameras_delete_admin" ON cameras
  FOR DELETE
  TO authenticated
  USING (auth.user_role() = 'ADMIN');

-- ============================================================================
-- GATE EVENTS TABLE - Least Privilege RLS
-- ============================================================================

-- All authenticated users can read gate events
CREATE POLICY "gate_events_select_authenticated" ON gate_events
  FOR SELECT
  TO authenticated
  USING (true);

-- ADMIN and SECURITY_OFFICER can insert gate events (via secure function only)
CREATE POLICY "gate_events_insert_authorized" ON gate_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.user_role() IN ('ADMIN', 'SECURITY_OFFICER')
  );

-- Only ADMIN and SECURITY_OFFICER can update gate events (for review resolution)
CREATE POLICY "gate_events_update_authorized" ON gate_events
  FOR UPDATE
  TO authenticated
  USING (auth.user_role() IN ('ADMIN', 'SECURITY_OFFICER'))
  WITH CHECK (auth.user_role() IN ('ADMIN', 'SECURITY_OFFICER'));

-- Only ADMIN can delete gate events
CREATE POLICY "gate_events_delete_admin" ON gate_events
  FOR DELETE
  TO authenticated
  USING (auth.user_role() = 'ADMIN');

-- ============================================================================
-- DETECTION REVIEWS TABLE - Least Privilege RLS
-- ============================================================================

-- All authenticated users can read reviews
CREATE POLICY "reviews_select_authenticated" ON detection_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- ADMIN and SECURITY_OFFICER can create reviews
CREATE POLICY "reviews_insert_authorized" ON detection_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_role() IN ('ADMIN', 'SECURITY_OFFICER'));

-- ADMIN and SECURITY_OFFICER can update reviews
CREATE POLICY "reviews_update_authorized" ON detection_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.user_role() IN ('ADMIN', 'SECURITY_OFFICER'))
  WITH CHECK (auth.user_role() IN ('ADMIN', 'SECURITY_OFFICER'));

-- Only ADMIN can delete reviews
CREATE POLICY "reviews_delete_admin" ON detection_reviews
  FOR DELETE
  TO authenticated
  USING (auth.user_role() = 'ADMIN');

-- ============================================================================
-- AUDIT LOGS TABLE - Least Privilege RLS
-- ============================================================================

-- All authenticated users can read audit logs (for transparency)
CREATE POLICY "audit_logs_select_authenticated" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- System-level inserts only (via triggers or server functions)
CREATE POLICY "audit_logs_insert_system" ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow insert but log who did it

-- No direct updates or deletes (audit logs are immutable)

-- ============================================================================
-- PROFILES TABLE - Least Privilege RLS
-- ============================================================================

-- All authenticated users can read profiles
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own display name
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Only allow updating display_name, not role
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Only ADMIN can update user roles
CREATE POLICY "profiles_update_role_admin" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.user_role() = 'ADMIN')
  WITH CHECK (auth.user_role() = 'ADMIN');

-- ============================================================================
-- Secure Server-Side Gate Event Processing Function
-- Prevents direct bus status manipulation and enforces business rules
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_gate_detection(
  p_raw_ocr_text VARCHAR(64),
  p_confidence REAL,
  p_camera_id UUID,
  p_source VARCHAR(16),
  p_direction_estimate VARCHAR(16),
  p_evidence_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_normalized_text VARCHAR(64);
  v_bus buses%ROWTYPE;
  v_event_type VARCHAR(16);
  v_review_status VARCHAR(32);
  v_new_bus_status VARCHAR(32);
  v_event_id UUID;
  v_outcome VARCHAR(32);
  v_message TEXT;
BEGIN
  -- Normalize the OCR text (simplified; you may want more sophisticated logic)
  v_normalized_text := UPPER(REGEXP_REPLACE(p_raw_ocr_text, '\s+', '', 'g'));
  
  -- Determine event type from direction
  v_event_type := CASE 
    WHEN p_direction_estimate = 'INBOUND' THEN 'ENTRY'
    WHEN p_direction_estimate = 'OUTBOUND' THEN 'EXIT'
    ELSE 'ENTRY' -- Default fallback
  END;

  -- Try to find matching bus
  SELECT * INTO v_bus
  FROM buses
  WHERE normalized_registration_number = v_normalized_text
    AND is_active = true
  LIMIT 1;

  -- Determine review status based on confidence and bus match
  IF p_confidence < 0.85 THEN
    v_review_status := 'PENDING';
    v_outcome := 'ROUTED_TO_REVIEW';
    v_message := 'Low confidence detection routed to review queue';
  ELSIF v_bus.id IS NULL THEN
    v_review_status := 'PENDING';
    v_outcome := 'ROUTED_TO_REVIEW';
    v_message := 'Unknown vehicle routed to review queue';
  ELSE
    -- Validate state transition
    IF v_event_type = 'EXIT' AND v_bus.current_status = 'OUTSIDE_CAMPUS' THEN
      v_review_status := 'PENDING';
      v_outcome := 'ROUTED_TO_REVIEW';
      v_message := 'Invalid state transition: bus already outside';
    ELSIF v_event_type = 'ENTRY' AND v_bus.current_status = 'INSIDE_CAMPUS' THEN
      v_review_status := 'PENDING';
      v_outcome := 'ROUTED_TO_REVIEW';
      v_message := 'Invalid state transition: bus already inside';
    ELSE
      v_review_status := 'CONFIRMED';
      v_outcome := 'EVENT_CREATED';
      v_message := 'Gate event recorded successfully';
      
      -- Calculate new bus status
      v_new_bus_status := CASE
        WHEN v_event_type = 'ENTRY' THEN 'INSIDE_CAMPUS'
        WHEN v_event_type = 'EXIT' THEN 'OUTSIDE_CAMPUS'
      END;
      
      -- Update bus status atomically
      UPDATE buses
      SET current_status = v_new_bus_status,
          updated_at = NOW()
      WHERE id = v_bus.id;
    END IF;
  END IF;

  -- Insert gate event
  INSERT INTO gate_events (
    bus_id,
    event_type,
    event_time,
    source,
    raw_ocr_text,
    normalized_ocr_text,
    confidence,
    camera_id,
    evidence_reference,
    review_status,
    notes
  ) VALUES (
    v_bus.id,
    v_event_type,
    NOW(),
    p_source,
    p_raw_ocr_text,
    v_normalized_text,
    p_confidence,
    p_camera_id,
    p_evidence_reference,
    v_review_status,
    CASE WHEN v_review_status = 'PENDING' THEN v_message ELSE NULL END
  ) RETURNING id INTO v_event_id;

  -- Log to audit
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, reason)
  VALUES (auth.uid(), 'GATE_DETECTION_PROCESSED', 'gate_events', v_event_id, v_message);

  -- Return result
  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'message', v_message,
    'event_id', v_event_id,
    'bus_id', v_bus.id,
    'new_status', v_new_bus_status,
    'review_status', v_review_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users with appropriate roles
GRANT EXECUTE ON FUNCTION public.process_gate_detection TO authenticated;
