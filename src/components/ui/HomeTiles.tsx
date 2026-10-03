import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Tile } from '@/components/ui/Tile'

export function HomeTiles({ tabs, onSelect }: { tabs: TabKey[]; onSelect: (key: TabKey) => void }) {
  const { session } = useAuth()
  const [favorites, setFavorites] = useState<string[]>([])
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

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setFavorites([])
      return
    }
    supabase
      .from('user_favorites')
      .select('tab_key')
      .eq('staff_id', userId)
      .then(({ data }) => setFavorites((data ?? []).map((row) => row.tab_key)))
  }, [session?.user.id])

  async function toggleFavorite(key: TabKey) {
    const userId = session?.user.id
    if (!userId) return
    const isFavorite = favorites.includes(key)
    setFavorites((current) => isFavorite ? current.filter((x) => x !== key) : [...current, key])

    if (isFavorite) {
      await supabase.from('user_favorites').delete().eq('staff_id', userId).eq('tab_key', key)
    } else {
      await supabase.from('user_favorites').upsert({ staff_id: userId, tab_key: key })
    }
  }

  const homeKeys: TabKey[] = ['services', 'absence', 'prestations', 'dossier', 'dossier_medical', 'formations', 'aide']
  const sections = TILE_SECTIONS
    .filter((s) => tabs.includes(s.key) && homeKeys.includes(s.key))
    .sort((a, b) => Number(favorites.includes(b.key)) - Number(favorites.includes(a.key)))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {sections.map((section, i) => {
        let stat: string | null = null
        if (section.key === 'services') stat = `${enService}`
        if (section.key === 'absence') stat = `${mesAbsencesAVenir}`

        return (
          <Tile
            key={section.key}
            icon={section.icon}
            label={section.label}
            stat={stat}
            color={section.color}
            big={section.key === 'services'}
            delay={i * 0.04}
            favorite={favorites.includes(section.key)}
            onToggleFavorite={() => toggleFavorite(section.key)}
            onClick={() => {
              if (section.key === 'dossier_medical') {
                window.open('https://ljlife.online/admin/pages/ambulance/ems.php', '_blank', 'noopener,noreferrer')
                return
              }
              onSelect(section.key)
            }}
          />
        )
      })}
    </div>
  )
}
