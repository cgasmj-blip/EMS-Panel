import { useCallback, useEffect, useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import { supabase, type Affiliation, type SousGrade, type StaffRole } from '@/lib/supabase'
import { EligibilitySelector, type Eligibility } from '@/components/ui/EligibilitySelector'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

type SubjectRow = {
  id: number
  request_type: 'question' | 'recrutement' | 'rendez_vous'
  label: string
  active: boolean
  grade: StaffRole[] | null
  sous_grade_id: string | null
  affiliation_id: string | null
}

function typeLabel(type: SubjectRow['request_type']) {
  if (type === 'recrutement') return 'Candidatures'
  if (type === 'rendez_vous') return 'Rendez-vous'
  return 'Demandes / messages'
}

export function VisitorAccessSection() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [edits, setEdits] = useState<Record<number, Eligibility>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: rows }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('visitor_request_subjects').select('id,request_type,label,active,grade,sous_grade_id,affiliation_id').order('request_type').order('position'),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])
    setSubjects((rows ?? []) as SubjectRow[])
    setSousGrades((sg ?? []) as SousGrade[])
    setAffiliations((aff ?? []) as Affiliation[])
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  function valueOf(row: SubjectRow): Eligibility {
    return edits[row.id] ?? {
      grade: row.grade ?? [],
      sous_grade_id: row.sous_grade_id ?? '',
      affiliation_id: row.affiliation_id ?? '',
    }
  }

  async function save(row: SubjectRow) {
    const value = valueOf(row)
    setSavingId(row.id)
    setSavedId(null)

    const { error } = await supabase.from('visitor_request_subjects').update({
      grade: value.grade.length ? value.grade : null,
      sous_grade_id: value.sous_grade_id || null,
      affiliation_id: value.affiliation_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)

    setSavingId(null)
    if (error) return

    setSavedId(row.id)
    setEdits((current) => {
      const next = { ...current }
      delete next[row.id]
      return next
    })
    await fetchAll()
    window.setTimeout(() => setSavedId((current) => current === row.id ? null : current), 1400)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-green-400/10 text-green-300 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2 className="font-bold">Autorisations des demandes visiteurs</h2>
            <p className="text-[var(--ink)]/40 text-xs mt-1 max-w-3xl">
              Pour chaque objet, choisis les grades, habilitations ou affiliations qui peuvent voir la demande, répondre au visiteur et faire avancer son dossier.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {subjects.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-sm">{row.label}</p>
                  <Badge variant={row.request_type === 'recrutement' ? 'red' : row.request_type === 'rendez_vous' ? 'cyan' : 'gray'}>
                    {typeLabel(row.request_type)}
                  </Badge>
                  {!row.active && <Badge variant="gray">Désactivé</Badge>}
                </div>
                <p className="text-[var(--ink)]/35 text-[11px] mt-1">
                  Les personnes qui ne correspondent pas aux critères ne verront pas cette demande dans le panel.
                </p>
              </div>
              <Button size="sm" onClick={() => void save(row)} disabled={savingId === row.id}>
                <Save size={13} /> {savingId === row.id ? 'Enregistrement…' : savedId === row.id ? 'Enregistré' : 'Enregistrer'}
              </Button>
            </div>

            <EligibilitySelector
              value={valueOf(row)}
              onChange={(next) => setEdits((current) => ({ ...current, [row.id]: next }))}
              sousGrades={sousGrades}
              affiliations={affiliations}
            />
          </Card>
        ))}
      </div>
    </div>
  )
}
