import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Search, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type VisitorRequest = {
  id: number
  public_id: string
  request_type: 'question' | 'recrutement' | 'rendez_vous'
  full_name: string
  discord_username: string | null
  discord_avatar_url: string | null
  subject: string
  status: string
  updated_at: string
  created_at: string
}

type VisitorMessage = {
  id: number
  sender: 'visiteur' | 'ems'
  body: string
  created_at: string
}

function typeLabel(type: VisitorRequest['request_type']) {
  if (type === 'recrutement') return 'Candidature'
  return type === 'rendez_vous' ? 'Rendez-vous' : 'Contact'
}

export function VisitorMessagesPane() {
  const [requests, setRequests] = useState<VisitorRequest[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<VisitorMessage[]>([])
  const [filter, setFilter] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const fetchRequests = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('visitor_requests')
      .select('id,public_id,request_type,full_name,discord_username,discord_avatar_url,subject,status,updated_at,created_at')
      .in('request_type', ['question', 'rendez_vous', 'recrutement'])
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setRequests((data ?? []) as VisitorRequest[])
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!selectedId) {
      setMessages([])
      return
    }

    const { data, error: fetchError } = await supabase
      .from('visitor_request_messages')
      .select('id,sender,body,created_at')
      .eq('request_id', selectedId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setMessages((data ?? []) as VisitorMessage[])
  }, [selectedId])

  useEffect(() => {
    void fetchRequests()
    const timer = window.setInterval(() => void fetchRequests(), 5000)
    return () => window.clearInterval(timer)
  }, [fetchRequests])

  useEffect(() => {
    void fetchMessages()
    const timer = window.setInterval(() => void fetchMessages(), 4000)
    return () => window.clearInterval(timer)
  }, [fetchMessages])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })
  }, [messages, selectedId])

  const selected = requests.find((request) => request.id === selectedId) ?? null

  const visibleRequests = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase('fr')
    if (!term) return requests
    return requests.filter((request) =>
      request.full_name.toLocaleLowerCase('fr').includes(term)
      || request.subject.toLocaleLowerCase('fr').includes(term)
      || (request.discord_username ?? '').toLocaleLowerCase('fr').includes(term),
    )
  }, [requests, filter])

  async function sendReply() {
    const message = body.trim()
    if (!selected || !message || sending) return

    setSending(true)
    setError(null)

    const { data, error: invokeError } = await supabase.functions.invoke('notify-visitor-request', {
      body: {
        request_id: selected.id,
        status: selected.request_type === 'recrutement' ? selected.status : 'repondu',
        custom_message: message,
      },
    })

    if (invokeError) {
      setSending(false)
      setError(invokeError.message)
      return
    }

    if (selected.discord_username && data?.dm_sent === false) {
      setError('Message enregistré, mais le MP Discord n’a pas pu être envoyé.')
    }

    setBody('')
    setSending(false)
    await Promise.all([fetchMessages(), fetchRequests()])
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-3 flex-1 min-h-0 overflow-hidden">
      <Card className="p-3 flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/35" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher un visiteur" className="pl-9" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid gap-1 pr-1">
          {visibleRequests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedId(request.id)}
              className={selectedId === request.id
                ? 'flex items-center gap-3 rounded-xl bg-red/10 border border-red/15 p-2.5 text-left'
                : 'flex items-center gap-3 rounded-xl hover:bg-[var(--ink)]/[0.04] p-2.5 text-left'}
            >
              {request.discord_avatar_url ? (
                <img src={request.discord_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-[var(--ink)]/7 flex items-center justify-center shrink-0">
                  <MessageCircle size={15} className="text-[var(--ink)]/40" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{request.full_name}</span>
                <span className="block text-[11px] text-[var(--ink)]/35 truncate">{request.subject}</span>
              </span>
              <Badge variant={request.request_type === 'recrutement' ? 'red' : request.request_type === 'rendez_vous' ? 'cyan' : 'gray'}>{typeLabel(request.request_type)}</Badge>
            </button>
          ))}
          {visibleRequests.length === 0 && (
            <p className="text-center text-xs text-[var(--ink)]/30 py-8">Aucune conversation visiteur accessible.</p>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col min-h-0 h-full">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageCircle size={28} className="text-[var(--ink)]/25 mb-3" />
            <p className="font-semibold text-sm">Messages visiteurs</p>
            <p className="text-[var(--ink)]/35 text-xs mt-1">Sélectionne une demande pour répondre directement depuis la messagerie.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[var(--ink)]/8 flex items-center gap-3">
              {selected.discord_avatar_url ? (
                <img src={selected.discord_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-[var(--ink)]/7" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{selected.full_name}</p>
                <p className="text-[var(--ink)]/35 text-xs truncate">{selected.subject}</p>
              </div>
              <Badge variant={selected.status === 'ferme' ? 'gray' : selected.status === 'repondu' ? 'green' : 'amber'}>
                {selected.status.replaceAll('_', ' ')}
              </Badge>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 pr-2 flex flex-col gap-2 bg-[var(--ink)]/[0.01]">
              {messages.map((message) => (
                <div key={message.id} className={message.sender === 'ems' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={message.sender === 'ems'
                    ? 'max-w-[82%] rounded-2xl rounded-br-md bg-red text-white px-3.5 py-2.5'
                    : 'max-w-[82%] rounded-2xl rounded-bl-md bg-[var(--ink)]/7 text-[var(--ink)] px-3.5 py-2.5'}>
                    <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                    <p className={message.sender === 'ems' ? 'text-white/55 text-[10px] mt-1 text-right' : 'text-[var(--ink)]/30 text-[10px] mt-1'}>
                      {new Date(message.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 border-t border-[var(--ink)]/8 shrink-0 bg-[var(--surface)]/95 backdrop-blur">
              {error && <p className="text-red-300 text-xs mb-2">{error}</p>}
              <div className="flex gap-2 items-end">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendReply()
                    }
                  }}
                  placeholder="Répondre au visiteur…"
                  rows={2}
                  maxLength={6000}
                  className="flex-1 resize-none rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-red/35"
                />
                <Button onClick={() => void sendReply()} disabled={!body.trim() || sending} title="Envoyer">
                  <Send size={16} />
                </Button>
              </div>
              <p className="text-[var(--ink)]/30 text-[10px] mt-2">La réponse est ajoutée à l’historique et envoyée en MP Discord lorsque le visiteur est joignable.</p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
