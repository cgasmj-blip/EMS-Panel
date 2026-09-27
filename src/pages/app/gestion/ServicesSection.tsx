import { useCallback, useEffect, useState } from 'react'
import { supabase, type Staff, type Unit } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

export function ServicesSection() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [units, setUnits] = useState<Unit[]>([])

  const fetchAll = useCallback(async () => {
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.from('staff').select('*').order('full_name'),
      supabase.from('units').select('*'),
    ])
    if (s) setStaffList(s)
    if (u) setUnits(u)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function forceEnd(staffId: string) {
    await supabase.from('staff').update({ unit_id: null, status: 'hors_service', shift_started_at: null }).eq('id', staffId)
    await supabase.from('shifts').update({ ended_at: new Date().toISOString() }).eq('staff_id', staffId).is('ended_at', null)
    await fetchAll()
  }

  const unitsById = new Map(units.map((u) => [u.id, u]))
  const activeStaff = staffList.filter((s) => s.status !== 'hors_service')

  return (
    <Card className="p-5">
      <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Services actifs</h2>
      <AnimatedList className="flex flex-col gap-2">
        {activeStaff.map((s) => (
          <AnimatedListItem
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5"
          >
            <div>
              <p className="text-[var(--ink)] text-sm font-semibold">{s.full_name}</p>
              <p className="text-[var(--ink)]/40 text-xs">{s.unit_id ? unitsById.get(s.unit_id)?.name ?? '—' : '—'}</p>
            </div>
            <Button size="sm" variant="red" onClick={() => forceEnd(s.id)}>
              Terminer
            </Button>
          </AnimatedListItem>
        ))}
        {activeStaff.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucun service actif.</p>}
      </AnimatedList>
    </Card>
  )
}
