# GateVision API Contract

This document defines the REST API contract between the React frontend, the FastAPI computer vision backend, and the database persistence layer.

## Endpoints

### Health & Status
- `GET /api/health` — Returns system status and database connectivity.
- `GET /api/cameras` — List registered gate cameras.
- `GET /api/cameras/{camera_id}/status` — Heartbeat and telemetry for a camera.

### Events & Detections
- `GET /api/events` — Retrieve paginated gate movement history with filters (`from`, `to`, `bus_id`, `event_type`, `review_status`).
- `GET /api/events/{event_id}` — Get single event detail with evidence reference.
- `POST /api/detections` — Ingest raw ANPR camera detection (called by FastAPI CV service).
- `POST /api/events/manual` — Record a manual gate event with mandatory audit reason.
- `POST /api/events/{event_id}/review` — Resolve a pending detection review (confirm, reject, or correct).

### Bus Registry
- `GET /api/buses` — List all registered campus buses.
- `POST /api/buses` — Register a new bus.
- `PATCH /api/buses/{bus_id}` — Update bus metadata or deactivation status.
- `GET /api/buses/{bus_id}/events` — Movement history for a specific bus.

### Analytics
- `GET /api/reports/summary` — Aggregated movement statistics and outside-campus durations.
