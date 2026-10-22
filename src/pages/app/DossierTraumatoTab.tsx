import { Card } from '@/components/ui/Card'

const DOSSIER_URL = `${import.meta.env.BASE_URL}traumatologie/index.html`

export function DossierTraumatoTab() {
  return (
    <Card className="flex flex-1 min-h-0 min-w-0 overflow-hidden p-0">
      <iframe
        src={DOSSIER_URL}
        title="Dossier traumatologique EMS Los Santos"
        className="block h-full w-full min-h-0 flex-1 border-0"
      />
    </Card>
  )
}
