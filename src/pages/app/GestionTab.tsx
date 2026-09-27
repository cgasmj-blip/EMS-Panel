import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, UsersRound } from 'lucide-react'
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

type GestionView = GestionKey | 'home' | 'employees' | 'hospital'

const EMPLOYEE_KEYS: GestionKey[] = [
  'users',
  'services',
  'absences',
  'payes',
  'archive',
  'rdv',
  'historique',
]

const HOSPITAL_KEYS: GestionKey[] = GESTION_SECTIONS
  .map((section) => section.key)
  .filter((key) => !EMPLOYEE_KEYS.includes(key))

const VIEW_STORAGE_KEY = 'ems-gestion-view'

function getStoredView(): GestionView {
  if (typeof window === 'undefined') return 'home'
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY) as GestionView | null
  return stored || 'home'
}

function formatUpcoming(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export function GestionTab() {
  const { staff } = useAuth()
  const [view, setViewState] = useState<GestionView>(getStoredView)
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

  function setView(next: GestionView) {
    setViewState(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const sections = GESTION_SECTIONS.filter((s) => !s.directionOnly || isDirection(staff?.role))
  const validSectionKeys = sections.map((s) => s.key)
  const employeeSections = sections.filter((s) => EMPLOYEE_KEYS.includes(s.key))
  const hospitalSections = sections.filter((s) => HOSPITAL_KEYS.includes(s.key))

  const effectiveView: GestionView =
    view === 'home' || view === 'employees' || view === 'hospital' || validSectionKeys.includes(view as GestionKey)
      ? view
      : 'home'

  const activeSection =
    effectiveView !== 'home' && effectiveView !== 'employees' && effectiveView !== 'hospital'
      ? sections.find((s) => s.key === effectiveView) ?? null
      : null

  const parentView =
    activeSection && EMPLOYEE_KEYS.includes(activeSection.key)
      ? 'employees'
      : activeSection
        ? 'hospital'
        : 'home'

  const renderSectionTiles = (items: typeof sections) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      {items.map((s, i) => {
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
    </div>
  )

  return (
    <AnimatePresence mode="wait">
      {effectiveView === 'home' ? (
        <motion.div
          key="gestion-home"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Tile
            icon={UsersRound}
            label="Gestion employés"
            color="var(--tile-services)"
            onClick={() => setView('employees')}
          />
          <Tile
            icon={Building2}
            label="Gestion hôpital"
            color="var(--tile-gestion)"
            delay={0.04}
            onClick={() => setView('hospital')}
          />
        </motion.div>
      ) : effectiveView === 'employees' || effectiveView === 'hospital' ? (
        <motion.div
          key={effectiveView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-6"
        >
          <SectionHeader
            label={effectiveView === 'employees' ? 'Gestion employés' : 'Gestion hôpital'}
            icon={effectiveView === 'employees' ? UsersRound : Building2}
            color={effectiveView === 'employees' ? 'var(--tile-services)' : 'var(--tile-gestion)'}
            onBack={() => setView('home')}
          />
          {renderSectionTiles(effectiveView === 'employees' ? employeeSections : hospitalSections)}
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
            <SectionHeader
              label={activeSection.label}
              icon={activeSection.icon}
              color={activeSection.color}
              onBack={() => setView(parentView)}
            />
          )}
          {activeSection && SECTION_CONTENT[activeSection.key]}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
