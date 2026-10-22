import { supabase, isSupabaseConfigured } from '@/services/supabase/client'

export interface ConnectionTestResult {
  configured: boolean
  connected: boolean
  authenticated: boolean
  canReadBuses: boolean
  canReadEvents: boolean
  canReadCameras: boolean
  error?: string
  userRole?: string
}

/**
 * Test Supabase connection and permissions
 * Safe to call in development - reports actual connectivity status
 */
export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  const result: ConnectionTestResult = {
    configured: isSupabaseConfigured,
    connected: false,
    authenticated: false,
    canReadBuses: false,
    canReadEvents: false,
    canReadCameras: false,
  }

  if (!isSupabaseConfigured) {
    result.error = 'Supabase not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)'
    return result
  }

  if (!supabase) {
    result.error = 'Supabase client not initialized'
    return result
  }

  try {
    // Test basic connectivity
    const { error: pingError } = await supabase.from('buses').select('count', { count: 'exact', head: true })
    
    if (pingError) {
      result.error = `Connection failed: ${pingError.message}`
      return result
    }

    result.connected = true

    // Check authentication status
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      result.error = `Auth check failed: ${authError.message}`
    }

    result.authenticated = !!user

    if (user) {
      // Try to get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      
      result.userRole = profile?.role || 'VIEWER'
    }

    // Test RLS permissions
    try {
      const { error: busError } = await supabase.from('buses').select('id').limit(1)
      result.canReadBuses = !busError
    } catch {
      result.canReadBuses = false
    }

    try {
      const { error: eventError } = await supabase.from('gate_events').select('id').limit(1)
      result.canReadEvents = !eventError
    } catch {
      result.canReadEvents = false
    }

    try {
      const { error: cameraError } = await supabase.from('cameras').select('id').limit(1)
      result.canReadCameras = !cameraError
    } catch {
      result.canReadCameras = false
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error during connection test'
  }

  return result
}
