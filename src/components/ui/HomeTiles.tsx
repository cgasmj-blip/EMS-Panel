import { useEffect, useState } from 'react'
import { supabase, type Appointment } from '@/lib/supabase'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Tile } from '@/components/ui/Tile'

function formatUpcoming(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export function HomeTiles({ tabs, onSelect }: { tabs: TabKey[]; onSelect: (key: TabKey) => void }) {
  const [enService, setEnService] = useState(0)
  const [absencesEnAttente, setAbsencesEnAttente] = useState(0)
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null)

  useEffect(() => {
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_service')
      .eq('active', true)
      .neq('role', 'membre')
      .then(({ count }) => setEnService(count ?? 0))
    supabase
      .from('absences')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_attente')
      .then(({ count }) => setAbsencesEnAttente(count ?? 0))
    supabase
      .from('appointments')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .then(({ data }) => setNextAppointment(data?.[0] ?? null))
  }, [])

  const sections = TILE_SECTIONS.filter((s) => tabs.includes(s.key))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {sections.map((section, i) => {
        let stat: string | null = null
        if (section.key === 'services') stat = `${enService}`
        if (section.key === 'absence') stat = `${absencesEnAttente}`
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
