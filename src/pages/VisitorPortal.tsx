import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, FileText, HeartHandshake, History, LogIn, MessageCircle, Send, Stethoscope, UserRoundPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import logo from '@/assets/logo.webp'

type PortalTab = 'reglement' | 'contact' | 'recrutement' | 'rendez_vous' | 'suivi'

type SiteSettings = {
  hero_title: string
  hero_subtitle: string
  contact_title: string
  contact_text: string
  hero_image_path: string | null
  background_image_path: string | null
  background_position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  background_opacity: number
  hero_image_position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  show_reglement: boolean
  show_contact: boolean
  show_recrutement: boolean
  show_rendez_vous: boolean
  show_suivi: boolean
}

type SubjectRow = {
  id: number
  request_type: 'question' | 'recrutement' | 'rendez_vous'
  label: string
}

type TicketCredential = {
  public_id: string
  access_token: string
}

type ThreadData = {
  request: {
    public_id: string
    request_type: 'question' | 'recrutement' | 'rendez_vous'
    subject: string
    message: string
    status: string
    preferred_at: string | null
    created_at: string
    updated_at: string
  }
  messages: Array<{
    id: number
    sender: 'visiteur' | 'ems'
    body: string
    created_at: string
  }>
}

type RequestForm = {
  fullName: string
  contact: string
  subject: string
  message: string
  preferredAt: string
}

const EMPTY_FORM: RequestForm = {
  fullName: '',
  contact: '',
  subject: '',
  message: '',
  preferredAt: '',
}

