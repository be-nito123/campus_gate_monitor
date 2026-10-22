import { useState } from 'react'
import { useAppData } from '@/services/data-context'
import type { Camera, CameraConnectionStatus, CameraProcessingStatus, DirectionConfiguration } from '@/types/domain'
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
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { formatDateTime, formatRelativeTime } from '@/utils/format'
import { Plus, Edit, Trash2, Video, Radio, RefreshCw } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const Cameras = () => {
  const { cameras, loading, registerCamera, updateCamera, deleteCamera, refresh } = useAppData()
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formGate, setFormGate] = useState('')
  const [formLane, setFormLane] = useState('')
  const [formDirection, setFormDirection] = useState<DirectionConfiguration>('BIDIRECTIONAL')
  const [formConnection, setFormConnection] = useState<CameraConnectionStatus>('ONLINE')
  const [formProcessing, setFormProcessing] = useState<CameraProcessingStatus>('PROCESSING')
  const [submitting, setSubmitting] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const openAddModal = () => {
    setEditingCamera(null)
    setFormName('')
    setFormCode(`CAM${Math.floor(10 + Math.random() * 90)}`)
    setFormGate('Main Gate')
    setFormLane('Lane 1')
    setFormDirection('BIDIRECTIONAL')
    setFormConnection('ONLINE')
    setFormProcessing('PROCESSING')
    setDialogOpen(true)
  }

  const openEditModal = (cam: Camera) => {
    setEditingCamera(cam)
    setFormName(cam.name)
    setFormCode(cam.cameraCode)
    setFormGate(cam.gateName)
    setFormLane(cam.laneName)
    setFormDirection(cam.directionConfiguration)
    setFormConnection(cam.connectionStatus)
    setFormProcessing(cam.processingStatus)
    setDialogOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('Camera name is required')
      return
    }
    setSubmitting(true)
    try {
      if (editingCamera) {
        await updateCamera({
          id: editingCamera.id,
          name: formName.trim(),
          cameraCode: formCode.trim(),
          gateName: formGate.trim(),
          laneName: formLane.trim(),
          directionConfiguration: formDirection,
          connectionStatus: formConnection,
          processingStatus: formProcessing,
        })
        toast.success(`Successfully updated camera ${formName}`)
      } else {
        await registerCamera({
          name: formName.trim(),
          cameraCode: formCode.trim() || `CAM-${Math.floor(100 + Math.random() * 900)}`,
          gateName: formGate.trim() || 'Main Gate',
          laneName: formLane.trim() || 'Lane 1',
          enabled: true,
          connectionStatus: formConnection,
          processingStatus: formProcessing,
          directionConfiguration: formDirection,
          simulated: true,
        })
        toast.success(`Successfully registered new camera ${formName}`)
      }
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save camera record')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this camera?')) return
    try {
      await deleteCamera(id)
      toast.success('Camera successfully deleted')
    } catch {
      toast.error('Failed to delete camera')
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Camera Management Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Configure campus gate OCR cameras, monitor connection heartbeats, processing status, and direction lanes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddModal}>
            <Plus className="size-3.5" />
            Register Camera
          </Button>
        </div>
      </div>

      {/* Camera Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Active Gate Cameras</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Showing {cameras.length} registered campus cameras
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camera Name & Code</TableHead>
                <TableHead>Gate & Lane</TableHead>
                <TableHead>Connection Status</TableHead>
                <TableHead>Last Heartbeat</TableHead>
                <TableHead>Processing Status</TableHead>
                <TableHead>Direction Config</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading cameras…</TableCell>
                </TableRow>
              ) : cameras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                    <div className="py-2">
                      <p className="font-medium text-foreground text-xs">No gate cameras registered</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Click 'Register Camera' to add a terminal camera feed and configure lane directions.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cameras.map((cam) => (
                  <TableRow key={cam.id}>
                    <TableCell>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        <Video className="size-4 text-primary" /> {cam.name}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">{cam.cameraCode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground">{cam.gateName}</div>
                      <div className="text-[11px] text-muted-foreground">{cam.laneName}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cam.connectionStatus === 'ONLINE' ? 'success' : cam.connectionStatus === 'SIMULATED' ? 'neutral' : 'destructive'}
                        className="text-[10px] gap-1"
                      >
                        <Radio className="size-3 animate-pulse" /> {cam.connectionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div>{formatDateTime(cam.lastHeartbeatAt)}</div>
                      <div className="text-[10px] opacity-75">{formatRelativeTime(cam.lastHeartbeatAt)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cam.processingStatus === 'PROCESSING' ? 'success' : 'neutral'} className="text-[10px]">
                        {cam.processingStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      {cam.directionConfiguration}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(cam)} title="Edit Camera">
                          <Edit className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(cam.id)} title="Delete Camera">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Registration / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingCamera ? 'Edit Camera Configuration' : 'Register New Gate Camera'}</DialogTitle>
            <DialogDescription>
              Configure camera details, gate lane mapping, and direction rules.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Camera Name *</label>
              <Input
                placeholder="e.g. Gate 1 - Main Inbound"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Camera Code</label>
                <Input
                  placeholder="e.g. CAM01"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Gate Name</label>
                <Input
                  placeholder="e.g. Main Gate"
                  value={formGate}
                  onChange={(e) => setFormGate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Lane Name</label>
                <Input
                  placeholder="e.g. Lane A (Inbound)"
                  value={formLane}
                  onChange={(e) => setFormLane(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Direction Configuration</label>
                <Select value={formDirection} onValueChange={(v) => setFormDirection(v as DirectionConfiguration)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INBOUND">INBOUND</SelectItem>
                    <SelectItem value="OUTBOUND">OUTBOUND</SelectItem>
                    <SelectItem value="BIDIRECTIONAL">BIDIRECTIONAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Connection Status</label>
                <Select value={formConnection} onValueChange={(v) => setFormConnection(v as CameraConnectionStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONLINE">ONLINE</SelectItem>
                    <SelectItem value="OFFLINE">OFFLINE</SelectItem>
                    <SelectItem value="SIMULATED">SIMULATED</SelectItem>
                    <SelectItem value="DEGRADED">DEGRADED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Processing Status</label>
                <Select value={formProcessing} onValueChange={(v) => setFormProcessing(v as CameraProcessingStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Processing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROCESSING">PROCESSING</SelectItem>
                    <SelectItem value="IDLE">IDLE</SelectItem>
                    <SelectItem value="ERROR">ERROR</SelectItem>
                    <SelectItem value="DISABLED">DISABLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingCamera ? 'Save Changes' : 'Register Camera'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Cameras
