import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Tile } from '@/components/ui/Tile'
import { cn } from '@/lib/utils'

type TileGeometry = {
  x: number
  y: number
  w: number
  h: number
}

function defaultGeometry(index: number, key: TabKey): TileGeometry {
  const cols = 4
  const gap = 1.2
  const w = key === 'services' ? 48.8 : 23.2
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: col * (23.2 + gap),
    y: row * 170,
    w,
    h: key === 'services' ? 185 : 145,
  }
}

export function HomeTiles({
  keys,
  onSelect,
  onMove,
  nextAppointment,
  tileColors,
  tileShape,
  editMode,
  onFinishEdit,
}: {
  keys: TabKey[]
  onSelect: (key: TabKey) => void
  onMove: (key: TabKey, zone: 'home' | 'sidebar', target?: TabKey) => void
  nextAppointment: { scheduled_at: string; title: string | null; type: string } | null
  tileColors: Record<string, string>
  tileShape: 'square' | 'soft' | 'rounded' | 'pill'
  editMode: boolean
  onFinishEdit: () => void
}) {
  const { session } = useAuth()
  const [enService, setEnService] = useState(0)
  const [mesAbsencesAVenir, setMesAbsencesAVenir] = useState(0)
  const [geometry, setGeometry] = useState<Record<string, TileGeometry>>({})
  const canvasRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return

    supabase
      .from('user_home_tile_geometry')
      .select('tab_key,x,y,w,h')
      .eq('staff_id', userId)
      .then(({ data }) => {
        const next: Record<string, TileGeometry> = {}
        for (const row of data ?? []) {
          next[row.tab_key] = {
            x: Number(row.x),
            y: Number(row.y),
            w: Number(row.w),
            h: Number(row.h),
          }
        }
        setGeometry(next)
      })
  }, [session?.user.id])

  const sections = keys
    .map((key) => TILE_SECTIONS.find((section) => section.key === key))
    .filter(Boolean) as typeof TILE_SECTIONS

  const effectiveGeometry = useMemo(() => {
    const next: Record<string, TileGeometry> = {}
    sections.forEach((section, index) => {
      next[section.key] = geometry[section.key] ?? defaultGeometry(index, section.key)
    })
    return next
  }, [sections, geometry])

  async function persistGeometry(key: TabKey, value: TileGeometry) {
    const userId = session?.user.id
    if (!userId) return

    await supabase.from('user_home_tile_geometry').upsert({
      staff_id: userId,
      tab_key: key,
      x: Number(value.x.toFixed(2)),
      y: Math.round(value.y),
      w: Number(value.w.toFixed(2)),
      h: Math.round(value.h),
      updated_at: new Date().toISOString(),
    })
  }

  function startMove(event: ReactPointerEvent<HTMLElement>, key: TabKey) {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const start = effectiveGeometry[key]
    const rect = canvas.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId
    event.currentTarget.setPointerCapture(pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      const dxPercent = ((moveEvent.clientX - startX) / rect.width) * 100
      const dy = moveEvent.clientY - startY
      const next = {
        ...start,
        x: Math.max(0, Math.min(100 - start.w, start.x + dxPercent)),
        y: Math.max(0, start.y + dy),
      }
      setGeometry((current) => ({ ...current, [key]: next }))
    }

    const onUp = (upEvent: PointerEvent) => {
      const dxPercent = ((upEvent.clientX - startX) / rect.width) * 100
      const dy = upEvent.clientY - startY
      const next = {
        ...start,
        x: Math.max(0, Math.min(100 - start.w, start.x + dxPercent)),
        y: Math.max(0, start.y + dy),
      }
      setGeometry((current) => ({ ...current, [key]: next }))
      void persistGeometry(key, next)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(event: ReactPointerEvent<HTMLElement>, key: TabKey) {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const start = effectiveGeometry[key]
    const rect = canvas.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId
    event.currentTarget.setPointerCapture(pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      const dwPercent = ((moveEvent.clientX - startX) / rect.width) * 100
      const dh = moveEvent.clientY - startY
      const next = {
        ...start,
        w: Math.max(14, Math.min(100 - start.x, start.w + dwPercent)),
        h: Math.max(105, Math.min(420, start.h + dh)),
      }
      setGeometry((current) => ({ ...current, [key]: next }))
    }

    const onUp = (upEvent: PointerEvent) => {
      const dwPercent = ((upEvent.clientX - startX) / rect.width) * 100
      const dh = upEvent.clientY - startY
      const next = {
        ...start,
        w: Math.max(14, Math.min(100 - start.x, start.w + dwPercent)),
        h: Math.max(105, Math.min(420, start.h + dh)),
      }
      setGeometry((current) => ({ ...current, [key]: next }))
      void persistGeometry(key, next)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function dragKey(event: DragEvent, key: TabKey) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-ems-tab', key)
    event.dataTransfer.setData('text/plain', key)
  }

  function readDraggedKey(event: DragEvent): TabKey | null {
    const key = event.dataTransfer.getData('application/x-ems-tab') || event.dataTransfer.getData('text/plain')
    return TILE_SECTIONS.some((section) => section.key === key) ? (key as TabKey) : null
  }

  function tileStat(key: TabKey) {
    if (key === 'services') return `${enService}`
    if (key === 'absence') return `${mesAbsencesAVenir}`
    if (key === 'agenda' && nextAppointment) {
      const date = new Date(nextAppointment.scheduled_at)
      return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    }
    return null
  }

  function openSection(key: TabKey) {
    if (key === 'dossier_medical') {
      window.open('https://ljlife.online/admin/pages/ambulance/ems.php', '_blank', 'noopener,noreferrer')
      return
    }
    onSelect(key)
  }

  const tileRadius = cn(
    tileShape === 'square' && 'rounded-none',
    tileShape === 'soft' && 'rounded-lg',
    tileShape === 'rounded' && 'rounded-3xl',
    tileShape === 'pill' && 'rounded-[2.5rem]',
  )

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <div
        className="md:hidden grid grid-cols-2 gap-3 min-h-[120px] rounded-2xl"
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
        {sections.map((section, i) => (
          <div
            key={section.key}
            draggable
            onDragStart={(event) => dragKey(event, section.key)}
            className={cn('relative h-full cursor-grab active:cursor-grabbing', section.key === 'services' && 'col-span-2')}
          >
            <Tile
              icon={section.icon}
              label={section.label}
              stat={tileStat(section.key)}
              color={tileColors[section.key] ?? section.color}
              big={section.key === 'services'}
              delay={i * 0.04}
              className={cn('w-full h-full', tileRadius)}
              onClick={() => openSection(section.key)}
            />
          </div>
        ))}
      </div>

      <div
        ref={canvasRef}
        className="hidden md:block relative w-full flex-1 min-h-0 h-full overflow-hidden"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          event.preventDefault()
          const key = readDraggedKey(event)
          if (!key) return

          if (!keys.includes(key)) {
            const rect = event.currentTarget.getBoundingClientRect()
            const dropped = {
              ...defaultGeometry(keys.length, key),
              x: Math.max(0, Math.min(76, ((event.clientX - rect.left) / rect.width) * 100 - 11)),
              y: Math.max(0, event.clientY - rect.top - 70),
            }
            setGeometry((current) => ({ ...current, [key]: dropped }))
            void persistGeometry(key, dropped)
            onMove(key, 'home')
          }
        }}
      >
        {sections.map((section, i) => {
          const item = effectiveGeometry[section.key]
          return (
            <div
              key={section.key}
              draggable={!editMode}
              onDragStart={(event) => {
                if (!editMode) dragKey(event, section.key)
              }}
              className={cn(
                'absolute',
                editMode
                  ? 'cursor-move select-none touch-none ring-2 ring-white/40 ring-offset-2 ring-offset-transparent'
                  : 'cursor-grab active:cursor-grabbing',
              )}
              style={{
                left: `${item.x}%`,
                top: item.y,
                width: `${item.w}%`,
                height: item.h,
              }}
              onPointerDown={(event) => {
                if (!editMode) return
                const target = event.target as HTMLElement
                if (target.closest('[data-tile-resize]')) return
                startMove(event, section.key)
              }}
            >
              <Tile
                icon={section.icon}
                label={section.label}
                stat={tileStat(section.key)}
                color={tileColors[section.key] ?? section.color}
                big={section.key === 'services'}
                delay={i * 0.04}
                className={cn(
                  'w-full h-full min-h-0',
                  tileRadius,
                  editMode && 'pointer-events-none',
                )}
                onClick={() => {
                  if (!editMode) openSection(section.key)
                }}
              />

              {editMode && (
                <button
                  type="button"
                  data-tile-resize
                  onPointerDown={(event) => startResize(event, section.key)}
                  className="absolute -bottom-2 -right-2 z-30 w-6 h-6 rounded-full bg-white text-black border-2 border-black/15 shadow-lg cursor-se-resize touch-none flex items-center justify-center"
                  title="Redimensionner"
                  aria-label={`Redimensionner ${section.label}`}
                >
                  <span className="block w-2.5 h-2.5 border-r-2 border-b-2 border-black/70" />
                </button>
              )}
            </div>
          )
        })}
        {editMode && (
          <button
            type="button"
            onClick={onFinishEdit}
            className="fixed right-5 bottom-6 z-[60] hidden md:flex items-center gap-2 rounded-xl bg-red px-4 py-2.5 text-sm font-semibold text-white shadow-xl cursor-pointer"
          >
            Terminer
          </button>
        )}
      </div>
    </div>
  )
}
