import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase, type EmergencyCodeRow, type InterventionShortcut, type SousGrade, type Affiliation } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EligibilitySelector, type Eligibility } from '@/components/ui/EligibilitySelector'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

const EMPTY_ELIG: Eligibility = { grade: [], sous_grade_id: '', affiliation_id: '' }

export function CodesSection() {
  const [codes, setCodes] = useState<EmergencyCodeRow[]>([])
  const [codeEdits, setCodeEdits] = useState<Record<string, string>>({})
  const [newCodeValue, setNewCodeValue] = useState('')
  const [newCodeLabel, setNewCodeLabel] = useState('')
  const [shortcuts, setShortcuts] = useState<InterventionShortcut[]>([])
  const [shortcutEdits, setShortcutEdits] = useState<Record<number, string>>({})
  const [shortcutEligEdits, setShortcutEligEdits] = useState<Record<number, Eligibility>>({})
  const [newShortcut, setNewShortcut] = useState('')
  const [newShortcutElig, setNewShortcutElig] = useState<Eligibility>(EMPTY_ELIG)
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])

  const fetchAll = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('emergency_codes').select('*').order('position'),
      supabase.from('intervention_shortcuts').select('*').order('position'),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])
    if (c) setCodes(c)
    if (s) setShortcuts(s)
    if (sg) setSousGrades(sg)
    if (aff) setAffiliations(aff)
  }, [])

  function shortcutEligOf(s: InterventionShortcut): Eligibility {
    return shortcutEligEdits[s.id] ?? { grade: s.grade ?? [], sous_grade_id: s.sous_grade_id ?? '', affiliation_id: s.affiliation_id ?? '' }
  }

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function saveCode(code: string) {
    const label = codeEdits[code]
    if (label === undefined) return
    await supabase.from('emergency_codes').update({ label }).eq('code', code)
    setCodeEdits((prev) => {
      const next = { ...prev }
      delete next[code]
      return next
    })
    await fetchAll()
  }

  async function deleteCode(code: string) {
    await supabase.from('emergency_codes').delete().eq('code', code)
    await fetchAll()
  }

  async function addCode() {
    if (!newCodeValue.trim() || !newCodeLabel.trim()) return
    await supabase.from('emergency_codes').insert({ code: newCodeValue.trim(), label: newCodeLabel.trim(), position: codes.length })
    setNewCodeValue('')
    setNewCodeLabel('')
    await fetchAll()
  }

  async function saveShortcut(id: number) {
    const label = shortcutEdits[id]
    const elig = shortcutEligEdits[id]
    const patch: Record<string, unknown> = {}
    if (label !== undefined) patch.label = label
    if (elig !== undefined) {
      patch.grade = elig.grade.length > 0 ? elig.grade : null
      patch.sous_grade_id = elig.sous_grade_id || null
      patch.affiliation_id = elig.affiliation_id || null
    }
    if (Object.keys(patch).length === 0) return
    await supabase.from('intervention_shortcuts').update(patch).eq('id', id)
    setShortcutEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setShortcutEligEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await fetchAll()
  }

  async function deleteShortcut(id: number) {
    await supabase.from('intervention_shortcuts').delete().eq('id', id)
    await fetchAll()
  }

  async function addShortcut() {
    if (!newShortcut.trim()) return
    await supabase.from('intervention_shortcuts').insert({
      label: newShortcut.trim(),
      position: shortcuts.length,
      grade: newShortcutElig.grade.length > 0 ? newShortcutElig.grade : null,
      sous_grade_id: newShortcutElig.sous_grade_id || null,
      affiliation_id: newShortcutElig.affiliation_id || null,
    })
    setNewShortcut('')
    setNewShortcutElig(EMPTY_ELIG)
    await fetchAll()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Codes d'urgence</h2>
        <AnimatedList className="flex flex-col gap-2 mb-4">
          {codes.map((c) => (
            <AnimatedListItem key={c.code} className="flex items-center gap-2 rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-2">
              <span className="text-[var(--ink)]/50 text-xs w-16 shrink-0">Code {c.code}</span>
              <Input
                className="flex-1"
                value={codeEdits[c.code] ?? c.label}
                onChange={(e) => setCodeEdits((prev) => ({ ...prev, [c.code]: e.target.value }))}
              />
              <Button size="sm" variant="ghost" onClick={() => saveCode(c.code)}>
                OK
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteCode(c.code)}>
                <Trash2 size={13} />
              </Button>
            </AnimatedListItem>
          ))}
          {codes.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucun code configuré.</p>}
        </AnimatedList>
        <div className="flex gap-2">
          <Input className="w-20" placeholder="Valeur" value={newCodeValue} onChange={(e) => setNewCodeValue(e.target.value)} />
          <Input placeholder="Libellé (ex: Code 4 · Urgence vitale)" value={newCodeLabel} onChange={(e) => setNewCodeLabel(e.target.value)} />
          <Button size="sm" onClick={addCode}>Ajouter</Button>
        </div>
      </Card>

      <Card className="p-5" delay={0.06}>
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Interventions rapides</h2>
        <AnimatedList className="flex flex-col gap-2 mb-4">
          {shortcuts.map((s) => (
            <AnimatedListItem key={s.id} className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={shortcutEdits[s.id] ?? s.label}
                  onChange={(e) => setShortcutEdits((prev) => ({ ...prev, [s.id]: e.target.value }))}
                />
                <Button size="sm" variant="ghost" onClick={() => saveShortcut(s.id)}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteShortcut(s.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
              <EligibilitySelector
                value={shortcutEligOf(s)}
                onChange={(next) => setShortcutEligEdits((prev) => ({ ...prev, [s.id]: next }))}
                sousGrades={sousGrades}
                affiliations={affiliations}
              />
            </AnimatedListItem>
          ))}
          {shortcuts.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune intervention configurée.</p>}
        </AnimatedList>
        <div className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-3">
          <Input placeholder="Nouvelle intervention (ex: M.A.R.U.)" value={newShortcut} onChange={(e) => setNewShortcut(e.target.value)} />
          <EligibilitySelector value={newShortcutElig} onChange={setNewShortcutElig} sousGrades={sousGrades} affiliations={affiliations} />
          <Button size="sm" onClick={addShortcut}>Ajouter</Button>
        </div>
      </Card>
    </div>
  )
}
