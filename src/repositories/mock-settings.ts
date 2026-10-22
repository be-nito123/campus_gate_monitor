import type { AppSettings } from '@/types/domain'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  campusName: 'GateVision Main Campus',
  gateName: 'Primary Gate Terminal',
  operatingMode: 'DEMO',
  liveBackendEnabled: false,
  confidenceThreshold: 0.85,
  duplicateCooldownSeconds: 60,
  outsideCampusAlertMinutes: 120,
  evidenceRetentionDays: 30,
  eventRetentionDays: 90,
  timezone: 'Asia/Kolkata',
}

const STORAGE_KEY = 'gatevision_settings_v1'

export class SettingsRepository {
  private settings: AppSettings

  constructor(initial: AppSettings = DEFAULT_APP_SETTINGS) {
    this.settings = this.loadFromStorage(initial)
  }

  private loadFromStorage(initial: AppSettings): AppSettings {
    try {
      if ((import.meta as { env?: { VITEST?: boolean } }).env?.VITEST) {
        return { ...initial }
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          return { ...initial, ...JSON.parse(stored) }
        }
      }
    } catch {
      // fallback
    }
    return { ...initial }
  }

  private saveToStorage(): void {
    try {
      if ((import.meta as { env?: { VITEST?: boolean } }).env?.VITEST) return
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
      }
    } catch {
      // fallback
    }
  }

  async get(): Promise<AppSettings> {
    return { ...this.settings }
  }

  async update(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...updates }
    this.saveToStorage()
    return { ...this.settings }
  }
}
