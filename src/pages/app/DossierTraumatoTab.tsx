import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCheck, FileHeart, Plus, Save, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { TRAUMA_FIELDS, assignedPeople, isAssigned, normalizeSearch, type TraumaRecord } from '@/lib/traumaRecords'

type Draft = TraumaRecord
type Person = { id: string; full_name: string; staff_affiliations: { affiliation_id: string }[] }
type Payload = Record<string, unknown>
const DOSSIER_URL = `${import.meta.env.BASE_URL}traumatologie/index.html`
const fields = TRAUMA_FIELDS
const statusLabel = (s: string) => s === 'completed' ? 'Terminé' : s === 'transferred' ? 'Transmis' : 'Brouillon'

export function DossierTraumatoTab({ initialRecordId, onClose, onSaved }: { initialRecordId?: string; onClose?: () => void; onSaved?: () => void } = {}) {
  const { staff } = useAuth()
  const iframe = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [current, setCurrent] = useState<Draft | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [showRecipients, setShowRecipients] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef(new Map<string, { resolve: (value: Payload) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>())
  const canEdit = !!staff?.active && (!current || isAssigned(current, staff.id))
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
    const roster = await supabase.from('staff').select('id,full_name,staff_affiliations(affiliation_id)').eq('active', true).order('full_name')
    if (roster.error) throw new Error('Chargement des destinataires impossible')
    setPeople((roster.data || []) as Person[])
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

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible') } finally { setBusy(false) }
  }, [])

  async function save(mode: 'draft' | 'transferred' | 'completed') {
    if (!staff || !canEdit) throw new Error('Ce dossier est confié à un autre collègue.')
    if (mode === 'transferred' && !recipients.length) throw new Error('Choisissez au moins un destinataire EMS.')
    const snapshot = await request('snapshot')
    const payload = { ...snapshot, patientFirstName: firstName.trim(), patientLastName: lastName.trim() }
    const assigned = mode === 'transferred' ? recipients : current ? assignedPeople(current) : [staff.id]
    const record = { title: [lastName.trim(), firstName.trim()].filter(Boolean).join(' ').slice(0,160) || 'Dossier patient', payload, status: mode, assigned_to: assigned[0], assigned_staff: assigned }
    const result = current
      ? await supabase.from('trauma_handoffs').update(record).eq('id', current.id).eq('version', current.version).select(fields).maybeSingle()
      : await supabase.from('trauma_handoffs').insert({ ...record, created_by: staff.id }).select(fields).single()
    if (result.error) throw new Error('Enregistrement impossible : ' + result.error.message)
    if (!result.data) throw new Error('Ce dossier a changé ou a été transmis. Rechargez-le avant de continuer ; votre saisie est conservée à l’écran.')
    setCurrent(result.data as Draft); setDirty(false)
    setNotice(mode === 'transferred' ? `Dossier transmis à ${recipients.length} destinataire(s) EMS. Chacun le retrouve dans ses dossiers en cours.` : mode === 'completed' ? 'Dossier marqué terminé.' : 'Brouillon enregistré.')
    await refresh()
    onSaved?.()
  }

  const open = useCallback(async (id: string) => {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre dossier et les abandonner ?')) return
    const { data, error: err } = await supabase.from('trauma_handoffs').select(fields + ',payload').eq('id', id).single<TraumaRecord & { payload: Payload }>()
    if (err) throw new Error('Impossible d’ouvrir ce dossier')
    await request('load', data.payload)
    setCurrent(data as Draft); setFirstName(data.patient_first_name || ''); setLastName(data.patient_last_name || ''); setRecipients([]); setDirty(false)
  }, [dirty, request])

  const initialOpened = useRef(false)
  useEffect(() => {
    if (!ready || !initialRecordId || initialOpened.current) return
    initialOpened.current = true
    void run(() => open(initialRecordId))
  }, [ready, initialRecordId, open, run])
  useEffect(() => {
    if (!ready) return
    iframe.current?.contentWindow?.postMessage({ channel: 'ems-trauma-v1', action: 'patientIdentity', firstName, lastName }, location.origin)
  }, [ready, firstName, lastName])

  useEffect(() => {
    if (!ready) return
    const syncTheme = () => {
      const styles = getComputedStyle(document.documentElement)
      const colors = { bg: styles.getPropertyValue('--bg').trim(), ink: styles.getPropertyValue('--ink').trim(), surface: styles.getPropertyValue('--surface').trim(), soft: styles.getPropertyValue('--surface-soft').trim(), accent: '#ef4444' }
      iframe.current?.contentWindow?.postMessage({ channel: 'ems-trauma-v1', action: 'theme', colors }, location.origin)
    }
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme','style'] })
    return () => observer.disconnect()
  }, [ready])

  const eligiblePeople = people.filter(p => p.id !== staff?.id && !p.staff_affiliations.some(a => a.affiliation_id === 'pompier'))
  const visiblePeople = eligiblePeople.filter(p => normalizeSearch(p.full_name).includes(normalizeSearch(recipientSearch)))
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <Card className="p-4 shrink-0 max-h-[42dvh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-red/10 text-red flex items-center justify-center"><FileHeart size={20}/></span><div><h2 className="font-bold text-sm">Dossier patient</h2><p className="text-xs text-[var(--ink)]/45" aria-live="polite">{busy ? 'Enregistrement…' : dirty ? 'Modifications non enregistrées' : current ? statusLabel(current.status) : 'Nouvelle évaluation'}</p></div></div>
          <div className="flex flex-wrap gap-2">
            {onClose && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (!dirty || window.confirm('Quitter sans enregistrer les modifications ?')) onClose() }}><ArrowLeft size={14}/>Dossiers médicaux</Button>}
            <Button size="sm" variant="ghost" disabled={!ready || busy} onClick={() => void run(async () => {
              if (dirty && !window.confirm('Créer un nouveau dossier et abandonner les modifications non enregistrées ?')) return
              await request('reset'); setCurrent(null); setFirstName(''); setLastName(''); setRecipients([]); setShowRecipients(false); setDirty(false)
            })}><Plus size={14}/>Nouveau</Button>
            <Button size="sm" disabled={!ready || busy || !canEdit} onClick={() => void run(() => save('draft'))}><Save size={14}/>Enregistrer</Button>
            <Button size="sm" variant="green" disabled={!ready || busy || !canEdit} onClick={() => void run(() => save('completed'))}><CheckCheck size={14}/>Terminer</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label><span className="text-xs uppercase tracking-wider text-[var(--ink)]/40 font-semibold mb-1.5 block">Nom du patient</span><Input autoComplete="off" maxLength={100} value={lastName} disabled={busy || !canEdit} onChange={e => { setLastName(e.target.value); setDirty(true) }} /></label>
          <label><span className="text-xs uppercase tracking-wider text-[var(--ink)]/40 font-semibold mb-1.5 block">Prénom du patient</span><Input autoComplete="off" maxLength={100} value={firstName} disabled={busy || !canEdit} onChange={e => { setFirstName(e.target.value); setDirty(true) }} /></label>
        </div>
        <div className="border-t border-[var(--ink)]/8 mt-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-xs font-semibold text-[var(--ink)]/70">Transmettre aux EMS</p><p className="text-xs text-[var(--ink)]/40 mt-1">Sélectionnez un ou plusieurs destinataires.</p></div>
            <div className="flex gap-2"><Button size="sm" variant="ghost" aria-expanded={showRecipients} disabled={busy || !canEdit} onClick={() => setShowRecipients(v => !v)}><Users size={14}/>{recipients.length ? `${recipients.length} EMS sélectionné(s)` : 'Choisir les EMS'}</Button><Button size="sm" variant="outline" disabled={!ready || busy || !canEdit || !recipients.length} onClick={() => void run(() => save('transferred'))}><Send size={14}/>Enregistrer et transmettre</Button></div>
          </div>
          {showRecipients && <div className="mt-3 rounded-xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] p-3"><Input type="search" aria-label="Rechercher un destinataire EMS" placeholder="Rechercher un EMS…" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} /><div className="grid sm:grid-cols-2 gap-1 max-h-36 overflow-y-auto mt-2">{visiblePeople.map(p => <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--ink)]/5 text-sm cursor-pointer"><input type="checkbox" className="accent-red" checked={recipients.includes(p.id)} disabled={busy || !canEdit} onChange={e => setRecipients(ids => e.target.checked ? [...ids,p.id] : ids.filter(id => id !== p.id))}/>{p.full_name}</label>)}{!visiblePeople.length && <p className="text-xs p-2 text-[var(--ink)]/45">Aucun destinataire EMS trouvé.</p>}</div></div>}
          {!!recipients.length && <p className="mt-2 text-xs text-[var(--ink)]/60">Destinataires : {recipients.map(personName).join(', ')}</p>}
        </div>
        {current && <p className="mt-3 text-xs text-[var(--ink)]/45">Créé par {personName(current.created_by)} · Confié à {assignedPeople(current).map(personName).join(', ')}{!canEdit && ' · Consultation seule.'}</p>}
        {!!current?.history.length && <details className="text-xs mt-2 text-[var(--ink)]/50"><summary className="cursor-pointer">Historique des reprises et transmissions</summary><ul className="mt-2 space-y-1">{current.history.map((h,i) => <li key={i}>{new Date(h.at).toLocaleString('fr-FR')} · {personName(h.actor)} · {h.action === 'transferred' ? 'Transmission à ' + assignedPeople(h).map(personName).join(', ') : h.action === 'completed' ? 'Dossier terminé' : 'Enregistrement'}</li>)}</ul></details>}
        {error && <p role="alert" className="rounded-lg bg-red/10 text-red p-3 mt-3 text-sm">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green/10 text-[var(--ink)] p-3 mt-3 text-sm">{notice}</p>}
      </Card>
      <Card className="flex flex-1 min-h-0 min-w-0 overflow-hidden p-0">
        <iframe ref={iframe} onLoad={() => setReady(true)} src={DOSSIER_URL} title="Dossier traumatologique EMS Los Santos" className="block h-full w-full min-h-0 flex-1 border-0" />
      </Card>
    </div>
  )
}
