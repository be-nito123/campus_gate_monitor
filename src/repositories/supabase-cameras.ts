import { supabase } from '@/services/supabase/client'
import { nowIso } from '@/utils/id'
import type { Camera } from '@/types/domain'
import type { Database } from '@/types/database'

type DbCamera = Database['public']['Tables']['cameras']['Row']

/** Map database row to domain model */
function mapDbCameraToDomain(dbCamera: DbCamera): Camera {
  return {
    id: dbCamera.id,
    name: dbCamera.name,
    cameraCode: dbCamera.camera_code,
    gateName: dbCamera.gate_name,
    laneName: dbCamera.lane_name,
    enabled: dbCamera.enabled,
    connectionStatus: dbCamera.connection_status,
    lastHeartbeatAt: dbCamera.last_heartbeat_at,
    lastFrameAt: dbCamera.last_frame_at,
    processingStatus: dbCamera.processing_status,
    directionConfiguration: dbCamera.direction_configuration,
    simulated: dbCamera.simulated,
    createdAt: dbCamera.created_at,
    updatedAt: dbCamera.updated_at,
  }
}

export class SupabaseCameraRepository {
  async listAll(): Promise<Camera[]> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('cameras')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw new Error(`Failed to fetch cameras: ${error.message}`)
    return (data || []).map(mapDbCameraToDomain)
  }

  async getById(id: string): Promise<Camera | null> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch camera: ${error.message}`)
    return data ? mapDbCameraToDomain(data) : null
  }

  async upsert(camera: Partial<Camera>): Promise<Camera> {
    if (!supabase) throw new Error('Supabase client not configured')

    const now = nowIso()

    if (camera.id) {
      // Update existing
      const updates: Partial<Database['public']['Tables']['cameras']['Update']> = {
        updated_at: now,
      }

      if (camera.name) updates.name = camera.name
      if (camera.cameraCode) updates.camera_code = camera.cameraCode
      if (camera.gateName) updates.gate_name = camera.gateName
      if (camera.laneName) updates.lane_name = camera.laneName
      if (camera.enabled !== undefined) updates.enabled = camera.enabled
      if (camera.connectionStatus) updates.connection_status = camera.connectionStatus
      if (camera.lastHeartbeatAt !== undefined) updates.last_heartbeat_at = camera.lastHeartbeatAt
      if (camera.lastFrameAt !== undefined) updates.last_frame_at = camera.lastFrameAt
      if (camera.processingStatus) updates.processing_status = camera.processingStatus
      if (camera.directionConfiguration) updates.direction_configuration = camera.directionConfiguration
      if (camera.simulated !== undefined) updates.simulated = camera.simulated

      const { data, error } = await supabase
        .from('cameras')
        .update(updates)
        .eq('id', camera.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update camera: ${error.message}`)
      return mapDbCameraToDomain(data)
    } else {
      // Insert new
      const insert: Database['public']['Tables']['cameras']['Insert'] = {
        name: camera.name ?? 'New Camera Feed',
        camera_code: camera.cameraCode ?? `CAM${Math.floor(10 + Math.random() * 90)}`,
        gate_name: camera.gateName ?? 'Main Gate',
        lane_name: camera.laneName ?? 'Lane 1',
        enabled: camera.enabled ?? true,
        connection_status: camera.connectionStatus ?? 'ONLINE',
        last_heartbeat_at: now,
        last_frame_at: now,
        processing_status: camera.processingStatus ?? 'PROCESSING',
        direction_configuration: camera.directionConfiguration ?? 'BIDIRECTIONAL',
        simulated: camera.simulated ?? true,
        created_at: now,
        updated_at: now,
      }

      const { data, error } = await supabase
        .from('cameras')
        .insert(insert)
        .select()
        .single()

      if (error) throw new Error(`Failed to create camera: ${error.message}`)
      return mapDbCameraToDomain(data)
    }
  }

  async remove(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { error } = await supabase
      .from('cameras')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete camera: ${error.message}`)
    return true
  }

  async reset(): Promise<void> {
    throw new Error('Reset operation not supported in production Supabase mode')
  }
}
