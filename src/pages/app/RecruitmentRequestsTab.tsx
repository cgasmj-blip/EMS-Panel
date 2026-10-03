import { VisitorRequestsSection } from './gestion/VisitorRequestsSection'

const TYPES = ['recrutement'] as const

export function RecruitmentRequestsTab() {
  return <VisitorRequestsSection types={[...TYPES]} title="Candidatures EMS" />
}
