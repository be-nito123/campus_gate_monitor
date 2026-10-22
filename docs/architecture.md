# GateVision Architecture

GateVision is a smart campus bus monitoring system designed for automated entry/exit tracking using vehicle number plate recognition (ANPR), camera-based event processing, a PostgreSQL/Supabase database, and an operations dashboard.

## System Architecture

```
[ ANPR Camera / YOLO Vision Service ]
              │ (POST /api/detections)
              ▼
[ FastAPI Ingestion & Verification Backend ]
              │
              ▼ (Database Transaction / Event Service)
[ PostgreSQL Database (Supabase) ] ──(Supabase Realtime)──> [ React Ops Dashboard (Vite + TypeScript) ]
```

## Core Modules

1. **Event Processing Service (`src/services/event-processing/`)**:
   - Normalises OCR text and applies OCR-tolerant comparison keys (`SS DD LL NNNN`).
   - Validates confidence thresholds and camera direction.
   - Enforces duplicate event suppression within a configurable cooldown window.
   - Prevents invalid state transitions (e.g. issuing an EXIT when the bus is already outside campus).
   - Routes uncertain or unknown plates to a dedicated review queue.

2. **Data Abstraction Layer (`src/repositories/`)**:
   - Decouples UI components from the persistence layer.
   - Supports local in-memory simulation for development and demo mode, with an identical contract designed for Supabase PostgreSQL.

3. **Frontend Control Center (`src/pages/`)**:
   - Built with React, TypeScript, Tailwind CSS, Lucide Icons, and Recharts.
   - Provides Overview, Live Monitoring, Bus Registry, Gate Activity, Reports & Analytics, Detection Review, Camera Management, and Settings.
