import { ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const MEDICAL_URL = 'https://ljlife.online/admin/pages/ambulance/ems.php'

export function DossierMedicalTab() {
  return (
    <Card className="p-5">
      <h2 className="text-[var(--ink)] font-bold text-sm mb-2">Dossier médical</h2>
      <p className="text-[var(--ink)]/45 text-sm mb-4">
        L'accès à cette page passe par le panel EMS authentifié avec Discord.
      </p>
      <a href={MEDICAL_URL} target="_blank" rel="noreferrer">
        <Button type="button" variant="red">
          <ExternalLink size={14} /> Ouvrir le dossier médical
        </Button>
      </a>
    </Card>
  )
}
