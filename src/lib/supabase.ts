import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export type StaffRole =
  | 'directeur'
  | 'directeur_adjoint'
  | 'directeur_centre'
  | 'chef_pole'
  | 'chef_service'
  | 'chef_chirurgie'
  | 'chirurgien_expert'
  | 'chirurgien_vacataire'
  | 'chirurgien_specialise'
  | 'chirurgien'
  | 'medecin_chef'
  | 'urgentiste'
  | 'generaliste'
  | 'resident'
  | 'interne'
  | 'externe'
  | 'infirmier'
  | 'ambulancier'
  | 'aide_soignant'
  | 'membre'

export type DutyStatus = 'en_service' | 'en_pause' | 'hors_service'

export const ROLE_LABELS: Record<StaffRole, string> = {
  directeur: 'Directeur',
  directeur_adjoint: 'Directeur-Adjoint',
  directeur_centre: 'Directeur de centre',
  chef_pole: 'Chef de Pôle',
  chef_service: 'Chef de service',
  chef_chirurgie: 'Chef de chirurgie',
  chirurgien_expert: 'Chirurgien expert',
  chirurgien_vacataire: 'Chirurgien vacataire',
  chirurgien_specialise: 'Chirurgien spécialisé',
  chirurgien: 'Chirurgien',
  medecin_chef: 'Médecin-chef',
  urgentiste: 'Urgentiste',
  generaliste: 'Généraliste',
  resident: 'Résident',
  interne: 'Interne',
  externe: 'Externe',
  infirmier: 'Infirmier',
  ambulancier: 'Ambulancier',
  aide_soignant: 'Aide-soignant',
  membre: 'Membre E.M.S',
}

// 'membre' is the generic base role granted just by holding the E.M.S. gate
// role on Discord, before any real hierarchy rank is assigned. It's used to
// authorize login but must never be shown as a displayed grade.
export function displayRoleLabel(role: StaffRole): string | null {
  return role === 'membre' ? null : ROLE_LABELS[role]
}

export const STATUS_LABELS: Record<DutyStatus, string> = {
  en_service: 'En service',
  en_pause: 'En pause',
  hors_service: 'Hors service',
}

export const DISCORD_INVITE_URL = 'https://discord.gg/BqPNg7Ngt'

// Full Gestion access. Note this deliberately excludes directeur_centre,
// which (along with the chef de pôle/service/chirurgie roles) only gets the
// limited subset defined by GESTION_LIMITED_ROLES in gestionTiles.ts.
export const DIRECTION_ROLES: StaffRole[] = ['directeur', 'directeur_adjoint']

export function isDirection(role: StaffRole | undefined | null) {
  return !!role && DIRECTION_ROLES.includes(role)
}

// StaffRole is declared in hierarchy order (Directeur down to Membre), so its
// declaration order doubles as a rank table for "is this role senior to X".
const ROLE_ORDER = Object.keys(ROLE_LABELS) as StaffRole[]
const CHIRURGIEN_RANK = ROLE_ORDER.indexOf('chirurgien')

export function isAboveChirurgien(role: StaffRole | undefined | null) {
  if (!role) return false
  const rank = ROLE_ORDER.indexOf(role)
  return rank >= 0 && rank < CHIRURGIEN_RANK
}

export interface Staff {
  id: string
  discord_id: string | null
  full_name: string
  avatar_url: string | null
  role: StaffRole
  sous_grade_ids: string[]
  affiliation_ids: string[]
  status: DutyStatus
  shift_started_at: string | null
  unit_id: string | null
  active: boolean
  created_at: string
}

// A staff member can hold several sous-grades and affiliations at once (e.g.
// Recruteur and Formateur together), so they're stored in join tables and
// joined in via this select string, then flattened by mapStaffRow.
export const STAFF_SELECT_WITH_GRADES = '*, staff_sous_grades(sous_grade_id), staff_affiliations(affiliation_id)'

