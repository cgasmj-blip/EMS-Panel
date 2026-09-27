import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, type Shift, type Prestation, type PrestationType } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR') + ' ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function HistoriqueTab({ staffId }: { staffId?: string }) {
  const { staff } = useAuth()
  const targetId = staffId ?? staff?.id
  const [shifts, setShifts] = useState<Shift[]>([])
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [prestationTypes, setPrestationTypes] = useState<PrestationType[]>([])

  useEffect(() => {
    if (!targetId) return
    supabase
      .from('shifts')
      .select('*')
      .eq('staff_id', targetId)
      .is('archived_at', null)
      .order('started_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setShifts(data)
      })
    supabase
      .from('prestations')
      .select('*')
      .eq('staff_id', targetId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setPrestations(data)
      })
    supabase
      .from('prestation_types')
      .select('*')
      .then(({ data }) => {
        if (data) setPrestationTypes(data)
      })
  }, [targetId])

  const enCours = shifts.filter((s) => !s.ended_at)
  const finis = shifts.filter((s) => s.ended_at)
  const prestationLabel = (id: string) => prestationTypes.find((t) => t.id === id)?.label ?? id

  return (
    <div className="flex flex-col gap-4">
      <HistorySection title="Services en cours" delay={0}>
        {enCours.map((s) => (
          <AnimatedListItem key={s.id}>
            {formatDateTime(s.started_at)} → ... | {s.unit_name ?? '—'} | {s.status_label ?? ''}
          </AnimatedListItem>
        ))}
        {enCours.length === 0 && <Empty />}
      </HistorySection>

      <HistorySection title="Services finis" delay={0.05}>
        {finis.map((s) => (
          <AnimatedListItem key={s.id}>
            {formatDateTime(s.started_at)} → {s.ended_at ? formatTime(s.ended_at) : '—'} | {s.unit_name ?? '—'} | {s.status_label ?? ''}
          </AnimatedListItem>
        ))}
        {finis.length === 0 && <Empty />}
      </HistorySection>

      <HistorySection title="Prestations" delay={0.1}>
        {prestations.map((p) => (
          <AnimatedListItem key={p.id}>
            {formatDateTime(p.created_at)} | {prestationLabel(p.prestation_type_id)} · {p.montant}$ {p.is_public ? '· Service public' : ''}
            {p.details ? ` · ${p.details}` : ''}
          </AnimatedListItem>
        ))}
        {prestations.length === 0 && <Empty />}
      </HistorySection>
    </div>
  )
}

function HistorySection({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <Card className="p-5" delay={delay}>
      <h2 className="text-[var(--ink)] font-bold text-sm mb-3">{title}</h2>
      <AnimatedList className="flex flex-col gap-1 text-[var(--ink)]/70 text-sm">{children}</AnimatedList>
    </Card>
  )
}

function Empty() {
  return <p className="text-[var(--ink)]/30 text-sm">—</p>
}
