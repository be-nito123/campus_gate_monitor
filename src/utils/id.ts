/** Stable-ish unique identifier generator that works in browser and test envs. */
export function createId(prefix = 'id'): string {
  const cryptoRef = globalThis.crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `${prefix}_${cryptoRef.randomUUID().replace(/-/g, '').slice(0, 20)}`
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** ISO timestamp helper used across repositories. */
export function nowIso(): string {
  return new Date().toISOString()
}
