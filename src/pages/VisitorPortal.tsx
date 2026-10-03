import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, FileText, HeartHandshake, LogIn, MessageCircle, Send, Stethoscope, UserRoundPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import logo from '@/assets/logo.webp'

type PortalTab = 'reglement' | 'contact' | 'recrutement' | 'rendez_vous'

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
    return saved && ['reglement', 'contact', 'recrutement', 'rendez_vous'].includes(saved) ? saved : 'reglement'
  })
  const [reglement, setReglement] = useState('Chargement du règlement…')
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM)
  const [sending, setSending] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const metadata = (session?.user.user_metadata ?? {}) as Record<string, unknown>
  const discordId = String(metadata.provider_id ?? metadata.sub ?? '')
  const discordName = String(metadata.full_name ?? metadata.name ?? metadata.user_name ?? '')
  const discordAvatar = String(metadata.avatar_url ?? metadata.picture ?? '')

  useEffect(() => {
    supabase
      .from('public_portal_content')
      .select('body')
      .eq('key', 'reglement')
      .maybeSingle()
      .then(({ data }) => setReglement(data?.body || 'Le règlement EMS sera bientôt disponible.'))
  }, [])

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
      { key: 'reglement' as const, label: 'Règlement', icon: FileText },
      { key: 'contact' as const, label: 'Nous contacter', icon: MessageCircle },
      { key: 'recrutement' as const, label: 'Recrutement', icon: UserRoundPlus },
      { key: 'rendez_vous' as const, label: 'Rendez-vous', icon: CalendarClock },
    ],
    [],
  )

  async function connectDiscord(target: 'contact' | 'recrutement') {
    setConnecting(true)
    setError(null)
    window.sessionStorage.setItem('ems-public-tab', target)
    await signInVisitorWithDiscord()
    setConnecting(false)
  }

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
    if (!form.subject.trim() || !form.message.trim()) {
      setError('L’objet et le message sont nécessaires.')
      return
    }

    setSending(true)
    const { data, error: rpcError } = await supabase.rpc('submit_visitor_request', {
      p_type: type,
      p_full_name: fullName,
      p_contact: form.contact.trim(),
      p_subject: form.subject.trim(),
      p_message: form.message.trim(),
      p_preferred_at: form.preferredAt ? new Date(form.preferredAt).toISOString() : null,
      p_discord_id: needsDiscord ? discordId : null,
      p_discord_username: needsDiscord ? discordName : null,
      p_discord_avatar_url: needsDiscord ? discordAvatar : null,
      p_metadata: {},
    })
    setSending(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const ticket = data?.[0]?.public_id ? String(data[0].public_id).slice(0, 8).toUpperCase() : null
    setSuccess(ticket ? `Demande envoyée · Référence ${ticket}` : 'Demande envoyée à l’EMS.')
    setForm(EMPTY_FORM)
    window.sessionStorage.setItem('ems-public-tab', tab)
  }

  const requestType = tab === 'contact' ? 'question' : tab === 'recrutement' ? 'recrutement' : 'rendez_vous'

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-6 items-stretch mb-8">
          <Card className="p-7 sm:p-9 flex flex-col justify-center">
            <div className="w-12 h-12 rounded-2xl bg-red/12 text-red-300 flex items-center justify-center mb-5">
              <Stethoscope size={22} />
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl leading-tight">Bienvenue sur l’espace public EMS</h1>
            <p className="text-[var(--ink)]/55 mt-4 max-w-2xl leading-relaxed">
              Consulte le règlement, pose une question, dépose une candidature ou demande un rendez-vous directement auprès de l’équipe EMS.
            </p>
          </Card>
          <Card className="p-7 sm:p-9 flex flex-col justify-center bg-red/5">
            <HeartHandshake size={25} className="text-red-300 mb-4" />
            <p className="font-bold text-lg">Besoin de nous joindre ?</p>
            <p className="text-[var(--ink)]/50 text-sm mt-2 leading-relaxed">
              Les demandes envoyées ici arrivent directement dans le panel EMS afin que l’équipe puisse les traiter et assurer leur suivi.
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
                <Input value={form.subject} onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))} />
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
