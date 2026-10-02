import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, History, LayoutGrid, LogOut, Megaphone, MessageCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { displayRoleLabel, isAboveChirurgien, supabase } from '@/lib/supabase'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { HomeTiles } from '@/components/ui/HomeTiles'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { VitalsBar } from '@/components/ui/VitalsBar'
import { StockAlertButton } from '@/components/ui/StockAlertButton'
import { CodeBlancAlertButton } from '@/components/ui/CodeBlancAlertButton'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.webp'
import { ServicesTab } from './app/ServicesTab'
import { AbsenceTab } from './app/AbsenceTab'
import { PrestationsTab } from './app/PrestationsTab'
import { AgendaTab } from './app/AgendaTab'
import { DossierTraumatoTab } from './app/DossierTraumatoTab'
import { DossierMedicalTab } from './app/DossierMedicalTab'
import { HistoriqueTab } from './app/HistoriqueTab'
import { GestionTab } from './app/GestionTab'
import { AideTab } from './app/AideTab'
import { DossiersFormationTab } from './app/DossiersFormationTab'
import { SearchTab } from './app/SearchTab'
import { MessagesTab } from './app/MessagesTab'

const TAB_CONTENT: Record<TabKey, ReactNode> = {
  services: <ServicesTab />,
  absence: <AbsenceTab />,
  prestations: <PrestationsTab />,
  agenda: <AgendaTab />,
  dossier: null,
  dossier_medical: <DossierMedicalTab />,
  formations: <DossiersFormationTab />,
  recherche: <SearchTab />,
  messages: <MessagesTab />,
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
  const { staff, session, signOut, signInWithDiscord } = useAuth()
  const [view, setViewState] = useState<TabKey | 'home'>(getStoredView)
  const [resyncing, setResyncing] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [latestAnnouncement, setLatestAnnouncement] = useState<{ id: number; title: string; body: string } | null>(null)
  const previousUnreadRef = useRef<number | null>(null)
  const previousAnnouncementIdRef = useRef<number | null>(null)

  const playTone = useCallback((kind: 'message' | 'announcement') => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      const ctx = new AudioContextClass()
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, now)

      if (kind === 'message') {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        osc.connect(gain)
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
        osc.start(now)
        osc.stop(now + 0.23)
      } else {
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        osc1.type = 'triangle'
        osc2.type = 'triangle'
        osc1.frequency.setValueAtTime(520, now)
        osc2.frequency.setValueAtTime(740, now + 0.18)
        osc1.connect(gain)
        osc2.connect(gain)
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.19)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
        osc1.start(now)
        osc1.stop(now + 0.17)
        osc2.start(now + 0.18)
        osc2.stop(now + 0.43)
      }

      window.setTimeout(() => ctx.close().catch(() => {}), 700)
    } catch {
      // Les navigateurs peuvent bloquer l'audio avant la première interaction utilisateur.
    }
  }, [])

  const refreshSidebarData = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) {
      setUnreadMessages(0)
      setLatestAnnouncement(null)
      return
    }

    const [{ count }, { data: announcement }] = await Promise.all([
      supabase
        .from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null),
      supabase
        .from('internal_announcements')
        .select('id,title,body')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const nextUnread = count ?? 0
    const nextAnnouncement = announcement ?? null

    if (previousUnreadRef.current !== null && nextUnread > previousUnreadRef.current) {
      playTone('message')
    }

    if (
      previousAnnouncementIdRef.current !== null &&
      nextAnnouncement?.id &&
      nextAnnouncement.id !== previousAnnouncementIdRef.current
    ) {
      playTone('announcement')
    }

    previousUnreadRef.current = nextUnread
    previousAnnouncementIdRef.current = nextAnnouncement?.id ?? null
    setUnreadMessages(nextUnread)
    setLatestAnnouncement(nextAnnouncement)
  }, [session?.user.id, playTone])

  useEffect(() => {
    refreshSidebarData()
    const timer = window.setInterval(refreshSidebarData, 5000)
    return () => window.clearInterval(timer)
  }, [refreshSidebarData])

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
    <div className={cn('flex bg-[var(--bg)]', effectiveView === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen')}>
      <aside className="w-16 sm:w-20 shrink-0 flex flex-col items-center py-4 gap-3 bg-[var(--sidebar-bg)] border-r border-[var(--ink)]/8">
        <img src={logo} alt="EMS" className="w-10 h-10 rounded-full object-cover" />

        <CodeBlancAlertButton />

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



        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView('agenda')}
            aria-label="Agenda"
            title="Agenda"
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors',
              effectiveView === 'agenda' ? 'bg-red text-white' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]',
            )}
          >
            <CalendarClock size={17} />
          </button>

          <button
            type="button"
            onClick={() => setView('recherche')}
            aria-label="Recherche globale"
            title="Recherche globale"
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors',
              effectiveView === 'recherche' ? 'bg-red text-white' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]',
            )}
          >
            <Search size={17} />
          </button>

          <button
            type="button"
            onClick={() => setView('messages')}
            aria-label="Messages"
            title="Messages"
            className={cn(
              'relative w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors',
              effectiveView === 'messages' ? 'bg-red text-white' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]',
            )}
          >
            <MessageCircle size={17} />
            {unreadMessages > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--sidebar-bg)]">
                +{unreadMessages}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setView('historique')}
            aria-label="Historique"
            title="Historique"
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors',
              effectiveView === 'historique' ? 'bg-red text-white' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]',
            )}
          >
            <History size={17} />
          </button>

          <StockAlertButton compact />

          {isAboveChirurgien(staff.role) && (
            <button
              type="button"
              onClick={() => setView('gestion')}
              aria-label="Gestion"
              title="Gestion"
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors',
                effectiveView === 'gestion' ? 'bg-red text-white' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]',
              )}
            >
              <ShieldCheck size={17} />
            </button>
          )}
        </div>

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

      <main
        className={cn(
          'flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6',
          effectiveView === 'messages' ? 'h-screen overflow-hidden' : 'overflow-y-auto',
        )}
      >
        <AnimatePresence mode="wait">
          {effectiveView === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'flex flex-col gap-6 max-w-5xl w-full mx-auto',
                effectiveView === 'messages' && 'h-full min-h-0 overflow-hidden',
              )}
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
              {latestAnnouncement && (
                <div className="rounded-2xl border border-red/20 bg-red/10 px-4 py-3 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-red/15 text-red-300 flex items-center justify-center shrink-0">
                    <Megaphone size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[var(--ink)] font-bold text-sm">{latestAnnouncement.title}</p>
                    <p className="text-[var(--ink)]/60 text-sm mt-1 whitespace-pre-wrap line-clamp-3">{latestAnnouncement.body}</p>
                  </div>
                </div>
              )}
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
