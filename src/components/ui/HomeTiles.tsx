import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Tile } from '@/components/ui/Tile'
import { cn } from '@/lib/utils'

export function HomeTiles({ tabs, onSelect }: { tabs: TabKey[]; onSelect: (key: TabKey) => void }) {
  const { session } = useAuth()
  const [order, setOrder] = useState<TabKey[]>([])
  const [draggingKey, setDraggingKey] = useState<TabKey | null>(null)
  const draggedRef = useRef(false)
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

  const homeKeys: TabKey[] = ['services', 'absence', 'prestations', 'dossier', 'dossier_medical', 'formations', 'aide']
  const availableSections = useMemo(
    () => TILE_SECTIONS.filter((section) => tabs.includes(section.key) && homeKeys.includes(section.key)),
    [tabs],
  )

  useEffect(() => {
    const userId = session?.user.id
    const defaults = availableSections.map((section) => section.key)

    if (!userId) {
      setOrder(defaults)
      return
    }

    supabase
      .from('user_home_tile_order')
      .select('tab_key,position')
      .eq('staff_id', userId)
      .order('position')
      .then(({ data }) => {
        const saved = (data ?? [])
          .map((row) => row.tab_key as TabKey)
          .filter((key) => defaults.includes(key))
        setOrder([...saved, ...defaults.filter((key) => !saved.includes(key))])
      })
  }, [session?.user.id, availableSections])

  const sections = useMemo(() => {
    const positions = new Map(order.map((key, index) => [key, index]))
    return [...availableSections].sort(
      (a, b) => (positions.get(a.key) ?? 999) - (positions.get(b.key) ?? 999),
    )
  }, [availableSections, order])

  async function persistOrder(nextOrder: TabKey[]) {
    const userId = session?.user.id
    if (!userId) return

    await supabase.from('user_home_tile_order').upsert(
      nextOrder.map((tab_key, position) => ({
        staff_id: userId,
        tab_key,
        position,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'staff_id,tab_key' },
    )
  }

  function reorder(dragged: TabKey, target: TabKey) {
    if (dragged === target) return

    const current = sections.map((section) => section.key)
    const from = current.indexOf(dragged)
    const to = current.indexOf(target)
    if (from < 0 || to < 0) return

    const next = [...current]
    next.splice(from, 1)
    next.splice(to, 0, dragged)
    draggedRef.current = true
    setOrder(next)
  }

  function finishDrag() {
    const next = sections.map((section) => section.key)
    setDraggingKey(null)
    window.setTimeout(() => {
      draggedRef.current = false
    }, 0)
    void persistOrder(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[var(--ink)]/30 text-[11px] px-1 hidden sm:flex items-center gap-1.5">
        <GripVertical size={13} />
        Clique, déplace puis lâche une tuile pour personnaliser ton accueil.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {sections.map((section, i) => {
          let stat: string | null = null
          if (section.key === 'services') stat = `${enService}`
          if (section.key === 'absence') stat = `${mesAbsencesAVenir}`

          return (
            <div
              key={section.key}
              draggable
              onDragStart={(event) => {
                setDraggingKey(section.key)
                draggedRef.current = false
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', section.key)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                if (draggingKey) reorder(draggingKey, section.key)
              }}
              onDrop={(event) => {
                event.preventDefault()
                finishDrag()
              }}
              onDragEnd={finishDrag}
              className={cn(
                'relative cursor-grab active:cursor-grabbing transition-opacity',
                section.key === 'services' && 'col-span-2',
                draggingKey === section.key && 'opacity-55',
              )}
            >
              <Tile
                icon={section.icon}
                label={section.label}
                stat={stat}
                color={section.color}
                big={section.key === 'services'}
                delay={i * 0.04}
                onClick={() => {
                  if (draggedRef.current) return
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
