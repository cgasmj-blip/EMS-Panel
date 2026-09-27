import { useCallback, useEffect, useState } from 'react'
import { supabase, type Staff, type Absence } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function AbsencesSection() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])

  const fetchAll = useCallback(async () => {
    // Best-effort cleanup: absences whose end date has passed are removed so
    // Direction never has to do it by hand. A daily pg_cron job does the
    // same thing server-side even if nobody opens this page.
    await supabase.from('absences').delete().lt('end_date', today())

    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from('staff').select('*').order('full_name'),
      supabase.from('absences').select('*').order('created_at', { ascending: false }),
    ])
    if (s) setStaffList(s)
    if (a) setAbsences(a)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function setAbsenceStatus(id: number, status: 'validee' | 'refusee') {
    await supabase.from('absences').update({ status }).eq('id', id)
    await fetchAll()
  }

  const pendingAbsences = absences.filter((a) => a.status === 'en_attente')
  const validatedAbsences = [...absences.filter((a) => a.status === 'validee')].sort((a, b) => a.end_date.localeCompare(b.end_date))

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Absences en attente</h2>
        <AnimatedList className="flex flex-col gap-2">
          {pendingAbsences.map((a) => {
            const owner = staffList.find((s) => s.id === a.staff_id)
            return (
              <AnimatedListItem
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5"
              >
                <div>
                  <p className="text-[var(--ink)] text-sm font-semibold">{owner?.full_name ?? a.staff_id}</p>
                  <p className="text-[var(--ink)]/40 text-xs">
                    {a.start_date} → {a.end_date} {a.motif ? `· ${a.motif}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="green" onClick={() => setAbsenceStatus(a.id, 'validee')}>
                    Valider
                  </Button>
                  <Button size="sm" variant="red" onClick={() => setAbsenceStatus(a.id, 'refusee')}>
                    Refuser
                  </Button>
                </div>
              </AnimatedListItem>
            )
          })}
          {pendingAbsences.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune absence en attente.</p>}
        </AnimatedList>
      </Card>

      <Card className="p-5" delay={0.06}>
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Absences validées à venir</h2>
        <AnimatedList className="flex flex-col gap-2">
          {validatedAbsences.map((a) => {
            const owner = staffList.find((s) => s.id === a.staff_id)
            return (
              <AnimatedListItem
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5"
              >
                <div>
                  <p className="text-[var(--ink)] text-sm font-semibold">{owner?.full_name ?? a.staff_id}</p>
                  <p className="text-[var(--ink)]/40 text-xs">
                    {a.start_date} → {a.end_date} {a.motif ? `· ${a.motif}` : ''}
                  </p>
                </div>
                <Badge variant="green">Validée</Badge>
              </AnimatedListItem>
            )
          })}
          {validatedAbsences.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune absence validée à venir.</p>}
        </AnimatedList>
      </Card>
    </div>
  )
}
