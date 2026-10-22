-- ============================================================================
-- GateVision Development Seed Data
-- ============================================================================

-- Insert initial buses
INSERT INTO buses (bus_code, registration_number, normalized_registration_number, display_name, route_name, driver_name, driver_contact, current_status)
VALUES
('B001', 'MH 12 AB 1234', 'MH12AB1234', 'Campus Shuttle 1', 'Route A', 'Rahul Sharma', '+91-9876543210', 'INSIDE_CAMPUS'),
('B002', 'KA 05 CD 5678', 'KA05CD5678', 'Campus Shuttle 2', 'Route B', 'Sneha Gupta', '+91-9123456789', 'OUTSIDE_CAMPUS'),
('B003', 'DL 08 EF 9012', 'DL08EF9012', 'Engineering Dept Bus', 'Route C', 'Amit Kumar', '+91-9988776655', 'INSIDE_CAMPUS')
ON CONFLICT (bus_code) DO NOTHING;

-- Insert initial cameras
INSERT INTO cameras (name, camera_code, gate_name, lane_name, enabled, connection_status, processing_status, direction_configuration, simulated)
VALUES
('Gate 1 - Main Inbound', 'CAM01', 'Main Gate', 'Lane A (Inbound)', true, 'ONLINE', 'PROCESSING', 'INBOUND', true),
('Gate 1 - Main Outbound', 'CAM02', 'Main Gate', 'Lane B (Outbound)', true, 'ONLINE', 'PROCESSING', 'OUTBOUND', true),
('North Campus Gate', 'CAM03', 'North Gate', 'Lane 1', true, 'ONLINE', 'PROCESSING', 'BIDIRECTIONAL', true),
('South Campus Gate', 'CAM04', 'South Gate', 'Lane 1', true, 'SIMULATED', 'IDLE', 'BIDIRECTIONAL', true)
ON CONFLICT (camera_code) DO NOTHING;
