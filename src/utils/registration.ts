/**
 * Indian vehicle registration helpers.
 *
 * Indian plates follow the `SS DD LL NNNN` layout where:
 *   SS  — 2-letter state code          (alpha, always present)
 *   DD  — 1–2 digit district code      (numeric, always present)
 *   LL  — 1–3 letter series code       (alpha, sometimes absent on old plates)
 *   NNNN — 1–4 digit running number   (numeric, always present)
 *
 * Examples:  MH 12 AB 1234  |  KA 05 C 999  |  DL 8 CAB 1234
 *
 * Two additional representations are used internally:
 *
 *  1. `normalizeRegistrationNumber` — strips separators, uppercases everything.
 *     Deterministic and lossless; used for storage and exact matching.
 *
 *  2. `toComparisonKey` — an OCR-tolerant key that folds only the numeric
 *     positions of a plate.  Series letters are NEVER folded, so `AB` ≠ `4B`.
 *     This allows `MH I2 AB I234` to match `MH12AB1234`.
 */

/**
 * Letters that OCR engines frequently confuse with digits.
 * Only applied to the STATE, DISTRICT and NUMBER groups — never to SERIES.
 */
const NUMERIC_LOOKALIKES: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  T: '1',
  Z: '2',
  S: '5',
  G: '6',
}

/** Strip separators and uppercase the remainder. */
export function normalizeRegistrationNumber(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Structure of a parsed Indian registration number.
 * `series` is null for old-style plates that have no alphabetic series block.
 */
interface PlateGroups {
  state: string    // e.g. "MH"
  district: string // e.g. "12"
  series: string   // e.g. "AB" (may be empty string for plates without one)
  number: string   // e.g. "1234"
}

/** Greedy plate parser — returns null for non-conforming strings. */
function parsePlateGroups(normalized: string): PlateGroups | null {
  // With series:    SS DD[D] [L[LL]] NNNN
  const withSeries = /^([A-Z]{2})(\d{1,3})([A-Z]{1,3})(\d{1,4})$/.exec(normalized)
  if (withSeries) {
    const [, state, district, series, number] = withSeries
    return { state, district, series, number }
  }
  // Without series: SS DD NNNN  (legacy plates)
  const withoutSeries = /^([A-Z]{2})(\d{1,3})()(\d{1,4})$/.exec(normalized)
  if (withoutSeries) {
    const [, state, district, series, number] = withoutSeries
    return { state, district, series, number }
  }
  return null
}

/**
 * Produce an OCR-tolerant comparison key.
 *
 * Strategy: apply letter→digit folding to the raw normalised string,
 * then attempt to parse the result as an Indian plate to keep the series
 * block untouched. If the unfolded version parses successfully, only the
 * numeric groups are folded (keeping series). Otherwise the fully-folded
 * string is the key.
 */
export function toComparisonKey(normalizedOrRaw: string): string {
  const value = normalizeRegistrationNumber(normalizedOrRaw)
  // Try parsing the raw value directly first.
  const groups = parsePlateGroups(value)
  if (groups) {
    const { state, district, series, number } = groups
    return `${state}${district}${series}${number}`
  }
  // Fold every confusable letter, then try structuring the result.
  const fullyFolded = Array.from(value)
    .map((ch) => NUMERIC_LOOKALIKES[ch] ?? ch)
    .join('')
  return fullyFolded
}

/**
 * Format a canonical registration for user display.
 * Returns the raw value for plates that do not conform.
 */
export function formatRegistrationNumber(normalized: string): string {
  const value = normalizeRegistrationNumber(normalized)
  const groups = parsePlateGroups(value)
  if (!groups) return value
  const { state, district, series, number } = groups
  return series
    ? `${state} ${district} ${series} ${number}`
    : `${state} ${district} ${number}`
}

/** Parse a user-supplied plate into its canonical + display representations. */
export function parseRegistrationNumber(raw: string): {
  normalized: string
  display: string
  comparisonKey: string
} {
  const normalized = normalizeRegistrationNumber(raw)
  return {
    normalized,
    display: formatRegistrationNumber(normalized),
    comparisonKey: toComparisonKey(normalized),
  }
}

/**
 * Structural validation of an Indian registration number.
 *
 * Accepts the pre-2014 layout (`MH 12 A 1234`) and the current layout
 * (`MH 12 AB 1234`).  A trailing numeric group of at least 1 digit and
 * at most 4 digits is required.
 */
const REGISTRATION_RE = /^[A-Z]{2}\d{1,3}[A-Z]{0,3}\d{1,4}$/

export function isValidRegistrationNumber(raw: string): boolean {
  const value = normalizeRegistrationNumber(raw)
  if (!REGISTRATION_RE.test(value)) return false
  // Must have at least a state code + district + number (6 chars minimum).
  if (value.length < 6) return false
  return true
}

/** Human-readable validation error, or null when valid. */
export function describeRegistrationIssue(raw: string): string | null {
  const value = normalizeRegistrationNumber(raw)
  if (!value) return 'Registration number is required.'
  if (!/^[A-Z]{2}/.test(value))
    return 'Registration number must start with a 2-letter state code (e.g. MH, KA, DL).'
  if (value.length < 6) return 'Registration number is too short.'
  if (value.length > 13) return 'Registration number is too long.'
  if (!REGISTRATION_RE.test(value))
    return 'Use the format SS DD LL NNNN — for example MH 12 AB 1234.'
  return null
}
