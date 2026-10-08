import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquareReply, RefreshCw, UserRoundCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

type VisitorMessage = { id:number; request_id:number; sender:'visitor'|'ems'; body:string; staff_id:string|null; created_at:string }

type VisitorRequest = {
  id: number
  public_id: string
  request_type: 'question' | 'recrutement' | 'rendez_vous'
  full_name: string
  contact: string | null
  phone: string | null
  driving_license: string | null
  identity_document: string | null
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
  ['en_attente', 'En attente'],
  ['verification_dossier', 'En attente du casier judiciaire'],
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
  const [messages, setMessages] = useState<VisitorMessage[]>([])
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const previousThreadRef = useRef<number | null>(null)

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
    setRequests(((data ?? []) as VisitorRequest[]).filter((request) => !(request.request_type === 'recrutement' && ['acceptee','refusee'].includes(request.status)) && !((request.request_type === 'question' || request.request_type === 'rendez_vous') && request.status === 'ferme')))
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

  const fetchMessages = useCallback(async (requestId: number) => {
    const {data}=await supabase.from('visitor_request_messages').select('*').eq('request_id',requestId).order('created_at',{ascending:true})
    setMessages((data??[]) as VisitorMessage[])
  }, [])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    stickToBottomRef.current = true
    fetchMessages(selectedId)
    const channel=supabase.channel(`visitor-thread-${selectedId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'visitor_request_messages',filter:`request_id=eq.${selectedId}`},()=>fetchMessages(selectedId)).subscribe()
    // Poll as a fallback: visitor replies can otherwise be missed by Realtime until another action reloads the thread.
    const timer=window.setInterval(()=>void fetchMessages(selectedId),3000)
    return ()=>{window.clearInterval(timer);supabase.removeChannel(channel)}
  }, [selectedId, fetchMessages])

  useEffect(() => {
    const node=threadScrollRef.current
    if(!node||!selectedId) return
    const changed=previousThreadRef.current!==selectedId
    previousThreadRef.current=selectedId
    if(changed) stickToBottomRef.current=true
    if(!stickToBottomRef.current) return
    window.requestAnimationFrame(()=>{node.scrollTop=node.scrollHeight})
  }, [messages, selectedId])

  const handleThreadScroll=useCallback(()=>{
    const node=threadScrollRef.current
    if(!node) return
    stickToBottomRef.current=node.scrollHeight-node.scrollTop-node.clientHeight<80
  },[])
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

  async function closePatientRequest(request: VisitorRequest) {
    setBusy(true); setError(null)
    const {error: closeError}=await supabase.from('visitor_requests').update({status:'ferme',updated_at:new Date().toISOString()}).eq('id',request.id)
    setBusy(false)
    if(closeError){setError(closeError.message);return}
    setSelectedId(null); await fetchAll()
  }

  async function openDocument(value: string | null) {
    if(!value) return
    if(value.startsWith('file:')){
      const {data,error}=await supabase.storage.from('recruitment-documents').createSignedUrl(value.slice(5),300)
      if(error){setError(error.message);return}
      if(data?.signedUrl) window.open(data.signedUrl,'_blank','noopener,noreferrer')
      return
    }
    const url=/^https?:\/\//i.test(value)?value:`https://${value}`
    window.open(url,'_blank','noopener,noreferrer')
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
    await fetchMessages(request.id)
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 h-full min-h-0 overflow-hidden">
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

      <Card className="p-5 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
        {!selected ? (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center">
            <MessageSquareReply size={28} className="text-[var(--ink)]/20 mb-3" />
            <p className="font-semibold">Sélectionne une demande</p>
            <p className="text-[var(--ink)]/35 text-xs mt-1">Tu pourras consulter le dossier, changer son statut et répondre.</p>
          </div>
        ) : (
          <div className="max-w-3xl w-full h-full min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-start gap-3 mb-4 shrink-0">
              {selected.request_type !== 'recrutement' && <Button size="sm" variant="outline" className="ml-auto order-last" disabled={busy} onClick={()=>void closePatientRequest(selected)}>Fermer</Button>}
              {selected.discord_avatar_url ? <img src={selected.discord_avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : <span className="w-12 h-12 rounded-full bg-[var(--ink)]/8" />}
              <div className="min-w-0">
                <h3 className="font-bold">{selected.full_name}</h3>
                <p className="text-[var(--ink)]/40 text-xs">{selected.discord_username || selected.contact || 'Contact non renseigné'}</p>
                <p className="text-[var(--ink)]/30 text-[10px] mt-1">Réf. {selected.public_id.slice(0,8).toUpperCase()}</p>
                <div className="mt-2 grid gap-1 text-xs text-[var(--ink)]/55">
                  <p><span className="font-semibold">Téléphone :</span> {selected.phone || 'Non renseigné'}</p>
                  <p><span className="font-semibold">ID Discord :</span> <span className="font-mono">{selected.discord_id || 'Non renseigné'}</span></p>
                  {selected.request_type === 'recrutement' && <p><span className="font-semibold">Permis :</span> {selected.driving_license ? <button className="underline" onClick={()=>void openDocument(selected.driving_license)}>Ouvrir le document</button> : 'Non renseigné'}</p>}
                  {selected.request_type === 'recrutement' && <p><span className="font-semibold">Pièce d’identité :</span> {selected.identity_document ? <button className="underline" onClick={()=>void openDocument(selected.identity_document)}>Ouvrir le document</button> : 'Non renseignée'}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-4 mb-3 shrink-0 max-h-32 overflow-y-auto">
              <p className="text-xs uppercase tracking-wide text-[var(--ink)]/35 mb-1">Objet</p>
              <p className="font-semibold text-sm">{selected.subject}</p>
              <p className="text-sm text-[var(--ink)]/65 whitespace-pre-wrap mt-3">{selected.message}</p>
              {selected.preferred_at && (
                <p className="text-xs text-cyan mt-3">Rendez-vous souhaité : {new Date(selected.preferred_at).toLocaleString('fr-FR')}</p>
              )}
            </div>

            {selected.request_type === 'recrutement' && <div className="grid sm:grid-cols-[1fr_auto] gap-3 mb-3 shrink-0"><Select value={selected.status} disabled={busy} onChange={(e)=>void setStatus(selected,e.target.value)}>{STATUS_OPTIONS.filter(([value])=>['en_attente','verification_dossier','entretien','acceptee','refusee'].includes(value)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><Badge variant={selected.status==='acceptee'?'green':selected.status==='refusee'?'red':'amber'}>{STATUS_OPTIONS.find(([value])=>value===selected.status)?.[1]??selected.status}</Badge></div>}

            {selected.request_type !== 'recrutement' && <div className="flex-1 min-h-0 flex flex-col overflow-hidden"><div ref={threadScrollRef} onScroll={handleThreadScroll} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.015] p-3 mb-3 flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
              {messages.map((message)=><div key={message.id} className={message.sender==='ems'?'flex justify-end':'flex justify-start'}><div className={message.sender==='ems'?'max-w-[82%] rounded-2xl bg-red text-white px-3.5 py-2.5':'max-w-[82%] rounded-2xl bg-[var(--ink)]/7 px-3.5 py-2.5'}><p className="text-[10px] opacity-60 mb-1">{message.sender==='ems'?'EMS':selected.full_name} · {new Date(message.created_at).toLocaleString('fr-FR')}</p><p className="text-sm whitespace-pre-wrap">{message.body}</p></div></div>)}
              {messages.length===0&&<p className="text-center text-xs text-[var(--ink)]/30 py-5">Aucun message dans cette conversation.</p>}
            </div>
            <label className="grid gap-2">
              <span className="text-xs font-semibold text-[var(--ink)]/50">Réponse / message au patient</span>
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

            </div>}
            {selected.request_type === 'recrutement' && selected.discord_id && (
              <p className="text-[var(--ink)]/35 text-xs mt-auto pt-3 shrink-0">
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
