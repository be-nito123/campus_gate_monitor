import type { GateEvent } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'
import { StorageService, defaultStorage } from '@/services/storage/storage-service'
import { isGateEvent } from '@/services/storage/validation'

const now = new Date()
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString()

export const DEMO_EVENTS: GateEvent[] = [
  {
    id: 'evt-seed-01',
    busId: 'bus-001',
    eventType: 'EXIT',
    eventTime: hoursAgo(9),
    source: 'CAMERA',
    rawOcrText: 'MH12AB1234',
    normalizedOcrText: 'MH12AB1234',
    confidence: 0.98,
    cameraId: 'cam-main-out',
    evidenceReference: null,
    reviewStatus: 'CONFIRMED',
    notes: 'Morning shift departure',
    createdAt: hoursAgo(9),
  },
  {
    id: 'evt-seed-02',
    busId: 'bus-001',
    eventType: 'ENTRY',
    eventTime: hoursAgo(4),
    source: 'CAMERA',
    rawOcrText: 'MH12AB1234',
    normalizedOcrText: 'MH12AB1234',
    confidence: 0.96,
    cameraId: 'cam-main-in',
    evidenceReference: null,
    reviewStatus: 'CONFIRMED',
    notes: 'Midday return',
    createdAt: hoursAgo(4),
  },
  {
    id: 'evt-seed-03',
    busId: 'bus-002',
    eventType: 'EXIT',
    eventTime: hoursAgo(7),
    source: 'CAMERA',
    rawOcrText: 'KA05CD5678',
    normalizedOcrText: 'KA05CD5678',
    confidence: 0.94,
    cameraId: 'cam-main-out',
    evidenceReference: null,
    reviewStatus: 'CONFIRMED',
    notes: 'Route B inter-campus transfer',
    createdAt: hoursAgo(7),
  },
  {
    id: 'evt-seed-04',
    busId: 'bus-001',
    eventType: 'EXIT',
    eventTime: daysAgo(1),
    source: 'CAMERA',
    rawOcrText: 'MH12AB1234',
    normalizedOcrText: 'MH12AB1234',
    confidence: 0.97,
    cameraId: 'cam-main-out',
    evidenceReference: null,
    reviewStatus: 'CONFIRMED',
    notes: 'Yesterday afternoon trip',
    createdAt: daysAgo(1),
  },
  {
    id: 'evt-seed-05',
    busId: 'bus-001',
    eventType: 'ENTRY',
    eventTime: new Date(new Date(daysAgo(1)).getTime() + 7200000).toISOString(),
    source: 'CAMERA',
    rawOcrText: 'MH12AB1234',
    normalizedOcrText: 'MH12AB1234',
    confidence: 0.95,
    cameraId: 'cam-main-in',
    evidenceReference: null,
    reviewStatus: 'CONFIRMED',
    notes: 'Yesterday return',
    createdAt: daysAgo(1),
  },
]

export const EVENTS_STORAGE_KEY = 'gatevision_events_v2'

export class GateEventRepository {
  private events: GateEvent[]
  private storage: StorageService

  constructor(initial: GateEvent[] = DEMO_EVENTS, storage?: StorageService) {
    const isTest = Boolean((globalThis as { VITEST?: boolean }).VITEST)
    this.storage = storage ?? (isTest ? new StorageService() : defaultStorage)
    if (isTest && initial !== DEMO_EVENTS) {
      this.events = initial.map((e) => ({ ...e }))
      this.persist()
    } else {
      this.events = this.storage.loadArray(EVENTS_STORAGE_KEY, initial, isGateEvent)
    }
  }

  private persist(): void {
    this.storage.save(EVENTS_STORAGE_KEY, this.events)
  }

  async listAll(): Promise<GateEvent[]> {
    return [...this.events]
      .sort((a, b) => new Date(b.eventTime || b.createdAt).getTime() - new Date(a.eventTime || a.createdAt).getTime())
      .map((e) => ({ ...e }))
  }

  async getById(id: string): Promise<GateEvent | null> {
    const found = this.events.find((e) => e.id === id)
    return found ? { ...found } : null
  }

  async getLastForBus(busId: string): Promise<GateEvent | null> {
    const busEvents = this.events
      .filter((e) => e.busId === busId && e.reviewStatus === 'CONFIRMED')
      .sort((a, b) => new Date(b.eventTime || b.createdAt).getTime() - new Date(a.eventTime || a.createdAt).getTime())
    return busEvents[0] ? { ...busEvents[0] } : null
  }

  async create(event: Partial<GateEvent>): Promise<GateEvent> {
    const now = nowIso()
    const newEvent: GateEvent = {
      id: event.id ?? createId('evt'),
      busId: event.busId ?? null,
      eventType: event.eventType ?? 'ENTRY',
      eventTime: event.eventTime ?? now,
      source: event.source ?? 'DEMO',
      rawOcrText: event.rawOcrText ?? null,
      normalizedOcrText: event.normalizedOcrText ?? null,
      confidence: event.confidence ?? null,
      cameraId: event.cameraId ?? null,
      evidenceReference: event.evidenceReference ?? null,
      reviewStatus: event.reviewStatus ?? 'PENDING',
      notes: event.notes ?? null,
      createdAt: event.createdAt ?? now,
    }
    this.events.push(newEvent)
    this.persist()
    return { ...newEvent }
  }

  async update(id: string, updates: Partial<GateEvent>): Promise<GateEvent | null> {
    const idx = this.events.findIndex((e) => e.id === id)
    if (idx < 0) return null
    const updated: GateEvent = {
      ...this.events[idx],
      ...updates,
    }
    this.events[idx] = updated
    this.persist()
    return { ...updated }
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.events.findIndex((e) => e.id === id)
    if (idx < 0) return false
    this.events.splice(idx, 1)
    this.persist()
    return true
  }

  /** Reset store to original demo seed */
  async reset(initial: GateEvent[] = DEMO_EVENTS): Promise<void> {
    this.events = initial.map((e) => ({ ...e }))
    this.persist()
  }

  /** Seed an event directly */
  async _seed(event: GateEvent): Promise<void> {
    this.events.push({ ...event })
    this.persist()
  }
}
