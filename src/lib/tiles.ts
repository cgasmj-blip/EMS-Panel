import { Siren, UserX, Receipt, CalendarClock, HelpCircle, History, ShieldCheck, Stethoscope, type LucideIcon } from 'lucide-react'

export type TabKey = 'services' | 'absence' | 'prestations' | 'agenda' | 'dossier' | 'aide' | 'historique' | 'gestion'

export interface TileSection {
  key: TabKey
  label: string
  icon: LucideIcon
  color: string
  seniorOnly?: boolean
}

export const TILE_SECTIONS: TileSection[] = [
  { key: 'services', label: 'Services', icon: Siren, color: 'var(--tile-services)' },
  { key: 'absence', label: 'Absence', icon: UserX, color: 'var(--tile-absence)' },
  { key: 'prestations', label: 'Prestations', icon: Receipt, color: 'var(--tile-prestations)' },
  { key: 'agenda', label: 'Agenda', icon: CalendarClock, color: 'var(--tile-agenda)' },
  { key: 'dossier', label: 'Dossier traumato', icon: Stethoscope, color: 'var(--tile-services)' },
  { key: 'aide', label: 'Aide', icon: HelpCircle, color: 'var(--tile-aide)' },
  { key: 'historique', label: 'Historique', icon: History, color: 'var(--tile-historique)' },
  { key: 'gestion', label: 'Gestion', icon: ShieldCheck, color: 'var(--tile-gestion)', seniorOnly: true },
]
