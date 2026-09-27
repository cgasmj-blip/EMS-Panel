import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase, slugify, type SousGrade, type Affiliation } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Field } from '@/components/ui/Field'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

interface DiscordRoleMapRow {
  role_id: string
  label: string
  staff_role: string | null
  is_gate: boolean
  sous_grade_id: string | null
  affiliation_id: string | null
}

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
  const [roleMappings, setRoleMappings] = useState<DiscordRoleMapRow[]>([])
  const [sgEdits, setSgEdits] = useState<Record<string, { label: string; discord_role_id: string }>>({})
  const [affEdits, setAffEdits] = useState<Record<string, { label: string; sous_grade_id: string; discord_role_id: string }>>({})
  const [newSg, setNewSg] = useState('')
  const [newSgDiscord, setNewSgDiscord] = useState('')
  const [newAffLabel, setNewAffLabel] = useState('')
  const [newAffSousGrade, setNewAffSousGrade] = useState('')
  const [newAffDiscord, setNewAffDiscord] = useState('')
  const [mappingError, setMappingError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: sg }, { data: aff }, { data: mappings }] = await Promise.all([
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
      supabase
        .from('discord_role_map')
        .select('role_id,label,staff_role,is_gate,sous_grade_id,affiliation_id'),
    ])
    if (sg) setSousGrades(sg)
    if (aff) setAffiliations(aff)
    if (mappings) setRoleMappings(mappings as DiscordRoleMapRow[])
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function roleForSousGrade(id: string) {
    return roleMappings.find((m) => m.sous_grade_id === id)?.role_id ?? ''
  }

  function roleForAffiliation(id: string) {
    return roleMappings.find((m) => m.affiliation_id === id)?.role_id ?? ''
  }

  function sgEditOf(sg: SousGrade) {
    return sgEdits[sg.id] ?? { label: sg.label, discord_role_id: roleForSousGrade(sg.id) }
  }

  function affEditOf(a: Affiliation) {
    return affEdits[a.id] ?? {
      label: a.label,
      sous_grade_id: a.sous_grade_id ?? '',
      discord_role_id: roleForAffiliation(a.id),
    }
  }

  async function saveDiscordMapping(
    target: { sous_grade_id?: string; affiliation_id?: string },
    label: string,
    roleIdRaw: string,
  ) {
    setMappingError(null)
    const roleId = roleIdRaw.trim()
    const current = target.sous_grade_id
      ? roleMappings.find((m) => m.sous_grade_id === target.sous_grade_id)
      : roleMappings.find((m) => m.affiliation_id === target.affiliation_id)

    if (!roleId) {
      if (current) await supabase.from('discord_role_map').delete().eq('role_id', current.role_id)
      return true
    }

    const conflict = roleMappings.find((m) => m.role_id === roleId)
    const sameTarget =
      conflict &&
      ((target.sous_grade_id && conflict.sous_grade_id === target.sous_grade_id) ||
        (target.affiliation_id && conflict.affiliation_id === target.affiliation_id))

    if (conflict && !sameTarget) {
      setMappingError(`L'ID Discord ${roleId} est déjà utilisé par « ${conflict.label} ».`)
      return false
    }

    if (current && current.role_id !== roleId) {
      await supabase.from('discord_role_map').delete().eq('role_id', current.role_id)
    }

    const { error } = await supabase.from('discord_role_map').upsert(
      {
        role_id: roleId,
        label,
        staff_role: null,
        is_gate: false,
        priority: null,
        sous_grade_id: target.sous_grade_id ?? null,
        affiliation_id: target.affiliation_id ?? null,
      },
      { onConflict: 'role_id' },
    )

    if (error) {
      setMappingError(error.message)
      return false
    }
    return true
  }

  async function saveSousGrade(sg: SousGrade) {
    const edit = sgEditOf(sg)
    const ok = await saveDiscordMapping({ sous_grade_id: sg.id }, edit.label, edit.discord_role_id)
    if (!ok) return
    await supabase.from('sous_grades').update({ label: edit.label }).eq('id', sg.id)
    setSgEdits((prev) => {
      const next = { ...prev }
      delete next[sg.id]
      return next
    })
    await fetchAll()
  }

  async function deleteSousGrade(id: string) {
    const mapping = roleMappings.find((m) => m.sous_grade_id === id)
    if (mapping) await supabase.from('discord_role_map').delete().eq('role_id', mapping.role_id)
    await supabase.from('sous_grades').delete().eq('id', id)
    await fetchAll()
  }

  async function addSousGrade() {
    if (!newSg.trim()) return
    const id = uniqueSlug(newSg, sousGrades.map((sg) => sg.id))
    await supabase.from('sous_grades').insert({ id, label: newSg.trim(), position: sousGrades.length })
    if (newSgDiscord.trim()) {
      await saveDiscordMapping({ sous_grade_id: id }, newSg.trim(), newSgDiscord)
    }
    setNewSg('')
    setNewSgDiscord('')
    await fetchAll()
  }

  async function saveAffiliation(a: Affiliation) {
    const edit = affEditOf(a)
    const ok = await saveDiscordMapping({ affiliation_id: a.id }, edit.label, edit.discord_role_id)
    if (!ok) return
    await supabase
      .from('affiliations')
      .update({ label: edit.label, sous_grade_id: edit.sous_grade_id || null })
      .eq('id', a.id)
    setAffEdits((prev) => {
      const next = { ...prev }
      delete next[a.id]
      return next
    })
    await fetchAll()
  }

  async function deleteAffiliation(id: string) {
    const mapping = roleMappings.find((m) => m.affiliation_id === id)
    if (mapping) await supabase.from('discord_role_map').delete().eq('role_id', mapping.role_id)
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
    if (newAffDiscord.trim()) {
      await saveDiscordMapping({ affiliation_id: id }, newAffLabel.trim(), newAffDiscord)
    }
    setNewAffLabel('')
    setNewAffSousGrade('')
    setNewAffDiscord('')
    await fetchAll()
  }

  return (
    <div className="flex flex-col gap-6">
      {mappingError && (
        <p className="rounded-lg border border-red/25 bg-red/10 p-3 text-red-300 text-xs">{mappingError}</p>
      )}

      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-1">Habilitations</h2>
        <p className="text-[var(--ink)]/35 text-xs mb-4">Ajoute l'ID du rôle Discord pour détecter automatiquement l'habilitation à la synchronisation.</p>
        <AnimatedList className="flex flex-col gap-2 mb-4">
          {sousGrades.map((sg) => {
            const edit = sgEditOf(sg)
            return (
              <AnimatedListItem key={sg.id} className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3">
                <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                  <Input
                    value={edit.label}
                    onChange={(e) => setSgEdits((prev) => ({ ...prev, [sg.id]: { ...edit, label: e.target.value } }))}
                  />
                  <Input
                    inputMode="numeric"
                    placeholder="ID rôle Discord"
                    value={edit.discord_role_id}
                    onChange={(e) => setSgEdits((prev) => ({ ...prev, [sg.id]: { ...edit, discord_role_id: e.target.value } }))}
                  />
                  <Button size="sm" variant="ghost" onClick={() => saveSousGrade(sg)}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteSousGrade(sg.id)}><Trash2 size={13} /></Button>
                </div>
              </AnimatedListItem>
            )
          })}
          {sousGrades.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune habilitation.</p>}
        </AnimatedList>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <Input placeholder="Nouvelle habilitation (ex: T.B.U.)" value={newSg} onChange={(e) => setNewSg(e.target.value)} />
          <Input inputMode="numeric" placeholder="ID rôle Discord (optionnel)" value={newSgDiscord} onChange={(e) => setNewSgDiscord(e.target.value)} />
          <Button size="sm" onClick={addSousGrade}>Ajouter</Button>
        </div>
      </Card>

      <Card className="p-5" delay={0.06}>
        <h2 className="text-[var(--ink)] font-bold text-sm mb-1">Affiliations</h2>
        <p className="text-[var(--ink)]/35 text-xs mb-4">L'ID Discord permet aussi d'attribuer automatiquement l'affiliation.</p>
        <AnimatedList className="flex flex-col gap-2 mb-4">
          {affiliations.map((a) => {
            const edit = affEditOf(a)
            return (
              <AnimatedListItem key={a.id} className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-2">
                <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                  <Input
                    value={edit.label}
                    onChange={(e) => setAffEdits((prev) => ({ ...prev, [a.id]: { ...edit, label: e.target.value } }))}
                  />
                  <Input
                    inputMode="numeric"
                    placeholder="ID rôle Discord"
                    value={edit.discord_role_id}
                    onChange={(e) => setAffEdits((prev) => ({ ...prev, [a.id]: { ...edit, discord_role_id: e.target.value } }))}
                  />
                  <Button size="sm" variant="ghost" onClick={() => saveAffiliation(a)}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteAffiliation(a.id)}><Trash2 size={13} /></Button>
                </div>
                <Field label="Habilitation requise (optionnelle)">
                  <Select
                    value={edit.sous_grade_id}
                    onChange={(e) => setAffEdits((prev) => ({ ...prev, [a.id]: { ...edit, sous_grade_id: e.target.value } }))}
                  >
                    <option value="">— aucun (universelle) —</option>
                    {sousGrades.map((sg) => (
                      <option key={sg.id} value={sg.id}>{sg.label}</option>
                    ))}
                  </Select>
                </Field>
              </AnimatedListItem>
            )
          })}
          {affiliations.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune affiliation.</p>}
        </AnimatedList>

        <div className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <Input placeholder="Nouvelle affiliation (ex: PSU)" value={newAffLabel} onChange={(e) => setNewAffLabel(e.target.value)} />
            <Input inputMode="numeric" placeholder="ID rôle Discord (optionnel)" value={newAffDiscord} onChange={(e) => setNewAffDiscord(e.target.value)} />
          </div>
          <Field label="Habilitation requise (optionnelle)">
            <Select value={newAffSousGrade} onChange={(e) => setNewAffSousGrade(e.target.value)}>
              <option value="">— aucun (universelle) —</option>
              {sousGrades.map((sg) => (
                <option key={sg.id} value={sg.id}>{sg.label}</option>
              ))}
            </Select>
          </Field>
          <Button size="sm" onClick={addAffiliation}>Ajouter</Button>
        </div>
      </Card>
    </div>
  )
}
