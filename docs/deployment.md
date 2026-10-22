# GateVision Deployment & Supabase Integration Guide

GateVision supports dual operating modes:
1. **DEMO Mode**: Runs entirely client-side using in-memory repositories with `localStorage` persistence. Ideal for local development, demos, and student evaluation.
2. **Supabase Connected Mode**: Connects to a production Supabase project with PostgreSQL, Supabase Auth, Row Level Security (RLS), and atomic event processing functions.

---

## 1. Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Security Warning**: Never expose the Supabase `service_role` secret key in client-side code or frontend environment variables. Only use the public `anon` key.

---

## 2. Database Schema & Migrations

Execute the migration script located at `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor or via Supabase CLI:

- **Tables**: `buses`, `cameras`, `gate_events`, `detection_reviews`, `audit_logs`, `profiles`.
- **Indexes**: Optimized indices on `normalized_registration_number`, `bus_id`, `event_time`, `review_status`, and `camera_id`.
- **Row Level Security (RLS)**: Enabled on all tables with strict access policies distinguishing administrators, security officers, and read-only viewers.

---

## 3. Atomic Database Transactions (RPC)

For production concurrency safety across multiple security terminals, gate detections should be processed via a PostgreSQL RPC function ensuring atomicity and idempotency:

```sql
CREATE OR REPLACE FUNCTION process_gate_detection(
    p_bus_id UUID,
    p_event_type VARCHAR,
    p_source VARCHAR,
    p_raw_ocr VARCHAR,
    p_normalized_ocr VARCHAR,
    p_confidence REAL,
    p_camera_id UUID,
    p_evidence_ref TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_status VARCHAR;
    v_event_id UUID;
BEGIN
    -- Determine new status
    v_new_status := CASE WHEN p_event_type = 'ENTRY' THEN 'INSIDE_CAMPUS' ELSE 'OUTSIDE_CAMPUS' END;

    -- Update bus current status atomically
    UPDATE buses
    SET current_status = v_new_status, updated_at = NOW()
    WHERE id = p_bus_id;

    -- Insert gate event
    INSERT INTO gate_events (bus_id, event_type, source, raw_ocr_text, normalized_ocr_text, confidence, camera_id, evidence_reference, review_status)
    VALUES (p_bus_id, p_event_type, p_source, p_raw_ocr, p_normalized_ocr, p_confidence, p_camera_id, p_evidence_ref, 'CONFIRMED')
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'event_id', v_event_id, 'new_status', v_new_status);
END;
$$;
```

---

## 4. Role-Based Access Control (RBAC)

- **Admin**: Full access to bus registry, camera management, audit logs, and settings.
- **Security Officer**: Can record manual events, review uncertain detections, and update gate logs.
- **Viewer**: Read-only access to dashboard statistics, movement history, and reports.
