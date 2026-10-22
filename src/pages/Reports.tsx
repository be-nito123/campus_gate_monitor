import { useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { Bus } from '@/types/domain'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatDateTime, formatDuration, formatConfidence } from '@/utils/format'
import { exportRowsToCsv } from '@/utils/csv'
import { Download, RefreshCw, BarChart3, PieChart as PieIcon, Clock, Filter, Calendar } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts'
import { toast, Toaster } from 'sonner'

const COLORS = ['#2f7bff', '#3fb950', '#f85149', '#d29922', '#8957e5']

const Reports = () => {
  const { buses, events, loading, refresh } = useAppData()
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL')

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Bus lookup map
  const busMap = useMemo(() => {
    const map = new Map<string, Bus>()
    for (const b of buses) {
      map.set(b.id, b)
      map.set(b.registrationNumber.toUpperCase(), b)
      if (b.normalizedRegistrationNumber) map.set(b.normalizedRegistrationNumber, b)
    }
    return map
  }, [buses])

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesType = eventTypeFilter === 'ALL' || ev.eventType === eventTypeFilter
      const evTime = new Date(ev.eventTime).getTime()
      let matchesDate = true
      if (fromDate) {
        const start = new Date(fromDate).getTime()
        if (evTime < start) matchesDate = false
      }
      if (toDate) {
        const end = new Date(toDate).setHours(23, 59, 59, 999)
        if (evTime > end) matchesDate = false
      }
      return matchesType && matchesDate
    }).sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
  }, [events, eventTypeFilter, fromDate, toDate])

  // 1. Gate movements per day chart data
  const movementsPerDayData = useMemo(() => {
    const counts = new Map<string, { date: string; entries: number; exits: number }>()
    for (const ev of filteredEvents) {
      const dateKey = new Date(ev.eventTime).toISOString().slice(0, 10)
      if (!counts.has(dateKey)) {
        counts.set(dateKey, { date: dateKey, entries: 0, exits: 0 })
      }
      const entry = counts.get(dateKey)!
      if (ev.eventType === 'ENTRY') entry.entries++
      else if (ev.eventType === 'EXIT') entry.exits++
    }
    return Array.from(counts.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredEvents])

  // 2. Entry vs Exit comparison data
  const entryVsExitData = useMemo(() => {
    let entries = 0
    let exits = 0
    for (const ev of filteredEvents) {
      if (ev.eventType === 'ENTRY') entries++
      else if (ev.eventType === 'EXIT') exits++
    }
    return [
      { name: 'Entries (Inbound)', value: entries },
      { name: 'Exits (Outbound)', value: exits },
    ]
  }, [filteredEvents])

  // 3. Bus movements by hour (0-23)
  const movementsByHourData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const hourLabel = `${hour.toString().padStart(2, '0')}:00`
      const matching = filteredEvents.filter((e) => new Date(e.eventTime).getHours() === hour)
      return {
        hour: hourLabel,
        movements: matching.length,
      }
    })
  }, [filteredEvents])

  // 4. Bus duration outside campus computation
  const busDurationData = useMemo(() => {
    const result: Array<{
      busId: string
      registrationNumber: string
      displayName: string
      routeName: string
      exitTime: string
      entryTime: string | null
      durationText: string
      durationMinutes: number
    }> = []

    for (const bus of buses) {
      const busEvents = events
        .filter((e) => e.busId === bus.id)
        .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())

      for (let i = 0; i < busEvents.length; i++) {
        const ev = busEvents[i]
        if (ev.eventType === 'EXIT') {
          const nextEntry = busEvents.slice(i + 1).find((e) => e.eventType === 'ENTRY')
          const exitTime = ev.eventTime
          const entryTime = nextEntry ? nextEntry.eventTime : null
          const endInstant = entryTime ? new Date(entryTime).getTime() : Date.now()
          const startInstant = new Date(exitTime).getTime()
          const durationMinutes = Math.max(0, Math.round((endInstant - startInstant) / 60000))

          result.push({
            busId: bus.id,
            registrationNumber: bus.registrationNumber,
            displayName: bus.displayName || bus.registrationNumber,
            routeName: bus.routeName,
            exitTime,
            entryTime,
            durationText: entryTime ? formatDuration(exitTime, entryTime) : `${formatDuration(exitTime, new Date().toISOString())} (Still Outside)`,
            durationMinutes,
          })
        }
      }
    }
    return result.sort((a, b) => b.durationMinutes - a.durationMinutes).slice(0, 10)
  }, [buses, events])

  const handleCsvExport = () => {
    const rows = filteredEvents.map((ev) => {
      const bus = ev.busId ? busMap.get(ev.busId) : null
      return {
        EventId: ev.id,
        Timestamp: ev.eventTime,
        RegistrationNumber: bus?.registrationNumber || ev.normalizedOcrText || ev.rawOcrText || 'UNKNOWN',
        BusName: bus?.displayName || 'Unregistered',
        RouteName: bus?.routeName || 'N/A',
        EventType: ev.eventType,
        Source: ev.source,
        Confidence: formatConfidence(ev.confidence),
        CameraId: ev.cameraId || 'N/A',
        ReviewStatus: ev.reviewStatus,
      }
    })
    exportRowsToCsv(`gate-reports-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast.success(`Exported ${rows.length} report telemetry records to CSV`)
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Reports & Analytics Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Comprehensive gate telemetry analytics, movement trends, bus duration metrics, and CSV exports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCsvExport}>
            <Download className="size-3.5" />
            Export Filtered CSV
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Report Filters</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Event Type:</span>
                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Event Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Event Types</SelectItem>
                    <SelectItem value="ENTRY">ENTRY (Inbound)</SelectItem>
                    <SelectItem value="EXIT">EXIT (Outbound)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEventTypeFilter('ALL')
                  setFromDate('')
                  setToDate('')
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid - Part 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Gate Movements Per Day */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Gate Movements Per Day
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Daily volume of inbound entries and outbound exits across campus gates
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pt-0">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">Loading chart…</div>
            ) : movementsPerDayData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">No movement data available for selected period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movementsPerDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232b38" vertical={false} />
                  <XAxis dataKey="date" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={{ stroke: '#232b38' }} />
                  <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={{ stroke: '#232b38' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '6px', color: '#c9d1d9', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="entries" name="Entries" fill="#2f7bff" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="exits" name="Exits" fill="#3fb950" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 2. Entry vs Exit Comparison */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PieIcon className="size-4 text-success" /> Entry vs Exit Distribution
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Overall proportion of inbound campus entries versus outbound exits
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pt-0 flex items-center justify-center">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={entryVsExitData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    label={({ name, percent }: { name?: string; percent?: number }) => percent !== undefined ? `${name ?? ''}: ${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {entryVsExitData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '6px', color: '#c9d1d9', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid - Part 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 3. Bus Movements by Hour */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-warning" /> Bus Movements by Hour of Day
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Hourly distribution of campus gate crossings across the 24-hour cycle
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pt-0">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movementsByHourData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232b38" vertical={false} />
                  <XAxis dataKey="hour" stroke="#8b949e" fontSize={10} tickLine={false} axisLine={{ stroke: '#232b38' }} />
                  <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={{ stroke: '#232b38' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '6px', color: '#c9d1d9', fontSize: '12px' }}
                  />
                  <Bar dataKey="movements" name="Gate Crossings" fill="#d29922" radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Bus Duration Outside Campus */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-info" /> Bus Duration Outside Campus
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Recent recorded durations of campus buses operating outside grounds
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus / Route</TableHead>
                  <TableHead>Exit Time</TableHead>
                  <TableHead>Return Time</TableHead>
                  <TableHead className="text-right">Duration Outside</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Loading duration metrics…</TableCell>
                  </TableRow>
                ) : busDurationData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No offsite trip telemetry recorded.</TableCell>
                  </TableRow>
                ) : (
                  busDurationData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.displayName}</div>
                        <div className="text-[11px] text-muted-foreground">{item.routeName}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(item.exitTime)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.entryTime ? formatDateTime(item.entryTime) : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-warning">{item.durationText}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Reports
