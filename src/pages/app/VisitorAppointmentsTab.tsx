import { VisitorRequestsSection } from './gestion/VisitorRequestsSection'

const TYPES = ['rendez_vous'] as const

export function VisitorAppointmentsTab() {
  return <VisitorRequestsSection types={[...TYPES]} title="Rendez-vous" />
}
