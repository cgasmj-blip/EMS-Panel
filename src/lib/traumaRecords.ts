export type TraumaHistory = { actor: string; assigned_to: string; assigned_staff?: string[]; at: string; action: string }
export type TraumaRecord = { id: string; title: string; patient_first_name: string | null; patient_last_name: string | null; created_by: string; assigned_to: string; assigned_staff?: string[]; status: string; deleted_at?: string | null; deleted_by?: string | null; version: number; updated_at: string; history: TraumaHistory[] }
export const TRAUMA_FIELDS = 'id,title,patient_first_name:payload->>patientFirstName,patient_last_name:payload->>patientLastName,created_by,assigned_to,assigned_staff,status,deleted_at,deleted_by,version,updated_at,history'
export const patientName = (record: Pick<TraumaRecord, 'patient_first_name' | 'patient_last_name'>) => [record.patient_last_name, record.patient_first_name].filter(Boolean).join(' ')
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const assignedPeople = (record: { assigned_to: string; assigned_staff?: string[] }) => record.assigned_staff?.length ? record.assigned_staff : [record.assigned_to]
export const isAssigned = (record: { assigned_to: string; assigned_staff?: string[] }, userId?: string) => !!userId && assignedPeople(record).includes(userId)
export function matchesPatient(record: TraumaRecord, query: string) {
  const haystack = normalizeSearch(`${patientName(record)} ${record.title}`)
  return normalizeSearch(query).split(/\s+/).every(word => haystack.includes(word))
}
export function receivedTraumaNotifications(records: TraumaRecord[], userId: string) {
  return records.filter(record => !record.deleted_at && isAssigned(record, userId)).flatMap(record => {
    const transfer = [...record.history].reverse().find(h => h.action === 'transferred' && isAssigned(h, userId) && h.actor !== userId)
    return transfer ? [{ id: `trauma-${record.id}-${transfer.at}`, kind: 'trauma' as const, title: 'Nouveau dossier patient reçu', detail: `${patientName(record) || record.title} · ${record.status === 'completed' ? 'Dossier terminé' : 'Dossier en cours à reprendre'}`, created_at: transfer.at, target: 'dossier_medical' as const, recordId: record.id }] : []
  })
}
