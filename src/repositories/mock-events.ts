import type { GateEvent } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'

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

const STORAGE_KEY = 'gatevision_events_v1'

export class GateEventRepository {
  private events: GateEvent[]

  constructor(initial: GateEvent[] = DEMO_EVENTS) {
    this.events = this.loadFromStorage(initial)
  }

  private loadFromStorage(initial: GateEvent[]): GateEvent[] {
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
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events))
      }
    } catch {
      // fallback
    }
  }

  async listAll(): Promise<GateEvent[]> {
    return [...this.events].sort((a, b) => (b.createdAt >= a.createdAt ? 1 : -1))
  }

  async getLastForBus(busId: string): Promise<GateEvent | null> {
    const events = this.events
      .filter((e) => e.busId === busId)
      .sort((a, b) => (b.createdAt >= a.createdAt ? 1 : -1))
    return events[0] ?? null
  }

  async create(event: Partial<GateEvent>): Promise<GateEvent> {
    const newEvent: GateEvent = {
      id: event.id ?? createId('evt'),
      busId: event.busId ?? null,
      eventType: event.eventType ?? 'ENTRY',
      eventTime: event.eventTime ?? nowIso(),
      source: event.source ?? 'DEMO',
      rawOcrText: event.rawOcrText ?? null,
      normalizedOcrText: event.normalizedOcrText ?? null,
      confidence: event.confidence ?? null,
      cameraId: event.cameraId ?? null,
      evidenceReference: event.evidenceReference ?? null,
      reviewStatus: event.reviewStatus ?? 'PENDING',
      notes: event.notes ?? null,
      createdAt: nowIso(),
    }
    this.events.push(newEvent)
    this.saveToStorage()
    return newEvent
  }

  async update(id: string, updates: Partial<GateEvent>): Promise<GateEvent | null> {
    const idx = this.events.findIndex((e) => e.id === id)
    if (idx < 0) return null
    this.events[idx] = { ...this.events[idx], ...updates }
    this.saveToStorage()
    return this.events[idx]
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.events.findIndex((e) => e.id === id)
    if (idx < 0) return false
    this.events.splice(idx, 1)
    this.saveToStorage()
    return true
  }

  async _seed(event: GateEvent) {
    this.events.push(event)
    this.saveToStorage()
  }
}
