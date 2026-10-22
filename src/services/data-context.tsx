import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { isSupabaseConfigured } from '@/services/supabase/client'
import { RepositoryFactory } from '@/services/repositories/repo-factory'
import { EventProcessingService } from '@/services/event-processing/event-processing'
import { SupabaseEventProcessingService } from '@/services/event-processing/supabase-event-processing'
import { DEMO_BUSES } from '@/repositories/mock-bus'
import { DEMO_EVENTS } from '@/repositories/mock-events'
import { DEMO_CAMERAS } from '@/repositories/mock-cameras'
import { DEFAULT_APP_SETTINGS } from '@/repositories/mock-settings'
import type {
  Bus,
  GateEvent,
  Camera,
  AppSettings,
  RawDetection,
  ProcessingResult,
  ReviewStatus,
  BusStatus,
} from '@/types/domain'

export interface AppDataContextValue {
  // Reactive shared state
  buses: Bus[]
  events: GateEvent[]
  cameras: Camera[]
  settings: AppSettings
  loading: boolean
  error: string | null

  // Lifecycle & Sync
  refresh: () => Promise<void>
  resetToDemo: () => Promise<void>

  // Bus Operations
  listBuses: () => Promise<Bus[]>
  registerBus: (bus: Partial<Bus>) => Promise<Bus>
  updateBus: (bus: Partial<Bus>) => Promise<Bus>
  deactivateBus: (id: string) => Promise<boolean>

  // Gate & Detection Operations
  listEvents: () => Promise<GateEvent[]>
  processDetection: (d: RawDetection) => Promise<ProcessingResult>
  updateEvent: (id: string, updates: Partial<GateEvent>) => Promise<GateEvent | null>
  deleteEvent: (id: string) => Promise<boolean>
  resolveReview: (
    eventId: string,
    status: ReviewStatus,
    targetBusId: string | null,
    correctedPlate?: string,
    notes?: string,
  ) => Promise<GateEvent | null>

  // Camera Operations
  listCameras: () => Promise<Camera[]>
  registerCamera: (camera: Partial<Camera>) => Promise<Camera>
  updateCamera: (camera: Partial<Camera>) => Promise<Camera>
  deleteCamera: (id: string) => Promise<boolean>

  // Settings Operations
  getSettings: () => Promise<AppSettings>
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
}

