import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, CheckCheck, LayoutGrid, LogOut, Megaphone, MessageCircle, PackageOpen, Palette, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { displayRoleLabel, isAboveChirurgien, staffMatchesEligibility, supabase, type StaffRole } from '@/lib/supabase'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/Button'
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
import { RecruitmentRequestsTab } from './app/RecruitmentRequestsTab'
import { VisitorAppointmentsTab } from './app/VisitorAppointmentsTab'
import { ProfessionalMessagesTab } from './app/ProfessionalMessagesTab'
import { LspdTransferTab } from './app/LspdTransferTab'

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
  visitor_rdv: <VisitorAppointmentsTab />,
  candidatures: <RecruitmentRequestsTab />,
  professional_messages: <ProfessionalMessagesTab />,
  lspd_transfer: <LspdTransferTab />,
}

const VIEW_STORAGE_KEY = 'ems-dashboard-view'
// Deployment refresh marker: 2026-10-03

function getStoredView(): TabKey | 'home' {
  if (typeof window === 'undefined') return 'home'
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
  return (stored as TabKey | 'home') || 'home'
}

export function Dashboard() {
  const navigate = useNavigate()
  const { staff, session, signOut, signInWithDiscord } = useAuth()
  const [view, setViewState] = useState<TabKey | 'home'>(getStoredView)
  const [resyncing, setResyncing] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationSeenAt, setNotificationSeenAt] = useState(() => window.localStorage.getItem('ems-notifications-seen-at') ?? '')
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('ems-notifications-dismissed') ?? '[]') }
    catch { return [] }
  })
  const notificationTouchStart = useRef<Record<string, number>>({})
  const [recentMessages, setRecentMessages] = useState<Array<{ id:number; sender_id:string; sender_name:string; body:string; media_type:string|null; created_at:string }>>([])
  const [recentStockAlerts, setRecentStockAlerts] = useState<Array<{ id:number; item_key:string; quantity_remaining:number|null; note:string|null; created_at:string }>>([])
  const [recentLspdMessages, setRecentLspdMessages] = useState<Array<{ id:string; sender_display_name:string|null; body:string|null; created_at:string; files?: unknown[] }>>([])
  const [recentCriminalRecordReplies, setRecentCriminalRecordReplies] = useState<Array<{ id:string; subject_first_name:string|null; subject_last_name:string|null; created_at:string }>>([])
  const [latestAnnouncements, setLatestAnnouncements] = useState<{ id: number; title: string; body: string; created_at: string }[]>([])
  const [nextAppointment, setNextAppointment] = useState<{ scheduled_at: string; title: string | null; type: string } | null>(null)
  const [acceptedAnnouncementIds, setAcceptedAnnouncementIds] = useState<number[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('ems-announcements-accepted') ?? '[]') }
    catch { return [] }
  })
  const previousUnreadRef = useRef<number | null>(null)
  const previousAnnouncementIdRef = useRef<number | null>(null)
  const [navLayout, setNavLayout] = useState<{ home: TabKey[]; sidebar: TabKey[] }>({ home: [], sidebar: [] })
  const [showCustomization, setShowCustomization] = useState(false)
  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const [layoutResetNonce, setLayoutResetNonce] = useState(0)
  const [uiPreferences, setUiPreferences] = useState<{
    background_color: string | null
    background_image_path: string | null
    background_image_opacity: number
    background_position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    sidebar_color: string | null
    sidebar_position: 'left' | 'right' | 'top' | 'bottom'
    tile_shape: 'square' | 'soft' | 'rounded' | 'pill'
    tile_opacity: number
    tile_images: Record<string, string>
    tile_colors: Record<string, string>
  }>({ background_color: null, background_image_path: null, background_image_opacity: 100, background_position: 'center', sidebar_color: null, sidebar_position: 'left', tile_shape: 'rounded', tile_opacity: 100, tile_images: {}, tile_colors: {} })
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [visitorSubjectRules, setVisitorSubjectRules] = useState<Array<{
    request_type: 'question' | 'recrutement' | 'rendez_vous'
    grade: StaffRole[] | null
    sous_grade_id: string | null
    affiliation_id: string | null
  }>>([])

  const canHandleVisitorRdv = !!staff && visitorSubjectRules.some(
    (rule) =>
      (rule.request_type === 'question' || rule.request_type === 'rendez_vous')
      && staffMatchesEligibility(staff, rule),
  )

  const canHandleRecruitment = !!staff && visitorSubjectRules.some(
    (rule) =>
      rule.request_type === 'recrutement'
      && staffMatchesEligibility(staff, rule),
  )

  const visibleTabs = TILE_SECTIONS
    .filter((section) => {
      if (section.key === 'candidatures') return canHandleRecruitment
      if (section.key === 'visitor_rdv' || section.key === 'professional_messages') return canHandleVisitorRdv
      return !section.seniorOnly || isAboveChirurgien(staff?.role)
    })
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

    const [{ count }, { data: announcements }, { data: appointment }, { data: messageRows }, { data: stockRows }] = await Promise.all([
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
      supabase
        .from('internal_messages')
        .select('id,sender_id,body,media_type,created_at')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('stock_alerts')
        .select('id,item_key,quantity_remaining,note,created_at')
        .order('created_at', { ascending: false })
        .limit(8),
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
    try {
      const { data: { session: bridgeSession } } = await supabase.auth.getSession()
      if (bridgeSession) {
        const response = await fetch('https://pvahrnrtivzbkipborcd.supabase.co/functions/v1/ems-lspd-send', { headers: { Authorization: 'Bearer ' + bridgeSession.access_token } })
        const payload = await response.json()
        if (response.ok) setRecentLspdMessages((payload.items ?? []).filter((item: any) => item.sender_service === 'LSPD').slice(0, 12))
        const recordResponse = await fetch('https://pvahrnrtivzbkipborcd.supabase.co/functions/v1/ems-lspd-send?notifications=1', { headers: { Authorization: 'Bearer ' + bridgeSession.access_token } })
        const recordPayload = await recordResponse.json()
        if (recordResponse.ok) setRecentCriminalRecordReplies((recordPayload.items ?? []).slice(0, 12))
      }
    } catch { /* Le centre continue de fonctionner si la liaison LSPD est temporairement indisponible. */ }
    const senderIds = [...new Set((messageRows ?? []).map((item) => item.sender_id).filter(Boolean))]
    const { data: senders } = senderIds.length
      ? await supabase.from('staff').select('id,full_name').in('id', senderIds)
      : { data: [] as Array<{ id:string; full_name:string }> }
    const senderNames = new Map((senders ?? []).map((sender) => [sender.id, sender.full_name]))
    setRecentMessages((messageRows ?? []).map((item) => ({ ...item, sender_name: senderNames.get(item.sender_id) ?? 'EMS' })) as Array<{ id:number; sender_id:string; sender_name:string; body:string; media_type:string|null; created_at:string }>)
    setRecentStockAlerts((stockRows ?? []) as Array<{ id:number; item_key:string; quantity_remaining:number|null; note:string|null; created_at:string }>)
  }, [session?.user.id, playTone])

  useEffect(() => {
    refreshSidebarData()
    const timer = window.setInterval(refreshSidebarData, 5000)
    return () => window.clearInterval(timer)
  }, [refreshSidebarData])

  useEffect(() => {
    supabase
      .from('visitor_request_subjects')
      .select('request_type,grade,sous_grade_id,affiliation_id')
      .eq('active', true)
      .then(({ data }) => {
        setVisitorSubjectRules((data ?? []) as Array<{
          request_type: 'question' | 'recrutement' | 'rendez_vous'
          grade: StaffRole[] | null
          sous_grade_id: string | null
          affiliation_id: string | null
        }>)
      })
  }, [staff?.id, staff?.role, staff?.sous_grade_ids, staff?.affiliation_ids])

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
      .select('background_color,background_image_path,background_image_opacity,background_position,sidebar_color,sidebar_position,tile_shape,tile_opacity,tile_images,tile_colors')
      .eq('staff_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setUiPreferences({
          background_color: data.background_color ?? null,
          background_image_path: data.background_image_path ?? null,
          background_image_opacity: data.background_image_opacity ?? 100,
          background_position: (data.background_position ?? 'center') as 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
          sidebar_color: data.sidebar_color ?? null,
          sidebar_position: (data.sidebar_position ?? 'left') as 'left' | 'right' | 'top' | 'bottom',
          tile_shape: (data.tile_shape ?? 'rounded') as 'square' | 'soft' | 'rounded' | 'pill',
          tile_opacity: data.tile_opacity ?? 100,
          tile_images: (data.tile_images ?? {}) as Record<string, string>,
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
  }, [session?.user.id, staff?.role, staff?.sous_grade_ids, staff?.affiliation_ids, visitorSubjectRules])

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

  async function handleSignOut() {
    await signOut()
    window.sessionStorage.removeItem('ems-auth-after')
    window.sessionStorage.setItem('ems-public-tab', 'reglement')
    navigate('/', { replace: true })
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

  const allNotificationItems = [
    ...recentLspdMessages.map((item) => ({ id: `lspd-direction-${item.id}`, kind: 'lspd' as const, title: 'Nouveau message — Direction LSPD', detail: item.body || 'Pièce jointe reçue du LSPD', created_at: item.created_at, target: 'lspd_transfer' as TabKey })),
    ...recentCriminalRecordReplies.map((item) => ({ id: `lspd-criminal-record-${item.id}`, kind: 'lspd' as const, title: `Casier judiciaire reçu${item.subject_last_name || item.subject_first_name ? ` — ${[item.subject_last_name, item.subject_first_name].filter(Boolean).join(' ')}` : ''}`, detail: 'Le LSPD a répondu à une demande de casier judiciaire.', created_at: item.created_at, target: 'lspd_transfer' as TabKey })),
    ...recentMessages.map((item) => ({ id: `message-${item.id}`, kind: 'message' as const, title: `Nouveau message — ${item.sender_name}`, detail: item.body || (item.media_type === 'image' ? 'Image reçue' : item.media_type === 'audio' ? 'Message vocal reçu' : 'Nouveau message'), created_at: item.created_at, target: 'messages' as TabKey })),
    ...latestAnnouncements.map((item) => ({ id: `announcement-${item.id}`, kind: 'announcement' as const, title: item.title, detail: item.body, created_at: item.created_at, target: 'messages' as TabKey })),
    ...recentStockAlerts.map((item) => ({ id: `stock-${item.id}`, kind: 'stock' as const, title: 'Alerte stock', detail: `${item.item_key}${item.quantity_remaining != null ? ` — reste ${item.quantity_remaining}` : ''}${item.note ? ` · ${item.note}` : ''}`, created_at: item.created_at, target: 'gestion' as TabKey })),
    ...(nextAppointment ? [{ id: `appointment-${nextAppointment.scheduled_at}`, kind: 'appointment' as const, title: 'Prochain rendez-vous', detail: nextAppointment.title || nextAppointment.type, created_at: nextAppointment.scheduled_at, target: 'agenda' as TabKey }] : []),
  ].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25)
  const notificationItems = allNotificationItems.filter((item) => item.kind === 'announcement' || !dismissedNotifications.includes(item.id))
  const unreadNotifications = notificationItems.filter((item) => !notificationSeenAt || new Date(item.created_at) > new Date(notificationSeenAt)).length
  const pendingAnnouncement = latestAnnouncements.find((item) => !acceptedAnnouncementIds.includes(item.id)) ?? null

  function dismissNotification(id: string) {
    if (id.startsWith('announcement-')) return
    setDismissedNotifications((current) => {
      const next = [...new Set([...current, id])]
      window.localStorage.setItem('ems-notifications-dismissed', JSON.stringify(next))
      return next
    })
  }

  function markAllNotificationsRead() {
    const ids = allNotificationItems.filter((item) => item.kind !== 'announcement').map((item) => item.id)
    setDismissedNotifications((current) => {
      const next = [...new Set([...current, ...ids])]
      window.localStorage.setItem('ems-notifications-dismissed', JSON.stringify(next))
      return next
    })
    const now = new Date().toISOString()
    setNotificationSeenAt(now)
    window.localStorage.setItem('ems-notifications-seen-at', now)
  }

  function openNotifications() {
    setShowNotifications((value) => {
      const next = !value
      if (next) {
        const now = new Date().toISOString()
        setNotificationSeenAt(now)
        window.localStorage.setItem('ems-notifications-seen-at', now)
      }
      return next
    })
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
  const sidebarHorizontal = uiPreferences.sidebar_position === 'top' || uiPreferences.sidebar_position === 'bottom'

  return (
    <div
      className={cn(
        'bg-[var(--bg)]',
        effectiveView === 'home' || ['messages','candidatures','professional_messages','lspd_transfer','gestion'].includes(effectiveView) ? 'h-[100dvh] overflow-hidden' : 'min-h-screen',
      )}
      style={{
        backgroundColor: uiPreferences.background_color ?? undefined,
      }}
    >
      {backgroundImageUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url("${backgroundImageUrl}")`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: uiPreferences.background_position.replace('-', ' '),
            opacity: Math.max(0, Math.min(100, uiPreferences.background_image_opacity)) / 100,
          }}
        />
      )}
      <aside
        className={cn(
          'hidden md:flex fixed z-40 items-center gap-3 overflow-hidden',
          uiPreferences.sidebar_position === 'left' && 'inset-y-0 left-0 w-20 flex-col py-4 border-r border-[var(--ink)]/8',
          uiPreferences.sidebar_position === 'right' && 'inset-y-0 right-0 w-20 flex-col py-4 border-l border-[var(--ink)]/8',
          uiPreferences.sidebar_position === 'top' && 'inset-x-0 top-0 h-20 flex-row px-4 border-b border-[var(--ink)]/8',
          uiPreferences.sidebar_position === 'bottom' && 'inset-x-0 bottom-0 h-20 flex-row px-4 border-t border-[var(--ink)]/8',
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
          className={cn(
            'flex items-center gap-1.5',
            sidebarHorizontal ? 'flex-row min-w-12 h-full py-2' : 'flex-col min-h-12 w-full px-2',
          )}
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

        <div className={cn('flex items-center gap-1.5', sidebarHorizontal ? 'flex-row' : 'flex-col')}>
          <button type="button" onClick={openNotifications} className={cn('relative w-10 h-10 rounded-xl transition-colors flex items-center justify-center cursor-pointer', unreadNotifications > 0 ? 'bg-red/15 text-red ring-2 ring-red/70 animate-pulse shadow-[0_0_16px_rgba(239,68,68,0.55)]' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]')} title="Centre de notifications" aria-label="Centre de notifications">
            <Bell size={17} />
            {unreadNotifications > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--sidebar-bg)]">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
          </button>
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
          onClick={() => void handleSignOut()}
          aria-label="Déconnexion"
          className="w-10 h-10 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer"
        >
          <LogOut size={17} />
        </button>
      </aside>

      <div className="md:hidden fixed top-[max(0.65rem,env(safe-area-inset-top))] right-3 z-50 flex items-center gap-1.5 rounded-2xl border border-[var(--ink)]/8 bg-[var(--sidebar-bg)]/90 p-1.5 shadow-lg backdrop-blur-xl">
        <CodeBlancAlertButton />
        <CodeRougeAlertButton />
        <StockAlertButton compact />
        <button type="button" onClick={openNotifications} className={cn('relative w-10 h-10 rounded-xl flex items-center justify-center', unreadNotifications > 0 ? 'bg-red/15 text-red ring-2 ring-red/70 animate-pulse shadow-[0_0_16px_rgba(239,68,68,0.55)]' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60')} aria-label="Centre de notifications"><Bell size={17}/>{unreadNotifications > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</button>
      </div>

      <nav
        className="md:hidden fixed inset-x-2 bottom-2 z-50 rounded-2xl border border-[var(--ink)]/10 backdrop-blur-xl px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-2xl"
        style={{ backgroundColor: uiPreferences.sidebar_color ?? 'var(--sidebar-bg)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around gap-0.5">
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
                  'relative min-w-0 flex-1 rounded-xl px-1.5 py-2 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer',
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
                'min-w-0 flex-1 rounded-xl px-1.5 py-2 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer',
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
          'relative z-10 min-h-0',
          'min-w-0 px-3 pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] sm:px-5 sm:pt-6 md:px-8 md:py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8 flex flex-col gap-4 sm:gap-6',
          uiPreferences.sidebar_position === 'right' && 'md:mr-20',
          uiPreferences.sidebar_position === 'left' && 'md:ml-20',
          uiPreferences.sidebar_position === 'top' && 'md:mt-20',
          uiPreferences.sidebar_position === 'bottom' && 'md:mb-20',
          effectiveView === 'home'
            ? sidebarHorizontal
              ? 'h-[calc(100vh-5rem)] overflow-hidden'
              : 'h-[100dvh] overflow-hidden'
            : ['messages','candidatures','professional_messages','lspd_transfer','gestion'].includes(effectiveView)
              ? sidebarHorizontal
                ? 'h-[calc(100vh-5rem)] overflow-hidden'
                : 'h-[100dvh] overflow-hidden'
              : 'min-h-screen',
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
              className="flex flex-col gap-3 sm:gap-6 w-full h-full min-h-0 overflow-y-auto md:overflow-hidden"
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
              {false && latestAnnouncements.length > 0 && (
                <div className="rounded-2xl border border-red/20 bg-red/10 px-3 py-2.5 sm:px-4 sm:py-3 shrink-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-9 h-9 rounded-xl bg-red/15 text-red-300 flex items-center justify-center shrink-0">
                      <Megaphone size={17} />
                    </span>
                    <div>
                      <p className="text-[var(--ink)] font-bold text-sm">Annonces EMS</p>
                      <p className="text-[var(--ink)]/40 text-xs">Les dernières informations de la direction</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {latestAnnouncements.slice(0, 1).map((announcement) => (
                      <div key={announcement.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--bg)]/55 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[var(--ink)] font-semibold text-sm">{announcement.title}</p>
                          <span className="text-[var(--ink)]/30 text-[10px] shrink-0">
                            {new Date(announcement.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[var(--ink)]/60 text-xs sm:text-sm mt-1 whitespace-pre-wrap line-clamp-2 sm:line-clamp-3">{announcement.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <HomeTiles
                keys={navLayout.home}
                onSelect={(key) => setView(key)}
                onMove={moveNavItem}
                nextAppointment={nextAppointment}
                tileColors={uiPreferences.tile_colors}
                tileShape={uiPreferences.tile_shape}
                tileOpacity={uiPreferences.tile_opacity}
                tileImages={uiPreferences.tile_images}
                editMode={layoutEditMode}
                resetNonce={layoutResetNonce}
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
                'flex flex-col gap-4 sm:gap-6 max-w-5xl w-full mx-auto min-w-0 flex-1',
                (effectiveView === 'messages' || effectiveView === 'candidatures' || effectiveView === 'professional_messages' || effectiveView === 'lspd_transfer' || effectiveView === 'gestion') && 'h-full min-h-0 overflow-hidden gap-2 sm:gap-3',
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
              <div className={cn((effectiveView === 'messages' || effectiveView === 'candidatures' || effectiveView === 'professional_messages' || effectiveView === 'lspd_transfer' || effectiveView === 'gestion') && 'flex-1 min-h-0 overflow-hidden')}>
                {effectiveView === 'dossier' ? <DossierTraumatoTab /> : TAB_CONTENT[effectiveView]}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {pendingAnnouncement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-red-950/20 backdrop-blur-lg" />
          <div className="absolute inset-0 bg-gradient-to-br from-red/10 via-transparent to-red/10 pointer-events-none" />
          <section className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-red/50 bg-[linear-gradient(145deg,rgba(127,29,29,0.96),rgba(69,10,10,0.97))] shadow-[0_0_45px_rgba(239,68,68,0.38),0_24px_80px_rgba(0,0,0,0.55)] p-6 sm:p-8 before:absolute before:inset-0 before:rounded-3xl before:border before:border-white/10 before:pointer-events-none animate-[pulse_2.8s_ease-in-out_infinite]">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl border border-white/15 bg-white/10 text-white flex items-center justify-center mb-5 shadow-[0_0_24px_rgba(255,255,255,0.10)]"><Megaphone size={26}/></div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200 mb-2">Annonce EMS</p>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white">{pendingAnnouncement.title}</h2>
              <p className="text-white/45 text-xs mt-2">{new Date(pendingAnnouncement.created_at).toLocaleString('fr-FR')}</p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 backdrop-blur-sm p-4 sm:p-5">
                <p className="text-sm sm:text-base text-white/85 whitespace-pre-wrap leading-relaxed">{pendingAnnouncement.body}</p>
              </div>
              <Button className="w-full mt-6 !bg-white !text-red-800 hover:!bg-red-50 shadow-lg" onClick={() => {
              setAcceptedAnnouncementIds((current) => {
                const next=[...new Set([...current,pendingAnnouncement.id])]
                window.localStorage.setItem('ems-announcements-accepted',JSON.stringify(next))
                return next
              })
              }}>J’ai lu et j’accepte</Button>
              <p className="text-center text-[10px] text-white/40 mt-3">Cette annonce restera disponible dans le centre de notifications.</p>
            </div>
          </section>
        </div>
      )}

      {showNotifications && (
        <div className="fixed inset-0 z-[80]" onClick={() => setShowNotifications(false)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <section onClick={(event) => event.stopPropagation()} className="absolute right-3 top-3 bottom-3 w-[min(430px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--ink)]/10 bg-[var(--sidebar-bg)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/10 p-4">
              <div><h2 className="font-bold text-[var(--ink)]">Notifications</h2><p className="text-xs text-[var(--ink)]/45">Messages EMS/LSPD, annonces, rendez-vous et alertes stock</p></div>
              <div className="flex items-center gap-2">
                {notificationItems.length > 0 && <button type="button" onClick={markAllNotificationsRead} className="rounded-xl px-3 py-2 text-xs font-semibold bg-red/10 text-red hover:bg-red/15 flex items-center gap-1.5"><CheckCheck size={14}/>Tout marquer comme lu</button>}
                <button type="button" onClick={() => setShowNotifications(false)} className="rounded-xl px-3 py-2 text-xs font-semibold bg-[var(--ink)]/5 hover:bg-[var(--ink)]/10">Fermer</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {notificationItems.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center text-[var(--ink)]/40"><Bell size={30} className="mb-3"/><p className="font-semibold">Aucune notification</p></div> : notificationItems.map((item) => {
                const Icon = item.kind === 'message' || item.kind === 'lspd' ? MessageCircle : item.kind === 'announcement' ? Megaphone : item.kind === 'appointment' ? CalendarClock : PackageOpen
                return <div key={item.id} className="relative group" onTouchStart={(event) => { notificationTouchStart.current[item.id] = event.touches[0]?.clientX ?? 0 }} onTouchEnd={(event) => { const start = notificationTouchStart.current[item.id] ?? 0; const end = event.changedTouches[0]?.clientX ?? start; if (start - end > 70) dismissNotification(item.id) }}>
                  <button type="button" onClick={() => { setShowNotifications(false); setView(item.target) }} className="w-full rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.035] p-3 pr-11 text-left hover:bg-[var(--ink)]/[0.07] transition-colors">
                  <div className="flex gap-3"><span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-red/10 text-red flex items-center justify-center"><Icon size={16}/></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-sm font-semibold text-[var(--ink)] truncate">{item.title}</p><span className="text-[10px] text-[var(--ink)]/35 shrink-0">{new Date(item.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span></div><p className="mt-1 text-xs text-[var(--ink)]/55 line-clamp-2 whitespace-pre-wrap">{item.detail}</p></div></div>
                  </button>
                  {item.kind !== 'announcement' && <button type="button" onClick={() => dismissNotification(item.id)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink)]/35 hover:bg-red/10 hover:text-red opacity-60 group-hover:opacity-100 transition" title="Supprimer la notification" aria-label="Supprimer la notification"><Trash2 size={15}/></button>}
                </div>
              })}
            </div>
          </section>
        </div>
      )}

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
          onResetLayout={async () => {
            await supabase.from('user_home_tile_geometry').delete().eq('staff_id', staff.id)
            setLayoutResetNonce((value) => value + 1)
          }}
          onSaved={(next) => {
            setUiPreferences(next)
          }}
        />
      )}
    </div>
  )
}
