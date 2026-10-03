import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Megaphone, MessageCircle, Mic, Search, Send, Square, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, displayRoleLabel, isDirection, type Staff, type StaffRole } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type AnnouncementRow = {
  id: number
  author_id: string
  title: string
  body: string
  created_at: string
}

type MessageRow = {
  id: number
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
  media_type: 'image' | 'audio' | null
  media_path: string | null
  media_name: string | null
  media_mime: string | null
  media_duration_seconds: number | null
  media_url?: string | null
}

export function MessagesTab() {
  const { session, staff: currentStaff } = useAuth()
  const me = session?.user.id ?? ''
  const [staff, setStaff] = useState<Pick<Staff, 'id' | 'full_name' | 'avatar_url' | 'role'>[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState<'messages' | 'annonces'>('messages')
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [publishing, setPublishing] = useState(false)
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)
  const latestIncomingIdRef = useRef<number | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef<number>(0)
  const [recording, setRecording] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const playIncomingMessageTone = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const now = ctx.currentTime
      const gain = ctx.createGain()
      const osc = ctx.createOscillator()

      gain.connect(ctx.destination)
      osc.connect(gain)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.60, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)

      osc.start(now)
      osc.stop(now + 0.25)
      window.setTimeout(() => ctx.close().catch(() => {}), 600)
    } catch {
      // L'audio peut être bloqué tant que l'utilisateur n'a pas interagi avec la page.
    }
  }, [])

  const selected = staff.find((person) => person.id === selectedId) ?? null

  const fetchPeople = useCallback(async () => {
    if (!me) return
    const [{ data: people }, { data: unread }, { data: recent }] = await Promise.all([
      supabase
        .from('staff')
        .select('id,full_name,avatar_url,role')
        .eq('active', true)
        .neq('id', me),
      supabase
        .from('internal_messages')
        .select('sender_id')
        .eq('recipient_id', me)
        .is('read_at', null),
      supabase
        .from('internal_messages')
        .select('id,sender_id,recipient_id,created_at')
        .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    const counts: Record<string, number> = {}
    for (const row of unread ?? []) counts[row.sender_id] = (counts[row.sender_id] ?? 0) + 1
    setUnreadBySender(counts)

    const latestIncoming = (recent ?? []).find((row) => row.recipient_id === me)
    if (latestIncoming) {
      if (latestIncomingIdRef.current !== null && latestIncoming.id !== latestIncomingIdRef.current) {
        playIncomingMessageTone()
      }
      latestIncomingIdRef.current = latestIncoming.id
    }

    const latest: Record<string, string> = {}
    for (const row of recent ?? []) {
      const otherId = row.sender_id === me ? row.recipient_id : row.sender_id
      if (!latest[otherId]) latest[otherId] = row.created_at
    }
    setLastMessageAt(latest)

    const sortedPeople = ((people ?? []) as Pick<Staff, 'id' | 'full_name' | 'avatar_url' | 'role'>[])
      .sort((a, b) => {
        const aDate = latest[a.id]
        const bDate = latest[b.id]
        if (aDate && bDate) return new Date(bDate).getTime() - new Date(aDate).getTime()
        if (aDate) return -1
        if (bDate) return 1
        return a.full_name.localeCompare(b.full_name, 'fr')
      })

    setStaff(sortedPeople)
  }, [me, playIncomingMessageTone])

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('internal_announcements')
      .select('id,author_id,title,body,created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    setAnnouncements((data ?? []) as AnnouncementRow[])
  }, [])

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

    const rows = (data ?? []) as MessageRow[]
    const withUrls = await Promise.all(
      rows.map(async (message) => {
        if (!message.media_path) return message
        const { data: signed } = await supabase.storage
          .from('internal-message-media')
          .createSignedUrl(message.media_path, 3600)
        return { ...message, media_url: signed?.signedUrl ?? null }
      }),
    )

    setMessages(withUrls)

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
    fetchAnnouncements()
    const timer = window.setInterval(() => {
      fetchPeople()
      fetchAnnouncements()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [fetchPeople, fetchAnnouncements])

  useEffect(() => {
    fetchConversation()
    const timer = window.setInterval(fetchConversation, 5000)
    return () => window.clearInterval(timer)
  }, [fetchConversation])

  useEffect(() => {
    if (selectedId && !staff.some((person) => person.id === selectedId)) {
      setSelectedId(null)
      setMessages([])
    }
  }, [staff, selectedId])

  useEffect(() => {
    const node = messagesScrollRef.current
    if (!node) return
    window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })
  }, [messages, selectedId])

  const visiblePeople = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase('fr')
    if (!term) return staff
    return staff.filter((person) => person.full_name.toLocaleLowerCase('fr').includes(term))
  }, [staff, filter])

  async function sendMedia(file: File | Blob, mediaType: 'image' | 'audio', options?: { name?: string; mime?: string; duration?: number }) {
    if (!me || !selectedId || sending) return
    if (file.size > 20 * 1024 * 1024) {
      setMediaError('Le fichier est trop volumineux (20 Mo maximum).')
      return
    }

    setSending(true)
    setMediaError(null)

    try {
      const name = options?.name || (file instanceof File ? file.name : mediaType === 'audio' ? 'message-vocal.webm' : 'image')
      const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const path = `${me}/${selectedId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('internal-message-media')
        .upload(path, file, {
          contentType: options?.mime || file.type || undefined,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('internal_messages').insert({
        sender_id: me,
        recipient_id: selectedId,
        body: '',
        media_type: mediaType,
        media_path: path,
        media_name: name,
        media_mime: options?.mime || file.type || null,
        media_duration_seconds: options?.duration ?? null,
      })

      if (insertError) {
        await supabase.storage.from('internal-message-media').remove([path])
        throw insertError
      }

      await fetchConversation()
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  async function handleImage(file: File | null) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'svg', 'ico', 'tif', 'tiff'])
    if (!file.type.startsWith('image/') && !imageExtensions.has(extension)) {
      setMediaError('Ce fichier ne semble pas être une image.')
      return
    }
    await sendMedia(file, 'image', { name: file.name, mime: file.type || undefined })
  }

  async function startRecording() {
    if (!selectedId || recording || sending) return
    setMediaError(null)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError('L’enregistrement vocal n’est pas pris en charge par ce navigateur.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream
      recordingChunksRef.current = []

      const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000))
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
        mediaRecorderRef.current = null
        setRecording(false)

        if (blob.size > 0) {
          const ext = recorder.mimeType.includes('ogg') ? 'ogg' : recorder.mimeType.includes('mp4') ? 'm4a' : 'webm'
          await sendMedia(blob, 'audio', {
            name: `message-vocal.${ext}`,
            mime: recorder.mimeType || 'audio/webm',
            duration,
          })
        }
      }

      recordingStartedAtRef.current = Date.now()
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      recordingStreamRef.current = null
      setMediaError('Impossible d’accéder au microphone. Vérifie l’autorisation du navigateur.')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

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

  async function publishAnnouncement() {
    const title = announcementTitle.trim()
    const message = announcementBody.trim()
    if (!me || !title || !message || publishing) return

    setPublishing(true)
    const { error } = await supabase.from('internal_announcements').insert({
      author_id: me,
      title,
      body: message,
    })

    if (!error) {
      setAnnouncementTitle('')
      setAnnouncementBody('')
      await fetchAnnouncements()
    }
    setPublishing(false)
  }

  async function deleteAnnouncement(id: number) {
    await supabase.from('internal_announcements').delete().eq('id', id)
    await fetchAnnouncements()
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
      <div className="inline-flex self-start rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-1">
        <button
          type="button"
          onClick={() => setMode('messages')}
          className={mode === 'messages' ? 'rounded-lg bg-red px-3 py-2 text-white text-xs font-semibold cursor-pointer' : 'rounded-lg px-3 py-2 text-[var(--ink)]/55 text-xs font-semibold cursor-pointer'}
        >
          Messages privés
        </button>
        <button
          type="button"
          onClick={() => setMode('annonces')}
          className={mode === 'annonces' ? 'rounded-lg bg-red px-3 py-2 text-white text-xs font-semibold cursor-pointer' : 'rounded-lg px-3 py-2 text-[var(--ink)]/55 text-xs font-semibold cursor-pointer'}
        >
          Annonces EMS
        </button>
      </div>

      {mode === 'annonces' ? (
        <div className="flex flex-col gap-4">
          {isDirection(currentStaff?.role) && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={16} className="text-[var(--ink)]/50" />
                <p className="text-[var(--ink)] font-bold text-sm">Nouvelle annonce</p>
              </div>
              <div className="grid gap-2">
                <Input
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Titre de l’annonce"
                  maxLength={180}
                />
                <textarea
                  value={announcementBody}
                  onChange={(e) => setAnnouncementBody(e.target.value)}
                  placeholder="Message à afficher à tous les EMS…"
                  rows={4}
                  maxLength={6000}
                  className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-red/35"
                />
                <Button
                  size="sm"
                  onClick={publishAnnouncement}
                  disabled={!announcementTitle.trim() || !announcementBody.trim() || publishing}
                >
                  Publier l’annonce
                </Button>
              </div>
            </Card>
          )}

          <div className="grid gap-3">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center text-[var(--ink)]/50 shrink-0">
                    <Megaphone size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--ink)] font-bold text-sm">{announcement.title}</p>
                    <p className="text-[var(--ink)]/65 text-sm whitespace-pre-wrap mt-2">{announcement.body}</p>
                    <p className="text-[var(--ink)]/30 text-[11px] mt-3">
                      {staff.find((person) => person.id === announcement.author_id)?.full_name ?? 'Direction'} · {new Date(announcement.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  {isDirection(currentStaff?.role) && (
                    <Button size="sm" variant="ghost" title="Supprimer l’annonce" onClick={() => deleteAnnouncement(announcement.id)}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            {announcements.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-[var(--ink)]/35 text-sm">Aucune annonce EMS.</p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-3 flex-1 min-h-0 overflow-hidden">
      <Card className="p-3 flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/35" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher une personne" className="pl-9" />
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto pr-1">
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
                    {lastMessageAt[person.id]
                      ? ` · ${new Date(lastMessageAt[person.id]).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : ''}
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

      <Card className="p-0 overflow-hidden flex flex-col min-h-0 h-full">
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

            <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 pr-2 flex flex-col gap-2 bg-[var(--ink)]/[0.01]">
              {messages.map((message) => {
                const mine = message.sender_id === me
                return (
                  <div key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={mine ? 'max-w-[82%] rounded-2xl rounded-br-md bg-red text-white px-3.5 py-2.5' : 'max-w-[82%] rounded-2xl rounded-bl-md bg-[var(--ink)]/7 text-[var(--ink)] px-3.5 py-2.5'}>
                      {message.body && <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>}
                      {message.media_type === 'image' && message.media_url && (
                        <a href={message.media_url} target="_blank" rel="noreferrer" className="block mt-1">
                          <img
                            src={message.media_url}
                            alt={message.media_name || 'Image'}
                            className="max-w-full max-h-80 rounded-xl object-contain bg-black/10"
                          />
                          <span className={mine ? 'block text-white/60 text-[10px] mt-1' : 'block text-[var(--ink)]/40 text-[10px] mt-1'}>
                            {message.media_name || 'Ouvrir l’image'}
                          </span>
                        </a>
                      )}
                      {message.media_type === 'audio' && message.media_url && (
                        <div className="mt-1 min-w-[220px]">
                          <audio controls preload="metadata" src={message.media_url} className="w-full h-10" />
                          <p className={mine ? 'text-white/60 text-[10px] mt-1' : 'text-[var(--ink)]/40 text-[10px] mt-1'}>
                            Message vocal{message.media_duration_seconds ? ` · ${message.media_duration_seconds}s` : ''}
                          </p>
                        </div>
                      )}
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

            <div className="p-2.5 border-t border-[var(--ink)]/8 shrink-0">
              {mediaError && <p className="text-red-300 text-xs mb-2">{mediaError}</p>}
              {recording && (
                <div className="mb-2 rounded-xl border border-red/20 bg-red/8 px-3 py-2 text-red-300 text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
                  Enregistrement vocal en cours…
                </div>
              )}
              <div className="flex gap-2 items-end">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*,.heic,.heif,.avif,.bmp,.svg,.ico,.tif,.tiff"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    e.currentTarget.value = ''
                    void handleImage(file)
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={sending || recording}
                  title="Envoyer une image"
                >
                  <ImagePlus size={16} />
                </Button>
                <Button
                  variant={recording ? 'red' : 'ghost'}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={sending}
                  title={recording ? 'Arrêter et envoyer le vocal' : 'Enregistrer un message vocal'}
                >
                  {recording ? <Square size={15} /> : <Mic size={16} />}
                </Button>
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
                <Button onClick={sendMessage} disabled={!body.trim() || sending || recording} title="Envoyer">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
        </div>
      )}
    </div>
  )
}
