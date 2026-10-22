import { supabase } from '@/services/supabase/client'
import { nowIso } from '@/utils/id'
import type { GateEvent } from '@/types/domain'
import type { Database } from '@/types/database'

type DbGateEvent = Database['public']['Tables']['gate_events']['Row']

/** Map database row to domain model */
function mapDbEventToDomain(dbEvent: DbGateEvent): GateEvent {
  return {
    id: dbEvent.id,
    busId: dbEvent.bus_id,
    eventType: dbEvent.event_type,
    eventTime: dbEvent.event_time,
    source: dbEvent.source,
    rawOcrText: dbEvent.raw_ocr_text,
    normalizedOcrText: dbEvent.normalized_ocr_text,
    confidence: dbEvent.confidence,
    cameraId: dbEvent.camera_id,
    evidenceReference: dbEvent.evidence_reference,
    reviewStatus: dbEvent.review_status,
    notes: dbEvent.notes,
    createdAt: dbEvent.created_at,
  }
}

export class SupabaseGateEventRepository {
  async listAll(): Promise<GateEvent[]> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('gate_events')
      .select('*')
      .order('event_time', { ascending: false })

    if (error) throw new Error(`Failed to fetch gate events: ${error.message}`)
    return (data || []).map(mapDbEventToDomain)
  }

  async getById(id: string): Promise<GateEvent | null> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('gate_events')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch gate event: ${error.message}`)
    return data ? mapDbEventToDomain(data) : null
  }

  async getLastForBus(busId: string): Promise<GateEvent | null> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('gate_events')
      .select('*')
      .eq('bus_id', busId)
      .eq('review_status', 'CONFIRMED')
      .order('event_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch last event for bus: ${error.message}`)
    return data ? mapDbEventToDomain(data) : null
  }

  async create(event: Partial<GateEvent>): Promise<GateEvent> {
    if (!supabase) throw new Error('Supabase client not configured')

    const now = nowIso()

    const insert: Database['public']['Tables']['gate_events']['Insert'] = {
      bus_id: event.busId ?? null,
      event_type: event.eventType ?? 'ENTRY',
      event_time: event.eventTime ?? now,
      source: event.source ?? 'DEMO',
      raw_ocr_text: event.rawOcrText ?? null,
      normalized_ocr_text: event.normalizedOcrText ?? null,
      confidence: event.confidence ?? null,
      camera_id: event.cameraId ?? null,
      evidence_reference: event.evidenceReference ?? null,
      review_status: event.reviewStatus ?? 'PENDING',
      notes: event.notes ?? null,
      created_at: event.createdAt ?? now,
    }

    const { data, error } = await supabase
      .from('gate_events')
      .insert(insert)
      .select()
      .single()

    if (error) throw new Error(`Failed to create gate event: ${error.message}`)
    return mapDbEventToDomain(data)
  }

  async update(id: string, updates: Partial<GateEvent>): Promise<GateEvent | null> {
    if (!supabase) throw new Error('Supabase client not configured')

    const dbUpdates: Partial<Database['public']['Tables']['gate_events']['Update']> = {}

    if (updates.busId !== undefined) dbUpdates.bus_id = updates.busId
    if (updates.eventType) dbUpdates.event_type = updates.eventType
    if (updates.eventTime) dbUpdates.event_time = updates.eventTime
    if (updates.source) dbUpdates.source = updates.source
    if (updates.rawOcrText !== undefined) dbUpdates.raw_ocr_text = updates.rawOcrText
    if (updates.normalizedOcrText !== undefined) dbUpdates.normalized_ocr_text = updates.normalizedOcrText
    if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence
    if (updates.cameraId !== undefined) dbUpdates.camera_id = updates.cameraId
    if (updates.evidenceReference !== undefined) dbUpdates.evidence_reference = updates.evidenceReference
    if (updates.reviewStatus) dbUpdates.review_status = updates.reviewStatus
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes

    const { data, error } = await supabase
      .from('gate_events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update gate event: ${error.message}`)
    return mapDbEventToDomain(data)
  }

  async remove(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { error } = await supabase
      .from('gate_events')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete gate event: ${error.message}`)
    return true
  }

  async reset(): Promise<void> {
    throw new Error('Reset operation not supported in production Supabase mode')
  }

  async _seed(_event: GateEvent): Promise<void> {
    throw new Error('Seed operation not supported in production Supabase mode')
  }
}
