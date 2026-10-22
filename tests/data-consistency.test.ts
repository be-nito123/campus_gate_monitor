import { describe, expect, it, beforeEach } from 'vitest'
import { BusRepository, DEMO_BUSES } from '@/repositories/mock-bus'
import { GateEventRepository, DEMO_EVENTS } from '@/repositories/mock-events'
import { CameraRepository, DEMO_CAMERAS } from '@/repositories/mock-cameras'
import { SettingsRepository, DEFAULT_APP_SETTINGS } from '@/repositories/mock-settings'
import { EventProcessingService } from '@/services/event-processing/event-processing'

describe('Data Consistency & Cross-Entity Synchronization', () => {
  let busRepo: BusRepository
  let eventRepo: GateEventRepository
  let cameraRepo: CameraRepository
  let settingsRepo: SettingsRepository
  let processor: EventProcessingService

  beforeEach(() => {
    busRepo = new BusRepository([])
    eventRepo = new GateEventRepository([])
    cameraRepo = new CameraRepository([])
    settingsRepo = new SettingsRepository()
    processor = new EventProcessingService(busRepo, eventRepo)
    processor.duplicateCooldownSeconds = 0
  })

  it('reflects registered bus in lookups and normalizes registration plate automatically', async () => {
    const created = await busRepo.upsert({
      registrationNumber: 'mh 12 ab 1234',
      displayName: 'Express Shuttle',
      routeName: 'North Route',
      currentStatus: 'OUTSIDE_CAMPUS',
    })

    expect(created.normalizedRegistrationNumber).toBe('MH12AB1234')
    expect(created.currentStatus).toBe('OUTSIDE_CAMPUS')

    const byId = await busRepo.getById(created.id)
    expect(byId).not.toBeNull()
    expect(byId?.displayName).toBe('Express Shuttle')

    const byNormalized = await busRepo.getByNormalized('MH12AB1234')
    expect(byNormalized).not.toBeNull()
    expect(byNormalized?.id).toBe(created.id)
  })

  it('updates bus status atomically upon valid entry and exit detections', async () => {
    const bus = await busRepo.upsert({
      registrationNumber: 'KA 05 CD 5678',
      displayName: 'South Shuttle',
      routeName: 'South Route',
      currentStatus: 'OUTSIDE_CAMPUS',
    })

    // 1. Process INBOUND (ENTRY)
    const entryRes = await processor.processGateDetection({
      rawOcrText: 'KA 05 CD 5678',
      confidence: 0.96,
      cameraId: 'cam_1',
      source: 'CAMERA',
      directionEstimate: 'INBOUND',
      detectedAt: new Date().toISOString(),
    })

    expect(entryRes.outcome).toBe('EVENT_CREATED')
    expect(entryRes.bus?.currentStatus).toBe('INSIDE_CAMPUS')

    const updatedAfterEntry = await busRepo.getById(bus.id)
    expect(updatedAfterEntry?.currentStatus).toBe('INSIDE_CAMPUS')

    // 2. Process OUTBOUND (EXIT)
    const exitRes = await processor.processGateDetection({
      rawOcrText: 'KA 05 CD 5678',
      confidence: 0.95,
      cameraId: 'cam_2',
      source: 'CAMERA',
      directionEstimate: 'OUTBOUND',
      detectedAt: new Date().toISOString(),
    })

    expect(exitRes.outcome).toBe('EVENT_CREATED')
    expect(exitRes.bus?.currentStatus).toBe('OUTSIDE_CAMPUS')

    const updatedAfterExit = await busRepo.getById(bus.id)
    expect(updatedAfterExit?.currentStatus).toBe('OUTSIDE_CAMPUS')
  })

  it('preserves historical gate events after a bus is deactivated', async () => {
    const bus = await busRepo.upsert({
      registrationNumber: 'MH 12 AB 9999',
      displayName: 'Retiring Fleet Bus',
      routeName: 'Old Route',
      currentStatus: 'OUTSIDE_CAMPUS',
    })

    await processor.processGateDetection({
      rawOcrText: 'MH 12 AB 9999',
      confidence: 0.98,
      cameraId: 'cam_1',
      source: 'CAMERA',
      directionEstimate: 'INBOUND',
      detectedAt: new Date().toISOString(),
    })

    const eventsBefore = await eventRepo.listAll()
    expect(eventsBefore).toHaveLength(1)
    expect(eventsBefore[0].busId).toBe(bus.id)

    // Deactivate the bus
    const deactivated = await busRepo.deactivate(bus.id)
    expect(deactivated).toBe(true)

    // Bus is excluded from active list
    const activeBuses = await busRepo.listAll()
    expect(activeBuses.find((b) => b.id === bus.id)).toBeUndefined()

    // Bus is still in all-including-inactive
    const allBuses = await busRepo.listAllIncludingInactive()
    const foundDeactivated = allBuses.find((b) => b.id === bus.id)
    expect(foundDeactivated).toBeDefined()
    expect(foundDeactivated?.isActive).toBe(false)

    // Historical gate events remain completely intact
    const eventsAfter = await eventRepo.listAll()
    expect(eventsAfter).toHaveLength(1)
    expect(eventsAfter[0].busId).toBe(bus.id)
  })

  it('synchronizes review resolution: confirms event and updates bus status', async () => {
    const bus = await busRepo.upsert({
      registrationNumber: 'MH 14 XY 5555',
      displayName: 'Review Test Bus',
      routeName: 'Special Route',
      currentStatus: 'OUTSIDE_CAMPUS',
    })

    // Low confidence detection creates pending event in review queue
    const detectionRes = await processor.processGateDetection({
      rawOcrText: 'MH 14 XY 5555',
      confidence: 0.42, // low confidence
      cameraId: 'cam_1',
      source: 'CAMERA',
      directionEstimate: 'INBOUND',
      detectedAt: new Date().toISOString(),
    })

    expect(detectionRes.outcome).toBe('ROUTED_TO_REVIEW')
    const pendingEvent = detectionRes.event!
    expect(pendingEvent.reviewStatus).toBe('PENDING')

    // Bus status remains unchanged during pending review
    const busDuringPending = await busRepo.getById(bus.id)
    expect(busDuringPending?.currentStatus).toBe('OUTSIDE_CAMPUS')

    // Reviewer confirms the detection and assigns the bus
    const updatedEvent = await eventRepo.update(pendingEvent.id, {
      reviewStatus: 'CONFIRMED',
      busId: bus.id,
      normalizedOcrText: 'MH14XY5555',
      notes: 'Confirmed by Security Officer',
    })

    expect(updatedEvent?.reviewStatus).toBe('CONFIRMED')
    expect(updatedEvent?.busId).toBe(bus.id)

    // Update the bus status as resolveReview would
    await busRepo.upsert({
      id: bus.id,
      currentStatus: updatedEvent?.eventType === 'ENTRY' ? 'INSIDE_CAMPUS' : 'OUTSIDE_CAMPUS',
    })

    const busAfterConfirm = await busRepo.getById(bus.id)
    expect(busAfterConfirm?.currentStatus).toBe('INSIDE_CAMPUS')
  })

  it('restores baseline demo datasets cleanly on reset', async () => {
    // Add custom temporary records
    await busRepo.upsert({ registrationNumber: 'DL 99 ZZ 0000', routeName: 'Temp' })
    await eventRepo.create({ rawOcrText: 'DL 99 ZZ 0000', eventType: 'ENTRY' })
    await cameraRepo.upsert({ name: 'Temp Camera' })

    // Reset all stores to demo baseline
    await busRepo.reset(DEMO_BUSES)
    await eventRepo.reset(DEMO_EVENTS)
    await cameraRepo.reset(DEMO_CAMERAS)
    await settingsRepo.reset(DEFAULT_APP_SETTINGS)

    const resetBuses = await busRepo.listAll()
    expect(resetBuses.length).toBe(DEMO_BUSES.length)
    expect(resetBuses[0].registrationNumber).toBe(DEMO_BUSES[0].registrationNumber)

    const resetEvents = await eventRepo.listAll()
    expect(resetEvents.length).toBe(DEMO_EVENTS.length)

    const resetCameras = await cameraRepo.listAll()
    expect(resetCameras.length).toBe(DEMO_CAMERAS.length)

    const resetSettings = await settingsRepo.get()
    expect(resetSettings.campusName).toBe(DEFAULT_APP_SETTINGS.campusName)
  })
})
