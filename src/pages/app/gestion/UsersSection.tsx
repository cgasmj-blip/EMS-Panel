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
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

export function UsersSection() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])

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
    const channel = supabase
      .channel('gestion-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_sous_grades' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_affiliations' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const sousGradeLabel = (id: string) => shortLabel(sousGrades.find((sg) => sg.id === id)?.label ?? id)
  const affiliationLabel = (id: string) => shortLabel(affiliations.find((a) => a.id === id)?.label ?? id)

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-[var(--ink)] font-bold text-sm">Utilisateurs</h2>
        <p className="text-[var(--ink)]/30 text-xs text-right">
          Lecture seule · grades, habilitations et affiliations synchronisés automatiquement depuis Discord.
        </p>
      </div>

      <AnimatedList className="flex flex-col gap-2">
        {staffList.map((s) => (
          <AnimatedListItem
            key={s.id}
            className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5 flex flex-col gap-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[var(--ink)] text-sm font-semibold truncate">{s.full_name}</p>
                <p className="text-[var(--ink)]/40 text-xs">{s.discord_id ?? '—'}</p>
              </div>

              {displayRoleLabel(s.role) ? (
                <Badge variant="gray">{displayRoleLabel(s.role)}</Badge>
              ) : (
                <Badge variant="amber">Aucun grade Discord</Badge>
              )}

              <Badge variant={s.active ? 'green' : 'gray'}>
                {s.active ? 'Accès EMS actif' : 'Accès EMS retiré'}
              </Badge>

              <Badge variant={s.status === 'en_service' ? 'green' : s.status === 'en_pause' ? 'amber' : 'gray'}>
                {STATUS_LABELS[s.status]}
              </Badge>
            </div>

            {(s.sous_grade_ids.length > 0 || s.affiliation_ids.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {s.sous_grade_ids.map((id) => (
                  <Badge key={id} variant="cyan">{sousGradeLabel(id)}</Badge>
                ))}
                {s.affiliation_ids.map((id) => (
                  <Badge key={id} variant="red">{affiliationLabel(id)}</Badge>
                ))}
              </div>
            )}
          </AnimatedListItem>
        ))}
      </AnimatedList>
    </Card>
  )
}
