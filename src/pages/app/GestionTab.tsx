import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { isDirection, supabase, type Appointment } from '@/lib/supabase'
import { GESTION_SECTIONS, type GestionKey } from '@/lib/gestionTiles'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Tile } from '@/components/ui/Tile'
import { UsersSection } from './gestion/UsersSection'
import { ServicesSection } from './gestion/ServicesSection'
import { AbsencesSection } from './gestion/AbsencesSection'
import { TarifsSection } from './gestion/TarifsSection'
import { CodesSection } from './gestion/CodesSection'
import { AideSection } from './gestion/AideSection'
import { PayesSection } from './gestion/PayesSection'
import { ArchiveSection } from './gestion/ArchiveSection'
import { RdvSection } from './gestion/RdvSection'
import { VehiclesSection } from './gestion/VehiclesSection'
import { HistoriqueSection } from './gestion/HistoriqueSection'
import { HierarchySection } from './gestion/HierarchySection'

const SECTION_CONTENT: Record<GestionKey, ReactNode> = {
  users: <UsersSection />,
  services: <ServicesSection />,
  absences: <AbsencesSection />,
  tarifs: <TarifsSection />,
  codes: <CodesSection />,
  aide: <AideSection />,
  payes: <PayesSection />,
  archive: <ArchiveSection />,
  rdv: <RdvSection />,
  vehicles: <VehiclesSection />,
  historique: <HistoriqueSection />,
  hierarchy: <HierarchySection />,
}

const VIEW_STORAGE_KEY = 'ems-gestion-view'

function getStoredView(): GestionKey | 'home' {
  if (typeof window === 'undefined') return 'home'
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
  return (stored as GestionKey | 'home') || 'home'
}

function formatUpcoming(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export function GestionTab() {
  const { staff } = useAuth()
  const [view, setViewState] = useState<GestionKey | 'home'>(getStoredView)
  const [absenceCount, setAbsenceCount] = useState(0)
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null)

  const refreshManagementStats = useCallback(async () => {
    if (!isDirection(staff?.role)) {
      setAbsenceCount(0)
      setNextAppointment(null)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const now = new Date().toISOString()

    const [{ count }, { data }] = await Promise.all([
      supabase
        .from('absences')
        .select('id', { count: 'exact', head: true })
        .gte('end_date', today)
        .neq('status', 'refusee'),
      supabase
        .from('appointments')
        .select('*')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(1),
    ])

    setAbsenceCount(count ?? 0)
    setNextAppointment(data?.[0] ?? null)
  }, [staff?.role])

  useEffect(() => {
    refreshManagementStats()
    const timer = window.setInterval(refreshManagementStats, 25_000)
    return () => window.clearInterval(timer)
  }, [refreshManagementStats])

  function setView(next: GestionKey | 'home') {
    setViewState(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const sections = GESTION_SECTIONS.filter((s) => !s.directionOnly || isDirection(staff?.role))
  const effectiveView = view !== 'home' && !sections.some((s) => s.key === view) ? 'home' : view
  const activeSection = effectiveView === 'home' ? null : sections.find((s) => s.key === effectiveView) ?? null

  return (
    <AnimatePresence mode="wait">
      {effectiveView === 'home' ? (
        <motion.div
          key="gestion-home"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
        >
          {sections.map((s, i) => {
            let stat: string | null = null
            if (s.key === 'absences') stat = `${absenceCount}`
            if (s.key === 'rdv') stat = nextAppointment ? formatUpcoming(nextAppointment.scheduled_at) : 'Aucun RDV'

            return (
              <Tile
                key={s.key}
                icon={s.icon}
                label={s.label}
                stat={stat}
                color={s.color}
                delay={i * 0.04}
                onClick={() => setView(s.key)}
              />
            )
          })}
        </motion.div>
      ) : (
        <motion.div
          key={effectiveView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-6"
        >
          {activeSection && (
            <SectionHeader label={activeSection.label} icon={activeSection.icon} color={activeSection.color} onBack={() => setView('home')} />
          )}
          {SECTION_CONTENT[effectiveView]}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
