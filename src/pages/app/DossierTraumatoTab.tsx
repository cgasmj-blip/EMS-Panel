import { Card } from '@/components/ui/Card'

const DOSSIER_URL = `${import.meta.env.BASE_URL}traumatologie/index.html`

export function DossierTraumatoTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="font-semibold">Dossier traumatologique EMS Los Santos</h2>
        <p className="text-[var(--ink)]/60 text-xs mt-1">
          Complétez l’évaluation, ajoutez les examens et générez le compte rendu PNG directement ici.
        </p>
      </Card>
      <Card className="overflow-hidden p-0">
        <iframe
          src={DOSSIER_URL}
          title="Dossier traumatologique EMS Los Santos"
          className="w-full border-0"
          style={{ minHeight: '85vh' }}
        />
      </Card>
    </div>
  )
}
