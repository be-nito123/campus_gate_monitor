import { supabase } from '@/services/supabase/client'
import { normalizeRegistrationNumber, toComparisonKey } from '@/utils/registration'
import { nowIso } from '@/utils/id'
import type { Bus } from '@/types/domain'
import type { Database } from '@/types/database'

type DbBus = Database['public']['Tables']['buses']['Row']

/** Map database row to domain model */
function mapDbBusToDomain(dbBus: DbBus): Bus {
  return {
    id: dbBus.id,
    busCode: dbBus.bus_code,
    registrationNumber: dbBus.registration_number,
    normalizedRegistrationNumber: dbBus.normalized_registration_number,
    displayName: dbBus.display_name,
    routeName: dbBus.route_name,
    driverName: dbBus.driver_name,
    driverContact: dbBus.driver_contact,
    currentStatus: dbBus.current_status,
    registrationDate: dbBus.registration_date,
    isActive: dbBus.is_active,
    notes: dbBus.notes,
    createdAt: dbBus.created_at,
    updatedAt: dbBus.updated_at,
  }
}

export class SupabaseBusRepository {
  async listAll(): Promise<Bus[]> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('buses')
      .select('*')
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (error) throw new Error(`Failed to fetch buses: ${error.message}`)
    return (data || []).map(mapDbBusToDomain)
  }

  async listAllIncludingInactive(): Promise<Bus[]> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('buses')
      .select('*')
      .order('display_name', { ascending: true })

    if (error) throw new Error(`Failed to fetch all buses: ${error.message}`)
    return (data || []).map(mapDbBusToDomain)
  }

  async getById(id: string): Promise<Bus | null> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { data, error } = await supabase
      .from('buses')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch bus: ${error.message}`)
    return data ? mapDbBusToDomain(data) : null
  }

  async getByNormalized(reg: string): Promise<Bus | null> {
    if (!supabase) throw new Error('Supabase client not configured')

    const key = toComparisonKey(reg)
    
    const { data, error } = await supabase
      .from('buses')
      .select('*')
      .eq('is_active', true)

    if (error) throw new Error(`Failed to search buses: ${error.message}`)
    
    // Client-side comparison using toComparisonKey since Postgres doesn't have the custom logic
    const found = (data || []).find(
      (b) => toComparisonKey(b.normalized_registration_number) === key
    )
    
    return found ? mapDbBusToDomain(found) : null
  }

  async upsert(bus: Partial<Bus>): Promise<Bus> {
    if (!supabase) throw new Error('Supabase client not configured')

    const now = nowIso()

    if (bus.id) {
      // Update existing
      const updates: Partial<Database['public']['Tables']['buses']['Update']> = {
        updated_at: now,
      }

      if (bus.registrationNumber) {
        updates.registration_number = bus.registrationNumber
        updates.normalized_registration_number = bus.normalizedRegistrationNumber || normalizeRegistrationNumber(bus.registrationNumber)
      }
      if (bus.busCode) updates.bus_code = bus.busCode
      if (bus.displayName !== undefined) updates.display_name = bus.displayName
      if (bus.routeName) updates.route_name = bus.routeName
      if (bus.driverName !== undefined) updates.driver_name = bus.driverName
      if (bus.driverContact !== undefined) updates.driver_contact = bus.driverContact
      if (bus.currentStatus) updates.current_status = bus.currentStatus
      if (bus.registrationDate) updates.registration_date = bus.registrationDate
      if (bus.isActive !== undefined) updates.is_active = bus.isActive
      if (bus.notes !== undefined) updates.notes = bus.notes

      const { data, error } = await supabase
        .from('buses')
        .update(updates)
        .eq('id', bus.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update bus: ${error.message}`)
      return mapDbBusToDomain(data)
    } else {
      // Insert new
      const rawReg = bus.registrationNumber ?? bus.normalizedRegistrationNumber ?? 'UNASSIGNED'
      const normalizedReg = bus.normalizedRegistrationNumber ?? normalizeRegistrationNumber(rawReg)

      // Generate next bus code if not provided
      let busCode = bus.busCode
      if (!busCode) {
        const { count } = await supabase
          .from('buses')
          .select('*', { count: 'exact', head: true })
        busCode = `B${((count || 0) + 1).toString().padStart(3, '0')}`
      }

      const insert: Database['public']['Tables']['buses']['Insert'] = {
        bus_code: busCode,
        registration_number: rawReg,
        normalized_registration_number: normalizedReg,
        display_name: bus.displayName ?? null,
        route_name: bus.routeName ?? 'Route Unassigned',
        driver_name: bus.driverName ?? null,
        driver_contact: bus.driverContact ?? null,
        current_status: bus.currentStatus ?? 'INSIDE_CAMPUS',
        registration_date: bus.registrationDate ?? now,
        is_active: bus.isActive ?? true,
        notes: bus.notes ?? null,
        created_at: bus.createdAt ?? now,
        updated_at: now,
      }

      const { data, error } = await supabase
        .from('buses')
        .insert(insert)
        .select()
        .single()

      if (error) throw new Error(`Failed to create bus: ${error.message}`)
      return mapDbBusToDomain(data)
    }
  }

  async deactivate(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase client not configured')

    const { error } = await supabase
      .from('buses')
      .update({
        is_active: false,
        updated_at: nowIso(),
      })
      .eq('id', id)

    if (error) throw new Error(`Failed to deactivate bus: ${error.message}`)
    return true
  }

  async reset(): Promise<void> {
    throw new Error('Reset operation not supported in production Supabase mode')
  }
}
