import type { Camera } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'
import { StorageService, defaultStorage } from '@/services/storage/storage-service'
import { isCamera } from '@/services/storage/validation'

export const DEMO_CAMERAS: Camera[] = [
  {
    id: 'cam-main-in',
    name: 'Gate 1 - Main Inbound',
    cameraCode: 'CAM01',
    gateName: 'Main Gate',
    laneName: 'Lane A (Inbound)',
    enabled: true,
    connectionStatus: 'ONLINE',
    lastHeartbeatAt: nowIso(),
    lastFrameAt: nowIso(),
    processingStatus: 'PROCESSING',
    directionConfiguration: 'INBOUND',
    simulated: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'cam-main-out',
    name: 'Gate 1 - Main Outbound',
    cameraCode: 'CAM02',
    gateName: 'Main Gate',
    laneName: 'Lane B (Outbound)',
    enabled: true,
    connectionStatus: 'ONLINE',
    lastHeartbeatAt: nowIso(),
    lastFrameAt: nowIso(),
    processingStatus: 'PROCESSING',
    directionConfiguration: 'OUTBOUND',
    simulated: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'cam-north-01',
    name: 'North Campus Gate',
    cameraCode: 'CAM03',
    gateName: 'North Gate',
    laneName: 'Lane 1',
    enabled: true,
    connectionStatus: 'ONLINE',
    lastHeartbeatAt: nowIso(),
    lastFrameAt: nowIso(),
    processingStatus: 'PROCESSING',
    directionConfiguration: 'BIDIRECTIONAL',
    simulated: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'cam-south-01',
    name: 'South Campus Gate',
    cameraCode: 'CAM04',
    gateName: 'South Gate',
    laneName: 'Lane 1',
    enabled: true,
    connectionStatus: 'SIMULATED',
    lastHeartbeatAt: nowIso(),
    lastFrameAt: nowIso(),
    processingStatus: 'IDLE',
    directionConfiguration: 'BIDIRECTIONAL',
    simulated: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
]

export const CAMERAS_STORAGE_KEY = 'gatevision_cameras_v2'

export class CameraRepository {
  private cameras: Camera[]
  private storage: StorageService

  constructor(initial: Camera[] = DEMO_CAMERAS, storage?: StorageService) {
    const isTest = Boolean((globalThis as { VITEST?: boolean }).VITEST)
    this.storage = storage ?? (isTest ? new StorageService() : defaultStorage)
    if (isTest && initial !== DEMO_CAMERAS) {
      this.cameras = initial.map((c) => ({ ...c }))
      this.persist()
    } else {
      this.cameras = this.storage.loadArray(CAMERAS_STORAGE_KEY, initial, isCamera)
    }
  }

  private persist(): void {
    this.storage.save(CAMERAS_STORAGE_KEY, this.cameras)
  }

  async listAll(): Promise<Camera[]> {
    return [...this.cameras]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ ...c }))
  }

  async getById(id: string): Promise<Camera | null> {
    const found = this.cameras.find((c) => c.id === id)
    return found ? { ...found } : null
  }

  async upsert(camera: Partial<Camera>): Promise<Camera> {
    const now = nowIso()
    if (camera.id) {
      const idx = this.cameras.findIndex((c) => c.id === camera.id)
      if (idx >= 0) {
        const updated: Camera = {
          ...this.cameras[idx],
          ...camera,
          updatedAt: now,
        }
        this.cameras[idx] = updated
        this.persist()
        return { ...updated }
      }
    }
    const newCamera: Camera = {
      id: camera.id ?? createId('cam'),
      name: camera.name ?? 'New Camera Feed',
      cameraCode: camera.cameraCode ?? `CAM${Math.floor(10 + Math.random() * 90)}`,
      gateName: camera.gateName ?? 'Main Gate',
      laneName: camera.laneName ?? 'Lane 1',
      enabled: camera.enabled ?? true,
      connectionStatus: camera.connectionStatus ?? 'ONLINE',
      lastHeartbeatAt: now,
      lastFrameAt: now,
      processingStatus: camera.processingStatus ?? 'PROCESSING',
      directionConfiguration: camera.directionConfiguration ?? 'BIDIRECTIONAL',
      simulated: camera.simulated ?? true,
      createdAt: now,
      updatedAt: now,
    }
    this.cameras.push(newCamera)
    this.persist()
    return { ...newCamera }
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.cameras.findIndex((c) => c.id === id)
    if (idx < 0) return false
    this.cameras.splice(idx, 1)
    this.persist()
    return true
  }

  /** Reset store to original demo seed */
  async reset(initial: Camera[] = DEMO_CAMERAS): Promise<void> {
    this.cameras = initial.map((c) => ({ ...c }))
    this.persist()
  }
}
