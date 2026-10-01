import { Siren, UserX, Receipt, CalendarClock, HelpCircle, History, ShieldCheck, Stethoscope, FileHeart, FolderOpen, type LucideIcon } from 'lucide-react'

export type TabKey = 'services' | 'absence' | 'prestations' | 'agenda' | 'dossier' | 'dossier_medical' | 'formations' | 'aide' | 'historique' | 'gestion'

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
  { key: 'dossier', label: 'Dossier traumatologique', icon: Stethoscope, color: 'var(--tile-services)' },
  { key: 'dossier_medical', label: 'Dossier médical', icon: FileHeart, color: 'var(--tile-dossier)' },
  { key: 'formations', label: 'Documents', icon: FolderOpen, color: 'var(--tile-hierarchy)' },
  { key: 'aide', label: 'Aide', icon: HelpCircle, color: 'var(--tile-aide)' },
  { key: 'historique', label: 'Historique', icon: History, color: 'var(--tile-historique)' },
  { key: 'gestion', label: 'Gestion', icon: ShieldCheck, color: 'var(--tile-gestion)', seniorOnly: true },
]
