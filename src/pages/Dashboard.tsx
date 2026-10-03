import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, LayoutGrid, LogOut, Megaphone, MessageCircle, Palette, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { displayRoleLabel, isAboveChirurgien, supabase } from '@/lib/supabase'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { HomeTiles } from '@/components/ui/HomeTiles'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { VitalsBar } from '@/components/ui/VitalsBar'
import { StockAlertButton } from '@/components/ui/StockAlertButton'
import { CodeBlancAlertButton } from '@/components/ui/CodeBlancAlertButton'
import { CodeRougeAlertButton } from '@/components/ui/CodeRougeAlertButton'
import { CustomizationPanel } from '@/components/ui/CustomizationPanel'
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
  const [latestAnnouncements, setLatestAnnouncements] = useState<{ id: number; title: string; body: string; created_at: string }[]>([])
  const [nextAppointment, setNextAppointment] = useState<{ scheduled_at: string; title: string | null; type: string } | null>(null)
  const previousUnreadRef = useRef<number | null>(null)
  const previousAnnouncementIdRef = useRef<number | null>(null)
  const [navLayout, setNavLayout] = useState<{ home: TabKey[]; sidebar: TabKey[] }>({ home: [], sidebar: [] })
  const [showCustomization, setShowCustomization] = useState(false)
  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const [uiPreferences, setUiPreferences] = useState<{
    background_color: string | null
    background_image_path: string | null
    sidebar_color: string | null
    sidebar_position: 'left' | 'right'
    tile_shape: 'square' | 'soft' | 'rounded' | 'pill'
    tile_colors: Record<string, string>
  }>({ background_color: null, background_image_path: null, sidebar_color: null, sidebar_position: 'left', tile_shape: 'rounded', tile_colors: {} })
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)

  const visibleTabs = TILE_SECTIONS
    .filter((section) => !section.seniorOnly || isAboveChirurgien(staff?.role))
    .map((section) => section.key)

  const defaultSidebar = (['agenda', 'recherche', 'messages', 'historique', 'gestion'] as TabKey[])
    .filter((key) => visibleTabs.includes(key))
  const defaultHome = visibleTabs.filter((key) => !defaultSidebar.includes(key))

  const playTone = useCallback((kind: 'message' | 'announcement') => {
    try {
      const ctx = new AudioContext()
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, now)

      if (kind === 'message') {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        osc.connect(gain)
        gain.gain.exponentialRampToValueAtTime(0.60, now + 0.01)
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
      setLatestAnnouncements([])
      setNextAppointment(null)
      return
    }

    const [{ count }, { data: announcements }, { data: appointment }] = await Promise.all([
      supabase
        .from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null),
      supabase
        .from('internal_announcements')
        .select('id,title,body,created_at')
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('appointments')
        .select('scheduled_at,title,type')
        .eq('staff_id', userId)
        .eq('status', 'prevu')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    const nextUnread = count ?? 0
    const nextAnnouncements = announcements ?? []
    const nextAnnouncement = nextAnnouncements[0] ?? null

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
    setLatestAnnouncements(nextAnnouncements)
    setNextAppointment(appointment ?? null)
  }, [session?.user.id, playTone])

  useEffect(() => {
    refreshSidebarData()
    const timer = window.setInterval(refreshSidebarData, 5000)
    return () => window.clearInterval(timer)
  }, [refreshSidebarData])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return

    const heartbeat = async () => {
      if (document.visibilityState !== 'visible') return
      const now = new Date().toISOString()
      await supabase.from('user_presence').upsert(
        { staff_id: userId, last_seen_at: now, updated_at: now },
        { onConflict: 'staff_id' },
      )
    }

    heartbeat()
    const timer = window.setInterval(heartbeat, 30000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') heartbeat()
    }

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [session?.user.id])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return

    supabase
      .from('user_ui_preferences')
      .select('background_color,background_image_path,sidebar_color,sidebar_position,tile_shape,tile_colors')
      .eq('staff_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setUiPreferences({
          background_color: data.background_color ?? null,
          background_image_path: data.background_image_path ?? null,
          sidebar_color: data.sidebar_color ?? null,
          sidebar_position: (data.sidebar_position ?? 'left') as 'left' | 'right',
          tile_shape: (data.tile_shape ?? 'rounded') as 'square' | 'soft' | 'rounded' | 'pill',
          tile_colors: (data.tile_colors ?? {}) as Record<string, string>,
        })
      })
  }, [session?.user.id])

  useEffect(() => {
    let active = true

    async function loadBackground() {
      if (!uiPreferences.background_image_path) {
        setBackgroundImageUrl(null)
        return
      }

      const { data } = await supabase.storage
        .from('user-backgrounds')
        .createSignedUrl(uiPreferences.background_image_path, 3600)

      if (active) setBackgroundImageUrl(data?.signedUrl ?? null)
    }

    loadBackground()
    return () => {
      active = false
    }
  }, [uiPreferences.background_image_path])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId || visibleTabs.length === 0) return

    supabase
      .from('user_nav_layout')
      .select('tab_key,zone,position')
      .eq('staff_id', userId)
      .order('position')
      .then(({ data }) => {
        const rows = data ?? []
        if (rows.length === 0) {
          setNavLayout({ home: defaultHome, sidebar: defaultSidebar })
          void supabase.from('user_nav_layout').upsert([
            ...defaultHome.map((tab_key, position) => ({ staff_id: userId, tab_key, zone: 'home', position })),
            ...defaultSidebar.map((tab_key, position) => ({ staff_id: userId, tab_key, zone: 'sidebar', position })),
          ])
          return
        }

        const savedHome = rows
          .filter((row) => row.zone === 'home' && visibleTabs.includes(row.tab_key as TabKey))
          .map((row) => row.tab_key as TabKey)
        const savedSidebar = rows
          .filter((row) => row.zone === 'sidebar' && visibleTabs.includes(row.tab_key as TabKey))
          .map((row) => row.tab_key as TabKey)
        const known = new Set([...savedHome, ...savedSidebar])
        const missing = visibleTabs.filter((key) => !known.has(key))
        setNavLayout({ home: [...savedHome, ...missing], sidebar: savedSidebar })
      })
  }, [session?.user.id, staff?.role])

  async function persistNavLayout(next: { home: TabKey[]; sidebar: TabKey[] }) {
    const userId = session?.user.id
    if (!userId) return

    await supabase.from('user_nav_layout').upsert([
      ...next.home.map((tab_key, position) => ({
        staff_id: userId,
        tab_key,
        zone: 'home',
        position,
        updated_at: new Date().toISOString(),
      })),
      ...next.sidebar.map((tab_key, position) => ({
        staff_id: userId,
        tab_key,
        zone: 'sidebar',
        position,
        updated_at: new Date().toISOString(),
      })),
    ])
  }

  function moveNavItem(key: TabKey, zone: 'home' | 'sidebar', target?: TabKey) {
    if (!visibleTabs.includes(key)) return

    setNavLayout((current) => {
      const home = current.home.filter((item) => item !== key)
      const sidebar = current.sidebar.filter((item) => item !== key)
      const destination = zone === 'home' ? home : sidebar

      let index = target ? destination.indexOf(target) : -1
      if (index < 0) index = destination.length
      destination.splice(index, 0, key)

      const next = { home, sidebar }
      void persistNavLayout(next)
      return next
    })
  }

  function readDraggedTab(event: DragEvent): TabKey | null {
    const key = event.dataTransfer.getData('application/x-ems-tab') || event.dataTransfer.getData('text/plain')
    return visibleTabs.includes(key as TabKey) ? (key as TabKey) : null
  }

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

  const effectiveView = view !== 'home' && !visibleTabs.includes(view) ? 'home' : view
  const activeSection = effectiveView === 'home' ? null : TILE_SECTIONS.find((s) => s.key === effectiveView) ?? null

  return (
    <div
      className={cn('bg-[var(--bg)]', effectiveView === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen')}
      style={{
        backgroundColor: uiPreferences.background_color ?? undefined,
        backgroundImage: backgroundImageUrl ? `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.18)), url("${backgroundImageUrl}")` : undefined,
        backgroundSize: backgroundImageUrl ? 'cover' : undefined,
        backgroundPosition: backgroundImageUrl ? 'center' : undefined,
        backgroundAttachment: backgroundImageUrl ? 'fixed' : undefined,
      }}
    >
      <aside
        className={cn(
          'hidden md:flex fixed inset-y-0 z-40 w-20 flex-col items-center py-4 gap-3 overflow-hidden',
          uiPreferences.sidebar_position === 'right'
            ? 'right-0 border-l border-[var(--ink)]/8'
            : 'left-0 border-r border-[var(--ink)]/8',
        )}
        style={{ backgroundColor: uiPreferences.sidebar_color ?? 'var(--sidebar-bg)' }}
      >
        <img src={logo} alt="EMS" className="w-10 h-10 rounded-full object-cover" />

        <CodeBlancAlertButton />
        <CodeRougeAlertButton />
        <StockAlertButton compact />

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

        <div
          className="flex flex-col items-center gap-1.5 min-h-12 w-full px-2"
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(event) => {
            event.preventDefault()
            const key = readDraggedTab(event)
            if (key) moveNavItem(key, 'sidebar')
          }}
        >
          {navLayout.sidebar.map((key) => {
            const section = TILE_SECTIONS.find((item) => item.key === key)
            if (!section) return null
            const Icon = section.icon

            return (
              <button
                key={key}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('application/x-ems-tab', key)
                  event.dataTransfer.setData('text/plain', key)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  const dragged = readDraggedTab(event)
                  if (dragged) moveNavItem(dragged, 'sidebar', key)
                }}
                onClick={() => setView(key)}
                aria-label={section.label}
                title={section.label}
                className={cn(
                  'relative w-10 h-10 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors shrink-0',
                  effectiveView === key ? 'bg-red text-white' : 'text-[var(--ink)]/75 hover:text-white',
                )}
                style={effectiveView === key ? undefined : { background: uiPreferences.tile_colors[key] ?? 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
              >
                <Icon size={17} />
                {key === 'messages' && unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--sidebar-bg)]">
                    +{unreadMessages}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-1.5">
          {nextAppointment && navLayout.sidebar.includes('agenda') && (
            <button
              type="button"
              onClick={() => setView('agenda')}
              className="w-12 rounded-xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.04] px-1 py-1.5 text-center hover:bg-[var(--ink)]/[0.08] transition-colors cursor-pointer"
              title={`Prochain rendez-vous : ${new Date(nextAppointment.scheduled_at).toLocaleString('fr-FR')} — ${nextAppointment.title || nextAppointment.type}`}
              aria-label="Voir mon prochain rendez-vous"
            >
              <span className="block text-[9px] uppercase tracking-wide text-[var(--ink)]/35">RDV</span>
              <span className="block text-[11px] font-bold text-[var(--ink)] leading-tight">
                {new Date(nextAppointment.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="block text-[9px] text-[var(--ink)]/45 leading-tight mt-0.5">
                {new Date(nextAppointment.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          )}

          {staff.avatar_url ? (
            <img src={staff.avatar_url} alt="" className="w-9 h-9 rounded-full border border-[var(--ink)]/15" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--ink)]/10 border border-[var(--ink)]/15" />
          )}
        </div>

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
        <button
          type="button"
          onClick={() => setShowCustomization(true)}
          aria-label="Personnaliser l’interface"
          title="Personnaliser l’interface"
          className="w-10 h-10 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer"
        >
          <Palette size={17} />
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

      <div className="md:hidden fixed top-3 right-3 z-50 flex items-center gap-2">
        <CodeBlancAlertButton />
        <CodeRougeAlertButton />
        <StockAlertButton compact />
      </div>

      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-[var(--ink)]/10 backdrop-blur-xl px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
        style={{ backgroundColor: uiPreferences.sidebar_color ?? 'var(--sidebar-bg)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {[
            { key: 'home' as const, label: 'Accueil', icon: LayoutGrid },
            { key: 'agenda' as const, label: 'Agenda', icon: CalendarClock },
            { key: 'messages' as const, label: 'Messages', icon: MessageCircle },
            { key: 'recherche' as const, label: 'Recherche', icon: Search },
          ].map((item) => {
            const Icon = item.icon
            const active = effectiveView === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={cn(
                  'relative min-w-[64px] rounded-xl px-2 py-2 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer',
                  active ? 'bg-red text-white' : 'text-[var(--ink)]/55 hover:bg-[var(--ink)]/5',
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.key === 'messages' && unreadMessages > 0 && (
                  <span className="absolute right-1 top-0 min-w-4 h-4 px-1 rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center border border-[var(--sidebar-bg)]">
                    +{unreadMessages}
                  </span>
                )}
              </button>
            )
          })}
          {isAboveChirurgien(staff.role) && (
            <button
              type="button"
              onClick={() => setView('gestion')}
              className={cn(
                'min-w-[64px] rounded-xl px-2 py-2 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer',
                effectiveView === 'gestion' ? 'bg-red text-white' : 'text-[var(--ink)]/55 hover:bg-[var(--ink)]/5',
              )}
            >
              <ShieldCheck size={18} />
              <span>Gestion</span>
            </button>
          )}
        </div>
      </nav>

      <main
        className={cn(
          'min-w-0 px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8 pb-24 md:pb-8 flex flex-col gap-4 sm:gap-6',
          uiPreferences.sidebar_position === 'right' ? 'md:mr-20' : 'md:ml-20',
          effectiveView === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen',
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
              className="flex flex-col gap-6 w-full"
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
              <div className="rounded-2xl border border-red/20 bg-red/10 px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-red/15 text-red-300 flex items-center justify-center shrink-0">
                    <Megaphone size={17} />
                  </span>
                  <div>
                    <p className="text-[var(--ink)] font-bold text-sm">Annonces EMS</p>
                    <p className="text-[var(--ink)]/40 text-xs">Les dernières informations de la direction</p>
                  </div>
                </div>

                {latestAnnouncements.length > 0 ? (
                  <div className="grid gap-2">
                    {latestAnnouncements.map((announcement) => (
                      <div key={announcement.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--bg)]/55 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[var(--ink)] font-semibold text-sm">{announcement.title}</p>
                          <span className="text-[var(--ink)]/30 text-[10px] shrink-0">
                            {new Date(announcement.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[var(--ink)]/60 text-sm mt-1 whitespace-pre-wrap line-clamp-3">{announcement.body}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--ink)]/35 text-sm">Aucune annonce EMS pour le moment.</p>
                )}
              </div>
              <HomeTiles
                keys={navLayout.home}
                onSelect={(key) => setView(key)}
                onMove={moveNavItem}
                nextAppointment={nextAppointment}
                tileColors={uiPreferences.tile_colors}
                tileShape={uiPreferences.tile_shape}
                editMode={layoutEditMode}
                onFinishEdit={() => {
                  setLayoutEditMode(false)
                  setShowCustomization(true)
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={effectiveView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'flex flex-col gap-6 max-w-5xl w-full mx-auto',
                effectiveView === 'messages' && 'h-full min-h-0 overflow-hidden',
              )}
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

      {showCustomization && (
        <CustomizationPanel
          staffId={staff.id}
          visibleTabs={visibleTabs}
          initial={uiPreferences}
          onClose={() => setShowCustomization(false)}
          onEditLayout={() => {
            setShowCustomization(false)
            setView('home')
            setLayoutEditMode(true)
          }}
          onSaved={(next) => {
            setUiPreferences(next)
            setShowCustomization(false)
          }}
        />
      )}
    </div>
  )
}