export function VisitorPortal() {
  const navigate = useNavigate()
  const { session, staff, signInVisitorWithDiscord, signOut } = useAuth()
  const [tab, setTab] = useState<PortalTab>(() => {
    if (typeof window === 'undefined') return 'reglement'
    const saved = window.sessionStorage.getItem('ems-public-tab') as PortalTab | null
    return saved && ['reglement', 'contact', 'recrutement', 'rendez_vous', 'suivi'].includes(saved) ? saved : 'reglement'
  })
  const [reglement, setReglement] = useState('Chargement du règlement…')
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM)
  const [sending, setSending] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [threads, setThreads] = useState<Array<{ credential: TicketCredential; data: ThreadData }>>([])
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({})
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)

  const metadata = (session?.user.user_metadata ?? {}) as Record<string, unknown>
  const discordId = String(metadata.provider_id ?? metadata.sub ?? '')
  const discordName = String(metadata.full_name ?? metadata.name ?? metadata.user_name ?? '')
  const discordAvatar = String(metadata.avatar_url ?? metadata.picture ?? '')

  useEffect(() => {
    supabase
      .from('public_site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const settings = data as SiteSettings
        setSiteSettings(settings)
        setHeroImageUrl(settings.hero_image_path ? supabase.storage.from('public-site-assets').getPublicUrl(settings.hero_image_path).data.publicUrl : null)
        setBackgroundImageUrl(settings.background_image_path ? supabase.storage.from('public-site-assets').getPublicUrl(settings.background_image_path).data.publicUrl : null)
      })

    supabase
      .from('public_portal_content')
      .select('body')
      .eq('key', 'reglement')
      .maybeSingle()
      .then(({ data }) => setReglement(data?.body || 'Le règlement EMS sera bientôt disponible.'))

    supabase
      .from('visitor_request_subjects')
      .select('id,request_type,label')
      .eq('active', true)
      .order('request_type')
      .order('position')
      .then(({ data }) => setSubjects((data ?? []) as SubjectRow[]))
  }, [])

  useEffect(() => {
    const requestType = tab === 'contact' ? 'question' : tab === 'recrutement' ? 'recrutement' : tab === 'rendez_vous' ? 'rendez_vous' : null
    if (!requestType) return
    const available = subjects.filter((subject) => subject.request_type === requestType)
    setSubjectId((current) => available.some((subject) => subject.id === current) ? current : available[0]?.id ?? null)
  }, [tab, subjects])

  useEffect(() => {
    if ((tab === 'contact' || tab === 'recrutement') && session && discordName) {
      setForm((current) => ({
        ...current,
        fullName: current.fullName || discordName,
        contact: current.contact || `Discord · ${discordName}`,
        subject: current.subject || (tab === 'recrutement' ? 'Candidature EMS' : ''),
      }))
    }
  }, [tab, session, discordName])

  const tabs = useMemo(
    () => [
      siteSettings?.show_reglement !== false ? { key: 'reglement' as const, label: 'Règlement', icon: FileText } : null,
      siteSettings?.show_contact !== false ? { key: 'contact' as const, label: 'Nous contacter', icon: MessageCircle } : null,
      siteSettings?.show_recrutement !== false ? { key: 'recrutement' as const, label: 'Recrutement', icon: UserRoundPlus } : null,
      siteSettings?.show_rendez_vous !== false ? { key: 'rendez_vous' as const, label: 'Rendez-vous', icon: CalendarClock } : null,
      siteSettings?.show_suivi !== false ? { key: 'suivi' as const, label: 'Mes demandes', icon: History } : null,
    ].filter(Boolean) as Array<{ key: PortalTab; label: string; icon: typeof FileText }>,
    [siteSettings],
  )

  async function connectDiscord(target: 'contact' | 'recrutement') {
    setConnecting(true)
    setError(null)
    window.sessionStorage.setItem('ems-public-tab', target)
    await signInVisitorWithDiscord()
    setConnecting(false)
  }

  function readTicketCredentials(): TicketCredential[] {
    try {
      const value = JSON.parse(window.localStorage.getItem('ems-visitor-tickets') || '[]')
      return Array.isArray(value) ? value.filter((item) => item?.public_id && item?.access_token) : []
    } catch {
      return []
    }
  }

  function saveTicketCredential(credential: TicketCredential) {
    const current = readTicketCredentials().filter((item) => item.public_id !== credential.public_id)
    window.localStorage.setItem('ems-visitor-tickets', JSON.stringify([credential, ...current].slice(0, 30)))
  }

  async function loadThreads() {
    const credentials = readTicketCredentials()
    const rows = await Promise.all(
      credentials.map(async (credential) => {
        const { data } = await supabase.rpc('get_visitor_request_thread', {
          p_public_id: credential.public_id,
          p_access_token: credential.access_token,
        })
        return data ? { credential, data: data as ThreadData } : null
      }),
    )
    setThreads(rows.filter(Boolean) as Array<{ credential: TicketCredential; data: ThreadData }>)
  }

  async function sendTrackingReply(item: { credential: TicketCredential; data: ThreadData }) {
    const body = (replyByTicket[item.credential.public_id] ?? '').trim()
    if (!body) return
    const { error: replyError } = await supabase.rpc('reply_visitor_request', {
      p_public_id: item.credential.public_id,
      p_access_token: item.credential.access_token,
      p_body: body,
    })
    if (replyError) {
      setError(replyError.message)
      return
    }
    setReplyByTicket((current) => ({ ...current, [item.credential.public_id]: '' }))
    await loadThreads()
  }

  useEffect(() => {
    if (tab !== 'suivi') return
    void loadThreads()
    const timer = window.setInterval(() => void loadThreads(), 10000)
    return () => window.clearInterval(timer)
  }, [tab])

  async function submit(type: 'question' | 'recrutement' | 'rendez_vous') {
    setError(null)
    setSuccess(null)

    if ((type === 'question' || type === 'recrutement') && (!session || !discordId)) {
      setError(type === 'recrutement'
        ? 'Connecte ton compte Discord pour envoyer une candidature.'
        : 'Connecte ton compte Discord pour nous contacter.')
      return
    }

    const needsDiscord = type === 'question' || type === 'recrutement'
    const fullName = (needsDiscord ? discordName || form.fullName : form.fullName).trim()
    if (fullName.length < 2) {
      setError('Indique ton nom.')
      return
    }
    if (!subjectId || !form.message.trim()) {
      setError('L’objet et le message sont nécessaires.')
      return
    }

    const selectedSubject = subjects.find((subject) => subject.id === subjectId)
    if (!selectedSubject) {
      setError('Sélectionne un objet valide.')
      return
    }

    setSending(true)
    const { data, error: rpcError } = await supabase.rpc('submit_visitor_request', {
      p_type: type,
      p_full_name: fullName,
      p_contact: form.contact.trim(),
      p_subject: selectedSubject.label,
      p_message: form.message.trim(),
      p_preferred_at: form.preferredAt ? new Date(form.preferredAt).toISOString() : null,
      p_discord_id: needsDiscord ? discordId : null,
      p_discord_username: needsDiscord ? discordName : null,
      p_discord_avatar_url: needsDiscord ? discordAvatar : null,
      p_metadata: {},
      p_subject_id: subjectId,
    })
    setSending(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const publicId = data?.[0]?.public_id ? String(data[0].public_id) : null
    const accessToken = data?.[0]?.access_token ? String(data[0].access_token) : null
    if (publicId && accessToken) saveTicketCredential({ public_id: publicId, access_token: accessToken })

    const ticket = publicId ? publicId.slice(0, 8).toUpperCase() : null
    setSuccess(ticket ? `Demande envoyée · Référence ${ticket}` : 'Demande envoyée à l’EMS.')
    setForm(EMPTY_FORM)
    window.sessionStorage.setItem('ems-public-tab', tab)
  }

  const requestType = tab === 'contact' ? 'question' : tab === 'recrutement' ? 'recrutement' : 'rendez_vous'

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      {backgroundImageUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url("${backgroundImageUrl}")`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: (siteSettings?.background_position ?? 'center').replace('-', ' '),
            opacity: Math.max(0, Math.min(100, siteSettings?.background_opacity ?? 100)) / 100,
          }}
        />
      )}
      <header className="sticky top-0 z-40 border-b border-[var(--ink)]/8 bg-[var(--bg)]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center gap-4">
          <img src={logo} alt="EMS" className="w-11 h-11 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="font-display font-black text-lg text-neon-red">EMS Los Santos</p>
            <p className="text-[var(--ink)]/40 text-xs">Espace public · informations, contact et recrutement</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {staff ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>Ouvrir le panel</Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => navigate('/login')}>
                <LogIn size={14} /> Connexion EMS
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-6 items-stretch mb-8">
          <Card className="p-0 overflow-hidden flex flex-col justify-center">
            {heroImageUrl && (
              <div
                className="h-48 sm:h-56 w-full bg-cover bg-no-repeat"
                style={{ backgroundImage: `url("${heroImageUrl}")`, backgroundPosition: (siteSettings?.hero_image_position ?? 'center').replace('-', ' ') }}
              />
            )}
            <div className="p-7 sm:p-9">
              <div className="w-12 h-12 rounded-2xl bg-red/12 text-red-300 flex items-center justify-center mb-5">
                <Stethoscope size={22} />
              </div>
              <h1 className="font-display font-black text-3xl sm:text-4xl leading-tight">
                {siteSettings?.hero_title ?? 'Bienvenue sur l’espace public EMS'}
              </h1>
              <p className="text-[var(--ink)]/55 mt-4 max-w-2xl leading-relaxed">
                {siteSettings?.hero_subtitle ?? 'Consulte le règlement, pose une question, dépose une candidature ou demande un rendez-vous directement auprès de l’équipe EMS.'}
              </p>
            </div>
          </Card>
          <Card className="p-7 sm:p-9 flex flex-col justify-center bg-red/5">
            <HeartHandshake size={25} className="text-red-300 mb-4" />
            <p className="font-bold text-lg">{siteSettings?.contact_title ?? 'Besoin de nous joindre ?'}</p>
            <p className="text-[var(--ink)]/50 text-sm mt-2 leading-relaxed">
              {siteSettings?.contact_text ?? 'Les demandes envoyées ici arrivent directement dans le panel EMS afin que l’équipe puisse les traiter et assurer leur suivi.'}
            </p>
          </Card>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          {tabs.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setError(null)
                  setSuccess(null)
                  if ((item.key === 'contact' || item.key === 'recrutement') && !session) {
                    void connectDiscord(item.key)
                    return
                  }
                  window.sessionStorage.setItem('ems-public-tab', item.key)
                  setTab(item.key)
                }}
                className={tab === item.key
                  ? 'shrink-0 flex items-center gap-2 rounded-xl bg-red px-4 py-2.5 text-white text-sm font-semibold'
                  : 'shrink-0 flex items-center gap-2 rounded-xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] px-4 py-2.5 text-[var(--ink)]/60 text-sm font-semibold hover:bg-[var(--ink)]/[0.05]'}
              >
                <Icon size={15} /> {item.label}
              </button>
            )
          })}
        </div>

        {tab === 'reglement' ? (
          <Card className="p-6 sm:p-8">
            <h2 className="font-display font-black text-xl mb-5">Règlement EMS</h2>
            <div className="whitespace-pre-wrap text-sm sm:text-base text-[var(--ink)]/65 leading-7">{reglement}</div>
          </Card>
        ) : tab === 'suivi' ? (
          <div className="grid gap-4">
            {threads.map((item) => (
              <Card key={item.credential.public_id} className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-bold">{item.data.request.subject}</p>
                    <p className="text-[var(--ink)]/35 text-xs mt-1">
                      Réf. {item.data.request.public_id.slice(0, 8).toUpperCase()} · {new Date(item.data.request.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--ink)]/10 px-2.5 py-1 text-[11px] text-[var(--ink)]/60">
                    {item.data.request.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                  {item.data.messages.map((message) => (
                    <div
                      key={message.id}
                      className={message.sender === 'ems'
                        ? 'rounded-xl bg-red/8 border border-red/10 px-3 py-2.5'
                        : 'rounded-xl bg-[var(--ink)]/[0.035] border border-[var(--ink)]/8 px-3 py-2.5'}
                    >
                      <p className="text-[11px] font-semibold text-[var(--ink)]/40 mb-1">{message.sender === 'ems' ? 'EMS' : 'Vous'}</p>
                      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      <p className="text-[10px] text-[var(--ink)]/25 mt-1">{new Date(message.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-4">
                  <Input
                    value={replyByTicket[item.credential.public_id] ?? ''}
                    onChange={(e) => setReplyByTicket((current) => ({ ...current, [item.credential.public_id]: e.target.value }))}
                    placeholder="Ajouter un message…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void sendTrackingReply(item)
                      }
                    }}
                  />
                  <Button onClick={() => void sendTrackingReply(item)} disabled={!(replyByTicket[item.credential.public_id] ?? '').trim()}>
                    <Send size={15} />
                  </Button>
                </div>
              </Card>
            ))}
            {threads.length === 0 && (
              <Card className="p-8 text-center">
                <History size={26} className="mx-auto text-[var(--ink)]/20 mb-3" />
                <p className="font-semibold">Aucune demande enregistrée sur cet appareil.</p>
                <p className="text-[var(--ink)]/35 text-xs mt-1">Tes demandes apparaîtront ici après leur envoi.</p>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-6 sm:p-8">
            <div className="max-w-3xl">
              <h2 className="font-display font-black text-xl">
                {tab === 'contact' ? 'Contacter l’EMS' : tab === 'recrutement' ? 'Candidature de recrutement' : 'Demande de rendez-vous'}
              </h2>
              <p className="text-[var(--ink)]/45 text-sm mt-1 mb-6">
                {tab === 'recrutement'
                  ? 'Discord est utilisé pour identifier le candidat et recevoir les mises à jour de la candidature en message privé.'
                  : 'Remplis les informations ci-dessous et notre équipe pourra traiter ta demande depuis le panel.'}
              </p>

              {(tab === 'contact' || tab === 'recrutement') && !session && (
                <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/5 p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Authentification Discord requise</p>
                    <p className="text-[var(--ink)]/40 text-xs mt-1">
                      {tab === 'recrutement'
                        ? 'Nécessaire pour identifier ta candidature et recevoir son suivi en message privé.'
                        : 'Nécessaire pour identifier ta demande et permettre à l’EMS de te recontacter.'}
                    </p>
                  </div>
                  <Button onClick={() => void connectDiscord(tab)} disabled={connecting}>
                    {connecting ? 'Connexion…' : 'Se connecter avec Discord'}
                  </Button>
                </div>
              )}

              {(tab === 'contact' || tab === 'recrutement') && session && (
                <div className="rounded-2xl border border-green-400/20 bg-green-400/5 p-4 mb-5 flex items-center gap-3">
                  {discordAvatar ? <img src={discordAvatar} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-[var(--ink)]/10" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-green-300 text-sm font-semibold">Discord lié</p>
                    <p className="text-[var(--ink)]/50 text-xs truncate">{discordName || 'Compte Discord connecté'}</p>
                  </div>
                  {!staff && <Button size="sm" variant="ghost" onClick={signOut}>Changer</Button>}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[var(--ink)]/55">Nom</span>
                  <Input
                    value={(tab === 'contact' || tab === 'recrutement') && discordName ? discordName : form.fullName}
                    disabled={(tab === 'contact' || tab === 'recrutement') && Boolean(discordName)}
                    onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[var(--ink)]/55">Contact {tab === 'recrutement' ? '(facultatif)' : ''}</span>
                  <Input
                    value={form.contact}
                    placeholder="Discord, téléphone, autre…"
                    onChange={(e) => setForm((current) => ({ ...current, contact: e.target.value }))}
                  />
                </label>
              </div>

              <label className="grid gap-1.5 mt-4">
                <span className="text-xs font-semibold text-[var(--ink)]/55">Objet</span>
                <Select value={subjectId ?? ''} onChange={(e) => setSubjectId(Number(e.target.value))}>
                  <option value="">— Sélectionner —</option>
                  {subjects
                    .filter((subject) => subject.request_type === requestType)
                    .map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.label}</option>
                    ))}
                </Select>
              </label>

              {tab === 'rendez_vous' && (
                <label className="grid gap-1.5 mt-4">
                  <span className="text-xs font-semibold text-[var(--ink)]/55">Date / heure souhaitée</span>
                  <Input type="datetime-local" value={form.preferredAt} onChange={(e) => setForm((current) => ({ ...current, preferredAt: e.target.value }))} />
                </label>
              )}

              <label className="grid gap-1.5 mt-4">
                <span className="text-xs font-semibold text-[var(--ink)]/55">
                  {tab === 'recrutement' ? 'Présentation / motivation' : 'Message'}
                </span>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                  rows={7}
                  maxLength={6000}
                  className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/35"
                />
              </label>

              {error && <p className="text-red-300 text-xs mt-4">{error}</p>}
              {success && <p className="text-green-300 text-xs mt-4">{success}</p>}

              <Button
                className="mt-5"
                disabled={sending || ((tab === 'contact' || tab === 'recrutement') && !session)}
                onClick={() => void submit(requestType)}
              >
                <Send size={15} /> {sending ? 'Envoi…' : 'Envoyer la demande'}
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
