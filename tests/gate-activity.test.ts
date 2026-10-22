import { describe, expect, it, beforeEach } from 'vitest'
import { GateEventRepository } from '@/repositories/mock-events'
import type { GateEvent } from '@/types/domain'

describe('Gate Event Repository - Regression tests for event lifecycle', () => {
  let eventRepo: GateEventRepository

  const mockEvent: GateEvent = {
    id: 'evt_test_101',
    busId: 'bus_001',
    eventType: 'ENTRY',
    eventTime: new Date().toISOString(),
    source: 'CAMERA',
    rawOcrText: 'MH 12 AB 1234',
    normalizedOcrText: 'MH12AB1234',
    confidence: 0.95,
    cameraId: 'cam_gate_1',
    evidenceReference: null,
    reviewStatus: 'PENDING',
    notes: 'Test event',
    createdAt: new Date().toISOString(),
  }

  beforeEach(() => {
    eventRepo = new GateEventRepository([mockEvent])
  })

  it('opens and lists events correctly', async () => {
    const events = await eventRepo.listAll()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('evt_test_101')
    expect(events[0].confidence).toBe(0.95)
  })

  it('updates / edits an event safely (review status and notes)', async () => {
    const updated = await eventRepo.update('evt_test_101', {
      reviewStatus: 'CONFIRMED',
      notes: 'Reviewed and corrected manually',
    })

    expect(updated).not.toBeNull()
    expect(updated?.reviewStatus).toBe('CONFIRMED')
    expect(updated?.notes).toBe('Reviewed and corrected manually')
    expect(updated?.confidence).toBe(0.95) // preserved
  })

  it('handles updates to non-existent events safely', async () => {
    const result = await eventRepo.update('non_existent', { reviewStatus: 'CONFIRMED' })
    expect(result).toBeNull()
  })

  it('deletes an event safely and resets state', async () => {
    const deleted = await eventRepo.remove('evt_test_101')
    expect(deleted).toBe(true)

    const remaining = await eventRepo.listAll()
    expect(remaining).toHaveLength(0)

    // Deleting non-existent returns false
    const deletedAgain = await eventRepo.remove('evt_test_101')
    expect(deletedAgain).toBe(false)
  })

  it('handles null or missing confidence safely without throwing', async () => {
    const nullConfidenceEvent = await eventRepo.create({
      id: 'evt_null_conf',
      confidence: null,
      rawOcrText: 'UNKNOWN',
    })

    expect(nullConfidenceEvent.confidence).toBeNull()
    // Test formatting helper with null confidence
    const formatted = nullConfidenceEvent.confidence !== null && nullConfidenceEvent.confidence !== undefined
      ? `${(nullConfidenceEvent.confidence * 100).toFixed(1)}%`
      : '—'
    expect(formatted).toBe('—')
  })
})
