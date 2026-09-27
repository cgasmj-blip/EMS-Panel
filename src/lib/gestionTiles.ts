import {
  Users,
  Siren,
  CalendarOff,
  Wallet,
  SlidersHorizontal,
  HelpCircle,
  Banknote,
  CalendarClock,
  History,
  Archive,
  Car,
  Network,
  type LucideIcon,
} from 'lucide-react'

export type GestionKey =
  | 'users'
  | 'services'
  | 'absences'
  | 'tarifs'
  | 'codes'
  | 'aide'
  | 'payes'
  | 'archive'
  | 'rdv'
  | 'vehicles'
  | 'historique'
  | 'hierarchy'

export interface GestionSection {
  key: GestionKey
  label: string
  icon: LucideIcon
  color: string
  // Full-access-only: directeur/directeur-adjoint. Everyone else who can
  // reach Gestion at all (directeur de centre, chefs de pôle/service/
  // chirurgie) sees only the sections without this flag.
  directionOnly?: boolean
}

export const GESTION_SECTIONS: GestionSection[] = [
  { key: 'users', label: 'Utilisateurs', icon: Users, color: 'var(--tile-services)' },
  { key: 'services', label: 'Services', icon: Siren, color: 'var(--tile-absence)' },
  { key: 'absences', label: 'Absences', icon: CalendarOff, color: 'var(--tile-registre)' },
  { key: 'tarifs', label: 'Tarifs prestations', icon: Wallet, color: 'var(--tile-prestations)', directionOnly: true },
  { key: 'codes', label: 'Codes & interventions', icon: SlidersHorizontal, color: 'var(--tile-dossier)', directionOnly: true },
  { key: 'aide', label: 'Aide', icon: HelpCircle, color: 'var(--tile-aide)' },
  { key: 'payes', label: 'Gestion des payes', icon: Banknote, color: 'var(--tile-payes)' },
  { key: 'archive', label: 'Archive', icon: Archive, color: 'var(--tile-archive)', directionOnly: true },
  { key: 'rdv', label: 'RDV', icon: CalendarClock, color: 'var(--tile-rdv)', directionOnly: true },
  { key: 'vehicles', label: 'Véhicules', icon: Car, color: 'var(--tile-vehicles)', directionOnly: true },
  { key: 'historique', label: 'Historique', icon: History, color: 'var(--tile-historique)' },
  { key: 'hierarchy', label: 'Habilitations & Affiliations', icon: Network, color: 'var(--tile-hierarchy)', directionOnly: true },
]
