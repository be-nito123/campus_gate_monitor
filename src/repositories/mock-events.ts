import type { GateEvent } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'

/** Demo seed events. Loaded only by the demo data context. */
export const DEMO_EVENTS: GateEvent[] = []

export class GateEventRepository {
  private events: GateEvent[]

  constructor(initial: GateEvent[] = []) {
    this.events = [...initial]
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
    return newEvent
  }

  async update(id: string, updates: Partial<GateEvent>): Promise<GateEvent | null> {
    const idx = this.events.findIndex((e) => e.id === id)
    if (idx < 0) return null
    this.events[idx] = { ...this.events[idx], ...updates }
    return this.events[idx]
  }

  async _seed(event: GateEvent) {
    this.events.push(event)
  }
}
