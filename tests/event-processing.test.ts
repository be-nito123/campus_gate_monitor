import { beforeEach, describe, expect, it } from 'vitest'
import { EventProcessingService } from '@/services/event-processing/event-processing'
import { BusRepository } from '@/repositories/mock-bus'
import { GateEventRepository } from '@/repositories/mock-events'
import type { Bus, RawDetection } from '@/types/domain'

function makeBus(overrides: Partial<Bus> = {}): Bus {
  const now = new Date().toISOString()
  return {
    id: 'bus_test_1',
    busCode: 'B101',
    registrationNumber: 'MH 12 AB 1234',
    normalizedRegistrationNumber: 'MH12AB1234',
    displayName: 'Test Shuttle',
    routeName: 'Route A',
    driverName: null,
    driverContact: null,
    currentStatus: 'INSIDE_CAMPUS',
    registrationDate: now,
    isActive: true,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeDetection(overrides: Partial<RawDetection> = {}): RawDetection {
  return {
    rawOcrText: 'MH 12 AB 1234',
    confidence: 0.95,
    cameraId: 'cam_gate_1',
    directionEstimate: 'OUTBOUND',
    source: 'DEMO',
    ...overrides,
  }
}

let busRepo: BusRepository
let eventRepo: GateEventRepository
let service: EventProcessingService

beforeEach(() => {
  busRepo = new BusRepository([])
  eventRepo = new GateEventRepository([])
  service = new EventProcessingService(busRepo, eventRepo)
  service.duplicateCooldownSeconds = 0
})

describe('gate event processing', () => {
  it('records an EXIT and sets the bus to OUTSIDE_CAMPUS', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)

    const result = await service.processGateDetection(makeDetection({ directionEstimate: 'OUTBOUND' }))

    expect(result.outcome).toBe('EVENT_CREATED')
    expect(result.event?.eventType).toBe('EXIT')
    expect(result.event?.busId).toBe(bus.id)
    expect(result.event?.reviewStatus).toBe('CONFIRMED')

    const updated = await busRepo.getById(bus.id)
    expect(updated?.currentStatus).toBe('OUTSIDE_CAMPUS')
  })

  it('records an ENTRY after the bus has left, and back again', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)

    const exit = await service.processGateDetection(makeDetection({ directionEstimate: 'OUTBOUND' }))
    expect(exit.outcome).toBe('EVENT_CREATED')
    expect(exit.event?.eventType).toBe('EXIT')

    const entry = await service.processGateDetection(makeDetection({ directionEstimate: 'INBOUND' }))
    expect(entry.outcome).toBe('EVENT_CREATED')
    expect(entry.event?.eventType).toBe('ENTRY')

    const updated = await busRepo.getById(bus.id)
    expect(updated?.currentStatus).toBe('INSIDE_CAMPUS')

    // The bus can leave again without corrupting history.
    const secondExit = await service.processGateDetection(makeDetection({ directionEstimate: 'OUTBOUND' }))
    expect(secondExit.outcome).toBe('EVENT_CREATED')
    expect(secondExit.event?.eventType).toBe('EXIT')

    const events = await eventRepo.listAll()
    expect(events).toHaveLength(3)
  })

  it('suppresses duplicate detections for repeated frames of the same crossing', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)
    service.duplicateCooldownSeconds = 60

    const first = await service.processGateDetection(makeDetection({ directionEstimate: 'OUTBOUND' }))
    expect(first.outcome).toBe('EVENT_CREATED')

    const second = await service.processGateDetection(makeDetection({ directionEstimate: 'OUTBOUND' }))
    expect(second.outcome).toBe('DUPLICATE_SUPPRESSED')
    expect(second.event).toBeNull()

    // The bus status must not have been toggled twice.
    const updated = await busRepo.getById(bus.id)
    expect(updated?.currentStatus).toBe('OUTSIDE_CAMPUS')

    const events = await eventRepo.listAll()
    expect(events).toHaveLength(1)
  })

  it('routes unknown plates to review instead of creating a confirmed event', async () => {
    const result = await service.processGateDetection(
      makeDetection({ rawOcrText: 'ZZ 99 ZZ 9999' }),
    )

    expect(result.outcome).toBe('ROUTED_TO_REVIEW')
    expect(result.event).not.toBeNull()
    expect(result.event?.reviewStatus).toBe('PENDING')
    expect(result.event?.busId).toBeNull()
    expect(result.reasons).toContain('PLATE_NOT_REGISTERED')
  })

  it('routes low-confidence detections to review even when the plate matches', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)

    const result = await service.processGateDetection(makeDetection({ confidence: 0.31 }))

    expect(result.outcome).toBe('ROUTED_TO_REVIEW')
    expect(result.reasons).toContain('LOW_CONFIDENCE')
    expect(result.event?.reviewStatus).toBe('PENDING')

    // Bus status must remain untouched.
    const updated = await busRepo.getById(bus.id)
    expect(updated?.currentStatus).toBe('INSIDE_CAMPUS')
  })

  it('routes detections with an unknown direction to review', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)

    const result = await service.processGateDetection(makeDetection({ directionEstimate: 'UNKNOWN' }))

    expect(result.outcome).toBe('ROUTED_TO_REVIEW')
    expect(result.reasons).toContain('DIRECTION_UNKNOWN')

    const updated = await busRepo.getById(bus.id)
    expect(updated?.currentStatus).toBe('INSIDE_CAMPUS')
  })

  it('flags an invalid state transition (EXIT while already outside) instead of corrupting history', async () => {
    const bus = makeBus({ currentStatus: 'OUTSIDE_CAMPUS' })
    await busRepo.upsert(bus)

    const result = await service.processGateDetection(makeDetection({ directionEstimate: 'OUTBOUND' }))

    expect(result.outcome).toBe('ROUTED_TO_REVIEW')
    expect(result.reasons).toContain('INVALID_STATE_TRANSITION')

    // No confirmed event was created.
    const events = await eventRepo.listAll()
    expect(events.every((e) => e.reviewStatus === 'PENDING')).toBe(true)

    // Status unchanged.
    const updated = await busRepo.getById(bus.id)
    expect(updated?.currentStatus).toBe('OUTSIDE_CAMPUS')
  })

  it('ignores inactive buses and treats them as unknown plates', async () => {
    const bus = makeBus({ isActive: false })
    await busRepo.upsert(bus)

    const result = await service.processGateDetection(makeDetection())

    expect(result.outcome).toBe('ROUTED_TO_REVIEW')
    expect(result.reasons).toContain('PLATE_NOT_REGISTERED')
  })

  it('matches plates despite OCR character confusion', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)

    // OCR read the '1' digits as 'I'.
    const result = await service.processGateDetection(
      makeDetection({ rawOcrText: 'MH I2 AB I234', confidence: 0.82 }),
    )

    expect(result.outcome).toBe('EVENT_CREATED')
    expect(result.event?.busId).toBe(bus.id)
  })

  it('records the raw and normalised OCR text on created events', async () => {
    const bus = makeBus()
    await busRepo.upsert(bus)

    const result = await service.processGateDetection(makeDetection())
    expect(result.event?.rawOcrText).toBe('MH 12 AB 1234')
    expect(result.event?.normalizedOcrText).toBe('MH12AB1234')
    expect(result.event?.confidence).toBeCloseTo(0.95)
  })
})
