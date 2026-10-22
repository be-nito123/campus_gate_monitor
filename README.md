# GateVision — Smart Campus Bus Monitoring System

GateVision is a professional fleet-management control center and automated campus bus monitoring application built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui principles, and PostgreSQL / Supabase.

## Features

- **Operations Dashboard**: Real-time summary cards, hourly traffic charts, and live system health telemetry.
- **Live Monitoring & Simulation**: Interactive camera stream viewport with multi-camera selection and simulation controls (simulate exit, entry, unknown vehicle, and low confidence).
- **Bus Registry**: Complete fleet management module with registration number normalization, search, status filtering (`INSIDE_CAMPUS` / `OUTSIDE_CAMPUS`), route filters, and movement history modals.
- **Gate Activity & Audit Trail**: Searchable movement logs with date-range filters, review status badges, manual event creation, and one-click UTF-8 CSV export.
- **Reports & Analytics**: Recharts analytics suite for daily volume, entry/exit distribution, peak hours, and outside-campus duration calculations.
- **Detection Review Queue**: Dedicated workflow for uncertain or low-confidence OCR reads to confirm, correct, or reject plate detections.
- **Camera Management**: Registry of gate cameras with connection statuses, heartbeats, and direction configurations.
- **Settings**: Configurable thresholds for confidence, duplicate cooldown, evidence retention, and operating mode (`DEMO` / `LIVE`).

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Run the test suite:
   ```bash
   npx vitest run
   ```

4. Build for production:
   ```bash
   npm run build
   ```
