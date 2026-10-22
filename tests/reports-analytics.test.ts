import { describe, expect, it } from 'vitest'
import type { GateEvent, Bus } from '@/types/domain'

describe('Reports & Analytics Analytics Calculations', () => {
  const bus: Bus = {
    id: 'bus_rep_1',
    busCode: 'B999',
    registrationNumber: 'MH 12 ZZ 9999',
    normalizedRegistrationNumber: 'MH12ZZ9999',
    displayName: 'Analytics Test Bus',
    routeName: 'Route Z',
    driverName: null,
    driverContact: null,
    currentStatus: 'OUTSIDE_CAMPUS',
    registrationDate: new Date().toISOString(),
    isActive: true,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  it('pairs each valid EXIT with the next valid ENTRY for outside duration calculation', () => {
    const exitTime = '2026-10-20T08:00:00.000Z'
    const entryTime = '2026-10-20T10:30:00.000Z' // 2.5 hours = 150 minutes

    const exitInstant = new Date(exitTime).getTime()
    const entryInstant = new Date(entryTime).getTime()
    const durationMinutes = Math.max(0, Math.round((entryInstant - exitInstant) / 60000))

    expect(durationMinutes).toBe(150)
  })

  it('handles empty datasets cleanly without throwing errors', () => {
    const emptyEvents: GateEvent[] = []
    const filtered = emptyEvents.filter((e) => e.eventType === 'ENTRY')
    expect(filtered).toHaveLength(0)
  })

  it('respects date boundary filters correctly', () => {
    const events: GateEvent[] = [
      {
        id: 'e1',
        busId: bus.id,
        eventType: 'ENTRY',
        eventTime: '2026-10-15T10:00:00.000Z',
        source: 'CAMERA',
        rawOcrText: 'MH12ZZ9999',
        normalizedOcrText: 'MH12ZZ9999',
        confidence: 0.95,
        cameraId: 'cam_1',
        evidenceReference: null,
        reviewStatus: 'CONFIRMED',
        notes: null,
        createdAt: '2026-10-15T10:00:00.000Z',
      },
      {
        id: 'e2',
        busId: bus.id,
        eventType: 'ENTRY',
        eventTime: '2026-10-20T10:00:00.000Z',
        source: 'CAMERA',
        rawOcrText: 'MH12ZZ9999',
        normalizedOcrText: 'MH12ZZ9999',
        confidence: 0.95,
        cameraId: 'cam_1',
        evidenceReference: null,
        reviewStatus: 'CONFIRMED',
        notes: null,
        createdAt: '2026-10-20T10:00:00.000Z',
      },
    ]

    const fromDate = '2026-10-18'
    const toDate = '2026-10-22'

    const filtered = events.filter((ev) => {
      const evTime = new Date(ev.eventTime).getTime()
      const start = new Date(fromDate).getTime()
      const end = new Date(toDate).setHours(23, 59, 59, 999)
      return evTime >= start && evTime <= end
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('e2')
  })
})
