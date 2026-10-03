import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquareReply, RefreshCw, UserRoundCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

type VisitorRequest = {
  id: number
  public_id: string
  request_type: 'question' | 'recrutement' | 'rendez_vous'
  full_name: string
  contact: string | null
  discord_id: string | null
  discord_username: string | null
  discord_avatar_url: string | null
  subject: string
  message: string
  preferred_at: string | null
  status: string
  created_at: string
}

const STATUS_OPTIONS = [
  ['nouveau', 'Nouveau'],
  ['en_cours', 'En cours'],
  ['repondu', 'Répondu'],
  ['ferme', 'Fermé'],
  ['candidature_recue', 'Candidature reçue'],
  ['verification_dossier', 'En attente de casier judiciaire'],
  ['en_attente', 'En attente'],
  ['entretien', 'En attente d’entretien'],
  ['acceptee', 'Acceptée'],
  ['refusee', 'Refusée'],
] as const

function typeLabel(type: VisitorRequest['request_type']) {
  if (type === 'recrutement') return 'Recrutement'
  if (type === 'rendez_vous') return 'Rendez-vous'
  return 'Question'
}

export function VisitorRequestsSection({
  types,
  title,
}: {
  types: VisitorRequest['request_type'][]
  title: string
}) {
  const { staff } = useAuth()
  const [requests, setRequests] = useState<VisitorRequest[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeKey = types.join(',')

  const fetchAll = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('visitor_requests')
      .select('*')
      .in('request_type', types)
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setRequests((data ?? []) as VisitorRequest[])
  }, [typeKey])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('visitor-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const selected = requests.find((request) => request.id === selectedId) ?? null
  const visible = useMemo(() => requests, [requests])

  async function setStatus(request: VisitorRequest, status: string) {
    setBusy(true)
    setError(null)
    const { data, error: invokeError } = await supabase.functions.invoke('notify-visitor-request', {
      body: {
        request_id: request.id,
        status,
      },
    })
    setBusy(false)

    if (invokeError) {
      setError(invokeError.message)
      return
    }

    if (request.request_type === 'recrutement' && request.discord_id && data?.dm_sent === false) {
      setError('Statut enregistré, mais le MP Discord n’a pas pu être envoyé.')
    }

    await fetchAll()
  }

  async function sendReply(request: VisitorRequest) {
    const message = reply.trim()
    if (!message || !staff || busy) return
    setBusy(true)
    setError(null)

    if (request.discord_id) {
      const { error: invokeError } = await supabase.functions.invoke('notify-visitor-request', {
        body: {
          request_id: request.id,
          status: request.request_type === 'recrutement' ? request.status : 'repondu',
          custom_message: message,
        },
      })
      if (invokeError) {
        setBusy(false)
        setError(invokeError.message)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('visitor_request_messages').insert({
        request_id: request.id,
        sender: 'ems',
        body: message,
        staff_id: staff.id,
      })
      if (insertError) {
        setBusy(false)
        setError(insertError.message)
        return
      }

      await supabase.from('visitor_requests').update({
        status: 'repondu',
        updated_at: new Date().toISOString(),
      }).eq('id', request.id)
    }

    setReply('')
    setBusy(false)
    await fetchAll()
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 min-h-[520px]">
      <Card className="p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <UserRoundCheck size={16} className="text-[var(--ink)]/45" />
          <h2 className="text-sm font-bold">{title}</h2>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={fetchAll}>
            <RefreshCw size={13} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid gap-2 pr-1">
          {visible.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedId(request.id)}
              className={selectedId === request.id
                ? 'text-left rounded-xl border border-red/25 bg-red/8 p-3'
                : 'text-left rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 hover:bg-[var(--ink)]/[0.04]'}
            >
              <div className="flex items-start gap-2">
                {request.discord_avatar_url ? (
                  <img src={request.discord_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[var(--ink)]/8 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{request.full_name}</p>
                  <p className="text-[var(--ink)]/40 text-xs truncate">{request.subject}</p>
                </div>
                <Badge variant={request.request_type === 'recrutement' ? 'red' : request.request_type === 'rendez_vous' ? 'cyan' : 'gray'}>
                  {typeLabel(request.request_type)}
                </Badge>
              </div>
              <p className="text-[10px] text-[var(--ink)]/30 mt-2">{new Date(request.created_at).toLocaleString('fr-FR')}</p>
            </button>
          ))}
          {visible.length === 0 && <p className="text-center text-sm text-[var(--ink)]/30 py-8">Aucune demande.</p>}
        </div>
      </Card>

      <Card className="p-5 min-h-0 overflow-y-auto">
        {!selected ? (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center">
            <MessageSquareReply size={28} className="text-[var(--ink)]/20 mb-3" />
            <p className="font-semibold">Sélectionne une demande</p>
            <p className="text-[var(--ink)]/35 text-xs mt-1">Tu pourras consulter le dossier, changer son statut et répondre.</p>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-start gap-3 mb-5">
              {selected.discord_avatar_url ? <img src={selected.discord_avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : <span className="w-12 h-12 rounded-full bg-[var(--ink)]/8" />}
              <div className="min-w-0">
                <h3 className="font-bold">{selected.full_name}</h3>
                <p className="text-[var(--ink)]/40 text-xs">{selected.discord_username || selected.contact || 'Contact non renseigné'}</p>
                <p className="text-[var(--ink)]/30 text-[10px] mt-1">Réf. {selected.public_id.slice(0,8).toUpperCase()}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-4 mb-4">
              <p className="text-xs uppercase tracking-wide text-[var(--ink)]/35 mb-1">Objet</p>
              <p className="font-semibold text-sm">{selected.subject}</p>
              <p className="text-sm text-[var(--ink)]/65 whitespace-pre-wrap mt-3">{selected.message}</p>
              {selected.preferred_at && (
                <p className="text-xs text-cyan mt-3">Rendez-vous souhaité : {new Date(selected.preferred_at).toLocaleString('fr-FR')}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-3 mb-5">
              <Select value={selected.status} disabled={busy} onChange={(e) => void setStatus(selected, e.target.value)}>
                {STATUS_OPTIONS
                  .filter(([value]) => selected.request_type === 'recrutement'
                    ? ['candidature_recue','verification_dossier','en_attente','entretien','acceptee','refusee'].includes(value)
                    : ['nouveau','en_cours','repondu','ferme'].includes(value))
                  .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Badge variant={selected.status === 'acceptee' ? 'green' : selected.status === 'refusee' ? 'red' : 'amber'}>
                {STATUS_OPTIONS.find(([value]) => value === selected.status)?.[1] ?? selected.status}
              </Badge>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-semibold text-[var(--ink)]/50">Réponse / message au visiteur</span>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={5}
                maxLength={6000}
                className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/35"
                placeholder={selected.discord_id ? 'Ce message pourra également être envoyé en MP Discord.' : 'Réponse interne à la demande.'}
              />
            </label>
            <Button className="mt-3" disabled={!reply.trim() || busy} onClick={() => void sendReply(selected)}>
              <MessageSquareReply size={15} /> Envoyer la réponse
            </Button>

            {selected.request_type === 'recrutement' && selected.discord_id && (
              <p className="text-[var(--ink)]/35 text-xs mt-4">
                Les changements de statut de candidature envoient automatiquement le message correspondant en privé sur Discord.
              </p>
            )}
            {error && <p className="text-red-300 text-xs mt-3">{error}</p>}
          </div>
        )}
      </Card>
    </div>
  )
}
