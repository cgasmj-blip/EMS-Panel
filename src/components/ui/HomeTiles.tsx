import { useCallback, useEffect, useState } from 'react'
import { supabase, type Appointment } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Tile } from '@/components/ui/Tile'

function formatUpcoming(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export function HomeTiles({ tabs, onSelect }: { tabs: TabKey[]; onSelect: (key: TabKey) => void }) {
  const { staff } = useAuth()
  const [enService, setEnService] = useState(0)
  const [mesAbsencesAVenir, setMesAbsencesAVenir] = useState(0)
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null)

  const refreshStats = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const serviceQuery = supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_service')
      .eq('active', true)

    const absenceQuery = staff
      ? supabase
          .from('absences')
          .select('id', { count: 'exact', head: true })
          .eq('staff_id', staff.id)
          .gte('end_date', today)
          .neq('status', 'refusee')
      : null

    const appointmentQuery = staff
      ? supabase
          .from('appointments')
          .select('*')
          .eq('staff_id', staff.id)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1)
      : null

    const [serviceResult, absenceResult, appointmentResult] = await Promise.all([
      serviceQuery,
      absenceQuery ?? Promise.resolve({ count: 0 }),
      appointmentQuery ?? Promise.resolve({ data: [] as Appointment[] }),
    ])

    setEnService(serviceResult.count ?? 0)
    setMesAbsencesAVenir(absenceResult.count ?? 0)
    setNextAppointment(appointmentResult.data?.[0] ?? null)
  }, [staff])

  useEffect(() => {
    refreshStats()
    const timer = window.setInterval(refreshStats, 25_000)
    return () => window.clearInterval(timer)
  }, [refreshStats])

  const sections = TILE_SECTIONS.filter((s) => tabs.includes(s.key))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {sections.map((section, i) => {
        let stat: string | null = null
        if (section.key === 'services') stat = `${enService}`
        if (section.key === 'absence') stat = `${mesAbsencesAVenir}`
        if (section.key === 'agenda') stat = nextAppointment ? formatUpcoming(nextAppointment.scheduled_at) : 'Aucun RDV'

        return (
          <Tile
            key={section.key}
            icon={section.icon}
            label={section.label}
            stat={stat}
            color={section.color}
            big={section.key === 'services'}
            delay={i * 0.04}
            onClick={() => onSelect(section.key)}
          />
        )
      })}
    </div>
  )
}
