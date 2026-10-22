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

export class CameraRepository {
  private cameras: Camera[]

  constructor(initial: Camera[] = DEMO_CAMERAS) {
    this.cameras = [...initial]
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
    return newCamera
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.cameras.findIndex((c) => c.id === id)
    if (idx < 0) return false
    this.cameras.splice(idx, 1)
    return true
  }
}
