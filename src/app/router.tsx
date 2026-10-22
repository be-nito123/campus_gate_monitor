import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppDataProvider } from '@/services/data-context'
import { Button } from '@/components/ui/button'
import Overview from '@/pages/Overview'
import Monitoring from '@/pages/Monitoring'
import BusRegistry from '@/pages/BusRegistry'
import GateActivity from '@/pages/GateActivity'
import Reports from '@/pages/Reports'
import Reviews from '@/pages/Reviews'
import Cameras from '@/pages/Cameras'
import Settings from '@/pages/Settings'

const NAV_ITEMS = [
  { label: 'Overview', to: '/' },
  { label: 'Live Monitoring', to: '/monitoring' },
  { label: 'Bus Registry', to: '/buses' },
  { label: 'Gate Activity', to: '/activity' },
  { label: 'Reports & Analytics', to: '/reports' },
  { label: 'Detection Review', to: '/reviews' },
  { label: 'Camera Management', to: '/cameras' },
  { label: 'Settings', to: '/settings' },
]

const SidebarButton: React.FC<{ label: string; to: string }> = ({ label, to }) => {
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      size="sm"
      asChild
      className="w-full justify-start text-xs font-medium"
    >
      <a href={to} aria-current={isActive ? 'page' : undefined}>
        {label}
      </a>
    </Button>
  )
}

const AppShell = () => {
  return (
    <AppDataProvider>
      <div className="flex h-screen bg-background">
        <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-2 px-4 py-4 text-base font-bold tracking-tight text-primary">
            <span aria-hidden className="text-xl">🚌</span> GateVision
          </div>
          <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <SidebarButton key={item.to} label={item.label} to={item.to} />
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-4 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="font-medium">System Health</span>
              <span className="flex items-center gap-1 font-semibold text-success">
                <span className="size-1.5 rounded-full bg-success animate-pulse" /> Operational
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-medium">Operating Mode</span>
              <span className="rounded bg-warning/15 px-1.5 py-0.5 font-semibold text-warning">DEMO</span>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground/80 leading-tight">
              LocalStorage + In-Memory Persistence. Supabase PostgreSQL Ready.
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Campus Gate Ops</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>IST (UTC+05:30)</span>
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 font-semibold text-primary">
                  SA
                </div>
                <div>
                  <div className="font-medium text-foreground">Security Admin</div>
                  <div className="text-[10px]">Gate 1 Main Terminal</div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AppDataProvider>
  )
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'monitoring', element: <Monitoring /> },
      { path: 'buses', element: <BusRegistry /> },
      { path: 'activity', element: <GateActivity /> },
      { path: 'reports', element: <Reports /> },
      { path: 'reviews', element: <Reviews /> },
      { path: 'cameras', element: <Cameras /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export default createBrowserRouter(routes)
