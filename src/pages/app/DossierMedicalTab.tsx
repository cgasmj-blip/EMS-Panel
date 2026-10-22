import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { matchesPatient, patientName, isAssigned, TRAUMA_FIELDS, type TraumaRecord } from '@/lib/traumaRecords'
import { DossierTraumatoTab } from './DossierTraumatoTab'

export function DossierMedicalTab({ recordId, onRecordChange }: { recordId?: string; onRecordChange?: (id?: string) => void } = {}) {
  const { staff } = useAuth()
  const [records, setRecords] = useState<TraumaRecord[]>([])
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<'ongoing' | 'completed'>('ongoing')
  const [creating, setCreating] = useState(false)
  const [localRecordId, setLocalRecordId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const openedId = recordId || localRecordId
  const refresh = useCallback(async () => {
    // Fetch all authorized records in pages so older patient files remain searchable.
    const rows: TraumaRecord[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from('trauma_handoffs').select(TRAUMA_FIELDS).order('updated_at', { ascending: false }).order('id').range(offset, offset + 499)
      if (result.error) throw new Error('Impossible de charger les dossiers patients.')
      rows.push(...result.data as TraumaRecord[])
      if (result.data.length < 500) break
    }
    setRecords(rows); setError(''); setLoading(false)
  }, [])
  useEffect(() => {
    const load = () => { void refresh().catch(e => { setError(e.message); setLoading(false) }) }
    load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, 15000)
    return () => clearInterval(timer)
  }, [refresh])
  const close = () => { setCreating(false); setLocalRecordId(undefined); onRecordChange?.(undefined); void refresh().catch(e => setError(e.message)) }
  if (creating || openedId) return <DossierTraumatoTab key={openedId || 'new'} initialRecordId={openedId} onClose={close} onSaved={() => { void refresh().catch(e => setError(e.message)) }} />
  const searched = records.filter(record => matchesPatient(record, query))
  const visible = searched.filter(record => (record.status === 'completed') === (folder === 'completed'))
  return <div className="flex flex-col flex-1 min-h-0 gap-3">
    <Card className="p-4 shrink-0">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-44 text-sm">Rechercher un dossier médical
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, prénom ou référence du dossier" className="rounded-xl border border-[var(--ink)]/20 bg-[var(--bg)] p-3" />
        </label>
        <button className="rounded-xl bg-red text-white p-3 text-sm" onClick={() => setCreating(true)}>Nouveau dossier patient</button>
        <button className="rounded-xl border border-[var(--ink)]/20 p-3 text-sm" onClick={() => void refresh().catch(e => setError(e.message))}>Actualiser</button>
      </div>
      <div className="flex gap-2 mt-3" role="group" aria-label="Classement des dossiers">
        <button className={`rounded-xl px-4 py-2 text-sm ${folder === 'ongoing' ? 'bg-red text-white' : 'bg-[var(--ink)]/5'}`} aria-pressed={folder === 'ongoing'} onClick={() => setFolder('ongoing')}>Dossiers en cours ({searched.filter(r => r.status !== 'completed').length})</button>
        <button className={`rounded-xl px-4 py-2 text-sm ${folder === 'completed' ? 'bg-red text-white' : 'bg-[var(--ink)]/5'}`} aria-pressed={folder === 'completed'} onClick={() => setFolder('completed')}>Dossiers terminés ({searched.filter(r => r.status === 'completed').length})</button>
      </div>
      <p className="text-xs text-[var(--ink)]/50 mt-2">Les dossiers créés et reçus sont classés automatiquement. Ouvrez un dossier qui vous est confié pour poursuivre la saisie.</p>
    </Card>
    {error && <p role="alert" className="text-red">{error}</p>}
    <div className="flex-1 min-h-0 overflow-y-auto grid content-start gap-3">
      {loading ? <p>Chargement des dossiers…</p> : !visible.length ? <p className="p-4 text-[var(--ink)]/60">{query ? 'Aucun dossier correspondant dans ce classement.' : 'Aucun dossier dans ce classement.'}</p> : visible.map(record => <Card key={record.id} className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">{patientName(record) || 'Patient non renseigné'}</h3><p className="text-sm text-[var(--ink)]/60">{record.title}</p><p className="text-xs text-[var(--ink)]/50 mt-1">{isAssigned(record, staff?.id) ? 'À compléter par vous' : 'Confié à un collègue'} · {new Date(record.updated_at).toLocaleString('fr-FR')}</p></div>
          <button className="rounded-xl bg-red text-white px-4 py-2 text-sm" onClick={() => { setLocalRecordId(record.id); onRecordChange?.(record.id) }}>{record.status === 'completed' ? 'Ouvrir le dossier' : isAssigned(record, staff?.id) ? 'Ouvrir et continuer' : 'Consulter'}</button>
        </div>
      </Card>)}
    </div>
  </div>
}
