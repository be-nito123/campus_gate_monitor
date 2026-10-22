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

export class SettingsRepository {
  private settings: AppSettings

  constructor(initial: AppSettings = DEFAULT_APP_SETTINGS) {
    this.settings = { ...initial }
  }

  async get(): Promise<AppSettings> {
    return { ...this.settings }
  }

  async update(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...updates }
    return { ...this.settings }
  }
}
