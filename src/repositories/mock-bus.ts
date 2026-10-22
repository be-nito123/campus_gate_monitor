import type { Bus } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'
import { normalizeRegistrationNumber, toComparisonKey } from '@/utils/registration'
import { StorageService, defaultStorage } from '@/services/storage/storage-service'
import { isBus } from '@/services/storage/validation'

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
    registrationDate: '2026-01-15T08:00:00.000Z',
    isActive: true,
    notes: 'Primary fleet vehicle',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-01-15T08:00:00.000Z',
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
    registrationDate: '2026-01-20T08:00:00.000Z',
    isActive: true,
    notes: 'Secondary fleet vehicle',
    createdAt: '2026-01-20T08:00:00.000Z',
    updatedAt: '2026-01-20T08:00:00.000Z',
  },
  {
    id: 'bus-003',
    busCode: 'B003',
    registrationNumber: 'DL08EF9012',
    normalizedRegistrationNumber: 'DL08EF9012',
    displayName: 'Engineering Dept Bus',
    routeName: 'Route C',
    driverName: 'Amit Kumar',
    driverContact: '+91-9988776655',
    currentStatus: 'INSIDE_CAMPUS',
    registrationDate: '2026-02-01T08:00:00.000Z',
    isActive: true,
    notes: 'Engineering campus transfer shuttle',
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z',
  },
]

export const BUSES_STORAGE_KEY = 'gatevision_buses_v2'

export class BusRepository {
  private buses: Bus[]
  private storage: StorageService

  constructor(initial: Bus[] = DEMO_BUSES, storage?: StorageService) {
    const isTest = Boolean((globalThis as { VITEST?: boolean }).VITEST)
    this.storage = storage ?? (isTest ? new StorageService() : defaultStorage)
    if (isTest && initial !== DEMO_BUSES) {
      this.buses = initial.map((b) => ({ ...b }))
      this.persist()
    } else {
      this.buses = this.storage.loadArray(BUSES_STORAGE_KEY, initial, isBus)
    }
  }

  private persist(): void {
    this.storage.save(BUSES_STORAGE_KEY, this.buses)
  }

  async listAll(): Promise<Bus[]> {
    return this.buses
      .filter((b) => b.isActive)
      .sort((a, b) => (a.displayName || a.registrationNumber).localeCompare(b.displayName || b.registrationNumber))
      .map((b) => ({ ...b }))
  }

  async listAllIncludingInactive(): Promise<Bus[]> {
    return this.buses.map((b) => ({ ...b }))
  }

  async getById(id: string): Promise<Bus | null> {
    const found = this.buses.find((b) => b.id === id)
    return found ? { ...found } : null
  }

  async getByNormalized(reg: string): Promise<Bus | null> {
    const key = toComparisonKey(reg)
    const found = this.buses.find(
      (b) => b.isActive && toComparisonKey(b.normalizedRegistrationNumber) === key,
    )
    return found ? { ...found } : null
  }

  async upsert(bus: Partial<Bus>): Promise<Bus> {
    const now = nowIso()
    if (bus.id) {
      const idx = this.buses.findIndex((b) => b.id === bus.id)
      if (idx >= 0) {
        const updated: Bus = {
          ...this.buses[idx],
          ...bus,
          updatedAt: now,
        }
        if (bus.registrationNumber && !bus.normalizedRegistrationNumber) {
          updated.normalizedRegistrationNumber = normalizeRegistrationNumber(bus.registrationNumber)
        }
        this.buses[idx] = updated
        this.persist()
        return { ...updated }
      }
    }

    const rawReg = bus.registrationNumber ?? bus.normalizedRegistrationNumber ?? 'UNASSIGNED'
    const normalizedReg = bus.normalizedRegistrationNumber ?? normalizeRegistrationNumber(rawReg)

    const newBus: Bus = {
      id: bus.id ?? createId('bus'),
      busCode: bus.busCode ?? `B${(this.buses.length + 1).toString().padStart(3, '0')}`,
      registrationNumber: rawReg,
      normalizedRegistrationNumber: normalizedReg,
      displayName: bus.displayName ?? null,
      routeName: bus.routeName ?? 'Route Unassigned',
      driverName: bus.driverName ?? null,
      driverContact: bus.driverContact ?? null,
      currentStatus: bus.currentStatus ?? 'INSIDE_CAMPUS',
      registrationDate: bus.registrationDate ?? now,
      isActive: bus.isActive ?? true,
      notes: bus.notes ?? null,
      createdAt: bus.createdAt ?? now,
      updatedAt: now,
    }

    this.buses.push(newBus)
    this.persist()
    return { ...newBus }
  }

  async deactivate(id: string): Promise<boolean> {
    const idx = this.buses.findIndex((b) => b.id === id)
    if (idx < 0) return false
    this.buses[idx] = {
      ...this.buses[idx],
      isActive: false,
      updatedAt: nowIso(),
    }
    this.persist()
    return true
  }

  /** Reset store to original demo seed */
  async reset(initial: Bus[] = DEMO_BUSES): Promise<void> {
    this.buses = initial.map((b) => ({ ...b }))
    this.persist()
  }
}
