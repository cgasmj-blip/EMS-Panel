import { VisitorRequestsSection } from './gestion/VisitorRequestsSection'

const TYPES = ['question'] as const

export function ProfessionalMessagesTab() {
  return <VisitorRequestsSection types={[...TYPES]} title="Messages professionnels" />
}
