import { useEffect, useState } from 'react'
import { Save, Send } from 'lucide-react'
import { supabase, type Affiliation, type SousGrade } from '@/lib/supabase'
import { EligibilitySelector, type Eligibility } from '@/components/ui/EligibilitySelector'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const categories = [
 ['veterinary_followup','Suivi vétérinaire'],['periodic_medical_visit','Visite médicale périodique'],['cas','C.A.S.'],['cappa','C.A.P.P.A.'],['work_stoppage','Arrêt de travail'],['sick_leave','Arrêt maladie'],['billing','Facturation LSPD'],['criminal_record_request','Casier judiciaire vierge'],['direction_message','Messagerie Direction'],
] as const
const empty:Eligibility={grade:[],sous_grade_id:'',affiliation_id:''}

export function LspdTransferAccessSection(){
 const [sousGrades,setSousGrades]=useState<SousGrade[]>([]),[affiliations,setAffiliations]=useState<Affiliation[]>([])
 const [values,setValues]=useState<Record<string,Eligibility>>({})
 const [saved,setSaved]=useState<string|null>(null)
 useEffect(()=>{void (async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session)return;const r=await fetch('https://pvahrnrtivzbkipborcd.supabase.co/functions/v1/ems-lspd-send?permissions=1',{headers:{Authorization:'Bearer '+session.access_token}});if(r.ok){const data=await r.json();setValues(Object.fromEntries((data.settings||[]).map((x:any)=>[x.category_key,x.eligibility])))}})()},[])
 useEffect(()=>{Promise.all([supabase.from('sous_grades').select('*').order('position'),supabase.from('affiliations').select('*').order('position')]).then(([sg,aff])=>{setSousGrades((sg.data??[]) as SousGrade[]);setAffiliations((aff.data??[]) as Affiliation[])})},[])
 async function save(key:string){const {data:{session}}=await supabase.auth.getSession();if(!session)return;const r=await fetch('https://pvahrnrtivzbkipborcd.supabase.co/functions/v1/ems-lspd-send',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'save_permissions',settings:[{category_key:key,eligibility:values[key]??empty}]})});setSaved(r.ok?key:'error');setTimeout(()=>setSaved(null),2000)}
 return <div className="flex flex-col gap-4">
  <Card className="p-5"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/10 text-red"><Send size={18}/></span><div><h2 className="font-bold">Autorisations — Transferts LSPD</h2><p className="mt-1 text-xs text-[var(--ink)]/40">Pour chaque catégorie, sélectionne exactement comme pour les autres autorisations : grades, habilitation et affiliation autorisés.</p></div></div></Card>
  {categories.map(([key,label])=>{const value=values[key]??empty;return <Card key={key} className="p-4"><div className="mb-3 flex items-center justify-between gap-3"><p className="font-semibold text-sm">{label}</p><Button size="sm" onClick={()=>save(key)}><Save size={13}/>{saved===key?'Enregistré':saved==='error'?'Erreur':'Enregistrer'}</Button></div><EligibilitySelector value={value} onChange={next=>setValues(v=>({...v,[key]:next}))} sousGrades={sousGrades} affiliations={affiliations}/></Card>})}
 </div>
}
