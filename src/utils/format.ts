import { formatInTimeZone } from 'date-fns-tz'

/**
 * All user-facing timestamps are rendered in the campus display timezone.
 * The default is IST (UTC+05:30) because GateVision targets Indian campuses.
 * Storage always happens in UTC ISO-8601.
 */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

const TIMEZONE_LABELS: Record<string, string> = {
  'Asia/Kolkata': 'India Standard Time (IST, UTC+05:30)',
  'UTC': 'Coordinated Universal Time (UTC)',
  'Asia/Dubai': 'Gulf Standard Time (GST, UTC+04:00)',
  'Asia/Singapore': 'Singapore Time (SGT, UTC+08:00)',
  'Europe/London': 'Greenwich Mean Time (GMT, UTC+00:00)',
  'America/New_York': 'Eastern Time (ET, UTC-05:00)',
}

export function getTimezoneLabel(timezone: string): string {
  return TIMEZONE_LABELS[timezone] ?? timezone
}

export function formatDateTime(iso: string | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatInTimeZone(date, timezone, 'dd MMM yyyy, HH:mm:ss')
}

export function formatTime(iso: string | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatInTimeZone(date, timezone, 'HH:mm:ss')
}

export function formatDate(iso: string | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatInTimeZone(date, timezone, 'dd MMM yyyy')
}

export function formatDateTimeShort(iso: string | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatInTimeZone(date, timezone, 'dd MMM, HH:mm')
}

/** ISO date (yyyy-MM-dd) of an instant in the display timezone. */
export function toDateKey(iso: string | Date, timezone = DEFAULT_TIMEZONE): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd')
}

/** Start-of-day in the display timezone, returned as a UTC ISO string. */
export function startOfDayInTimezone(date: string | Date, timezone = DEFAULT_TIMEZONE): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Date(formatInTimeZone(d, timezone, "yyyy-MM-dd'T'00:00:00.000Z"))
}

export function endOfDayInTimezone(date: string | Date, timezone = DEFAULT_TIMEZONE): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Date(formatInTimeZone(d, timezone, "yyyy-MM-dd'T'23:59:59.999Z"))
}

/** "3 minutes ago" style label computed against a stable `now` reference. */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
  timezone = DEFAULT_TIMEZONE,
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)

  if (abs < 10) return 'just now'
  if (abs < 60) return diffSeconds < 0 ? `${abs}s ago` : `in ${abs}s`

  const minutes = Math.round(abs / 60)
  if (minutes < 60) return diffSeconds < 0 ? `${minutes} min ago` : `in ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return diffSeconds < 0 ? `${hours} h ago` : `in ${hours} h`

  const days = Math.round(hours / 24)
  if (days < 7) return diffSeconds < 0 ? `${days} d ago` : `in ${days} d`

  return formatDate(iso, timezone)
}

/** Compact duration between two instants, e.g. "1 h 24 min". */
export function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return '—'
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export function formatConfidence(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined || Number.isNaN(confidence)) return '—'
  return `${(confidence * 100).toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}
