import { useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { GateEvent, Bus, ReviewStatus } from '@/types/domain'
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
import { formatDateTime, formatConfidence, formatRelativeTime } from '@/utils/format'
import { formatRegistrationNumber } from '@/utils/registration'
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const Reviews = () => {
  const { buses, events, loading, resolveReview, refresh } = useAppData()
  const [refreshing, setRefreshing] = useState(false)

  // Review modal state
  const [selectedEvent, setSelectedEvent] = useState<GateEvent | null>(null)
  const [selectedBusId, setSelectedBusId] = useState<string>('NONE')
  const [correctedPlate, setCorrectedPlate] = useState('')
  const [reviewReason, setReviewReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  // Pending / uncertain review queue (events where reviewStatus === 'PENDING' or confidence < 0.85)
  const reviewQueueEvents = useMemo(() => {
    return events
      .filter((e) => e.reviewStatus === 'PENDING' || (e.confidence !== null && e.confidence < 0.85))
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
  }, [events])

  const openReviewModal = (ev: GateEvent) => {
    setSelectedEvent(ev)
    setSelectedBusId(ev.busId || 'NONE')
    setCorrectedPlate(ev.normalizedOcrText || ev.rawOcrText || '')
    setReviewReason(ev.notes || '')
  }

  const handleAction = async (status: ReviewStatus, reasonPrefix: string) => {
    if (!selectedEvent) return
    setSubmitting(true)
    try {
      const notes = reviewReason.trim() ? `${reasonPrefix}: ${reviewReason.trim()}` : reasonPrefix
      let targetBusId = selectedEvent.busId
      if (selectedBusId && selectedBusId !== 'NONE') {
        targetBusId = selectedBusId
      }

      await resolveReview(
        selectedEvent.id,
        status,
        targetBusId,
        correctedPlate.trim().toUpperCase() || undefined,
        notes,
      )

      toast.success(`Successfully updated event review status to ${status}`)
      setSelectedEvent(null)
    } catch {
      toast.error('Failed to process review action')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Uncertain & Unknown Detections Review Queue</h2>
          <p className="text-xs text-muted-foreground">
            Audit low-confidence OCR reads, assign correct vehicle registrations, confirm matches, or reject false detections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review Items</CardTitle>
            <AlertTriangle className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{loading ? '—' : reviewQueueEvents.length}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Requires security officer verification</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Detection Review Queue</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Showing {reviewQueueEvents.length} uncertain or pending OCR reads
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>OCR Raw / Plate</TableHead>
                <TableHead>Suggested Bus Match</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Camera ID</TableHead>
                <TableHead>Review Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading review queue…</TableCell>
                </TableRow>
              ) : reviewQueueEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No pending uncertain or unknown detections in the review queue. All clear!
                  </TableCell>
                </TableRow>
              ) : (
                reviewQueueEvents.map((ev) => {
                  const bus = ev.busId ? busMap.get(ev.busId) : null
                  const ocrText = ev.normalizedOcrText || ev.rawOcrText || 'UNKNOWN'

                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div>{formatDateTime(ev.eventTime)}</div>
                        <div className="text-[10px] opacity-75">{formatRelativeTime(ev.eventTime)}</div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-foreground">
                        {formatRegistrationNumber(ocrText)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{bus ? bus.displayName || bus.registrationNumber : 'Unmatched / Unknown'}</div>
                        {bus?.routeName && <div className="text-[11px] text-muted-foreground">{bus.routeName}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-warning">
                        {formatConfidence(ev.confidence)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ev.cameraId || 'cam-main-01'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">
                          {ev.reviewStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openReviewModal(ev)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>Verify & Review Detection Event</DialogTitle>
            <DialogDescription>
              Inspect OCR detection telemetry and perform verification actions.
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-[#0d1219] p-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Event ID:</span>
                  <span className="font-mono text-foreground">{selectedEvent.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp:</span>
                  <span className="font-mono text-foreground">{formatDateTime(selectedEvent.eventTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Raw OCR Text:</span>
                  <span className="font-mono font-bold text-foreground">{selectedEvent.rawOcrText || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>OCR Confidence:</span>
                  <span className="font-mono text-warning font-semibold">{formatConfidence(selectedEvent.confidence)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Camera ID:</span>
                  <span className="font-mono text-foreground">{selectedEvent.cameraId || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Corrected Registration Plate</label>
                <Input
                  value={correctedPlate}
                  onChange={(e) => setCorrectedPlate(e.target.value)}
                  placeholder="e.g. MH-12-AB-1234"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Assign Registered Bus</label>
                <Select value={selectedBusId} onValueChange={setSelectedBusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select matched bus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">-- None / Unknown Vehicle --</SelectItem>
                    {buses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.registrationNumber} ({b.displayName || b.routeName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Review Reason & Notes</label>
                <Textarea
                  placeholder="Reason for confirmation, correction, or rejection…"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                />
              </div>

              <DialogFooter className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => handleAction('REJECTED', 'Rejected false detection')}
                  loading={submitting}
                >
                  <XCircle className="size-4 mr-1" /> Reject False Detection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAction('CONFIRMED', 'Marked unknown / verified')}
                  loading={submitting}
                >
                  <HelpCircle className="size-4 mr-1" /> Mark Unknown
                </Button>
                <Button
                  type="button"
                  onClick={() => handleAction('CONFIRMED', 'Confirmed matched bus & registration')}
                  loading={submitting}
                >
                  <CheckCircle2 className="size-4 mr-1" /> Confirm Matched Bus
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Reviews
