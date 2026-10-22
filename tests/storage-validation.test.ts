import { describe, expect, it, beforeEach } from 'vitest'
import { StorageService } from '@/services/storage/storage-service'
import { isBus, isGateEvent, isCamera, isAppSettings } from '@/services/storage/validation'
import type { Bus, GateEvent, Camera, AppSettings } from '@/types/domain'

describe('Storage Validation & Fault Tolerance', () => {
  let storage: StorageService

  const sampleBus: Bus = {
    id: 'bus_test_1',
    busCode: 'B001',
    registrationNumber: 'MH 12 AB 1234',
    normalizedRegistrationNumber: 'MH12AB1234',
    displayName: 'Test Bus',
    routeName: 'Route 1',
    driverName: 'Driver Test',
    driverContact: '+91-9999999999',
    currentStatus: 'INSIDE_CAMPUS',
    registrationDate: new Date().toISOString(),
    isActive: true,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const sampleEvent: GateEvent = {
    id: 'evt_test_1',
    busId: 'bus_test_1',
    eventType: 'ENTRY',
    eventTime: new Date().toISOString(),
    source: 'CAMERA',
    rawOcrText: 'MH 12 AB 1234',
    normalizedOcrText: 'MH12AB1234',
    confidence: 0.95,
    cameraId: 'cam_1',
    evidenceReference: null,
    reviewStatus: 'CONFIRMED',
    notes: null,
    createdAt: new Date().toISOString(),
  }

  const sampleCamera: Camera = {
    id: 'cam_test_1',
    name: 'Gate 1 Inbound',
    cameraCode: 'CAM01',
    gateName: 'Main Gate',
    laneName: 'Lane A',
    enabled: true,
    connectionStatus: 'ONLINE',
    lastHeartbeatAt: new Date().toISOString(),
    lastFrameAt: new Date().toISOString(),
    processingStatus: 'PROCESSING',
    directionConfiguration: 'INBOUND',
    simulated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const sampleSettings: AppSettings = {
    campusName: 'GateVision Test Campus',
    gateName: 'Test Gate',
    operatingMode: 'DEMO',
    liveBackendEnabled: false,
    confidenceThreshold: 0.85,
    duplicateCooldownSeconds: 60,
    outsideCampusAlertMinutes: 120,
    evidenceRetentionDays: 30,
    eventRetentionDays: 90,
    timezone: 'Asia/Kolkata',
  }

  beforeEach(() => {
    storage = new StorageService()
  })

  it('validates a well-formed Bus entity', () => {
    expect(isBus(sampleBus)).toBe(true)
  })

  it('rejects an invalid Bus entity with missing or invalid fields', () => {
    expect(isBus(null)).toBe(false)
    expect(isBus({})).toBe(false)
    expect(isBus({ ...sampleBus, currentStatus: 'INVALID_STATUS' })).toBe(false)
    expect(isBus({ ...sampleBus, id: '' })).toBe(false)
    expect(isBus({ ...sampleBus, isActive: 'yes' })).toBe(false)
  })

  it('validates a well-formed GateEvent entity', () => {
    expect(isGateEvent(sampleEvent)).toBe(true)
  })

  it('rejects an invalid GateEvent entity with invalid enum values', () => {
    expect(isGateEvent({ ...sampleEvent, eventType: 'FLY' })).toBe(false)
    expect(isGateEvent({ ...sampleEvent, reviewStatus: 'UNKNOWN_STATUS' })).toBe(false)
    expect(isGateEvent({ ...sampleEvent, source: 'BLUETOOTH' })).toBe(false)
  })

  it('validates a well-formed Camera entity', () => {
    expect(isCamera(sampleCamera)).toBe(true)
  })

  it('rejects an invalid Camera entity', () => {
    expect(isCamera({ ...sampleCamera, connectionStatus: 'BROKEN' })).toBe(false)
    expect(isCamera({ ...sampleCamera, directionConfiguration: 'SIDEWAYS' })).toBe(false)
  })

  it('validates a well-formed AppSettings entity', () => {
    expect(isAppSettings(sampleSettings)).toBe(true)
  })

  it('rejects invalid AppSettings', () => {
    expect(isAppSettings({ ...sampleSettings, operatingMode: 'CLOUD_MAGIC' })).toBe(false)
    expect(isAppSettings({ ...sampleSettings, confidenceThreshold: NaN })).toBe(false)
  })

  it('safely recovers from malformed JSON in storage by returning initial seed', () => {
    // Write corrupted non-JSON string
    storage.save('corrupted_key', '{"id": 123, broken json')
    // Override raw to corrupted syntax
    ;(storage as any).setRaw('corrupted_key', '{"id": 123, broken json')

    const result = storage.loadArray('corrupted_key', [sampleBus], isBus)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(sampleBus.id)
  })

  it('safely recovers when stored value is not an array', () => {
    ;(storage as any).setRaw('object_key', JSON.stringify({ message: 'I am not an array' }))

    const result = storage.loadArray('object_key', [sampleBus], isBus)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(sampleBus.id)
  })

  it('filters out corrupt records while preserving valid records in an array', () => {
    const mixedRecords = [
      sampleBus,
      { id: 'corrupted_1', missingFields: true },
      { ...sampleBus, id: 'bus_test_2', busCode: 'B002', registrationNumber: 'KA 05 CD 5678' },
      { id: 'corrupted_2', currentStatus: 'UNKNOWN_STATUS' },
    ]

    ;(storage as any).setRaw('mixed_key', JSON.stringify(mixedRecords))

    const result = storage.loadArray('mixed_key', [sampleBus], isBus)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('bus_test_1')
    expect(result[1].id).toBe('bus_test_2')
  })

  it('safely merges partial stored configuration with default settings', () => {
    const partialSettings = {
      campusName: 'Custom Campus Name',
      confidenceThreshold: 0.9,
    }

    ;(storage as any).setRaw('settings_key', JSON.stringify(partialSettings))

    const result = storage.loadObject('settings_key', sampleSettings, isAppSettings)
    expect(result.campusName).toBe('Custom Campus Name')
    expect(result.confidenceThreshold).toBe(0.9)
    // Preserves default fields that were not in partial
    expect(result.timezone).toBe('Asia/Kolkata')
    expect(result.duplicateCooldownSeconds).toBe(60)
  })
})
