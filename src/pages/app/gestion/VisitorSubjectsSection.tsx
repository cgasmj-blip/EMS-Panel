import { useCallback, useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { supabase, type Affiliation, type SousGrade, type StaffRole } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EligibilitySelector, type Eligibility } from '@/components/ui/EligibilitySelector'

type SubjectRow = {
  id: number
  request_type: 'question' | 'recrutement' | 'rendez_vous'
  label: string
  active: boolean
  position: number
  grade: StaffRole[] | null
  sous_grade_id: string | null
  affiliation_id: string | null
}

const EMPTY_ELIGIBILITY: Eligibility = { grade: [], sous_grade_id: '', affiliation_id: '' }

export function VisitorSubjectsSection() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [labelEdits, setLabelEdits] = useState<Record<number, string>>({})
  const [eligibilityEdits, setEligibilityEdits] = useState<Record<number, Eligibility>>({})
  const [activeEdits, setActiveEdits] = useState<Record<number, boolean>>({})
  const [newType, setNewType] = useState<SubjectRow['request_type']>('question')
  const [newLabel, setNewLabel] = useState('')
  const [newEligibility, setNewEligibility] = useState<Eligibility>(EMPTY_ELIGIBILITY)

  const fetchAll = useCallback(async () => {
    const [{ data: subjectRows }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('visitor_request_subjects').select('*').order('request_type').order('position'),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])
    setSubjects((subjectRows ?? []) as SubjectRow[])
    setSousGrades((sg ?? []) as SousGrade[])
    setAffiliations((aff ?? []) as Affiliation[])
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  function eligibilityOf(row: SubjectRow): Eligibility {
    return eligibilityEdits[row.id] ?? {
      grade: row.grade ?? [],
      sous_grade_id: row.sous_grade_id ?? '',
      affiliation_id: row.affiliation_id ?? '',
    }
  }

  async function save(row: SubjectRow) {
    const elig = eligibilityOf(row)
    await supabase.from('visitor_request_subjects').update({
      label: labelEdits[row.id] ?? row.label,
      active: activeEdits[row.id] ?? row.active,
      grade: elig.grade.length > 0 ? elig.grade : null,
      sous_grade_id: elig.sous_grade_id || null,
      affiliation_id: elig.affiliation_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)

    setLabelEdits((current) => {
      const next = { ...current }
      delete next[row.id]
      return next
    })
    setEligibilityEdits((current) => {
      const next = { ...current }
      delete next[row.id]
      return next
    })
    setActiveEdits((current) => {
      const next = { ...current }
      delete next[row.id]
      return next
    })
    await fetchAll()
  }

  async function addSubject() {
    if (!newLabel.trim()) return
    await supabase.from('visitor_request_subjects').insert({
      request_type: newType,
      label: newLabel.trim(),
      active: true,
      position: subjects.filter((row) => row.request_type === newType).length,
      grade: newEligibility.grade.length > 0 ? newEligibility.grade : null,
      sous_grade_id: newEligibility.sous_grade_id || null,
      affiliation_id: newEligibility.affiliation_id || null,
    })
    setNewLabel('')
    setNewEligibility(EMPTY_ELIGIBILITY)
    await fetchAll()
  }

  async function removeSubject(id: number) {
    await supabase.from('visitor_request_subjects').delete().eq('id', id)
    await fetchAll()
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="font-bold text-sm">Objets des demandes visiteurs</h2>
        <p className="text-[var(--ink)]/40 text-xs mt-1 mb-4">
          Chaque objet peut être limité à certains grades, habilitations ou affiliations. Seuls les EMS correspondants verront les demandes liées à cet objet.
        </p>

        <div className="grid gap-3">
          {subjects.map((row) => (
            <div key={row.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 grid gap-3">
              <div className="grid sm:grid-cols-[150px_1fr_auto] gap-2 items-center">
                <Select value={row.request_type} disabled>
                  <option value="question">Nous contacter</option>
                  <option value="recrutement">Recrutement</option>
                  <option value="rendez_vous">Rendez-vous</option>
                </Select>
                <Input
                  value={labelEdits[row.id] ?? row.label}
                  onChange={(e) => setLabelEdits((current) => ({ ...current, [row.id]: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--ink)]/55">
                    <input
                      type="checkbox"
                      checked={activeEdits[row.id] ?? row.active}
                      onChange={(e) => setActiveEdits((current) => ({ ...current, [row.id]: e.target.checked }))}
                    />
                    Actif
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => void save(row)}>
                    <Save size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void removeSubject(row.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>

              <EligibilitySelector
                value={eligibilityOf(row)}
                onChange={(next) => setEligibilityEdits((current) => ({ ...current, [row.id]: next }))}
                sousGrades={sousGrades}
                affiliations={affiliations}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Ajouter un objet</h3>
        <div className="grid sm:grid-cols-[170px_1fr] gap-3">
          <Select value={newType} onChange={(e) => setNewType(e.target.value as SubjectRow['request_type'])}>
            <option value="question">Nous contacter</option>
            <option value="recrutement">Recrutement</option>
            <option value="rendez_vous">Rendez-vous</option>
          </Select>
          <Input placeholder="Ex : Demande de C.A.P.P.A." value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        </div>
        <div className="mt-3">
          <EligibilitySelector value={newEligibility} onChange={setNewEligibility} sousGrades={sousGrades} affiliations={affiliations} />
        </div>
        <Button className="mt-3" onClick={() => void addSubject()} disabled={!newLabel.trim()}>
          <Plus size={14} /> Ajouter
        </Button>
      </Card>
    </div>
  )
}
