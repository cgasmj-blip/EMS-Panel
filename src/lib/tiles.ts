import { Siren, UserX, Receipt, CalendarClock, HelpCircle, History, ShieldCheck, type LucideIcon } from 'lucide-react'

export type TabKey = 'services' | 'absence' | 'prestations' | 'agenda' | 'aide' | 'historique' | 'gestion'

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
  { key: 'aide', label: 'Aide', icon: HelpCircle, color: 'var(--tile-aide)' },
  { key: 'historique', label: 'Historique', icon: History, color: 'var(--tile-historique)' },
  { key: 'gestion', label: 'Gestion', icon: ShieldCheck, color: 'var(--tile-gestion)', seniorOnly: true },
]
