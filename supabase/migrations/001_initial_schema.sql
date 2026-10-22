-- ============================================================================
-- GateVision PostgreSQL Schema & Supabase Migration
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BUSES TABLE
CREATE TABLE IF NOT EXISTS buses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_code VARCHAR(32) NOT NULL UNIQUE,
    registration_number VARCHAR(32) NOT NULL,
    normalized_registration_number VARCHAR(32) NOT NULL UNIQUE,
    display_name VARCHAR(128),
    route_name VARCHAR(128) NOT NULL,
    driver_name VARCHAR(128),
    driver_contact VARCHAR(32),
    current_status VARCHAR(32) NOT NULL DEFAULT 'INSIDE_CAMPUS' CHECK (current_status IN ('INSIDE_CAMPUS', 'OUTSIDE_CAMPUS')),
    registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buses_normalized_reg ON buses(normalized_registration_number);
CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(current_status);

-- 2. CAMERAS TABLE
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    camera_code VARCHAR(32) NOT NULL UNIQUE,
    gate_name VARCHAR(128) NOT NULL,
    lane_name VARCHAR(128) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    connection_status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE' CHECK (connection_status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN', 'SIMULATED')),
    last_heartbeat_at TIMESTAMPTZ,
    last_frame_at TIMESTAMPTZ,
    processing_status VARCHAR(32) NOT NULL DEFAULT 'IDLE' CHECK (processing_status IN ('IDLE', 'PROCESSING', 'ERROR', 'DISABLED')),
    direction_configuration VARCHAR(32) NOT NULL DEFAULT 'BIDIRECTIONAL' CHECK (direction_configuration IN ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL')),
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. GATE EVENTS TABLE
CREATE TABLE IF NOT EXISTS gate_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('ENTRY', 'EXIT')),
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(16) NOT NULL CHECK (source IN ('CAMERA', 'MANUAL', 'DEMO')),
    raw_ocr_text VARCHAR(64),
    normalized_ocr_text VARCHAR(64),
    confidence REAL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    evidence_reference TEXT,
    review_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_events_bus_id ON gate_events(bus_id);
CREATE INDEX IF NOT EXISTS idx_gate_events_time ON gate_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_gate_events_type ON gate_events(event_type);
CREATE INDEX IF NOT EXISTS idx_gate_events_review ON gate_events(review_status);

-- 4. DETECTION REVIEWS TABLE
CREATE TABLE IF NOT EXISTS detection_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_event_id UUID NOT NULL REFERENCES gate_events(id) ON DELETE CASCADE,
    suggested_bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
    raw_ocr_text VARCHAR(64),
    normalized_ocr_text VARCHAR(64),
    confidence REAL,
    review_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
    reviewer_id UUID,
    review_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    reason TEXT,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 6. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    display_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'SECURITY_OFFICER', 'VIEWER')),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS) policies
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to buses" ON buses FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to buses" ON buses FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to cameras" ON cameras FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to cameras" ON cameras FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to gate events" ON gate_events FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert to gate events" ON gate_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated access to reviews" ON detection_reviews FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to audit logs" ON audit_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow public read access to profiles" ON profiles FOR SELECT USING (true);
