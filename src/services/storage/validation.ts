import type {
  Bus,
  GateEvent,
  Camera,
  AppSettings,
  DetectionReview,
  BusStatus,
  EventType,
  EventSource,
  ReviewStatus,
  CameraConnectionStatus,
  CameraProcessingStatus,
  DirectionConfiguration,
  OperatingMode,
} from '@/types/domain'

const VALID_BUS_STATUSES: Set<BusStatus> = new Set(['INSIDE_CAMPUS', 'OUTSIDE_CAMPUS'])
const VALID_EVENT_TYPES: Set<EventType> = new Set(['ENTRY', 'EXIT'])
const VALID_EVENT_SOURCES: Set<EventSource> = new Set(['CAMERA', 'MANUAL', 'DEMO'])
const VALID_REVIEW_STATUSES: Set<ReviewStatus> = new Set(['PENDING', 'CONFIRMED', 'REJECTED'])
const VALID_CAMERA_CONN_STATUSES: Set<CameraConnectionStatus> = new Set([
  'ONLINE',
  'OFFLINE',
  'DEGRADED',
  'UNKNOWN',
  'SIMULATED',
])
const VALID_CAMERA_PROC_STATUSES: Set<CameraProcessingStatus> = new Set([
  'IDLE',
  'PROCESSING',
  'ERROR',
  'DISABLED',
])
const VALID_DIR_CONFIGS: Set<DirectionConfiguration> = new Set([
  'INBOUND',
  'OUTBOUND',
  'BIDIRECTIONAL',
])
const VALID_OPERATING_MODES: Set<OperatingMode> = new Set(['DEMO', 'LIVE'])

/** Runtime type guard for Bus entity */
export function isBus(item: unknown): item is Bus {
  if (!item || typeof item !== 'object') return false
  const b = item as Record<string, unknown>
  return (
    typeof b.id === 'string' &&
    b.id.trim().length > 0 &&
    typeof b.busCode === 'string' &&
    typeof b.registrationNumber === 'string' &&
    typeof b.normalizedRegistrationNumber === 'string' &&
    typeof b.routeName === 'string' &&
    VALID_BUS_STATUSES.has(b.currentStatus as BusStatus) &&
    typeof b.isActive === 'boolean' &&
    typeof b.createdAt === 'string' &&
    typeof b.updatedAt === 'string'
  )
}

/** Runtime type guard for GateEvent entity */
export function isGateEvent(item: unknown): item is GateEvent {
  if (!item || typeof item !== 'object') return false
  const e = item as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.trim().length > 0 &&
    VALID_EVENT_TYPES.has(e.eventType as EventType) &&
    typeof e.eventTime === 'string' &&
    VALID_EVENT_SOURCES.has(e.source as EventSource) &&
    VALID_REVIEW_STATUSES.has(e.reviewStatus as ReviewStatus) &&
    typeof e.createdAt === 'string'
  )
}

/** Runtime type guard for Camera entity */
export function isCamera(item: unknown): item is Camera {
  if (!item || typeof item !== 'object') return false
  const c = item as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    c.id.trim().length > 0 &&
    typeof c.name === 'string' &&
    typeof c.cameraCode === 'string' &&
    typeof c.gateName === 'string' &&
    typeof c.laneName === 'string' &&
    typeof c.enabled === 'boolean' &&
    VALID_CAMERA_CONN_STATUSES.has(c.connectionStatus as CameraConnectionStatus) &&
    VALID_CAMERA_PROC_STATUSES.has(c.processingStatus as CameraProcessingStatus) &&
    VALID_DIR_CONFIGS.has(c.directionConfiguration as DirectionConfiguration) &&
    typeof c.simulated === 'boolean'
  )
}

/** Runtime type guard for AppSettings */
export function isAppSettings(item: unknown): item is AppSettings {
  if (!item || typeof item !== 'object') return false
  const s = item as Record<string, unknown>
  return (
    typeof s.campusName === 'string' &&
    typeof s.gateName === 'string' &&
    VALID_OPERATING_MODES.has(s.operatingMode as OperatingMode) &&
    typeof s.liveBackendEnabled === 'boolean' &&
    typeof s.confidenceThreshold === 'number' &&
    !Number.isNaN(s.confidenceThreshold) &&
    typeof s.duplicateCooldownSeconds === 'number' &&
    !Number.isNaN(s.duplicateCooldownSeconds) &&
    typeof s.outsideCampusAlertMinutes === 'number' &&
    !Number.isNaN(s.outsideCampusAlertMinutes) &&
    typeof s.evidenceRetentionDays === 'number' &&
    !Number.isNaN(s.evidenceRetentionDays) &&
    typeof s.eventRetentionDays === 'number' &&
    !Number.isNaN(s.eventRetentionDays) &&
    typeof s.timezone === 'string'
  )
}

/** Runtime type guard for DetectionReview */
export function isDetectionReview(item: unknown): item is DetectionReview {
  if (!item || typeof item !== 'object') return false
  const r = item as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.gateEventId === 'string' &&
    VALID_REVIEW_STATUSES.has(r.reviewStatus as ReviewStatus) &&
    typeof r.createdAt === 'string'
  )
}
