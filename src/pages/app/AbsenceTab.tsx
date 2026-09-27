import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, ABSENCE_STATUS_LABELS, type Absence } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

export function AbsenceTab() {
  const { staff } = useAuth()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [motif, setMotif] = useState('')
  const [absences, setAbsences] = useState<Absence[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAbsences = useCallback(async () => {
    if (!staff) return
    const { data } = await supabase.from('absences').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false })
    if (data) setAbsences(data)
  }, [staff])

  useEffect(() => {
    fetchAbsences()
  }, [fetchAbsences])

  async function handleSubmit() {
    if (!staff || submitting) return
    if (!start || !end) {
      setError('Indique une date de début et de fin.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase
      .from('absences')
      .insert({ staff_id: staff.id, start_date: start, end_date: end, motif: motif.trim() || null })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setStart('')
    setEnd('')
    setMotif('')
    await fetchAbsences()
  }

  async function handleCancel(id: number) {
    await supabase.from('absences').delete().eq('id', id)
    await fetchAbsences()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Déclarer une absence</h2>
        {error && <p className="text-red-300 text-xs mb-3 animate-pop-in">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Début">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fin">
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="mb-4">
          <Field label="Motif">
            <Input placeholder="ex: Maladie, RDV médical, congé..." value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Field>
        </div>
        <Button variant="red" className="w-full" disabled={submitting} onClick={handleSubmit}>
          Valider
        </Button>
      </Card>

      <Card className="p-5" delay={0.1}>
        <h2 className="text-[var(--ink)]/60 text-xs uppercase tracking-[2px] font-bold mb-4">Mon historique d'absences</h2>
        <AnimatedList className="flex flex-col gap-2">
          {absences.map((a) => (
            <AnimatedListItem
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5"
            >
              <div>
                <p className="text-[var(--ink)] text-sm">
                  {a.start_date} → {a.end_date}
                </p>
                {a.motif && <p className="text-[var(--ink)]/40 text-xs">{a.motif}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={a.status === 'validee' ? 'green' : a.status === 'refusee' ? 'red' : 'amber'}>
                  {ABSENCE_STATUS_LABELS[a.status]}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => handleCancel(a.id)} title="Annuler cette absence">
                  <X size={13} />
                </Button>
              </div>
            </AnimatedListItem>
          ))}
          {absences.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune absence.</p>}
        </AnimatedList>
      </Card>
    </div>
  )
}
