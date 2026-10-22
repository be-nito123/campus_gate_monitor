import { useEffect, useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { Bus, GateEvent, EventType } from '@/types/domain'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { formatTime, formatConfidence, formatRelativeTime } from '@/utils/format'
import {
  Bus as BusIcon,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  CheckCircle2,
  Radio,
  RefreshCw,
  Sliders,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { toast, Toaster } from 'sonner'

const Overview = () => {
  const { listBuses, listEvents, registerBus, processDetection } = useAppData()
  const [buses, setBuses] = useState<Bus[]>([])
  const [events, setEvents] = useState<GateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dialog states
  const [registerOpen, setRegisterOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  // Register Bus Form state
  const [regBusNum, setRegBusNum] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regRouteName, setRegRouteName] = useState('')
  const [regDriverName, setRegDriverName] = useState('')
  const [regDriverContact, setRegDriverContact] = useState('')
  const [regNotes, setRegNotes] = useState('')
  const [submittingBus, setSubmittingBus] = useState(false)

  // Manual Event Form state
  const [manualBusIdOrPlate, setManualBusIdOrPlate] = useState('')
  const [manualEventType, setManualEventType] = useState<EventType>('ENTRY')
  const [manualNotes, setManualNotes] = useState('')
  const [submittingEvent, setSubmittingEvent] = useState(false)

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [b, e] = await Promise.all([listBuses(), listEvents()])
      setBuses(b)
      setEvents(e)
    } catch {
      toast.error('Failed to load operations data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [listBuses, listEvents])

  // Computed metrics
  const totalBuses = buses.length
  const insideBuses = useMemo(() => buses.filter((b) => b.currentStatus === 'INSIDE_CAMPUS').length, [buses])
  const outsideBuses = useMemo(() => buses.filter((b) => b.currentStatus === 'OUTSIDE_CAMPUS').length, [buses])

  const todayStr = useMemo(() => new Date().toDateString(), [])
  const todayEvents = useMemo(
    () => events.filter((e) => new Date(e.eventTime).toDateString() === todayStr),
    [events, todayStr],
  )
  const todayEntries = useMemo(() => todayEvents.filter((e) => e.eventType === 'ENTRY').length, [todayEvents])
  const todayExits = useMemo(() => todayEvents.filter((e) => e.eventType === 'EXIT').length, [todayEvents])
  const pendingReviews = useMemo(() => events.filter((e) => e.reviewStatus === 'PENDING').length, [events])

  // Hourly chart data (0-23)
  const hourlyChartData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const hourLabel = `${hour.toString().padStart(2, '0')}:00`
      const matching = todayEvents.filter((e) => new Date(e.eventTime).getHours() === hour)
      const entries = matching.filter((e) => e.eventType === 'ENTRY').length
      const exits = matching.filter((e) => e.eventType === 'EXIT').length
      return {
        hour: hourLabel,
        entries,
        exits,
      }
    })
  }, [todayEvents])

  // Recent gate activity
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
      .slice(0, 8)
  }, [events])

  // Bus lookup map for table
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

  const handleRegisterBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regBusNum.trim()) {
      toast.error('Registration number is required')
      return
    }
    setSubmittingBus(true)
    try {
      const cleanNum = regBusNum.trim().toUpperCase()
      await registerBus({
        busCode: `BUS-${Math.floor(100 + Math.random() * 900)}`,
        registrationNumber: cleanNum,
        normalizedRegistrationNumber: cleanNum.replace(/[^A-Z0-9]/g, ''),
        displayName: regDisplayName.trim() || cleanNum,
        routeName: regRouteName.trim() || 'General Route',
        driverName: regDriverName.trim() || null,
        driverContact: regDriverContact.trim() || null,
        currentStatus: 'OUTSIDE_CAMPUS',
        isActive: true,
        notes: regNotes.trim() || null,
      })
      toast.success(`Successfully registered bus ${cleanNum}`)
      setRegisterOpen(false)
      setRegBusNum('')
      setRegDisplayName('')
      setRegRouteName('')
      setRegDriverName('')
      setRegDriverContact('')
      setRegNotes('')
      loadData()
    } catch {
      toast.error('Failed to register bus')
    } finally {
      setSubmittingBus(false)
    }
  }

  const handleManualEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualBusIdOrPlate.trim()) {
      toast.error('Please enter a bus registration number or identifier')
      return
    }
    setSubmittingEvent(true)
    try {
      const plate = manualBusIdOrPlate.trim().toUpperCase()
      await processDetection({
        rawOcrText: plate,
        confidence: 1.0,
        cameraId: 'cam-manual-01',
        source: 'MANUAL',
        directionEstimate: manualEventType === 'ENTRY' ? 'INBOUND' : 'OUTBOUND',
        detectedAt: new Date().toISOString(),
        evidenceReference: null,
      })
      toast.success(`Recorded manual ${manualEventType} for ${plate}`)
      setManualOpen(false)
      setManualBusIdOrPlate('')
      setManualNotes('')
      loadData()
    } catch {
      toast.error('Failed to record manual event')
    } finally {
      setSubmittingEvent(false)
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Operations Console</h2>
          <p className="text-xs text-muted-foreground">
            Real-time campus gate monitoring, automated OCR detection telemetry, and fleet status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            loading={refreshing}
          >
            <RefreshCw className="size-3.5" />
            Refresh Telemetry
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
            <Clock className="size-3.5" />
            Manual Event
          </Button>
          <Button size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus className="size-3.5" />
            Register Bus
          </Button>
        </div>
      </div>

      {/* 1. Top summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Registered
            </CardTitle>
            <BusIcon className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '—' : totalBuses}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Active campus fleet</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inside Campus
            </CardTitle>
            <ShieldCheck className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {loading ? '—' : insideBuses}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Currently on grounds</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outside Campus
            </CardTitle>
            <AlertTriangle className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {loading ? '—' : outsideBuses}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Dispatched or parked offsite</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Movements
            </CardTitle>
            <Activity className="size-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '—' : todayEvents.length}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="text-success font-medium">{todayEntries} entries</span> /{' '}
              <span className="text-warning font-medium">{todayExits} exits</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Reviews
            </CardTitle>
            <Clock className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {loading ? '—' : pendingReviews}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Low confidence detections</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid for Chart and System Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 2. Entry/Exit activity chart for today (takes 2 cols) */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">Today's Gate Traffic Volume</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Hourly breakdown of vehicle entry and exit movements across all campus gates (00:00 - 23:00)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pt-0">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                Loading telemetry chart…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232b38" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    stroke="#8b949e"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#232b38' }}
                  />
                  <YAxis
                    stroke="#8b949e"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#232b38' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161b22',
                      borderColor: '#30363d',
                      borderRadius: '6px',
                      color: '#c9d1d9',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                  />
                  <Bar
                    dataKey="entries"
                    name="Entries"
                    fill="#2f7bff"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar
                    dataKey="exits"
                    name="Exits"
                    fill="#3fb950"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. System status section showing DEMO mode, system health */}
        <Card className="bg-card border-border flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>System Telemetry & Health</span>
              <Badge variant="success" className="text-[10px]">
                <Radio className="size-3 animate-pulse" /> Operational
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Core OCR pipeline & camera gateways status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-md border border-border bg-[#0d1219] p-3 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Operating Mode</span>
                <Badge variant="warning" className="font-mono text-[10px]">DEMO MODE</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">OCR Engine</span>
                <span className="font-medium text-success flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Active (Simulated)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Active Gate Cameras</span>
                <span className="font-medium text-foreground">4 / 4 Online</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Database Sync</span>
                <span className="font-medium text-foreground">Real-time (PostgreSQL)</span>
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <Sliders className="size-3.5 text-primary" /> Quick System Actions
              </div>
              <p className="text-[11px]">
                Use the top action bar to register new campus buses or manually log barrier overrides.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Recent gate activity table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Recent Gate Activity</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live feed of vehicle OCR detections and recorded gate crossings
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/activity">View All Activity</a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Reg No</TableHead>
                <TableHead>Bus Name & Route</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading recent gate events…
                  </TableCell>
                </TableRow>
              ) : recentEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No recent gate events recorded.
                  </TableCell>
                </TableRow>
              ) : (
                recentEvents.map((ev) => {
                  const bus = ev.busId ? busMap.get(ev.busId) : null;
                  const regDisplay =
                    bus?.registrationNumber ||
                    ev.normalizedOcrText ||
                    ev.rawOcrText ||
                    'Unknown Plate';
                  const busName = bus?.displayName || bus?.routeName || 'Unregistered / Unknown';

                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div>{formatTime(ev.eventTime)}</div>
                        <div className="text-[10px] opacity-75">{formatRelativeTime(ev.eventTime)}</div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-foreground">
                        {regDisplay}
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
                      <TableCell className="font-mono text-xs">
                        {formatConfidence(ev.confidence)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {ev.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ev.reviewStatus === 'CONFIRMED' ? (
                          <Badge variant="success" className="text-[10px]">Confirmed</Badge>
                        ) : ev.reviewStatus === 'PENDING' ? (
                          <Badge variant="destructive" className="text-[10px]">Pending Review</Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px]">{ev.reviewStatus}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog 1: Register Bus Modal */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Register New Campus Bus</DialogTitle>
            <DialogDescription>
              Add a new vehicle to the fleet registry with OCR plate mapping.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterBusSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Registration Number (Plate) *</label>
              <Input
                placeholder="e.g. KA-01-F-1234"
                value={regBusNum}
                onChange={(e) => setRegBusNum(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Display Name</label>
                <Input
                  placeholder="e.g. Shuttle Alpha"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Route Name</label>
                <Input
                  placeholder="e.g. North Campus Route"
                  value={regRouteName}
                  onChange={(e) => setRegRouteName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Driver Name</label>
                <Input
                  placeholder="e.g. Rajesh Kumar"
                  value={regDriverName}
                  onChange={(e) => setRegDriverName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Driver Contact</label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={regDriverContact}
                  onChange={(e) => setRegDriverContact(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Notes / Comments</label>
              <Textarea
                placeholder="Optional notes about bus or permits…"
                value={regNotes}
                onChange={(e) => setRegNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submittingBus}>
                Save & Register Bus
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Record Manual Event Modal */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Record Manual Gate Event</DialogTitle>
            <DialogDescription>
              Force log an entry or exit movement for security override or manual inspection.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualEventSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Bus Registration Number / Plate *</label>
              <Input
                placeholder="e.g. KA-01-F-1234"
                value={manualBusIdOrPlate}
                onChange={(e) => setManualBusIdOrPlate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Movement Type</label>
              <Select
                value={manualEventType}
                onValueChange={(val) => setManualEventType(val as EventType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select movement type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRY">ENTRY (Inbound)</SelectItem>
                  <SelectItem value="EXIT">EXIT (Outbound)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Override Reason / Notes</label>
              <Textarea
                placeholder="Reason for manual gate override…"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setManualOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submittingEvent}>
                Record Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Overview