export function mapStaffRow(
  row: Omit<Staff, 'sous_grade_ids' | 'affiliation_ids'> & {
    staff_sous_grades?: { sous_grade_id: string }[] | null
    staff_affiliations?: { affiliation_id: string }[] | null
  },
): Staff {
  const { staff_sous_grades, staff_affiliations, ...rest } = row
  return {
    ...rest,
    sous_grade_ids: (staff_sous_grades ?? []).map((x) => x.sous_grade_id),
    affiliation_ids: (staff_affiliations ?? []).map((x) => x.affiliation_id),
  }
}

export interface SousGrade {
  id: string
  label: string
  position: number
}

// Sous-grade/affiliation labels are stored as "XX · Full description" so the
// meaning is documented in the DB, but the UI only ever shows the short code
// (e.g. "FU") — space is tight in badges/chips and the long form is noise.
export function shortLabel(label: string) {
  return label.split(' · ')[0]
}

export interface Affiliation {
  id: string
  label: string
  sous_grade_id: string | null
  position: number
}

export type EmergencyCode = string

export interface EmergencyCodeRow {
  code: EmergencyCode
  label: string
  position: number
}

export interface InterventionShortcut {
  id: number
  label: string
  position: number
  grade: StaffRole[] | null
  sous_grade_id: string | null
  affiliation_id: string | null
}

export interface Unit {
  id: string
  name: string
  sector: string | null
  code: EmergencyCode | null
  vehicule: string | null
  commentaire: string | null
  defibrillateur: boolean
  status: DutyStatus
  created_at: string
}

export interface Shift {
  id: number
  staff_id: string
  unit_name: string | null
  sector: string | null
  code: EmergencyCode | null
  vehicule: string | null
  commentaire: string | null
  defibrillateur: boolean
  status_label: string | null
  started_at: string
  ended_at: string | null
  created_at: string
  archived_at: string | null
  payout_id: number | null
}

export function slugify(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export type AbsenceStatus = 'en_attente' | 'validee' | 'refusee'

export interface Absence {
  id: number
  staff_id: string
  start_date: string
  end_date: string
  motif: string | null
  status: AbsenceStatus
  created_at: string
}

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  refusee: 'Refusée',
}

export interface PrestationType {
  id: string
  label: string
  tarif: number
  tarif_public: number | null
  grade: StaffRole[] | null
  sous_grade_id: string | null
  affiliation_id: string | null
  created_at: string
}

export function staffMatchesEligibility(
  staff: Pick<Staff, 'role' | 'sous_grade_ids' | 'affiliation_ids'>,
  restriction: { grade: StaffRole[] | null; sous_grade_id: string | null; affiliation_id: string | null },
) {
  if (restriction.grade && restriction.grade.length > 0 && !restriction.grade.includes(staff.role)) return false
  if (restriction.sous_grade_id && !staff.sous_grade_ids.includes(restriction.sous_grade_id)) return false
  if (restriction.affiliation_id && !staff.affiliation_ids.includes(restriction.affiliation_id)) return false
  return true
}

export interface Prestation {
  id: number
  staff_id: string
  prestation_type_id: string
  montant: number
  is_public: boolean
  details: string | null
  created_at: string
  archived_at: string | null
  payout_id: number | null
}

export interface Payout {
  id: number
  staff_id: string
  paid_by: string | null
  services_count: number
  prestations_count: number
  prestations_total: number
  commission: number
  paid_at: string
}

export interface AppointmentTypeRow {
  id: string
  label: string
  position: number
  grade: StaffRole[] | null
  sous_grade_id: string | null
  affiliation_id: string | null
}

export interface Appointment {
  id: number
  staff_id: string
  type: string
  title: string | null
  scheduled_at: string
  created_at: string
}

export interface Vehicle {
  id: number
  name: string
  grade: StaffRole[] | null
  sous_grade_id: string | null
  affiliation_id: string | null
  created_at: string
}

export interface HelpArticle {
  id: number
  title: string
  image_url: string | null
  content: string | null
  position: number
  created_at: string
}
