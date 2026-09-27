import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, type Staff, type Prestation, type Shift } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

const COMMISSION_RATE = 0.2

interface PayRow {
  staffId: string
  name: string
  servicesCount: number
  prestationsCount: number
  total: number
  commission: number
}

export function PayesSection() {
  const { staff: currentStaff } = useAuth()
  const [rows, setRows] = useState<PayRow[]>([])
  const [paying, setPaying] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: staffList }, { data: prestations }, { data: shifts }] = await Promise.all([
      supabase.from('staff').select('*'),
      supabase.from('prestations').select('*').is('archived_at', null),
      supabase.from('shifts').select('*').is('archived_at', null),
    ])
    const staffById = new Map((staffList ?? []).map((s: Staff) => [s.id, s]))
    const byStaff = new Map<string, { count: number; total: number }>()
    for (const p of (prestations ?? []) as Prestation[]) {
      const entry = byStaff.get(p.staff_id) ?? { count: 0, total: 0 }
      entry.count += 1
      entry.total += p.montant
      byStaff.set(p.staff_id, entry)
    }
    const servicesByStaff = new Map<string, number>()
    for (const s of (shifts ?? []) as Shift[]) {
      servicesByStaff.set(s.staff_id, (servicesByStaff.get(s.staff_id) ?? 0) + 1)
    }
    const staffIds = new Set([...byStaff.keys(), ...servicesByStaff.keys()])
    const built: PayRow[] = [...staffIds]
      .map((staffId) => {
        const p = byStaff.get(staffId) ?? { count: 0, total: 0 }
        return {
          staffId,
          name: staffById.get(staffId)?.full_name ?? staffId,
          servicesCount: servicesByStaff.get(staffId) ?? 0,
          prestationsCount: p.count,
          total: p.total,
          commission: Math.round(p.total * COMMISSION_RATE),
        }
      })
      .sort((a, b) => b.commission - a.commission)
    setRows(built)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handlePay(row: PayRow) {
    if (!currentStaff || paying) return
    setPaying(row.staffId)
    try {
      const { data: payout, error: payoutErr } = await supabase
        .from('payouts')
        .insert({
          staff_id: row.staffId,
          paid_by: currentStaff.id,
          services_count: row.servicesCount,
          prestations_count: row.prestationsCount,
          prestations_total: row.total,
          commission: row.commission,
        })
        .select()
        .single()
      if (payoutErr || !payout) throw new Error(payoutErr?.message ?? 'Paiement impossible')

      const archivedAt = new Date().toISOString()
      await supabase
        .from('prestations')
        .update({ archived_at: archivedAt, payout_id: payout.id })
        .eq('staff_id', row.staffId)
        .is('archived_at', null)
      await supabase
        .from('shifts')
        .update({ archived_at: archivedAt, payout_id: payout.id })
        .eq('staff_id', row.staffId)
        .is('archived_at', null)

      await fetchAll()
    } finally {
      setPaying(null)
    }
  }

  const totalCommissions = rows.reduce((acc, r) => acc + r.commission, 0)

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[var(--ink)] font-bold text-sm">Gestion des payes</h2>
        <p className="text-[var(--ink)]/40 text-xs">Commission {COMMISSION_RATE * 100}% · total dû : {totalCommissions}$</p>
      </div>
      <AnimatedList className="flex flex-col gap-2">
        {rows.map((r) => (
          <AnimatedListItem key={r.staffId} className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5">
            <div>
              <p className="text-[var(--ink)] text-sm font-semibold">{r.name}</p>
              <p className="text-[var(--ink)]/40 text-xs">
                {r.servicesCount} service{r.servicesCount > 1 ? 's' : ''} · {r.prestationsCount} prestation{r.prestationsCount > 1 ? 's' : ''} · {r.total}$ facturés
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[var(--ink)] font-bold text-sm">{r.commission}$</p>
              <Button size="sm" variant="green" disabled={paying === r.staffId} onClick={() => handlePay(r)}>
                Payer
              </Button>
            </div>
          </AnimatedListItem>
        ))}
        {rows.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Rien à payer pour le moment.</p>}
      </AnimatedList>
    </Card>
  )
}
