import { useEffect, useState } from 'react'
import { useAppData } from '@/services/data-context'
import type { OperatingMode } from '@/types/domain'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Sliders, RefreshCw, CheckCircle2, Shield } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const Settings = () => {
  const { getSettings, updateSettings, resetToDemo } = useAppData()
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Settings form state
  const [campusName, setCampusName] = useState('')
  const [gateName, setGateName] = useState('')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [confidenceThreshold, setConfidenceThreshold] = useState('0.85')
  const [duplicateCooldownSeconds, setDuplicateCooldownSeconds] = useState('60')
  const [evidenceRetentionDays, setEvidenceRetentionDays] = useState('30')
  const [eventRetentionDays, setEventRetentionDays] = useState('90')
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('DEMO')
  const [liveBackendEnabled, setLiveBackendEnabled] = useState(false)

  const loadSettings = async () => {
    try {
      const s = await getSettings()
      setCampusName(s.campusName)
      setGateName(s.gateName)
      setTimezone(s.timezone)
      setConfidenceThreshold(s.confidenceThreshold.toString())
      setDuplicateCooldownSeconds(s.duplicateCooldownSeconds.toString())
      setEvidenceRetentionDays(s.evidenceRetentionDays.toString())
      setEventRetentionDays(s.eventRetentionDays.toString())
      setOperatingMode(s.operatingMode)
      setLiveBackendEnabled(s.liveBackendEnabled)
    } catch {
      toast.error('Failed to load system settings')
    }
  }

  useEffect(() => {
    loadSettings()
  }, [getSettings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings({
        campusName: campusName.trim() || 'GateVision Main Campus',
        gateName: gateName.trim() || 'Primary Gate Terminal',
        timezone,
        confidenceThreshold: parseFloat(confidenceThreshold) || 0.85,
        duplicateCooldownSeconds: parseInt(duplicateCooldownSeconds, 10) || 60,
        evidenceRetentionDays: parseInt(evidenceRetentionDays, 10) || 30,
        eventRetentionDays: parseInt(eventRetentionDays, 10) || 90,
        operatingMode,
        liveBackendEnabled,
      })
      toast.success('Successfully updated system settings and configuration')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleResetDemo = async () => {
    if (
      !confirm(
        'Are you sure you want to reset all buses, gate events, cameras, and settings to the baseline demo dataset? Local modifications will be reset.',
      )
    )
      return
    setResetting(true)
    try {
      await resetToDemo()
      await loadSettings()
      toast.success('Successfully reset all records to the baseline demo dataset')
    } catch {
      toast.error('Failed to reset demo dataset')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">System Settings & Configuration</h2>
          <p className="text-xs text-muted-foreground">
            Manage campus terminal parameters, OCR confidence thresholds, event cooldowns, and operating mode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetDemo} loading={resetting} className="text-destructive hover:bg-destructive/10">
            Reset to Demo Seeds
          </Button>
          <Button variant="outline" size="sm" onClick={loadSettings}>
            <RefreshCw className="size-3.5" />
            Reload
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Operating Mode Indicator & Switch Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="size-4 text-primary" /> Operating Mode Indicator & Switch
              </span>
              <Badge variant={operatingMode === 'DEMO' ? 'warning' : 'success'} className="font-mono text-xs">
                {operatingMode} MODE
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Switch between simulated demo environments and live CV production pipelines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Operating Mode</label>
                <Select value={operatingMode} onValueChange={(v) => setOperatingMode(v as OperatingMode)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Operating Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEMO">DEMO (Simulated telemetry & test data)</SelectItem>
                    <SelectItem value="LIVE">LIVE (Production camera feeds)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Live CV Backend Integration</label>
                <Select value={liveBackendEnabled ? 'ENABLED' : 'DISABLED'} onValueChange={(v) => setLiveBackendEnabled(v === 'ENABLED')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Backend status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISABLED">Disabled (Demo Simulator)</SelectItem>
                    <SelectItem value="ENABLED">Enabled (Live ANPR Stream)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Campus & Terminal Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sliders className="size-4 text-primary" /> Campus & Display Terminal Settings
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Campus identification name, gate terminal label, and timezones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Campus Name</label>
                <Input
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  placeholder="e.g. GateVision Main Campus"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Gate Terminal Name</label>
                <Input
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="e.g. Primary Gate Terminal"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Display Timezone</label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">India Standard Time (IST, UTC+05:30)</SelectItem>
                  <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                  <SelectItem value="Asia/Dubai">Gulf Standard Time (GST, UTC+04:00)</SelectItem>
                  <SelectItem value="Asia/Singapore">Singapore Time (SGT, UTC+08:00)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET, UTC-05:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 3. OCR Processing & Retention Parameters */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">OCR Thresholds & Retention Policies</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure minimum confidence levels, duplicate suppression windows, and data retention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Confidence Threshold (0.0 - 1.0)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground">Minimum OCR confidence required to auto-match registered buses.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Duplicate Cooldown (Seconds)</label>
                <Input
                  type="number"
                  value={duplicateCooldownSeconds}
                  onChange={(e) => setDuplicateCooldownSeconds(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground">Window used to suppress duplicate events for the same plate.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Evidence Retention (Days)</label>
                <Input
                  type="number"
                  value={evidenceRetentionDays}
                  onChange={(e) => setEvidenceRetentionDays(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Gate Event Retention (Days)</label>
                <Input
                  type="number"
                  value={eventRetentionDays}
                  onChange={(e) => setEventRetentionDays(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" loading={saving}>
                <CheckCircle2 className="size-4 mr-1.5" /> Save Configuration Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

export default Settings
