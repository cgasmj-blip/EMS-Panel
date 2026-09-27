import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase, slugify, type SousGrade, type Affiliation } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Field } from '@/components/ui/Field'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function uniqueSlug(label: string, existing: string[]) {
  const base = slugify(label) || 'item'
  if (!existing.includes(base)) return base
  let i = 2
  while (existing.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}

export function HierarchySection() {
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [sgEdits, setSgEdits] = useState<Record<string, string>>({})
  const [affEdits, setAffEdits] = useState<Record<string, { label: string; sous_grade_id: string }>>({})
  const [newSg, setNewSg] = useState('')
  const [newAffLabel, setNewAffLabel] = useState('')
  const [newAffSousGrade, setNewAffSousGrade] = useState('')

  const fetchAll = useCallback(async () => {
    const [{ data: sg }, { data: aff }] = await Promise.all([
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])
    if (sg) setSousGrades(sg)
    if (aff) setAffiliations(aff)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function saveSousGrade(id: string) {
    const label = sgEdits[id]
    if (label === undefined) return
    await supabase.from('sous_grades').update({ label }).eq('id', id)
    setSgEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await fetchAll()
  }

  async function deleteSousGrade(id: string) {
    await supabase.from('sous_grades').delete().eq('id', id)
    await fetchAll()
  }

  async function addSousGrade() {
    if (!newSg.trim()) return
    const id = uniqueSlug(newSg, sousGrades.map((sg) => sg.id))
    await supabase.from('sous_grades').insert({ id, label: newSg.trim(), position: sousGrades.length })
    setNewSg('')
    await fetchAll()
  }

  function affEditOf(a: Affiliation) {
    return affEdits[a.id] ?? { label: a.label, sous_grade_id: a.sous_grade_id ?? '' }
  }

  async function saveAffiliation(id: string) {
    const edit = affEdits[id]
    if (edit === undefined) return
    await supabase.from('affiliations').update({ label: edit.label, sous_grade_id: edit.sous_grade_id || null }).eq('id', id)
    setAffEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await fetchAll()
  }

  async function deleteAffiliation(id: string) {
    await supabase.from('affiliations').delete().eq('id', id)
    await fetchAll()
  }

  async function addAffiliation() {
    if (!newAffLabel.trim()) return
    const id = uniqueSlug(newAffLabel, affiliations.map((a) => a.id))
    await supabase.from('affiliations').insert({
      id,
      label: newAffLabel.trim(),
      sous_grade_id: newAffSousGrade || null,
      position: affiliations.length,
    })
    setNewAffLabel('')
    setNewAffSousGrade('')
    await fetchAll()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Habilitations</h2>
        <AnimatedList className="flex flex-col gap-2 mb-4">
          {sousGrades.map((sg) => (
            <AnimatedListItem key={sg.id} className="flex items-center gap-2 rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-2">
              <Input
                className="flex-1"
                value={sgEdits[sg.id] ?? sg.label}
                onChange={(e) => setSgEdits((prev) => ({ ...prev, [sg.id]: e.target.value }))}
              />
              <Button size="sm" variant="ghost" onClick={() => saveSousGrade(sg.id)}>
                OK
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteSousGrade(sg.id)}>
                <Trash2 size={13} />
              </Button>
            </AnimatedListItem>
          ))}
          {sousGrades.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune habilitation.</p>}
        </AnimatedList>
        <div className="flex gap-2">
          <Input placeholder="Nouvelle habilitation (ex: T.B.U.)" value={newSg} onChange={(e) => setNewSg(e.target.value)} />
          <Button size="sm" onClick={addSousGrade}>Ajouter</Button>
        </div>
      </Card>

      <Card className="p-5" delay={0.06}>
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Affiliations</h2>
        <AnimatedList className="flex flex-col gap-2 mb-4">
          {affiliations.map((a) => (
            <AnimatedListItem key={a.id} className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={affEditOf(a).label}
                  onChange={(e) => setAffEdits((prev) => ({ ...prev, [a.id]: { ...affEditOf(a), label: e.target.value } }))}
                />
                <Button size="sm" variant="ghost" onClick={() => saveAffiliation(a.id)}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteAffiliation(a.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
              <Field label="Habilitation requise (optionnelle)">
                <Select
                  value={affEditOf(a).sous_grade_id}
                  onChange={(e) => setAffEdits((prev) => ({ ...prev, [a.id]: { ...affEditOf(a), sous_grade_id: e.target.value } }))}
                >
                  <option value="">— aucun (universelle) —</option>
                  {sousGrades.map((sg) => (
                    <option key={sg.id} value={sg.id}>
                      {sg.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </AnimatedListItem>
          ))}
          {affiliations.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune affiliation.</p>}
        </AnimatedList>
        <div className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-3">
          <Input placeholder="Nouvelle affiliation (ex: PSU · Psychologue Unité)" value={newAffLabel} onChange={(e) => setNewAffLabel(e.target.value)} />
          <Field label="Habilitation requise (optionnelle)">
            <Select value={newAffSousGrade} onChange={(e) => setNewAffSousGrade(e.target.value)}>
              <option value="">— aucun (universelle) —</option>
              {sousGrades.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button size="sm" onClick={addAffiliation}>Ajouter</Button>
        </div>
      </Card>
    </div>
  )
}
