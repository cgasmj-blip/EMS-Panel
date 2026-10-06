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
 useEffect(()=>{Promise.all([supabase.from('sous_grades').select('*').order('position'),supabase.from('affiliations').select('*').order('position'),supabase.schema('interservice_bridge').from('category_access_rules').select('category_key,principal_type,principal_key').eq('enabled',true)]).then(([sg,aff,rules])=>{setSousGrades((sg.data??[]) as SousGrade[]);setAffiliations((aff.data??[]) as Affiliation[]);const next:Record<string,Eligibility>={};for(const row of rules.data??[]){const value=next[row.category_key]??{...empty};if(row.principal_type==='grade')value.grade=[...value.grade,row.principal_key as any];if(row.principal_type==='sous_grade')value.sous_grade_id=row.principal_key;if(row.principal_type==='affiliation')value.affiliation_id=row.principal_key;next[row.category_key]=value}setValues(next)})},[])
 async function save(key:string){const value=values[key]??empty;const {error:del}=await supabase.schema('interservice_bridge').from('category_access_rules').delete().eq('category_key',key);if(del)return;const rows=[...value.grade.map(principal_key=>({category_key:key,principal_type:'grade',principal_key,enabled:true})),...(value.sous_grade_id?[{category_key:key,principal_type:'sous_grade',principal_key:value.sous_grade_id,enabled:true}]:[]),...(value.affiliation_id?[{category_key:key,principal_type:'affiliation',principal_key:value.affiliation_id,enabled:true}]:[])];if(rows.length){const {error}=await supabase.schema('interservice_bridge').from('category_access_rules').insert(rows);if(error)return}setSaved(key);setTimeout(()=>setSaved(null),1400)}
 return <div className="flex flex-col gap-4">
  <Card className="p-5"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/10 text-red"><Send size={18}/></span><div><h2 className="font-bold">Autorisations — Transferts LSPD</h2><p className="mt-1 text-xs text-[var(--ink)]/40">Pour chaque catégorie, sélectionne exactement comme pour les autres autorisations : grades, habilitation et affiliation autorisés.</p></div></div></Card>
  {categories.map(([key,label])=>{const value=values[key]??empty;return <Card key={key} className="p-4"><div className="mb-3 flex items-center justify-between gap-3"><p className="font-semibold text-sm">{label}</p><Button size="sm" onClick={()=>save(key)}><Save size={13}/>{saved===key?'Enregistré':'Enregistrer'}</Button></div><EligibilitySelector value={value} onChange={next=>setValues(v=>({...v,[key]:next}))} sousGrades={sousGrades} affiliations={affiliations}/></Card>})}
 </div>
}
