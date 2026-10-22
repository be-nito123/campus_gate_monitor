/**
 * Domain-level type definitions for GateVision.
 * These mirror the PostgreSQL schema and are shared by every data source.
 */

/* -------------------------------------------------------------------------- */
/* Enumerations                                                               */
/* -------------------------------------------------------------------------- */

export const BUS_STATUSES = ['INSIDE_CAMPUS', 'OUTSIDE_CAMPUS'] as const
export type BusStatus = (typeof BUS_STATUSES)[number]

export const EVENT_TYPES = ['ENTRY', 'EXIT'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_SOURCES = ['CAMERA', 'MANUAL', 'DEMO'] as const
export type EventSource = (typeof EVENT_SOURCES)[number]

export const REVIEW_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const CAMERA_CONNECTION_STATUSES = [
  'ONLINE',
  'OFFLINE',
  'DEGRADED',
  'UNKNOWN',
  'SIMULATED',
] as const
export type CameraConnectionStatus = (typeof CAMERA_CONNECTION_STATUSES)[number]

export const CAMERA_PROCESSING_STATUSES = [
  'IDLE',
  'PROCESSING',
  'ERROR',
  'DISABLED',
] as const
export type CameraProcessingStatus = (typeof CAMERA_PROCESSING_STATUSES)[number]

export const OPERATING_MODES = ['DEMO', 'LIVE'] as const
export type OperatingMode = (typeof OPERATING_MODES)[number]

export const USER_ROLES = ['ADMIN', 'SECURITY_OFFICER', 'VIEWER'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const DIRECTION_CONFIGURATIONS = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'] as const
export type DirectionConfiguration = (typeof DIRECTION_CONFIGURATIONS)[number]

/* -------------------------------------------------------------------------- */
/* Entities                                                                   */
/* -------------------------------------------------------------------------- */

export interface Bus {
  id: string
  busCode: string
  registrationNumber: string
  normalizedRegistrationNumber: string
  displayName: string | null
  routeName: string
  driverName: string | null
  driverContact: string | null
  currentStatus: BusStatus
  registrationDate: string
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface GateEvent {
  id: string
  busId: string | null
  eventType: EventType
  eventTime: string
  source: EventSource
  rawOcrText: string | null
  normalizedOcrText: string | null
  confidence: number | null
  cameraId: string | null
  evidenceReference: string | null
  reviewStatus: ReviewStatus
  notes: string | null
  createdAt: string
}

export interface Camera {
  id: string
  name: string
  cameraCode: string
  gateName: string
  laneName: string
  enabled: boolean
  connectionStatus: CameraConnectionStatus
  lastHeartbeatAt: string | null
  lastFrameAt: string | null
  processingStatus: CameraProcessingStatus
  directionConfiguration: DirectionConfiguration
  simulated: boolean
  createdAt: string
  updatedAt: string
}

export interface DetectionReview {
  id: string
  gateEventId: string
  suggestedBusId: string | null
  rawOcrText: string | null
  normalizedOcrText: string | null
  confidence: number | null
  reviewStatus: ReviewStatus
  reviewerId: string | null
  reviewReason: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  reason: string | null
  beforeData: unknown
  afterData: unknown
  createdAt: string
}

export interface Profile {
  id: string
  displayName: string
  role: UserRole
  email: string | null
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/* Detection payload (input to the event-processing service)                   */
/* -------------------------------------------------------------------------- */

export type DirectionEstimate = 'INBOUND' | 'OUTBOUND' | 'UNKNOWN'

export interface RawDetection {
  /** Raw OCR output from the plate recogniser, exactly as received. */
  rawOcrText: string
  /** Confidence of the OCR read, 0..1. */
  confidence: number
  /** Camera that produced the detection. */
  cameraId: string
  /** Short-lived tracker identity. Never persisted as a vehicle identity. */
  trackingId?: string | null
  /** ISO timestamp of the detection. */
  detectedAt?: string
  /** Estimated direction of travel across the gate line. */
  directionEstimate?: DirectionEstimate
  /** Reference (path/URI) to the captured evidence frame. */
  evidenceReference?: string | null
  /** Where the detection came from. */
  source: EventSource
  /** Lane or region identifier inside the camera frame. */
  lane?: string | null
}

export interface ProcessingSettings {
  /** Minimum OCR confidence required to auto-match a registered bus. */
  confidenceThreshold: number
  /** Seconds window used to suppress duplicate events for the same plate. */
  duplicateCooldownSeconds: number
  /** Minutes outside campus before a bus is flagged as overdue. */
  outsideCampusAlertMinutes: number
  /** Days of evidence retention. */
  evidenceRetentionDays: number
  /** Days of gate event retention. */
  eventRetentionDays: number
  /** Display timezone for all user-facing timestamps. */
  timezone: string
}

export interface AppSettings extends ProcessingSettings {
  campusName: string
  gateName: string
  operatingMode: OperatingMode
  /** Master switch for live CV backend. Never true until a backend exists. */
  liveBackendEnabled: boolean
}

/* -------------------------------------------------------------------------- */
/* Processing results                                                         */
/* -------------------------------------------------------------------------- */

export type ProcessingOutcome =
  | 'EVENT_CREATED'
  | 'DUPLICATE_SUPPRESSED'
  | 'ROUTED_TO_REVIEW'
  | 'REJECTED_INVALID_STATE'
  | 'IGNORED'

export interface ProcessingResult {
  outcome: ProcessingOutcome
  event: GateEvent | null
  bus: Bus | null
  review: DetectionReview | null
  message: string
  /** Reason codes the UI can surface, e.g. LOW_CONFIDENCE, PLATE_NOT_FOUND. */
  reasons: string[]
}

/* -------------------------------------------------------------------------- */
/* Query helpers                                                              */
/* -------------------------------------------------------------------------- */

export interface EventFilters {
  from?: string | null
  to?: string | null
  registrationNumber?: string | null
  busId?: string | null
  eventType?: EventType | null
  source?: EventSource | null
  reviewStatus?: ReviewStatus | null
  cameraId?: string | null
}

export interface SortState<TKey extends string = string> {
  key: TKey
  direction: 'asc' | 'desc'
}
