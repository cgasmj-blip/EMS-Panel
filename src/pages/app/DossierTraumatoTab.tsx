import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'

type Draft = { id: string; title: string; created_by: string; assigned_to: string; status: string; version: number; updated_at: string; history: { actor: string; assigned_to: string; at: string; action: string }[] }
type Person = { id: string; full_name: string; staff_affiliations: { affiliation_id: string }[] }
type Payload = Record<string, unknown>
const DOSSIER_URL = `${import.meta.env.BASE_URL}traumatologie/index.html`
const fields = 'id,title,created_by,assigned_to,status,version,updated_at,history'
const statusLabel = (s: string) => s === 'completed' ? 'Terminé' : s === 'transferred' ? 'Transmis' : 'Brouillon'

export function DossierTraumatoTab() {
  const { staff } = useAuth()
  const iframe = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [current, setCurrent] = useState<Draft | null>(null)
  const [title, setTitle] = useState('')
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef(new Map<string, { resolve: (value: Payload) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>())
  const canEdit = !!staff?.active && (!current || current.assigned_to === staff.id)
  const personName = (id: string) => people.find(p => p.id === id)?.full_name || 'Collègue'

  useEffect(() => {
    const requests = pending.current
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== iframe.current?.contentWindow || event.data?.channel !== 'ems-trauma-v1') return
      if (event.data.action === 'changed') { setDirty(true); return }
      const request = requests.get(event.data.requestId)
      if (!request) return
      clearTimeout(request.timer); requests.delete(event.data.requestId)
      if (event.data.ok) request.resolve(event.data.payload)
      else request.reject(new Error(event.data.error || 'Erreur du dossier'))
    }
    window.addEventListener('message', receive)
    return () => { window.removeEventListener('message', receive); requests.forEach(r => { clearTimeout(r.timer); r.reject(new Error('Dossier fermé')) }); requests.clear() }
  }, [])

  const request = useCallback((action: string, payload?: Payload) => new Promise<Payload>((resolve, reject) => {
    const target = iframe.current?.contentWindow
    if (!target) { reject(new Error('Le dossier n’est pas encore chargé')); return }
    const requestId = crypto.randomUUID()
    const timer = setTimeout(() => { pending.current.delete(requestId); reject(new Error('Le dossier ne répond pas. Réessayez.')) }, 8000)
    pending.current.set(requestId, { resolve, reject, timer })
    target.postMessage({ channel: 'ems-trauma-v1', action, requestId, payload }, location.origin)
  }), [])

  const refresh = useCallback(async () => {
    const [rows, roster] = await Promise.all([
      supabase.from('trauma_handoffs').select(fields).order('updated_at', { ascending: false }).limit(100),
      supabase.from('staff').select('id,full_name,staff_affiliations(affiliation_id)').eq('active', true).order('full_name'),
    ])
    if (rows.error) throw new Error('Chargement des dossiers impossible : ' + rows.error.message)
    if (roster.error) throw new Error('Chargement des destinataires impossible')
    setDrafts((rows.data || []) as Draft[]); setPeople((roster.data || []) as Person[])
  }, [])

  useEffect(() => {
    async function load() { try { await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible') } }
    void load()
  }, [refresh])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!ready) return
    iframe.current?.contentWindow?.postMessage({ channel: 'ems-trauma-v1', action: 'readonly', value: busy || !canEdit }, location.origin)
  }, [ready, busy, canEdit])

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible') } finally { setBusy(false) }
  }

  async function save(mode: 'draft' | 'transferred' | 'completed') {
    if (!staff || !canEdit) throw new Error('Ce dossier est confié à un autre collègue.')
    if (mode === 'transferred' && (!recipient || recipient === staff.id)) throw new Error('Choisissez un destinataire.')
    const payload = await request('snapshot')
    const record = { title: title.trim() || 'Dossier sans nom', payload, status: mode, assigned_to: mode === 'transferred' ? recipient : staff.id }
    const result = current
      ? await supabase.from('trauma_handoffs').update(record).eq('id', current.id).eq('version', current.version).select(fields).maybeSingle()
      : await supabase.from('trauma_handoffs').insert({ ...record, created_by: staff.id }).select(fields).single()
    if (result.error) throw new Error('Enregistrement impossible : ' + result.error.message)
    if (!result.data) throw new Error('Ce dossier a changé ou a été transmis. Rechargez-le avant de continuer ; votre saisie est conservée à l’écran.')
    setCurrent(result.data as Draft); setTitle(result.data.title); setDirty(false)
    setNotice(mode === 'transferred' ? 'Dossier transmis. Le destinataire peut le reprendre dans cet onglet.' : mode === 'completed' ? 'Dossier marqué terminé.' : 'Brouillon enregistré.')
    await refresh()
  }

  async function open(id: string) {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre dossier et les abandonner ?')) return
    const { data, error: err } = await supabase.from('trauma_handoffs').select('*').eq('id', id).single()
    if (err) throw new Error('Impossible d’ouvrir ce dossier')
    await request('load', data.payload)
    setCurrent(data as Draft); setTitle(data.title); setRecipient(''); setDirty(false)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <Card className="p-3 shrink-0 max-h-[36dvh] overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex flex-col gap-1 flex-1 min-w-44">Nom / référence du dossier
            <input className="rounded-lg border border-[var(--ink)]/20 bg-[var(--bg)] px-2 py-1.5" maxLength={160} value={title} disabled={busy || !canEdit} placeholder="Patient ou référence d’intervention" onChange={e => { setTitle(e.target.value); setDirty(true) }} />
          </label>
          <button className="rounded-lg bg-red text-white px-3 py-2 disabled:opacity-40" disabled={!ready || busy || !canEdit} onClick={() => void run(() => save('draft'))}>Enregistrer</button>
          <button className="rounded-lg border border-[var(--ink)]/20 px-3 py-2 disabled:opacity-40" disabled={!ready || busy} onClick={() => void run(async () => {
            if (dirty && !window.confirm('Créer un nouveau dossier et abandonner les modifications non enregistrées ?')) return
            await request('reset'); setCurrent(null); setTitle(''); setRecipient(''); setDirty(false)
          })}>Nouveau</button>
          <label className="flex flex-col gap-1 flex-1 min-w-44">Transmettre à un collègue EMS / pompier
            <select className="rounded-lg border border-[var(--ink)]/20 bg-[var(--bg)] px-2 py-1.5" value={recipient} disabled={busy || !canEdit} onChange={e => setRecipient(e.target.value)}>
              <option value="">Choisir le destinataire</option>
              {people.filter(p => p.id !== staff?.id).map(p => <option key={p.id} value={p.id}>{p.full_name}{p.staff_affiliations.some(a => a.affiliation_id === 'pompier') ? ' · Pompier' : ' · EMS'}</option>)}
            </select>
          </label>
          <button className="rounded-lg bg-red text-white px-3 py-2 disabled:opacity-40" disabled={!ready || busy || !canEdit || !recipient} onClick={() => void run(() => save('transferred'))}>Enregistrer et transmettre</button>
          <button className="rounded-lg border border-[var(--ink)]/20 px-3 py-2 disabled:opacity-40" disabled={!ready || busy || !canEdit} onClick={() => void run(() => save('completed'))}>Terminer</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          <label className="flex items-center gap-2 flex-1 min-w-0">Mes dossiers / dossiers reçus
            <select className="rounded-lg border border-[var(--ink)]/20 bg-[var(--bg)] p-1.5 min-w-0 flex-1" aria-label="Ouvrir un dossier enregistré" value={current?.id || ''} disabled={!ready || busy} onChange={e => { if (e.target.value) void run(() => open(e.target.value)) }}>
              <option value="">Sélectionner un dossier</option>
              {drafts.map(d => <option key={d.id} value={d.id}>{d.assigned_to === staff?.id ? 'À moi' : 'Transmis'} · {d.title} · {statusLabel(d.status)} · {new Date(d.updated_at).toLocaleString('fr-FR')}</option>)}
            </select>
          </label>
          <button disabled={busy} onClick={() => void run(refresh)}>Actualiser</button>
          <span aria-live="polite">{busy ? 'En cours…' : dirty ? 'Modifications non enregistrées' : current ? statusLabel(current.status) : 'Nouveau dossier'}</span>
        </div>
        {current && <p className="mt-2 text-xs text-[var(--ink)]/60">Créé par {personName(current.created_by)} · Confié à {personName(current.assigned_to)}{!canEdit && ' · Consultation seule : le destinataire poursuit la saisie.'}</p>}
        {!!current?.history.length && <details className="text-xs mt-1"><summary>Historique des reprises et transmissions</summary><ul>{current.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString('fr-FR')} · {personName(h.actor)} · {h.action === 'transferred' ? 'Transmission à ' + personName(h.assigned_to) : h.action === 'completed' ? 'Dossier terminé' : 'Enregistrement'}</li>)}</ul></details>}
        {error && <p role="alert" className="text-red mt-2 text-sm">{error}</p>}
        {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
      </Card>
      <Card className="flex flex-1 min-h-0 min-w-0 overflow-hidden p-0">
        <iframe ref={iframe} onLoad={() => setReady(true)} src={DOSSIER_URL} title="Dossier traumatologique EMS Los Santos" className="block h-full w-full min-h-0 flex-1 border-0" />
      </Card>
    </div>
  )
}
