import { VisitorRequestsSection } from './gestion/VisitorRequestsSection'

const TYPES = ['question', 'rendez_vous'] as const

export function ProfessionalMessagesTab() {
  return <VisitorRequestsSection types={[...TYPES]} title="Messages patients" />
}
