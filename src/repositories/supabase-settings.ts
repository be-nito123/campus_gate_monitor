import { supabase } from '@/services/supabase/client'
import type { AppSettings } from '@/types/domain'

// Default settings (used as fallback)
export const DEFAULT_APP_SETTINGS: AppSettings = {
  campusName: 'GateVision Main Campus',
  gateName: 'Primary Gate Terminal',
  operatingMode: 'LIVE',
  liveBackendEnabled: true,
  confidenceThreshold: 0.85,
  duplicateCooldownSeconds: 60,
  outsideCampusAlertMinutes: 120,
  evidenceRetentionDays: 30,
  eventRetentionDays: 90,
  timezone: 'Asia/Kolkata',
}

export class SupabaseSettingsRepository {
  async get(): Promise<AppSettings> {
    if (!supabase) throw new Error('Supabase client not configured')

    // In Supabase mode, we use profile settings for user preferences
    // and hardcode the operational settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .maybeSingle()

    if (error) {
      console.warn(`Failed to fetch profile settings: ${error.message}, using defaults`)
      return DEFAULT_APP_SETTINGS
    }

    // Return operational settings with user profile info
    return {
      ...DEFAULT_APP_SETTINGS,
      campusName: profile?.display_name ? `${profile.display_name}'s Campus` : DEFAULT_APP_SETTINGS.campusName,
      gateName: profile?.role ? `${profile.role} Terminal` : DEFAULT_APP_SETTINGS.gateName,
    }
  }

  async update(_updates: Partial<AppSettings>): Promise<AppSettings> {
    // In Supabase mode, settings are read from profile
    // We could store additional settings in a separate table if needed
    console.warn('Settings update in Supabase mode - settings are read from profile')
    return this.get()
  }

  async reset(): Promise<void> {
    throw new Error('Reset operation not supported in production Supabase mode')
  }
}