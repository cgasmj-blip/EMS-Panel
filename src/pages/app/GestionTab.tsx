import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { isDirection } from '@/lib/supabase'
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

export function GestionTab() {
  const { staff } = useAuth()
  const [view, setViewState] = useState<GestionKey | 'home'>(getStoredView)

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
          {sections.map((s, i) => (
            <Tile key={s.key} icon={s.icon} label={s.label} color={s.color} delay={i * 0.04} onClick={() => setView(s.key)} />
          ))}
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
