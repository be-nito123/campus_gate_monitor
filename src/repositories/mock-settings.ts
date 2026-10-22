import type { AppSettings } from '@/types/domain'
import { StorageService, defaultStorage } from '@/services/storage/storage-service'
import { isAppSettings } from '@/services/storage/validation'

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

export const SETTINGS_STORAGE_KEY = 'gatevision_settings_v2'

export class SettingsRepository {
  private settings: AppSettings
  private storage: StorageService

  constructor(initial: AppSettings = DEFAULT_APP_SETTINGS, storage?: StorageService) {
    const isTest = Boolean((globalThis as { VITEST?: boolean }).VITEST)
    this.storage = storage ?? (isTest ? new StorageService() : defaultStorage)
    if (isTest && initial !== DEFAULT_APP_SETTINGS) {
      this.settings = { ...initial }
      this.persist()
    } else {
      this.settings = this.storage.loadObject(SETTINGS_STORAGE_KEY, initial, isAppSettings)
    }
  }

  private persist(): void {
    this.storage.save(SETTINGS_STORAGE_KEY, this.settings)
  }

  async get(): Promise<AppSettings> {
    return { ...this.settings }
  }

  async update(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...updates }
    this.persist()
    return { ...this.settings }
  }

  /** Reset settings to defaults */
  async reset(initial: AppSettings = DEFAULT_APP_SETTINGS): Promise<void> {
    this.settings = { ...initial }
    this.persist()
  }
}
