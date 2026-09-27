import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { supabase, type Staff, type Payout, type Prestation, type PrestationType, type Shift } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR') + ' ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ArchiveSection() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [prestationTypes, setPrestationTypes] = useState<PrestationType[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [detail, setDetail] = useState<{ prestations: Prestation[]; shifts: Shift[] } | null>(null)

  const fetchAll = () => {
    Promise.all([
      supabase.from('payouts').select('*').order('paid_at', { ascending: false }),
      supabase.from('staff').select('*'),
      supabase.from('prestation_types').select('*'),
    ]).then(([{ data: p }, { data: s }, { data: pt }]) => {
      if (p) setPayouts(p)
      if (s) setStaffList(s)
      if (pt) setPrestationTypes(pt)
    })
  }

  useEffect(fetchAll, [])

  const staffById = new Map(staffList.map((s) => [s.id, s]))
  const paidById = (id: string | null) => (id ? staffById.get(id)?.full_name ?? id : '—')
  const prestationLabel = (id: string) => prestationTypes.find((t) => t.id === id)?.label ?? id

  const filtered = payouts.filter((p) => {
    if (!search.trim()) return true
    const name = staffById.get(p.staff_id)?.full_name ?? ''
    return name.toLowerCase().includes(search.trim().toLowerCase())
  })

  async function handleDelete(id: number) {
    await supabase.from('payouts').delete().eq('id', id)
    if (expanded === id) setExpanded(null)
    fetchAll()
  }

  async function toggleExpand(payout: Payout) {
    if (expanded === payout.id) {
      setExpanded(null)
      return
    }
    setExpanded(payout.id)
    const [{ data: prestations }, { data: shifts }] = await Promise.all([
      supabase.from('prestations').select('*').eq('payout_id', payout.id),
      supabase.from('shifts').select('*').eq('payout_id', payout.id),
    ])
    setDetail({ prestations: prestations ?? [], shifts: shifts ?? [] })
  }

  return (
    <Card className="p-5">
      <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Archive des payes</h2>
      <div className="mb-4">
        <Input placeholder="Rechercher un agent (nom, prénom)..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <AnimatedList className="flex flex-col gap-2">
        {filtered.map((p) => {
          const isOpen = expanded === p.id
          return (
            <AnimatedListItem key={p.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] overflow-hidden">
              <button type="button" onClick={() => toggleExpand(p)} className="w-full flex items-center justify-between px-3.5 py-2.5 cursor-pointer text-left">
                <div>
                  <p className="text-[var(--ink)] text-sm font-semibold">{staffById.get(p.staff_id)?.full_name ?? p.staff_id}</p>
                  <p className="text-[var(--ink)]/40 text-xs">
                    {formatDateTime(p.paid_at)} · {p.services_count} service{p.services_count > 1 ? 's' : ''} · {p.prestations_count} prestation{p.prestations_count > 1 ? 's' : ''} ({p.prestations_total}$) · payé par {paidById(p.paid_by)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-[var(--ink)] font-bold text-sm">{p.commission}$</p>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}>
                    <Trash2 size={13} />
                  </Button>
                  {isOpen ? <ChevronUp size={16} className="text-[var(--ink)]/40" /> : <ChevronDown size={16} className="text-[var(--ink)]/40" />}
                </div>
              </button>
              {isOpen && detail && (
                <div className="px-3.5 pb-3.5 flex flex-col gap-3">
                  <div>
                    <p className="text-[var(--ink)]/40 text-[11px] uppercase tracking-[1.5px] font-semibold mb-1.5">Services archivés</p>
                    {detail.shifts.length === 0 && <p className="text-[var(--ink)]/30 text-xs">—</p>}
                    {detail.shifts.map((s) => (
                      <p key={s.id} className="text-[var(--ink)]/70 text-xs">
                        {formatDateTime(s.started_at)} → {s.ended_at ? formatDateTime(s.ended_at) : '...'} | {s.unit_name ?? '—'}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[var(--ink)]/40 text-[11px] uppercase tracking-[1.5px] font-semibold mb-1.5">Prestations archivées</p>
                    {detail.prestations.length === 0 && <p className="text-[var(--ink)]/30 text-xs">—</p>}
                    {detail.prestations.map((pr) => (
                      <p key={pr.id} className="text-[var(--ink)]/70 text-xs">
                        {formatDateTime(pr.created_at)} | {prestationLabel(pr.prestation_type_id)} · {pr.montant}$
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </AnimatedListItem>
          )
        })}
        {filtered.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune paye archivée.</p>}
      </AnimatedList>
    </Card>
  )
}
