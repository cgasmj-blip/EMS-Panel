import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Search, Send } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, displayRoleLabel, type Staff, type StaffRole } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type MessageRow = {
  id: number
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
}

export function MessagesTab() {
  const { session } = useAuth()
  const me = session?.user.id ?? ''
  const [staff, setStaff] = useState<Pick<Staff, 'id' | 'full_name' | 'avatar_url' | 'role'>[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const selected = staff.find((person) => person.id === selectedId) ?? null

  const fetchPeople = useCallback(async () => {
    if (!me) return
    const [{ data: people }, { data: unread }] = await Promise.all([
      supabase
        .from('staff')
        .select('id,full_name,avatar_url,role')
        .eq('active', true)
        .neq('id', me)
        .order('full_name'),
      supabase
        .from('internal_messages')
        .select('sender_id')
        .eq('recipient_id', me)
        .is('read_at', null),
    ])

    setStaff((people ?? []) as Pick<Staff, 'id' | 'full_name' | 'avatar_url' | 'role'>[])
    const counts: Record<string, number> = {}
    for (const row of unread ?? []) counts[row.sender_id] = (counts[row.sender_id] ?? 0) + 1
    setUnreadBySender(counts)
  }, [me])

  const fetchConversation = useCallback(async () => {
    if (!me || !selectedId) {
      setMessages([])
      return
    }

    const { data } = await supabase
      .from('internal_messages')
      .select('*')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${me})`)
      .order('created_at', { ascending: true })
      .limit(300)

    setMessages((data ?? []) as MessageRow[])

    await supabase
      .from('internal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', selectedId)
      .eq('recipient_id', me)
      .is('read_at', null)

    setUnreadBySender((prev) => {
      if (!prev[selectedId]) return prev
      const next = { ...prev }
      delete next[selectedId]
      return next
    })
  }, [me, selectedId])

  useEffect(() => {
    fetchPeople()
    const timer = window.setInterval(fetchPeople, 8000)
    return () => window.clearInterval(timer)
  }, [fetchPeople])

  useEffect(() => {
    fetchConversation()
    const timer = window.setInterval(fetchConversation, 5000)
    return () => window.clearInterval(timer)
  }, [fetchConversation])

  const visiblePeople = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase('fr')
    if (!term) return staff
    return staff.filter((person) => person.full_name.toLocaleLowerCase('fr').includes(term))
  }, [staff, filter])

  async function sendMessage() {
    const message = body.trim()
    if (!me || !selectedId || !message || sending) return

    setSending(true)
    const { error } = await supabase.from('internal_messages').insert({
      sender_id: me,
      recipient_id: selectedId,
      body: message,
    })

    if (!error) {
      setBody('')
      await fetchConversation()
    }
    setSending(false)
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[560px]">
      <Card className="p-3 flex flex-col gap-3 min-h-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/35" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher une personne" className="pl-9" />
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto">
          {visiblePeople.map((person) => {
            const unread = unreadBySender[person.id] ?? 0
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedId(person.id)}
                className={
                  selectedId === person.id
                    ? 'flex items-center gap-3 rounded-xl bg-red/10 border border-red/15 p-2.5 text-left cursor-pointer'
                    : 'flex items-center gap-3 rounded-xl hover:bg-[var(--ink)]/[0.04] p-2.5 text-left cursor-pointer'
                }
              >
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-[var(--ink)]/7 flex items-center justify-center shrink-0">
                    <MessageCircle size={15} className="text-[var(--ink)]/40" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[var(--ink)] text-sm font-semibold truncate">{person.full_name}</span>
                  <span className="block text-[var(--ink)]/35 text-[11px] truncate">
                    {displayRoleLabel(person.role as StaffRole) ?? 'EMS'}
                  </span>
                </span>
                {unread > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col min-h-[560px]">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageCircle size={28} className="text-[var(--ink)]/25 mb-3" />
            <p className="text-[var(--ink)] font-semibold text-sm">Messagerie interne EMS</p>
            <p className="text-[var(--ink)]/35 text-xs mt-1">Clique sur une personne pour lui envoyer un message privé.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[var(--ink)]/8 flex items-center gap-3">
              {selected.avatar_url ? (
                <img src={selected.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-[var(--ink)]/7" />
              )}
              <div>
                <p className="text-[var(--ink)] font-bold text-sm">{selected.full_name}</p>
                <p className="text-[var(--ink)]/35 text-xs">{displayRoleLabel(selected.role as StaffRole) ?? 'EMS'}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-[var(--ink)]/[0.01]">
              {messages.map((message) => {
                const mine = message.sender_id === me
                return (
                  <div key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={mine ? 'max-w-[82%] rounded-2xl rounded-br-md bg-red text-white px-3.5 py-2.5' : 'max-w-[82%] rounded-2xl rounded-bl-md bg-[var(--ink)]/7 text-[var(--ink)] px-3.5 py-2.5'}>
                      <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={mine ? 'text-white/55 text-[10px] mt-1 text-right' : 'text-[var(--ink)]/30 text-[10px] mt-1'}>
                        {new Date(message.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {mine && message.read_at ? ' · Lu' : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && (
                <p className="text-[var(--ink)]/30 text-xs text-center py-8">Aucun message pour le moment.</p>
              )}
            </div>

            <div className="p-3 border-t border-[var(--ink)]/8 flex gap-2 items-end">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Écrire un message…"
                rows={2}
                maxLength={4000}
                className="flex-1 resize-none rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-red/35"
              />
              <Button onClick={sendMessage} disabled={!body.trim() || sending} title="Envoyer">
                <Send size={16} />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
