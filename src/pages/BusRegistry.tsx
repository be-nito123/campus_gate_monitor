import { useEffect, useState, useMemo } from 'react'
import { useAppData } from '@/services/data-context'
import type { Bus, GateEvent } from '@/types/domain'
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
import { formatDateTime } from '@/utils/format'
import { describeRegistrationIssue, formatRegistrationNumber } from '@/utils/registration'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  History,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

const BusRegistry = () => {
  const { listBuses, listEvents, registerBus, updateBus, deactivateBus } = useAppData()
  const [buses, setBuses] = useState<Bus[]>([])
  const [events, setEvents] = useState<GateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [routeFilter, setRouteFilter] = useState<string>('ALL')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Sorting state
  const [sortField, setSortField] = useState<'displayName' | 'registrationNumber' | 'routeName' | 'currentStatus' | 'updatedAt'>('displayName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Modals state
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editBus, setEditBus] = useState<Bus | null>(null)
  const [historyBus, setHistoryBus] = useState<Bus | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Bus | null>(null)

  // Form states for register/edit
  const [formRegNum, setFormRegNum] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formRouteName, setFormRouteName] = useState('')
  const [formDriverName, setFormDriverName] = useState('')
  const [formDriverContact, setFormDriverContact] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [b, e] = await Promise.all([listBuses(), listEvents()])
      setBuses(b)
      setEvents(e)
    } catch {
      toast.error('Failed to load bus registry data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [listBuses, listEvents])

  // Unique route list for filter
  const routeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const b of buses) {
      if (b.routeName) set.add(b.routeName)
    }
    return Array.from(set).sort()
  }, [buses])

  // Filtered and sorted buses
  const filteredBuses = useMemo(() => {
    return buses.filter((b) => {
      const matchesSearch =
        !searchTerm.trim() ||
        b.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.displayName && b.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        b.routeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.driverName && b.driverName.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'ALL' || b.currentStatus === statusFilter
      const matchesRoute = routeFilter === 'ALL' || b.routeName === routeFilter

      return matchesSearch && matchesStatus && matchesRoute && b.isActive
    }).sort((a, b) => {
      let valA: any = a[sortField] ?? ''
      let valB: any = b[sortField] ?? ''
      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [buses, searchTerm, statusFilter, routeFilter, sortField, sortDirection])

  // Paginated buses
  const totalPages = Math.ceil(filteredBuses.length / pageSize) || 1
  const paginatedBuses = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredBuses.slice(start, start + pageSize)
  }, [filteredBuses, currentPage])

  // Movement history for selected bus
  const selectedBusEvents = useMemo(() => {
    if (!historyBus) return []
    return events
      .filter((e) => e.busId === historyBus.id)
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
  }, [events, historyBus])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const openRegisterModal = () => {
    setFormRegNum('')
    setFormDisplayName('')
    setFormRouteName('')
    setFormDriverName('')
    setFormDriverContact('')
    setFormNotes('')
    setEditBus(null)
    setRegisterOpen(true)
  }

  const openEditModal = (bus: Bus) => {
    setEditBus(bus)
    setFormRegNum(bus.registrationNumber)
    setFormDisplayName(bus.displayName || '')
    setFormRouteName(bus.routeName)
    setFormDriverName(bus.driverName || '')
    setFormDriverContact(bus.driverContact || '')
    setFormNotes(bus.notes || '')
    setRegisterOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const issue = describeRegistrationIssue(formRegNum)
    if (issue && !editBus) {
      toast.error(issue)
      return
    }

    setSubmitting(true)
    try {
      const cleanNum = formRegNum.trim().toUpperCase()
      const normalized = cleanNum.replace(/[^A-Z0-9]/g, '')

      if (editBus) {
        await updateBus({
          id: editBus.id,
          registrationNumber: cleanNum,
          normalizedRegistrationNumber: normalized,
          displayName: formDisplayName.trim() || cleanNum,
          routeName: formRouteName.trim() || 'General Route',
          driverName: formDriverName.trim() || null,
          driverContact: formDriverContact.trim() || null,
          notes: formNotes.trim() || null,
        })
        toast.success(`Successfully updated bus ${cleanNum}`)
      } else {
        await registerBus({
          busCode: `BUS-${Math.floor(100 + Math.random() * 900)}`,
          registrationNumber: cleanNum,
          normalizedRegistrationNumber: normalized,
          displayName: formDisplayName.trim() || cleanNum,
          routeName: formRouteName.trim() || 'General Route',
          driverName: formDriverName.trim() || null,
          driverContact: formDriverContact.trim() || null,
          currentStatus: 'OUTSIDE_CAMPUS',
          isActive: true,
          notes: formNotes.trim() || null,
        })
        toast.success(`Successfully registered bus ${cleanNum}`)
      }

      setRegisterOpen(false)
      loadData()
    } catch {
      toast.error('Failed to save bus record')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    try {
      await deactivateBus(deactivateTarget.id)
      toast.success(`Bus ${deactivateTarget.registrationNumber} deactivated`)
      setDeactivateTarget(null)
      loadData()
    } catch {
      toast.error('Failed to deactivate bus')
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Bus Registry & Fleet Management</h2>
          <p className="text-xs text-muted-foreground">
            Manage registered campus vehicles, OCR plate mappings, assigned routes, and movement history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={openRegisterModal}>
            <Plus className="size-3.5" />
            Register Bus
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by registration number, display name, route, or driver…"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="INSIDE_CAMPUS">Inside Campus</SelectItem>
                  <SelectItem value="OUTSIDE_CAMPUS">Outside Campus</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={routeFilter}
                onValueChange={(v) => {
                  setRouteFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Routes</SelectItem>
                  {routeOptions.map((route) => (
                    <SelectItem key={route} value={route}>
                      {route}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bus Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Registered Fleet</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Showing {filteredBuses.length} active vehicles matching criteria
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('registrationNumber')}>
                  Reg No / Plate {sortField === 'registrationNumber' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('displayName')}>
                  Display Name {sortField === 'displayName' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('routeName')}>
                  Route {sortField === 'routeName' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead>Driver & Contact</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('currentStatus')}>
                  Status {sortField === 'currentStatus' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Loading bus registry…
                  </TableCell>
                </TableRow>
              ) : paginatedBuses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No matching buses found in registry.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBuses.map((bus) => (
                  <TableRow key={bus.id}>
                    <TableCell className="font-mono font-semibold text-foreground">
                      <div>{formatRegistrationNumber(bus.registrationNumber)}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{bus.busCode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{bus.displayName || '—'}</div>
                      {bus.notes && <div className="text-[11px] text-muted-foreground line-clamp-1">{bus.notes}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{bus.routeName}</TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground font-medium">{bus.driverName || 'Unassigned'}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{bus.driverContact || 'No phone'}</div>
                    </TableCell>
                    <TableCell>
                      {bus.currentStatus === 'INSIDE_CAMPUS' ? (
                        <Badge variant="success" className="gap-1">
                          <ShieldCheck className="size-3" /> Inside Campus
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="size-3" /> Outside Campus
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Movement History"
                          onClick={() => setHistoryBus(bus)}
                        >
                          <History className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit Bus Details"
                          onClick={() => openEditModal(bus)}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          title="Deactivate Bus"
                          onClick={() => setDeactivateTarget(bus)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          {!loading && filteredBuses.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredBuses.length)} of{' '}
                {filteredBuses.length} buses
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

      {/* Modal 1: Register / Edit Bus Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editBus ? 'Edit Bus Details' : 'Register New Campus Bus'}</DialogTitle>
            <DialogDescription>
              {editBus ? 'Update vehicle records, driver assignment, or route.' : 'Add a new vehicle to the fleet with OCR plate mapping.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Registration Number / Plate *</label>
              <Input
                placeholder="e.g. MH-12-AB-1234"
                value={formRegNum}
                onChange={(e) => setFormRegNum(e.target.value)}
                required
                disabled={Boolean(editBus)}
              />
              {editBus && <p className="text-[10px] text-muted-foreground">Registration number cannot be changed after creation.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Display Name</label>
                <Input
                  placeholder="e.g. Campus Shuttle 1"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Route Name *</label>
                <Input
                  placeholder="e.g. Route A"
                  value={formRouteName}
                  onChange={(e) => setFormRouteName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Driver Name</label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={formDriverName}
                  onChange={(e) => setFormDriverName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Driver Contact</label>
                <Input
                  placeholder="e.g. +91-9876543210"
                  value={formDriverContact}
                  onChange={(e) => setFormDriverContact(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Notes / Permits</label>
              <Textarea
                placeholder="Optional notes or access permissions…"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editBus ? 'Save Changes' : 'Register Bus'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Movement History Dialog */}
      <Dialog open={Boolean(historyBus)} onOpenChange={(open) => !open && setHistoryBus(null)}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Movement History: {historyBus?.displayName || historyBus?.registrationNumber}
            </DialogTitle>
            <DialogDescription>
              Complete gate crossing logs for {formatRegistrationNumber(historyBus?.registrationNumber || '')} ({historyBus?.routeName})
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 pr-1">
            {selectedBusEvents.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No recorded gate events for this bus.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBusEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(ev.eventTime)}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setHistoryBus(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Deactivate Confirmation Dialog */}
      <Dialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirm Bus Deactivation</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate bus{' '}
              <span className="font-mono font-bold text-foreground">
                {formatRegistrationNumber(deactivateTarget?.registrationNumber || '')}
              </span>
              ? It will be removed from active fleet monitoring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivateConfirm}>
              Deactivate Bus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BusRegistry
