import type { Camera } from '@/types/domain'
import { createId, nowIso } from '@/utils/id'

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

const STORAGE_KEY = 'gatevision_cameras_v1'

export class CameraRepository {
  private cameras: Camera[]

  constructor(initial: Camera[] = DEMO_CAMERAS) {
    this.cameras = this.loadFromStorage(initial)
  }

  private loadFromStorage(initial: Camera[]): Camera[] {
    try {
      if ((import.meta as { env?: { VITEST?: boolean } }).env?.VITEST) {
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
      if ((import.meta as { env?: { VITEST?: boolean } }).env?.VITEST) return
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cameras))
      }
    } catch {
      // fallback
    }
  }

  async listAll(): Promise<Camera[]> {
    return [...this.cameras].sort((a, b) => a.name.localeCompare(b.name))
  }

  async getById(id: string): Promise<Camera | null> {
    return this.cameras.find((c) => c.id === id) || null
  }

  async upsert(camera: Partial<Camera>): Promise<Camera> {
    if (camera.id) {
      const idx = this.cameras.findIndex((c) => c.id === camera.id)
      if (idx >= 0) {
        this.cameras[idx] = { ...this.cameras[idx], ...camera, updatedAt: nowIso() }
        this.saveToStorage()
        return this.cameras[idx]
      }
    }
    const newCamera: Camera = {
      id: camera.id ?? createId('cam'),
      name: camera.name ?? 'New Camera',
      cameraCode: camera.cameraCode ?? `CAM${Math.floor(10 + Math.random() * 90)}`,
      gateName: camera.gateName ?? 'Main Gate',
      laneName: camera.laneName ?? 'Lane 1',
      enabled: camera.enabled ?? true,
      connectionStatus: camera.connectionStatus ?? 'ONLINE',
      lastHeartbeatAt: nowIso(),
      lastFrameAt: nowIso(),
      processingStatus: camera.processingStatus ?? 'PROCESSING',
      directionConfiguration: camera.directionConfiguration ?? 'BIDIRECTIONAL',
      simulated: camera.simulated ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    this.cameras.push(newCamera)
    this.saveToStorage()
    return newCamera
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.cameras.findIndex((c) => c.id === id)
    if (idx < 0) return false
    this.cameras.splice(idx, 1)
    this.saveToStorage()
    return true
  }
}
