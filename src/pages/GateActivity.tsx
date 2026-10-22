import { useEffect, useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { GateEvent, Bus, EventType, ReviewStatus } from '@/types/domain'
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
import { formatDateTime, formatRelativeTime } from '@/utils/format'
import { formatRegistrationNumber } from '@/utils/registration'
import { exportRowsToCsv } from '@/utils/csv'
import {
  Search,
  Download,
  Plus,
  Edit,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

const GateActivity = () => {
  const { listBuses, listEvents, processDetection, updateEvent } = useAppData()
  const [buses, setBuses] = useState<Bus[]>([])
  const [events, setEvents] = useState<GateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modals state
  const [manualOpen, setManualOpen] = useState(false)
  const [correctEvent, setCorrectEvent] = useState<GateEvent | null>(null)

  // Manual event form state
  const [manualPlate, setManualPlate] = useState('')
  const [manualEventType, setManualEventType] = useState<EventType>('ENTRY')
  const [manualNotes, setManualNotes] = useState('')
  const [submittingManual, setSubmittingManual] = useState(false)

  // Event correction form state
  const [correctStatus, setCorrectStatus] = useState<ReviewStatus>('CONFIRMED')
  const [correctNotes, setCorrectNotes] = useState('')
  const [submittingCorrection, setSubmittingCorrection] = useState(false)

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [b, e] = await Promise.all([listBuses(), listEvents()])
      setBuses(b)
      setEvents(e)
    } catch {
      toast.error('Failed to load gate activity logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const bus = ev.busId ? busMap.get(ev.busId) : null
      const regText = bus?.registrationNumber || ev.normalizedOcrText || ev.rawOcrText || ''
      const matchesSearch =
        !searchTerm.trim() ||
        regText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bus?.displayName && bus.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ev.cameraId && ev.cameraId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ev.notes && ev.notes.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesEventType = eventTypeFilter === 'ALL' || ev.eventType === eventTypeFilter
      const matchesSource = sourceFilter === 'ALL' || ev.source === sourceFilter
      const matchesReview = reviewStatusFilter === 'ALL' || ev.reviewStatus === reviewStatusFilter

      // Date range filter
      let matchesDate = true
      const evTime = new Date(ev.eventTime).getTime()
      if (fromDate) {
        const start = new Date(fromDate).getTime()
        if (evTime < start) matchesDate = false
      }
      if (toDate) {
        const end = new Date(toDate).setHours(23, 59, 59, 999)
        if (evTime > end) matchesDate = false
      }

      return matchesSearch && matchesEventType && matchesSource && matchesReview && matchesDate
    }).sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
  }, [events, searchTerm, eventTypeFilter, sourceFilter, reviewStatusFilter, fromDate, toDate, busMap])

  // Paginated events
  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredEvents.slice(start, start + pageSize)
  }, [filteredEvents, currentPage])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualPlate.trim()) {
      toast.error('Registration number or plate is required')
      return
    }
    setSubmittingManual(true)
    try {
      const plate = manualPlate.trim().toUpperCase()
      await processDetection({
        rawOcrText: plate,
        confidence: 1.0,
        cameraId: 'cam-manual-01',
        source: 'MANUAL',
        directionEstimate: manualEventType === 'ENTRY' ? 'INBOUND' : 'OUTBOUND',
        detectedAt: new Date().toISOString(),
        evidenceReference: null,
      })
      toast.success(`Successfully recorded manual ${manualEventType} for ${plate}`)
      setManualOpen(false)
      setManualPlate('')
      setManualNotes('')
      loadData()
    } catch {
      toast.error('Failed to record manual event')
    } finally {
      setSubmittingManual(false)
    }
  }

  const openCorrectionModal = (ev: GateEvent) => {
    setCorrectEvent(ev)
    setCorrectStatus(ev.reviewStatus)
    setCorrectNotes(ev.notes || '')
  }

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctEvent) return
    setSubmittingCorrection(true)
    try {
      await updateEvent(correctEvent.id, {
        reviewStatus: correctStatus,
        notes: correctNotes.trim() || null,
      })
      toast.success('Successfully updated event review status')
      setCorrectEvent(null)
      loadData()
    } catch {
      toast.error('Failed to update event correction')
    } finally {
      setSubmittingCorrection(false)
    }
  }

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
        Confidence: ev.confidence !== null ? `${(ev.confidence * 100).toFixed(1)}%` : 'N/A',
        CameraId: ev.cameraId || 'N/A',
        ReviewStatus: ev.reviewStatus,
        Notes: ev.notes || '',
      }
    })
    exportRowsToCsv(`gate-activity-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast.success(`Exported ${rows.length} gate activity records to CSV`)
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Gate Activity & Telemetry Logs</h2>
          <p className="text-xs text-muted-foreground">
            Searchable movement history, OCR detection telemetry, CSV exports, and manual override corrections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleCsvExport}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setManualOpen(true)}>
            <Plus className="size-3.5" />
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Filter and Search Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Filter className="size-4 text-primary" /> Advanced Filters & Search
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Filter movement history by date range, vehicle registration, event source, and review status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search plate, bus name, camera ID, or notes…"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <div>
              <Select
                value={eventTypeFilter}
                onValueChange={(v) => {
                  setEventTypeFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Event Types</SelectItem>
                  <SelectItem value="ENTRY">ENTRY (Inbound)</SelectItem>
                  <SelectItem value="EXIT">EXIT (Outbound)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={sourceFilter}
                onValueChange={(v) => {
                  setSourceFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sources</SelectItem>
                  <SelectItem value="CAMERA">Camera (OCR)</SelectItem>
                  <SelectItem value="MANUAL">Manual Override</SelectItem>
                  <SelectItem value="DEMO">Demo Simulator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 items-center">
            <div>
              <Select
                value={reviewStatusFilter}
                onValueChange={(v) => {
                  setReviewStatusFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Review Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Review Statuses</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="PENDING">Pending Review</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setSearchTerm('')
                  setEventTypeFilter('ALL')
                  setSourceFilter('ALL')
                  setReviewStatusFilter('ALL')
                  setFromDate('')
                  setToDate('')
                  setCurrentPage(1)
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Gate Activity Log</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Showing {filteredEvents.length} recorded events matching filters
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Reg No / Plate</TableHead>
                <TableHead>Bus & Route</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Source & Camera</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Review Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Loading gate activity…
                  </TableCell>
                </TableRow>
              ) : paginatedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No gate events found matching your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEvents.map((ev) => {
                  const bus = ev.busId ? busMap.get(ev.busId) : null
                  const regDisplay =
                    bus?.registrationNumber ||
                    ev.normalizedOcrText ||
                    ev.rawOcrText ||
                    'Unknown Plate'
                  const busName = bus?.displayName || bus?.routeName || 'Unregistered Vehicle'

                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div>{formatDateTime(ev.eventTime)}</div>
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
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {ev.source}
                        </Badge>
                        {ev.cameraId && <div className="text-[10px] text-muted-foreground mt-0.5">{ev.cameraId}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {ev.confidence !== null ? `${(ev.confidence * 100).toFixed(1)}%` : '—'}
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
                        {ev.notes && <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{ev.notes}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Correct / Review Event"
                          onClick={() => openCorrectionModal(ev)}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && filteredEvents.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredEvents.length)} of{' '}
                {filteredEvents.length} events
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" /> Previous
                </Button>
                <span className="font-medium text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal 1: Manual Entry Modal */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Record Manual Gate Event</DialogTitle>
            <DialogDescription>
              Force log an entry or exit movement for security override or manual inspection.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Registration Number / Plate *</label>
              <Input
                placeholder="e.g. MH-12-AB-1234"
                value={manualPlate}
                onChange={(e) => setManualPlate(e.target.value)}
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
                  <SelectValue placeholder="Select movement" />
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
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submittingManual}>
                Record Manual Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Event Correction & Review Modal */}
      <Dialog open={Boolean(correctEvent)} onOpenChange={(open) => !open && setCorrectEvent(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Correct / Review Gate Event</DialogTitle>
            <DialogDescription>
              Update review status and correction notes for event{' '}
              <span className="font-mono font-bold text-foreground">
                {correctEvent?.id}
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCorrectionSubmit} className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-[#0d1219] p-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>OCR Text:</span>
                <span className="font-mono font-semibold text-foreground">{correctEvent?.rawOcrText || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-mono text-foreground">
                  {correctEvent?.confidence !== null ? `${(correctEvent!.confidence! * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Camera ID:</span>
                <span className="font-mono text-foreground">{correctEvent?.cameraId || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Review Status</label>
              <Select
                value={correctStatus}
                onValueChange={(val) => setCorrectStatus(val as ReviewStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select review status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRMED">CONFIRMED (Valid crossing)</SelectItem>
                  <SelectItem value="PENDING">PENDING (Requires review)</SelectItem>
                  <SelectItem value="REJECTED">REJECTED (False positive / Invalid)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Correction Notes</label>
              <Textarea
                placeholder="Notes on correction or audit reason…"
                value={correctNotes}
                onChange={(e) => setCorrectNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCorrectEvent(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={submittingCorrection}>
                Save Correction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GateActivity
