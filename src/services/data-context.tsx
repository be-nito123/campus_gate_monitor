import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { BusRepository, DEMO_BUSES } from '@/repositories/mock-bus'
import { GateEventRepository, DEMO_EVENTS } from '@/repositories/mock-events'
import { CameraRepository, DEMO_CAMERAS } from '@/repositories/mock-cameras'
import { SettingsRepository, DEFAULT_APP_SETTINGS } from '@/repositories/mock-settings'
import { EventProcessingService } from '@/services/event-processing/event-processing'
import type { Bus, GateEvent, Camera, AppSettings, RawDetection, ProcessingResult } from '@/types/domain'

interface AppData {
  listBuses: () => Promise<Bus[]>
  listEvents: () => Promise<GateEvent[]>
  registerBus: (bus: Partial<Bus>) => Promise<Bus>
  updateBus: (bus: Partial<Bus>) => Promise<Bus>
  deactivateBus: (id: string) => Promise<boolean>
  processDetection: (d: RawDetection) => Promise<ProcessingResult>
  updateEvent: (id: string, updates: Partial<GateEvent>) => Promise<GateEvent | null>
  listCameras: () => Promise<Camera[]>
  registerCamera: (camera: Partial<Camera>) => Promise<Camera>
  updateCamera: (camera: Partial<Camera>) => Promise<Camera>
  deleteCamera: (id: string) => Promise<boolean>
  getSettings: () => Promise<AppSettings>
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
}

const Ctx = createContext<AppData | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const busRepo = new BusRepository(DEMO_BUSES)
  const eventRepo = new GateEventRepository(DEMO_EVENTS)
  const cameraRepo = new CameraRepository(DEMO_CAMERAS)
  const settingsRepo = new SettingsRepository(DEFAULT_APP_SETTINGS)
  const processor = new EventProcessingService(busRepo, eventRepo)

  const value: AppData = {
    listBuses: () => busRepo.listAll(),
    listEvents: () => eventRepo.listAll(),
    registerBus: (bus) => busRepo.upsert(bus),
    updateBus: (bus) => busRepo.upsert(bus),
    deactivateBus: (id) => busRepo.deactivate(id),
    processDetection: (d) => processor.processGateDetection(d),
    updateEvent: (id, updates) => eventRepo.update(id, updates),
    listCameras: () => cameraRepo.listAll(),
    registerCamera: (cam) => cameraRepo.upsert(cam),
    updateCamera: (cam) => cameraRepo.upsert(cam),
    deleteCamera: (id) => cameraRepo.remove(id),
    getSettings: () => settingsRepo.get(),
    updateSettings: (updates) => settingsRepo.update(updates),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
