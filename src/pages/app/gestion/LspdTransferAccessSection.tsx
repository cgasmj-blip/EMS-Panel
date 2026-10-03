import { useState } from 'react'
import { Card } from '@/components/ui/Card'

const categories = [
 ['Suivi vétérinaire','Vétérinaire'],['Visite médicale périodique','Tous les EMS'],['C.A.S.','APU + affiliation C.A.S.'],['C.A.P.P.A.','AU + affiliation C.A.P.P.A.'],['Arrêt de travail','Tous les EMS'],['Arrêt maladie','Tous les EMS'],['Facturation LSPD','Tous les EMS'],['Casier judiciaire vierge','Tous les EMS'],['Messagerie Direction','Direction / accès dédié'],
] as const

export function LspdTransferAccessSection(){
 const [saved,setSaved]=useState<string|null>(null)
 return <div className="space-y-3">
  <Card className="p-4"><p className="font-bold text-[var(--ink)]">Accès aux transferts LSPD</p><p className="mt-1 text-sm text-[var(--ink)]/50">Gestion des autorisations par dossier. Les réglages détaillés grade / sous-grade / affiliation seront synchronisés avec la passerelle.</p></Card>
  {categories.map(([label,access])=><Card key={label} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[var(--ink)]">{label}</p><p className="text-xs text-[var(--ink)]/45">Configuration actuelle : {access}</p></div><button type="button" onClick={()=>{setSaved(label);setTimeout(()=>setSaved(null),1800)}} className="rounded-xl border border-[var(--ink)]/10 px-3 py-2 text-xs font-semibold hover:bg-[var(--ink)]/5">{saved===label?'Enregistré':'Gérer les accès'}</button></div></Card>)}
 </div>
}
