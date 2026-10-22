import { useEffect, useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { GateEvent, Bus } from '@/types/domain'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { formatTime, formatConfidence, formatRelativeTime } from '@/utils/format'
import { formatRegistrationNumber } from '@/utils/registration'
import {
  Radio,
  Video,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Zap,
  Sliders,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

const CAMERAS = [
  { id: 'cam-main-in', name: 'Gate 1 - Main Inbound', gate: 'Main Gate', lane: 'Lane A (Inbound)', status: 'ONLINE' },
  { id: 'cam-main-out', name: 'Gate 1 - Main Outbound', gate: 'Main Gate', lane: 'Lane B (Outbound)', status: 'ONLINE' },
  { id: 'cam-north-01', name: 'North Campus Gate', gate: 'North Gate', lane: 'Lane 1', status: 'ONLINE' },
  { id: 'cam-south-01', name: 'South Campus Gate', gate: 'South Gate', lane: 'Lane 1', status: 'ONLINE' },
]

const Monitoring = () => {
  const { listBuses, listEvents, processDetection } = useAppData()
  const [buses, setBuses] = useState<Bus[]>([])
  const [events, setEvents] = useState<GateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCameraId, setSelectedCameraId] = useState('cam-main-in')
  const [operatingMode, setOperatingMode] = useState<'DEMO' | 'LIVE'>('DEMO')
  const [simulating, setSimulating] = useState(false)
  const [lastDetectionVisual, setLastDetectionVisual] = useState<{
    plate: string
    timestamp: string
    confidence: number
    outcome: string
  } | null>(null)

  const loadData = async () => {
    try {
      const [b, e] = await Promise.all([listBuses(), listEvents()])
      setBuses(b)
      setEvents(e)
    } catch {
      toast.error('Failed to load monitoring telemetry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [listBuses, listEvents])

  // Bus lookup map
  const busMap = useMemo(() => {
    const map = new Map<string, Bus>()
    for (const b of buses) {
      map.set(b.id, b)
      map.set(b.registrationNumber.toUpperCase(), b)
      if (b.normalizedRegistrationNumber) {
        map.set(b.normalizedRegistrationNumber, b)
      }
    }
    return map
  }, [buses])

  // Recent events list
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
      .slice(0, 10)
  }, [events])

  const handleSimulate = async (type: 'ENTRY' | 'EXIT' | 'UNKNOWN' | 'LOW_CONFIDENCE') => {
    setSimulating(true)
    try {
      let plate = 'MH12AB1234'
      let direction: 'INBOUND' | 'OUTBOUND' | 'UNKNOWN' = 'INBOUND'
      let conf = 0.98

      if (type === 'ENTRY') {
        plate = 'KA05CD5678'
        direction = 'INBOUND'
        conf = 0.96
      } else if (type === 'EXIT') {
        plate = 'MH12AB1234'
        direction = 'OUTBOUND'
        conf = 0.97
      } else if (type === 'UNKNOWN') {
        plate = 'DL01XY9999'
        direction = 'INBOUND'
        conf = 0.95
      } else if (type === 'LOW_CONFIDENCE') {
        plate = 'MH12AB1234'
        direction = 'INBOUND'
        conf = 0.38
      }

      const result = await processDetection({
        rawOcrText: plate,
        confidence: conf,
        cameraId: selectedCameraId,
        source: 'DEMO',
        directionEstimate: direction,
        detectedAt: new Date().toISOString(),
        evidenceReference: null,
      })

      setLastDetectionVisual({
        plate,
        timestamp: new Date().toLocaleTimeString(),
        confidence: conf,
        outcome: result.outcome,
      })

      if (result.outcome === 'EVENT_CREATED') {
        toast.success(`Simulated ${result.event?.eventType} for ${plate} (${result.message})`)
      } else if (result.outcome === 'ROUTED_TO_REVIEW') {
        toast.warning(`Detection routed to review queue: ${result.message}`)
      } else {
        toast.info(result.message)
      }

      loadData()
    } catch {
      toast.error('Simulation execution failed')
    } finally {
      setSimulating(false)
    }
  }

  const activeCam = CAMERAS.find((c) => c.id === selectedCameraId) || CAMERAS[0]

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Live Gate Monitoring Console</h2>
          <p className="text-xs text-muted-foreground">
            Dedicated live camera viewport, OCR plate recognition stream, and gate telemetry simulation controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOperatingMode((m) => (m === 'DEMO' ? 'LIVE' : 'DEMO'))
              toast.success(`Switched to ${operatingMode === 'DEMO' ? 'LIVE' : 'DEMO'} mode`)
            }}
          >
            <Sliders className="size-3.5" />
            Mode: <span className="font-bold ml-1 text-primary">{operatingMode}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Grid: Camera Viewport & Simulation Control Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Camera Viewport (Takes 2 columns) */}
        <Card className="bg-card border-border lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Video className="size-4 text-primary" /> Camera Stream Viewport
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Live optical feed from {activeCam.name} ({activeCam.gate})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="Select Camera" />
                </SelectTrigger>
                <SelectContent>
                  {CAMERAS.map((cam) => (
                    <SelectItem key={cam.id} value={cam.id}>
                      {cam.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="success" className="text-[10px]">
                <Radio className="size-3 animate-pulse" /> ONLINE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Simulated Video Box */}
            <div className="relative aspect-video w-full rounded-lg border border-border bg-[#070b10] overflow-hidden flex flex-col items-center justify-center">
              {/* Scanline overlay effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

              {/* Viewport header info inside */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground z-10">
                <span className="bg-background/80 px-2 py-0.5 rounded border border-border">
                  CAM_ID: {activeCam.id} | {activeCam.lane}
                </span>
                <span className="bg-background/80 px-2 py-0.5 rounded border border-border text-success font-semibold">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {/* Center Content / OCR Bounding Box simulation */}
              <div className="z-10 text-center space-y-2">
                <div className="inline-block rounded-md border border-primary/60 bg-primary/10 px-4 py-2 font-mono text-lg font-bold tracking-widest text-primary shadow-[0_0_20px_rgba(47,123,255,0.3)] animate-pulse">
                  {lastDetectionVisual ? lastDetectionVisual.plate : 'MH-12-AB-1234'}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {lastDetectionVisual ? (
                    <span>
                      Confidence: {(lastDetectionVisual.confidence * 100).toFixed(1)}% | Outcome:{' '}
                      <span className="text-foreground font-semibold">{lastDetectionVisual.outcome}</span>
                    </span>
                  ) : (
                    <span>Awaiting gate vehicle detection…</span>
                  )}
                </div>
              </div>

              {/* Camera watermark */}
              <div className="absolute bottom-3 left-3 text-[10px] font-mono text-muted-foreground/60">
                GATEVISION_CV_ENGINE v2.4 // 30 FPS
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Simulation Controls Panel */}
        <Card className="bg-card border-border flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="size-4 text-warning" /> Gate Simulation Controls
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Trigger instant vehicle detection events for testing and demonstration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-success/40 hover:bg-success/10 text-success"
                onClick={() => handleSimulate('ENTRY')}
                loading={simulating}
              >
                <ArrowDownLeft className="size-4" /> Simulate Bus Entry (Inbound)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-warning/40 hover:bg-warning/10 text-warning"
                onClick={() => handleSimulate('EXIT')}
                loading={simulating}
              >
                <ArrowUpRight className="size-4" /> Simulate Bus Exit (Outbound)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-destructive/40 hover:bg-destructive/10 text-destructive"
                onClick={() => handleSimulate('UNKNOWN')}
                loading={simulating}
              >
                <AlertTriangle className="size-4" /> Simulate Unknown Vehicle
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-border hover:bg-muted/30 text-foreground"
                onClick={() => handleSimulate('LOW_CONFIDENCE')}
                loading={simulating}
              >
                <Sliders className="size-4 text-primary" /> Simulate Low Confidence OCR
              </Button>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">Simulation Guidelines:</div>
              <p>
                Simulated events pass through the central event processing pipeline, updating bus statuses and review queues automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Detections Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Live Detections Telemetry</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Real-time OCR read events processed across all campus gate cameras
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/activity">View Full Activity</a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Plate / Reg No</TableHead>
                <TableHead>Bus & Route</TableHead>
                <TableHead>Movement</TableHead>
                <TableHead>Camera ID</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Review Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading detections telemetry…
                  </TableCell>
                </TableRow>
              ) : recentEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No detections recorded yet. Use the simulation buttons above to generate events.
                  </TableCell>
                </TableRow>
              ) : (
                recentEvents.map((ev) => {
                  const bus = ev.busId ? busMap.get(ev.busId) : null
                  const regDisplay =
                    bus?.registrationNumber ||
                    ev.normalizedOcrText ||
                    ev.rawOcrText ||
                    'Unknown Plate'
                  const busName = bus?.displayName || bus?.routeName || 'Unregistered / Unknown'

                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div>{formatTime(ev.eventTime)}</div>
                        <div className="text-[10px] opacity-75">{formatRelativeTime(ev.eventTime)}</div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-foreground">
                        {formatRegistrationNumber(regDisplay)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{busName}</div>
                        {bus?.routeName && <div className="text-[11px] text-muted-foreground">{bus.routeName}</div>}
                      </TableCell>
                      <TableCell>
                        {ev.eventType === 'ENTRY' ? (
                          <Badge variant="success" className="gap-1">
                            <ArrowDownLeft className="size-3" /> ENTRY
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <ArrowUpRight className="size-3" /> EXIT
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ev.cameraId || 'cam-main-01'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatConfidence(ev.confidence)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ev.reviewStatus === 'CONFIRMED'
                              ? 'success'
                              : ev.reviewStatus === 'PENDING'
                              ? 'destructive'
                              : 'neutral'
                          }
                          className="text-[10px]"
                        >
                          {ev.reviewStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default Monitoring
