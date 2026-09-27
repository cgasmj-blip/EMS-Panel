import { useCallback, useEffect, useState } from 'react'
import { supabase, slugify, type PrestationType, type SousGrade, type Affiliation } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EligibilitySelector, type Eligibility } from '@/components/ui/EligibilitySelector'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

const EMPTY: Eligibility = { grade: [], sous_grade_id: '', affiliation_id: '' }

function uniqueSlug(label: string, existing: string[]) {
  const base = slugify(label) || 'item'
  if (!existing.includes(base)) return base
  let i = 2
  while (existing.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}

export function TarifsSection() {
  const [prestationTypes, setPrestationTypes] = useState<PrestationType[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [tarifEdits, setTarifEdits] = useState<Record<string, number>>({})
  const [tarifPublicEdits, setTarifPublicEdits] = useState<Record<string, number>>({})
  const [labelEdits, setLabelEdits] = useState<Record<string, string>>({})
  const [eligEdits, setEligEdits] = useState<Record<string, Eligibility>>({})
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [newTypeTarif, setNewTypeTarif] = useState(0)
  const [newTypeTarifPublic, setNewTypeTarifPublic] = useState(0)
  const [newElig, setNewElig] = useState<Eligibility>(EMPTY)

  const fetchAll = useCallback(async () => {
    const [{ data: t }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('prestation_types').select('*').order('label'),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])
    if (t) setPrestationTypes(t)
    if (sg) setSousGrades(sg)
    if (aff) setAffiliations(aff)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function eligOf(t: PrestationType): Eligibility {
    return eligEdits[t.id] ?? { grade: t.grade ?? [], sous_grade_id: t.sous_grade_id ?? '', affiliation_id: t.affiliation_id ?? '' }
  }

  async function saveTarif(id: string) {
    const tarif = tarifEdits[id]
    const tarifPublic = tarifPublicEdits[id]
    const label = labelEdits[id]
    const elig = eligEdits[id]
    const patch: Record<string, unknown> = {}
    if (tarif !== undefined) patch.tarif = tarif
    if (tarifPublic !== undefined) patch.tarif_public = tarifPublic
    if (label !== undefined) patch.label = label
    if (elig !== undefined) {
      patch.grade = elig.grade.length > 0 ? elig.grade : null
      patch.sous_grade_id = elig.sous_grade_id || null
      patch.affiliation_id = elig.affiliation_id || null
    }
    if (Object.keys(patch).length === 0) return
    await supabase.from('prestation_types').update(patch).eq('id', id)
    setTarifEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setTarifPublicEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setLabelEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setEligEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await fetchAll()
  }

  async function addPrestationType() {
    if (!newTypeLabel.trim()) return
    const id = uniqueSlug(newTypeLabel, prestationTypes.map((t) => t.id))
    await supabase.from('prestation_types').insert({
      id,
      label: newTypeLabel.trim(),
      tarif: newTypeTarif,
      tarif_public: newTypeTarifPublic || null,
      grade: newElig.grade.length > 0 ? newElig.grade : null,
      sous_grade_id: newElig.sous_grade_id || null,
      affiliation_id: newElig.affiliation_id || null,
    })
    setNewTypeLabel('')
    setNewTypeTarif(0)
    setNewTypeTarifPublic(0)
    setNewElig(EMPTY)
    await fetchAll()
  }

  return (
    <Card className="p-5">
      <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Tarifs prestations</h2>
      <AnimatedList className="flex flex-col gap-3 mb-4">
        {prestationTypes.map((t) => (
          <AnimatedListItem key={t.id} className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={labelEdits[t.id] ?? t.label}
                onChange={(e) => setLabelEdits((prev) => ({ ...prev, [t.id]: e.target.value }))}
              />
              <Input
                type="number"
                className="w-24"
                title="Tarif normal"
                value={tarifEdits[t.id] ?? t.tarif}
                onChange={(e) => setTarifEdits((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
              />
              <Input
                type="number"
                className="w-24"
                title="Tarif service public"
                placeholder="Prix public"
                value={tarifPublicEdits[t.id] ?? t.tarif_public ?? ''}
                onChange={(e) => setTarifPublicEdits((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
              />
              <Button size="sm" variant="ghost" onClick={() => saveTarif(t.id)}>
                OK
              </Button>
            </div>
            <p className="text-[var(--ink)]/30 text-[11px]">Tarif normal · Tarif service public</p>
            <EligibilitySelector
              value={eligOf(t)}
              onChange={(next) => setEligEdits((prev) => ({ ...prev, [t.id]: next }))}
              sousGrades={sousGrades}
              affiliations={affiliations}
            />
          </AnimatedListItem>
        ))}
      </AnimatedList>
      <div className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-3">
        <p className="text-[var(--ink)]/40 text-xs uppercase tracking-[1.5px] font-semibold">Nouveau type</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Libellé (ex: Soins)" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} />
          <Input type="number" placeholder="Tarif normal" value={newTypeTarif} onChange={(e) => setNewTypeTarif(Number(e.target.value))} />
          <Input type="number" placeholder="Tarif service public" value={newTypeTarifPublic} onChange={(e) => setNewTypeTarifPublic(Number(e.target.value))} />
        </div>
        <EligibilitySelector value={newElig} onChange={setNewElig} sousGrades={sousGrades} affiliations={affiliations} />
        <Button size="sm" onClick={addPrestationType}>Ajouter</Button>
      </div>
    </Card>
  )
}
