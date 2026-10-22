/**
 * Storage Service
 * Provides fault-tolerant, runtime-validated localStorage operations.
 * Safely recovers from corrupted, outdated, or invalid stored data.
 */

export class StorageService {
  private inMemoryFallback: Map<string, string> = new Map()

  /** Returns true if running in a headless or test environment (e.g. Vitest/Node) */
  private isTestOrServer(): boolean {
    if (typeof window === 'undefined') return true
    if ((globalThis as { VITEST?: boolean }).VITEST) return true
    if (!window.localStorage) return true
    return false
  }

  /** Read raw string from storage or in-memory fallback */
  private getRaw(key: string): string | null {
    if (this.isTestOrServer()) {
      return this.inMemoryFallback.get(key) ?? null
    }
    try {
      return window.localStorage.getItem(key)
    } catch (err) {
      console.warn(`[StorageService] Failed to read key "${key}" from localStorage:`, err)
      return this.inMemoryFallback.get(key) ?? null
    }
  }

  /** Write raw string to storage and in-memory fallback */
  private setRaw(key: string, value: string): boolean {
    this.inMemoryFallback.set(key, value)
    if (this.isTestOrServer()) return true

    try {
      window.localStorage.setItem(key, value)
      return true
    } catch (err) {
      console.warn(`[StorageService] Failed to write key "${key}" to localStorage:`, err)
      return false
    }
  }

  /** Remove a key from storage */
  remove(key: string): void {
    this.inMemoryFallback.delete(key)
    if (!this.isTestOrServer()) {
      try {
        window.localStorage.removeItem(key)
      } catch (err) {
        console.warn(`[StorageService] Failed to remove key "${key}":`, err)
      }
    }
  }

  /**
   * Safely loads an array of entities with runtime validation.
   * If stored data is corrupted, malformed, or empty, safely returns validated items or initial demo data.
   */
  loadArray<T>(key: string, initial: T[], validator: (item: unknown) => item is T): T[] {
    const raw = this.getRaw(key)
    if (!raw) {
      // Key does not exist yet; populate with initial data
      this.save(key, initial)
      return initial.map((item) => structuredClone(item))
    }

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        console.warn(`[StorageService] Stored value for "${key}" is not an array. Resetting to initial seed.`)
        this.save(key, initial)
        return initial.map((item) => structuredClone(item))
      }

      // Filter to keep only items passing strict runtime validation
      const validItems: T[] = []
      let malformedCount = 0

      for (const item of parsed) {
        if (validator(item)) {
          validItems.push(item)
        } else {
          malformedCount++
        }
      }

      if (malformedCount > 0) {
        console.warn(
          `[StorageService] Discarded ${malformedCount} invalid/outdated records from "${key}". Valid records retained: ${validItems.length}.`,
        )
      }

      // If all records were malformed, fall back to initial demo dataset
      if (validItems.length === 0 && initial.length > 0) {
        console.warn(`[StorageService] Zero valid records remained for "${key}". Resetting to initial seed.`)
        this.save(key, initial)
        return initial.map((item) => structuredClone(item))
      }

      // Save sanitized array back if any items were purged
      if (malformedCount > 0) {
        this.save(key, validItems)
      }

      return validItems
    } catch (err) {
      console.warn(`[StorageService] JSON parse error for key "${key}". Resetting to initial seed:`, err)
      this.save(key, initial)
      return initial.map((item) => structuredClone(item))
    }
  }

  /**
   * Safely loads a single configuration object with runtime validation.
   * Automatically merges with defaults if some keys are missing or invalid.
   */
  loadObject<T extends object>(key: string, initial: T, validator: (item: unknown) => item is T): T {
    const raw = this.getRaw(key)
    if (!raw) {
      this.save(key, initial)
      return structuredClone(initial)
    }

    try {
      const parsed = JSON.parse(raw)
      if (validator(parsed)) {
        return parsed
      }

      // If it's a partial object, merge over defaults and test again
      if (parsed && typeof parsed === 'object') {
        const merged = { ...initial, ...parsed }
        if (validator(merged)) {
          this.save(key, merged)
          return merged
        }
      }

      console.warn(`[StorageService] Stored object for "${key}" failed validation. Resetting to defaults.`)
      this.save(key, initial)
      return structuredClone(initial)
    } catch (err) {
      console.warn(`[StorageService] JSON parse error for object "${key}":`, err)
      this.save(key, initial)
      return structuredClone(initial)
    }
  }

  /**
   * Safely serializes and persists data.
   */
  save<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value)
      return this.setRaw(key, serialized)
    } catch (err) {
      console.warn(`[StorageService] Failed to serialize data for "${key}":`, err)
      return false
    }
  }
}

/** Global default storage instance */
export const defaultStorage = new StorageService()
