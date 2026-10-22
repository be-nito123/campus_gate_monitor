import { useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { Camera } from '@/types/domain'
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
  CameraOff,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

const Monitoring = () => {
  const { buses, events, cameras, loading, processDetection, refresh } = useAppData()
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [operatingMode, setOperatingMode] = useState<'DEMO' | 'LIVE'>('DEMO')
  const [simulating, setSimulating] = useState(false)
  const [lastDetectionVisual, setLastDetectionVisual] = useState<{
    plate: string
    timestamp: string
    confidence: number
    outcome: string
  } | null>(null)

  // Bus lookup map
  const busMap = useMemo(() => {
    const map = new Map<string, (typeof buses)[0]>()
    for (const b of buses) {
      map.set(b.id, b)
      map.set(b.registrationNumber.toUpperCase(), b)
      if (b.normalizedRegistrationNumber) {
        map.set(b.normalizedRegistrationNumber, b)
      }
    }
    return map
  }, [buses])

  // Active camera selection
  const activeCam: Camera | null = useMemo(() => {
    if (cameras.length === 0) return null
    if (selectedCameraId) {
      const found = cameras.find((c) => c.id === selectedCameraId)
      if (found) return found
    }
    return cameras[0]
  }, [cameras, selectedCameraId])

  // Recent events list
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
      .slice(0, 10)
  }, [events])

  const handleSimulate = async (type: 'ENTRY' | 'EXIT' | 'UNKNOWN' | 'LOW_CONFIDENCE') => {
    if (!activeCam) {
      toast.error('No active camera available for simulation')
      return
    }

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
        cameraId: activeCam.id,
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
    } catch {
      toast.error('Simulation execution failed')
    } finally {
      setSimulating(false)
    }
  }

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
              const nextMode = operatingMode === 'DEMO' ? 'LIVE' : 'DEMO'
              setOperatingMode(nextMode)
              toast.info(`Switched interface mode to ${nextMode}`)
            }}
          >
            <Sliders className="size-3.5" />
            Mode: <span className="font-bold ml-1 text-primary">{operatingMode}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
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
                {activeCam
                  ? `Feed from ${activeCam.name} (${activeCam.gateName} - ${activeCam.laneName})`
                  : 'No active camera feed selected'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {cameras.length > 0 && (
                <Select
                  value={activeCam?.id ?? ''}
                  onValueChange={(val) => setSelectedCameraId(val)}
                >
                  <SelectTrigger className="w-[210px]">
                    <SelectValue placeholder="Select Camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((cam) => (
                      <SelectItem key={cam.id} value={cam.id}>
                        {cam.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeCam && (
                <Badge
                  variant={
                    activeCam.connectionStatus === 'ONLINE'
                      ? 'success'
                      : activeCam.connectionStatus === 'SIMULATED'
                        ? 'warning'
                        : 'destructive'
                  }
                  className="text-[10px]"
                >
                  <Radio className="size-3 animate-pulse" /> {activeCam.connectionStatus}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {activeCam ? (
              operatingMode === 'LIVE' && activeCam.connectionStatus !== 'ONLINE' ? (
                /* Disconnected state when in LIVE mode without genuine stream */
                <div className="relative aspect-video w-full rounded-lg border border-border bg-[#070b10] overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                  <CameraOff className="size-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">Live Camera Stream Disconnected</p>
                  <p className="text-xs text-muted-foreground max-w-md mt-1">
                    No physical RTSP/IP camera endpoint is connected for {activeCam.name}. In LIVE mode,
                    simulated fallback is disabled to prevent false reporting. Switch to DEMO mode or
                    configure live stream credentials.
                  </p>
                </div>
              ) : (
                /* Active Viewport Box */
                <div className="relative aspect-video w-full rounded-lg border border-border bg-[#070b10] overflow-hidden flex flex-col items-center justify-center">
                  {/* Scanline overlay effect */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

                  {/* Viewport header info inside */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground z-10">
                    <span className="bg-background/80 px-2 py-0.5 rounded border border-border">
                      CAM_ID: {activeCam.cameraCode} | {activeCam.laneName}
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
                        <span>Awaiting vehicle detection frame…</span>
                      )}
                    </div>
                  </div>

                  {/* Camera watermark */}
                  <div className="absolute bottom-3 left-3 text-[10px] font-mono text-muted-foreground/60">
                    GATEVISION_{operatingMode}_ENGINE v2.4 // 30 FPS
                  </div>
                </div>
              )
            ) : (
              <div className="relative aspect-video w-full rounded-lg border border-border bg-card overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                <CameraOff className="size-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">No Cameras Available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add cameras in the Camera Management page to begin monitoring gate lanes.
                </p>
              </div>
            )}
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
                disabled={simulating || !activeCam}
              >
                <ArrowDownLeft className="size-4" /> Simulate Bus Entry (KA 05 CD 5678)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-destructive/40 hover:bg-destructive/10 text-destructive"
                onClick={() => handleSimulate('EXIT')}
                disabled={simulating || !activeCam}
              >
                <ArrowUpRight className="size-4" /> Simulate Bus Exit (MH 12 AB 1234)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-warning/40 hover:bg-warning/10 text-warning"
                onClick={() => handleSimulate('UNKNOWN')}
                disabled={simulating || !activeCam}
              >
                <AlertTriangle className="size-4" /> Simulate Unknown Vehicle (DL 01 XY 9999)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-muted-foreground/40 hover:bg-muted"
                onClick={() => handleSimulate('LOW_CONFIDENCE')}
                disabled={simulating || !activeCam}
              >
                <AlertTriangle className="size-4 text-warning" /> Simulate Low Confidence (38%)
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-sidebar/50 p-3 text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Active Terminal Rules
              </div>
              <p>• Duplicate suppression active within 60s cooldown window.</p>
              <p>• Unrecognized or low-confidence reads route automatically to Review Queue.</p>
              <p>• State changes are synchronized in real-time across all views.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Live Activity Stream Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Radio className="size-4 text-primary" /> Real-Time Gate Activity Stream
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Most recent 10 optical recognition telemetry events
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {recentEvents.length} Events Logged
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="size-4 animate-spin mx-auto mb-2" />
              Loading real-time gate activity stream…
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              No recent gate activity recorded. Use the simulation controls above to test detection events.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Time</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>Vehicle / Plate</TableHead>
                  <TableHead>Route / Driver</TableHead>
                  <TableHead className="w-[110px]">Confidence</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[140px]">Camera / Lane</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map((ev) => {
                  const bus = ev.busId ? busMap.get(ev.busId) : null
                  const displayPlate =
                    bus?.registrationNumber || ev.normalizedOcrText || ev.rawOcrText || 'UNKNOWN'

                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(ev.eventTime)}
                        <span className="block text-[10px] text-muted-foreground/70">
                          {formatRelativeTime(ev.eventTime)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ev.eventType === 'ENTRY'
                              ? 'success'
                              : ev.eventType === 'EXIT'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-[10px] gap-1"
                        >
                          {ev.eventType === 'ENTRY' ? (
                            <ArrowDownLeft className="size-3" />
                          ) : (
                            <ArrowUpRight className="size-3" />
                          )}
                          {ev.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {formatRegistrationNumber(displayPlate)}
                        </div>
                        {bus?.displayName && (
                          <div className="text-[11px] text-muted-foreground">{bus.displayName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{bus?.routeName || '—'}</div>
                        {bus?.driverName && (
                          <div className="text-[10px] text-muted-foreground/80">{bus.driverName}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span
                          className={
                            ev.confidence !== null && ev.confidence >= 0.85
                              ? 'text-success'
                              : ev.confidence !== null && ev.confidence >= 0.6
                                ? 'text-warning'
                                : 'text-destructive'
                          }
                        >
                          {formatConfidence(ev.confidence)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ev.reviewStatus === 'CONFIRMED'
                              ? 'outline'
                              : ev.reviewStatus === 'PENDING'
                                ? 'warning'
                                : 'destructive'
                          }
                          className="text-[10px]"
                        >
                          {ev.reviewStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ev.cameraId || 'cam-main'}
                        <span className="block text-[10px] text-muted-foreground/60">{ev.source}</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Monitoring
