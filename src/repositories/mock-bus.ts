import type { Bus } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'
import { normalizeRegistrationNumber, toComparisonKey } from '@/utils/registration'

export const DEMO_BUSES: Bus[] = [
  {
    id: 'bus-001',
    busCode: 'B001',
    registrationNumber: 'MH12AB1234',
    normalizedRegistrationNumber: 'MH12AB1234',
    displayName: 'Campus Shuttle 1',
    routeName: 'Route A',
    driverName: 'Rahul Sharma',
    driverContact: '+91-9876543210',
    currentStatus: 'INSIDE_CAMPUS',
    registrationDate: nowIso(),
    isActive: true,
    notes: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'bus-002',
    busCode: 'B002',
    registrationNumber: 'KA05CD5678',
    normalizedRegistrationNumber: 'KA05CD5678',
    displayName: 'Campus Shuttle 2',
    routeName: 'Route B',
    driverName: 'Sneha Gupta',
    driverContact: '+91-9123456789',
    currentStatus: 'OUTSIDE_CAMPUS',
    registrationDate: nowIso(),
    isActive: true,
    notes: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
]

const STORAGE_KEY = 'gatevision_buses_v1'

export class BusRepository {
  private buses: Bus[]

  constructor(initial: Bus[] = DEMO_BUSES) {
    this.buses = this.loadFromStorage(initial)
  }

  private loadFromStorage(initial: Bus[]): Bus[] {
    try {
      if ((globalThis as { VITEST?: boolean }).VITEST) {
        return [...initial]
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          return JSON.parse(stored)
        }
      }
    } catch {
      // fallback
    }
    return [...initial]
  }

  private saveToStorage(): void {
    try {
      if ((globalThis as { VITEST?: boolean }).VITEST) return
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buses))
      }
    } catch {
      // fallback
    }
  }

  async listAll(): Promise<Bus[]> {
    return this.buses.filter((b) => b.isActive).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
  }

  async getById(id: string): Promise<Bus | null> {
    return this.buses.find((b) => b.id === id) || null
  }

  async getByNormalized(reg: string): Promise<Bus | null> {
    const key = toComparisonKey(reg)
    return (
      this.buses.find(
        (b) => b.isActive && toComparisonKey(b.normalizedRegistrationNumber) === key,
      ) ?? null
    )
  }

  async upsert(bus: Partial<Bus>): Promise<Bus> {
    if (bus.id) {
      const idx = this.buses.findIndex((b) => b.id === bus.id)
      if (idx >= 0) {
        this.buses[idx] = { ...this.buses[idx], ...bus, updatedAt: nowIso() }
        this.saveToStorage()
        return this.buses[idx]
      }
    }
    const newBus: Bus = {
      id: bus.id ?? createId('bus'),
      busCode: bus.busCode ?? `B${(this.buses.length + 1).toString().padStart(3, '0')}`,
      registrationNumber: bus.registrationNumber ?? bus.normalizedRegistrationNumber ?? 'UNASSIGNED',
      normalizedRegistrationNumber:
        bus.normalizedRegistrationNumber ?? normalizeRegistrationNumber(bus.registrationNumber ?? ''),
      displayName: bus.displayName ?? null,
      routeName: bus.routeName ?? 'Unknown',
      driverName: bus.driverName ?? null,
      driverContact: bus.driverContact ?? null,
      currentStatus: bus.currentStatus ?? 'INSIDE_CAMPUS',
      registrationDate: bus.registrationDate ?? nowIso(),
      isActive: bus.isActive ?? true,
      notes: bus.notes ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    this.buses.push(newBus)
    this.saveToStorage()
    return newBus
  }

  async deactivate(id: string): Promise<boolean> {
    const bus = await this.getById(id)
    if (!bus) return false
    bus.isActive = false
    bus.updatedAt = nowIso()
    this.saveToStorage()
    return true
  }

  async _seed(bus: Bus) {
    this.buses.push(bus)
    this.saveToStorage()
  }
}
