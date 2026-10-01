import { useCallback, useEffect, useState } from 'react'
import {
  supabase,
  displayRoleLabel,
  ROLE_LABELS,
  mapStaffRow,
  shortLabel,
  STAFF_SELECT_WITH_GRADES,
  STATUS_LABELS,
  type Staff,
  type SousGrade,
  type Affiliation,
} from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'
import { cn } from '@/lib/utils'

export function UsersSection() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [sgEdits, setSgEdits] = useState<Record<string, string[]>>({})
  const [affEdits, setAffEdits] = useState<Record<string, string[]>>({})

  const fetchAll = useCallback(async () => {
    const [{ data: s }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('staff').select(STAFF_SELECT_WITH_GRADES),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])
    if (s) {
      const roleOrder = Object.keys(ROLE_LABELS)
      setStaffList(
        s
          .map(mapStaffRow)
          .sort(
            (a, b) =>
              roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) ||
              a.full_name.localeCompare(b.full_name, 'fr'),
          ),
      )
    }
    if (sg) setSousGrades(sg)
    if (aff) setAffiliations(aff)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function sgValues(s: Staff) {
    return sgEdits[s.id] ?? s.sous_grade_ids
  }
  function affValues(s: Staff) {
    return affEdits[s.id] ?? s.affiliation_ids
  }

  function toggleSg(s: Staff, id: string) {
    const current = sgValues(s)
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setSgEdits((prev) => ({ ...prev, [s.id]: next }))
  }
  function toggleAff(s: Staff, id: string) {
    const current = affValues(s)
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setAffEdits((prev) => ({ ...prev, [s.id]: next }))
  }

  async function saveGrades(id: string) {
    const sg = sgEdits[id]
    const aff = affEdits[id]
    if (sg === undefined && aff === undefined) return
    if (sg !== undefined) {
      await supabase.from('staff_sous_grades').delete().eq('staff_id', id)
      if (sg.length > 0) await supabase.from('staff_sous_grades').insert(sg.map((sous_grade_id) => ({ staff_id: id, sous_grade_id })))
    }
    if (aff !== undefined) {
      await supabase.from('staff_affiliations').delete().eq('staff_id', id)
      if (aff.length > 0) await supabase.from('staff_affiliations').insert(aff.map((affiliation_id) => ({ staff_id: id, affiliation_id })))
    }
    setSgEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setAffEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await fetchAll()
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[var(--ink)] font-bold text-sm">Utilisateurs</h2>
        <p className="text-[var(--ink)]/30 text-xs">Grade, habilitations et affiliations détectés automatiquement depuis les rôles Discord configurés.</p>
      </div>
      <AnimatedList className="flex flex-col gap-2">
        {staffList.map((s) => (
          <AnimatedListItem key={s.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[var(--ink)] text-sm font-semibold truncate">{s.full_name}</p>
                <p className="text-[var(--ink)]/40 text-xs">{s.discord_id ?? '—'}</p>
              </div>
              {displayRoleLabel(s.role) ? (
                <Badge variant="gray">{displayRoleLabel(s.role)}</Badge>
              ) : (
                <Badge variant="amber">Grade Discord non détecté</Badge>
              )}
              <Badge variant={s.status === 'en_service' ? 'green' : s.status === 'en_pause' ? 'amber' : 'gray'}>
                {STATUS_LABELS[s.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sousGrades.map((sg) => {
                const active = sgValues(s).includes(sg.id)
                return (
                  <button
                    key={sg.id}
                    type="button"
                    onClick={() => toggleSg(s, sg.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                      active
                        ? 'border-cyan/40 bg-cyan/15 text-cyan-300'
                        : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] text-[var(--ink)]/50 hover:text-[var(--ink)]',
                    )}
                  >
                    {shortLabel(sg.label)}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {affiliations.map((a) => {
                const active = affValues(s).includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAff(s, a.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                      active
                        ? 'border-red/40 bg-red/15 text-red-300'
                        : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] text-[var(--ink)]/50 hover:text-[var(--ink)]',
                    )}
                  >
                    {shortLabel(a.label)}
                  </button>
                )
              })}
              <Button size="sm" variant="ghost" onClick={() => saveGrades(s.id)}>
                OK
              </Button>
            </div>
          </AnimatedListItem>
        ))}
      </AnimatedList>
    </Card>
  )
}
