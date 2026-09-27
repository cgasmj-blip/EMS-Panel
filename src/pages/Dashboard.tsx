import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { displayRoleLabel, isAboveChirurgien } from '@/lib/supabase'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { HomeTiles } from '@/components/ui/HomeTiles'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { VitalsBar } from '@/components/ui/VitalsBar'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.webp'
import { ServicesTab } from './app/ServicesTab'
import { AbsenceTab } from './app/AbsenceTab'
import { PrestationsTab } from './app/PrestationsTab'
import { AgendaTab } from './app/AgendaTab'
import { DossierTraumatoTab } from './app/DossierTraumatoTab'
import { HistoriqueTab } from './app/HistoriqueTab'
import { GestionTab } from './app/GestionTab'
import { AideTab } from './app/AideTab'

const TAB_CONTENT: Record<TabKey, ReactNode> = {
  services: <ServicesTab />,
  absence: <AbsenceTab />,
  prestations: <PrestationsTab />,
  agenda: <AgendaTab />,
  dossier: null,
  aide: <AideTab />,
  historique: <HistoriqueTab />,
  gestion: <GestionTab />,
}

const VIEW_STORAGE_KEY = 'ems-dashboard-view'

function getStoredView(): TabKey | 'home' {
  if (typeof window === 'undefined') return 'home'
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
  return (stored as TabKey | 'home') || 'home'
}

export function Dashboard() {
  const { staff, signOut, signInWithDiscord } = useAuth()
  const [view, setViewState] = useState<TabKey | 'home'>(getStoredView)
  const [resyncing, setResyncing] = useState(false)

  async function handleResync() {
    setResyncing(true)
    // Re-runs the Discord OAuth flow. Since consent is already granted this
    // round-trips almost instantly and comes back with a fresh provider
    // token, letting the edge function re-read the current grade/sous-grade/
    // affiliation from Discord (that's the only moment it's available).
    await signInWithDiscord()
  }

  function setView(next: TabKey | 'home') {
    setViewState(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <span className="w-8 h-8 border-2 border-[var(--ink)]/20 border-t-red rounded-full animate-spin" />
      </div>
    )
  }

  const visibleTabs = TILE_SECTIONS.filter((s) => !s.seniorOnly || isAboveChirurgien(staff.role)).map((s) => s.key)
  const effectiveView = view !== 'home' && !visibleTabs.includes(view) ? 'home' : view
  const activeSection = effectiveView === 'home' ? null : TILE_SECTIONS.find((s) => s.key === effectiveView) ?? null

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <aside className="w-16 sm:w-20 shrink-0 flex flex-col items-center py-5 gap-4 bg-[var(--sidebar-bg)] border-r border-[var(--ink)]/8">
        <img src={logo} alt="EMS" className="w-10 h-10 rounded-full object-cover" />

        <button
          type="button"
          onClick={() => setView('home')}
          aria-label="Accueil"
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors',
            effectiveView === 'home' ? 'bg-red text-white' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]',
          )}
        >
          <LayoutGrid size={18} />
        </button>

        <div className="flex-1" />

        {staff.avatar_url ? (
          <img src={staff.avatar_url} alt="" className="w-9 h-9 rounded-full border border-[var(--ink)]/15" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[var(--ink)]/10 border border-[var(--ink)]/15" />
        )}

        <button
          type="button"
          onClick={handleResync}
          disabled={resyncing}
          aria-label="Actualiser mon profil Discord"
          title="Actualiser mon grade/habilitations/affiliations depuis Discord"
          className="w-10 h-10 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={16} className={resyncing ? 'animate-spin' : ''} />
        </button>

        <ThemeToggle />

        <button
          type="button"
          onClick={signOut}
          aria-label="Déconnexion"
          className="w-10 h-10 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer"
        >
          <LogOut size={17} />
        </button>
      </aside>

      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {effectiveView === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6 max-w-5xl w-full mx-auto"
            >
              <div className="relative overflow-hidden rounded-2xl">
                <div className="absolute inset-0 h-full">
                  <VitalsBar />
                </div>
                <div className="relative z-10 py-2">
                  <h1 className="font-display font-black text-xl text-[var(--ink)]">Bonjour, {staff.full_name}</h1>
                  {displayRoleLabel(staff.role) && <p className="text-[var(--ink)]/40 text-sm">{displayRoleLabel(staff.role)}</p>}
                </div>
              </div>
              <HomeTiles tabs={visibleTabs} onSelect={(key) => setView(key)} />
            </motion.div>
          ) : (
            <motion.div
              key={effectiveView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6 max-w-5xl w-full mx-auto"
            >
              {activeSection && (
                <SectionHeader
                  label={activeSection.label}
                  icon={activeSection.icon}
                  color={activeSection.color}
                  onBack={() => setView('home')}
                />
              )}
              {effectiveView === 'dossier' ? <DossierTraumatoTab /> : TAB_CONTENT[effectiveView]}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
