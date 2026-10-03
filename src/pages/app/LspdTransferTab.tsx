import { useMemo, useState } from 'react'
import { Bone, CalendarCheck, FileBadge, FileCheck2, FileClock, FileText, MessageSquareText, Receipt, ShieldCheck, Upload } from 'lucide-react'

const folders = [
  { key: 'veterinary_followup', label: 'Suivi vétérinaire', detail: 'Prénom de l’animal + document', access: 'Accès configurable', icon: Bone },
  { key: 'periodic_medical_visit', label: 'Visite médicale périodique', detail: 'Nom, prénom + document', access: 'Tous les EMS par défaut', icon: CalendarCheck },
  { key: 'cas', label: 'C.A.S.', detail: 'Nom, prénom + document', access: 'Affiliation C.A.S. par défaut', icon: FileBadge },
  { key: 'cappa', label: 'C.A.P.P.A.', detail: 'Nom, prénom + document', access: 'A.U. + affiliation C.A.P.P.A.', icon: FileCheck2 },
  { key: 'work_stoppage', label: 'Arrêt de travail', detail: 'Nom, prénom + document', access: 'Tous les EMS par défaut', icon: FileClock },
  { key: 'sick_leave', label: 'Arrêt maladie', detail: 'Nom, prénom + document', access: 'Tous les EMS par défaut', icon: FileText },
  { key: 'billing', label: 'Facturation LSPD', detail: 'Nom, prénom, référence + facture', access: 'Tous les EMS par défaut', icon: Receipt },
  { key: 'criminal_record_request', label: 'Casier judiciaire vierge', detail: 'Nom et prénom — demande au LSPD', access: 'Tous les EMS par défaut', icon: ShieldCheck },
] as const

export function LspdTransferTab() {
  const [selected, setSelected] = useState<(typeof folders)[number]['key'] | null>(null)
  const current = useMemo(() => folders.find((folder) => folder.key === selected) ?? null, [selected])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red/15 text-red">
            <Upload size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-black text-[var(--ink)]">Liaison directe EMS ↔ LSPD</h2>
            <p className="mt-1 text-sm text-[var(--ink)]/55">Choisissez le dossier à transmettre. Les autorisations par grade, sous-grade et affiliation sont gérées pour chaque type de document.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {folders.map((folder) => {
          const Icon = folder.icon
          return (
            <button
              key={folder.key}
              type="button"
              onClick={() => setSelected(folder.key)}
              className="group rounded-2xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-red/30 hover:bg-red/[0.06]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/70 group-hover:bg-red/15 group-hover:text-red">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-[var(--ink)]">{folder.label}</p>
                  <p className="mt-1 text-xs text-[var(--ink)]/50">{folder.detail}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)]/35">{folder.access}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="w-full rounded-2xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] p-4 text-left transition hover:border-red/30 hover:bg-red/[0.06]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/15 text-red"><MessageSquareText size={18} /></span>
          <div>
            <p className="font-bold text-[var(--ink)]">Messagerie Direction</p>
            <p className="mt-1 text-xs text-[var(--ink)]/50">Messages, images, documents, factures et rendez-vous — accès configurable par la Direction.</p>
          </div>
        </div>
      </button>

      {current && (
        <div className="rounded-2xl border border-red/20 bg-red/[0.05] p-4">
          <p className="font-bold text-[var(--ink)]">{current.label}</p>
          <p className="mt-1 text-sm text-[var(--ink)]/55">Le formulaire d’envoi sécurisé sera activé via la passerelle interservices. Aucune donnée LSPD n’est exposée au panel EMS.</p>
        </div>
      )}
    </div>
  )
}
