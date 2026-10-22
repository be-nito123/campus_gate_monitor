import type { GateEvent } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'

export const DEMO_EVENTS: GateEvent[] = []
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
