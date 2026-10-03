import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Tile } from '@/components/ui/Tile'
import { cn } from '@/lib/utils'

export function HomeTiles({
  keys,
  onSelect,
  onMove,
  nextAppointment,
  tileColors,
  tileShape,
}: {
  keys: TabKey[]
  onSelect: (key: TabKey) => void
  onMove: (key: TabKey, zone: 'home' | 'sidebar', target?: TabKey) => void
  nextAppointment: { scheduled_at: string; title: string | null; type: string } | null
  tileColors: Record<string, string>
  tileShape: 'square' | 'soft' | 'rounded' | 'pill'
}) {
  const { session } = useAuth()
  const [enService, setEnService] = useState(0)
  const [mesAbsencesAVenir, setMesAbsencesAVenir] = useState(0)

  const refreshStats = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const serviceQuery = supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_service')
      .eq('active', true)
      .neq('role', 'membre')

    const userId = session?.user.id

    const absenceQuery = userId
      ? supabase
          .from('absences')
          .select('id', { count: 'exact', head: true })
          .eq('staff_id', userId)
          .gte('end_date', today)
          .neq('status', 'refusee')
      : null

    const [serviceResult, absenceResult] = await Promise.all([
      serviceQuery,
      absenceQuery ?? Promise.resolve({ count: 0 }),
    ])

    setEnService(serviceResult.count ?? 0)
    setMesAbsencesAVenir(absenceResult.count ?? 0)
  }, [session?.user.id])

  useEffect(() => {
    refreshStats()
    const timer = window.setInterval(refreshStats, 25_000)
    return () => window.clearInterval(timer)
  }, [refreshStats])

  const sections = keys
    .map((key) => TILE_SECTIONS.find((section) => section.key === key))
    .filter(Boolean) as typeof TILE_SECTIONS

  function dragKey(event: DragEvent, key: TabKey) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-ems-tab', key)
    event.dataTransfer.setData('text/plain', key)
  }

  function readDraggedKey(event: DragEvent): TabKey | null {
    const key = event.dataTransfer.getData('application/x-ems-tab') || event.dataTransfer.getData('text/plain')
    return TILE_SECTIONS.some((section) => section.key === key) ? (key as TabKey) : null
  }

  return (
    <div className="flex flex-col gap-2">

      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 min-h-[120px] rounded-2xl"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          event.preventDefault()
          const key = readDraggedKey(event)
          if (key && !keys.includes(key)) onMove(key, 'home')
        }}
      >
        {sections.map((section, i) => {
          let stat: string | null = null
          if (section.key === 'services') stat = `${enService}`
          if (section.key === 'absence') stat = `${mesAbsencesAVenir}`
          if (section.key === 'agenda' && nextAppointment) {
            const date = new Date(nextAppointment.scheduled_at)
            stat = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          }

          return (
            <div
              key={section.key}
              draggable
              onDragStart={(event) => dragKey(event, section.key)}
              onDragOver={(event) => {
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const key = readDraggedKey(event)
                if (key) onMove(key, 'home', section.key)
              }}
              className={cn(
                'relative h-full cursor-grab active:cursor-grabbing',
                section.key === 'services' && 'col-span-2',
              )}
            >
              <Tile
                icon={section.icon}
                label={section.label}
                stat={stat}
                color={tileColors[section.key] ?? section.color}
                big={section.key === 'services'}
                delay={i * 0.04}
                className={cn(
                  'w-full h-full',
                  tileShape === 'square' && 'rounded-none',
                  tileShape === 'soft' && 'rounded-lg',
                  tileShape === 'rounded' && 'rounded-3xl',
                  tileShape === 'pill' && 'rounded-[2.5rem]',
                )}
                onClick={() => {
                  if (section.key === 'dossier_medical') {
                    window.open('https://ljlife.online/admin/pages/ambulance/ems.php', '_blank', 'noopener,noreferrer')
                    return
                  }
                  onSelect(section.key)
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
