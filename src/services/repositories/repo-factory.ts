/**
 * Repository Factory
 * Switches between demo (localStorage) and live (Supabase) data sources
 */

import { isSupabaseConfigured } from '@/services/supabase/client'
import { BusRepository, DEMO_BUSES } from '@/repositories/mock-bus'
import { GateEventRepository, DEMO_EVENTS } from '@/repositories/mock-events'
import { CameraRepository, DEMO_CAMERAS } from '@/repositories/mock-cameras'
import { SettingsRepository, DEFAULT_APP_SETTINGS } from '@/repositories/mock-settings'
import { SupabaseBusRepository } from '@/repositories/supabase-bus'
import { SupabaseGateEventRepository } from '@/repositories/supabase-events'
import { SupabaseCameraRepository } from '@/repositories/supabase-cameras'
import { SupabaseSettingsRepository } from '@/repositories/supabase-settings'

export type BusRepositoryType = BusRepository | SupabaseBusRepository
export type EventRepositoryType = GateEventRepository | SupabaseGateEventRepository
export type CameraRepositoryType = CameraRepository | SupabaseCameraRepository
export type SettingsRepositoryType = SettingsRepository | SupabaseSettingsRepository

export interface RepositoryFactoryConfig {
  useSupabase: boolean
}

export class RepositoryFactory {
  static createBusRepository(config: RepositoryFactoryConfig): BusRepositoryType {
    if (config.useSupabase && isSupabaseConfigured) {
      return new SupabaseBusRepository()
    }
    return new BusRepository(DEMO_BUSES)
  }

  static createEventRepository(config: RepositoryFactoryConfig): EventRepositoryType {
    if (config.useSupabase && isSupabaseConfigured) {
      return new SupabaseGateEventRepository()
    }
    return new GateEventRepository(DEMO_EVENTS)
  }

  static createCameraRepository(config: RepositoryFactoryConfig): CameraRepositoryType {
    if (config.useSupabase && isSupabaseConfigured) {
      return new SupabaseCameraRepository()
    }
    return new CameraRepository(DEMO_CAMERAS)
  }

  static createSettingsRepository(config: RepositoryFactoryConfig): SettingsRepositoryType {
    if (config.useSupabase && isSupabaseConfigured) {
      return new SupabaseSettingsRepository()
    }
    return new SettingsRepository(DEFAULT_APP_SETTINGS)
  }
}
