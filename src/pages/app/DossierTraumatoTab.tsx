import { ArrowLeft, ExternalLink, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const DOSSIER_URL = 'https://dossier-traumatologique-ems-los-santos.ketchup-arya.chatgpt.site/'

export function DossierTraumatoTab({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={14} /> Retour au panel
          </Button>
          <p className="text-[var(--ink)]/50 text-xs">Dossier traumatologique EMS Los Santos</p>
        </div>
        <div className="flex gap-2">
          <a href={DOSSIER_URL} target="_blank" rel="noreferrer">
            <Button type="button" variant="ghost" size="sm">
              <ExternalLink size={14} /> Ouvrir
            </Button>
          </a>
          <a href={`${import.meta.env.BASE_URL}dossier-traumatologique.html`} download="dossier-traumatologique-EMS.html">
            <Button type="button" variant="ghost" size="sm">
              <Download size={14} /> Télécharger
            </Button>
          </a>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <iframe
          src={DOSSIER_URL}
          title="Dossier traumatologique EMS Los Santos"
          className="w-full border-0"
          style={{ minHeight: '78vh' }}
          allow="clipboard-read; clipboard-write"
        />
      </Card>
    </div>
  )
}