const Ctx = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Determine if we should use Supabase or demo mode
  const useSupabase = isSupabaseConfigured
  
  // Stable singleton repository instances across renders
  const busRepoRef = useRef<any>(null)
  const eventRepoRef = useRef<any>(null)
  const cameraRepoRef = useRef<any>(null)
  const settingsRepoRef = useRef<any>(null)
  const processorRef = useRef<any>(null)

  if (!busRepoRef.current) {
    const config = { useSupabase }
    busRepoRef.current = RepositoryFactory.createBusRepository(config)
    eventRepoRef.current = RepositoryFactory.createEventRepository(config)
    cameraRepoRef.current = RepositoryFactory.createCameraRepository(config)
    settingsRepoRef.current = RepositoryFactory.createSettingsRepository(config)
    
    if (useSupabase) {
      processorRef.current = new SupabaseEventProcessingService()
    } else {
      processorRef.current = new EventProcessingService(busRepoRef.current, eventRepoRef.current)
    }
  }

  const busRepo = busRepoRef.current!
  const eventRepo = eventRepoRef.current!
  const cameraRepo = cameraRepoRef.current!
  const settingsRepo = settingsRepoRef.current!
  const processor = processorRef.current!

  // Reactive state shared across all pages
  const [buses, setBuses] = useState<Bus[]>([])
  const [events, setEvents] = useState<GateEvent[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Re-sync all state from the repository singletons
  const syncState = useCallback(async () => {
    try {
      const [bList, eList, cList, sObj] = await Promise.all([
        busRepo.listAll(),
        eventRepo.listAll(),
        cameraRepo.listAll(),
        settingsRepo.get(),
      ])
      setBuses(bList)
      setEvents(eList)
      setCameras(cList)
      setSettings(sObj)
      setError(null)
    } catch (err) {
      console.error('[AppDataProvider] Failed to sync application state:', err)
      setError(err instanceof Error ? err.message : 'Unknown data synchronization error')
    }
  }, [busRepo, eventRepo, cameraRepo, settingsRepo])

  // Initial load on mount
  useEffect(() => {
    let mounted = true
    const init = async () => {
      setLoading(true)
      await syncState()
      if (mounted) setLoading(false)
    }
    init()
    return () => {
      mounted = false
    }
  }, [syncState])

  const refresh = useCallback(async () => {
    await syncState()
  }, [syncState])

  const resetToDemo = useCallback(async () => {
    if (useSupabase) {
      throw new Error('Reset to demo is not available in Supabase mode. Use the database console to manage data.')
    }
    setLoading(true)
    try {
      await Promise.all([
        busRepo.reset(DEMO_BUSES),
        eventRepo.reset(DEMO_EVENTS),
        cameraRepo.reset(DEMO_CAMERAS),
        settingsRepo.reset(DEFAULT_APP_SETTINGS),
      ])
      await syncState()
    } finally {
      setLoading(false)
    }
  }, [busRepo, eventRepo, cameraRepo, settingsRepo, syncState])

  // Bus actions
  const listBuses = useCallback(async () => {
    const list = await busRepo.listAll()
    setBuses(list)
    return list
  }, [busRepo])

  const registerBus = useCallback(
    async (bus: Partial<Bus>) => {
      const created = await busRepo.upsert(bus)
      await syncState()
      return created
    },
    [busRepo, syncState],
  )

  const updateBus = useCallback(
    async (bus: Partial<Bus>) => {
      const updated = await busRepo.upsert(bus)
      await syncState()
      return updated
    },
    [busRepo, syncState],
  )

  const deactivateBus = useCallback(
    async (id: string) => {
      const res = await busRepo.deactivate(id)
      await syncState()
      return res
    },
    [busRepo, syncState],
  )

  // Gate actions
  const listEvents = useCallback(async () => {
    const list = await eventRepo.listAll()
    setEvents(list)
    return list
  }, [eventRepo])

  const processDetection = useCallback(
    async (d: RawDetection): Promise<ProcessingResult> => {
      const result = await processor.processGateDetection(d)
      await syncState()
      return result
    },
    [processor, syncState],
  )

  const updateEvent = useCallback(
    async (id: string, updates: Partial<GateEvent>) => {
      const updated = await eventRepo.update(id, updates)
      await syncState()
      return updated
    },
    [eventRepo, syncState],
  )

  const deleteEvent = useCallback(
    async (id: string) => {
      const res = await eventRepo.remove(id)
      await syncState()
      return res
    },
    [eventRepo, syncState],
  )

  // Review resolution with automatic bus state synchronization
  const resolveReview = useCallback(
    async (
      eventId: string,
      status: ReviewStatus,
      targetBusId: string | null,
      correctedPlate?: string,
      notes?: string,
    ): Promise<GateEvent | null> => {
      const existing = await eventRepo.getById(eventId)
      if (!existing) return null

      const busIdToApply = targetBusId && targetBusId !== 'NONE' ? targetBusId : existing.busId
      const finalNormalizedPlate =
        correctedPlate?.trim().toUpperCase() || existing.normalizedOcrText

      // 1. Update the event record
      const updatedEvent = await eventRepo.update(eventId, {
        reviewStatus: status,
        busId: busIdToApply,
        normalizedOcrText: finalNormalizedPlate,
        notes: notes ?? existing.notes,
      })

      // 2. If review is confirmed and a valid bus is assigned, synchronize bus status
      if (status === 'CONFIRMED' && busIdToApply) {
        const bus = await busRepo.getById(busIdToApply)
        if (bus) {
          const newStatus: BusStatus =
            existing.eventType === 'ENTRY' ? 'INSIDE_CAMPUS' : 'OUTSIDE_CAMPUS'
          await busRepo.upsert({ id: bus.id, currentStatus: newStatus })
        }
      }

      await syncState()
      return updatedEvent
    },
    [eventRepo, busRepo, syncState],
  )

  // Camera actions
  const listCameras = useCallback(async () => {
    const list = await cameraRepo.listAll()
    setCameras(list)
    return list
  }, [cameraRepo])

  const registerCamera = useCallback(
    async (camera: Partial<Camera>) => {
      const created = await cameraRepo.upsert(camera)
      await syncState()
      return created
    },
    [cameraRepo, syncState],
  )

  const updateCamera = useCallback(
    async (camera: Partial<Camera>) => {
      const updated = await cameraRepo.upsert(camera)
      await syncState()
      return updated
    },
    [cameraRepo, syncState],
  )

  const deleteCamera = useCallback(
    async (id: string) => {
      const res = await cameraRepo.remove(id)
      await syncState()
      return res
    },
    [cameraRepo, syncState],
  )

  // Settings actions
  const getSettings = useCallback(async () => {
    const s = await settingsRepo.get()
    setSettings(s)
    return s
  }, [settingsRepo])

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      const s = await settingsRepo.update(updates)
      await syncState()
      return s
    },
    [settingsRepo, syncState],
  )

  const value: AppDataContextValue = {
    buses,
    events,
    cameras,
    settings,
    loading,
    error,
    refresh,
    resetToDemo,
    listBuses,
    registerBus,
    updateBus,
    deactivateBus,
    listEvents,
    processDetection,
    updateEvent,
    deleteEvent,
    resolveReview,
    listCameras,
    registerCamera,
    updateCamera,
    deleteCamera,
    getSettings,
    updateSettings,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
