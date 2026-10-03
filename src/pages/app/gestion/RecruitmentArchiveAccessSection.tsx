import { useEffect, useState } from 'react'
import { ROLE_LABELS, supabase, type StaffRole } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
const ROLES=Object.keys(ROLE_LABELS).filter(x=>x!=='membre') as StaffRole[]
export function RecruitmentArchiveAccessSection(){
 const [id,setId]=useState<number|null>(null); const [roles,setRoles]=useState<StaffRole[]>([]); const [saved,setSaved]=useState(false)
 useEffect(()=>{supabase.from('recruitment_archive_access').select('id,grade').limit(1).maybeSingle().then(({data})=>{if(data){setId(data.id);setRoles((data.grade??[]) as StaffRole[])}})},[])
 const toggle=(r:StaffRole)=>setRoles(v=>v.includes(r)?v.filter(x=>x!==r):[...v,r])
 const save=async()=>{if(id) await supabase.from('recruitment_archive_access').update({grade:roles}).eq('id',id);setSaved(true);setTimeout(()=>setSaved(false),1500)}
 return <Card className="p-5"><h2 className="font-bold">Accès aux archives candidatures</h2><p className="text-xs text-[var(--ink)]/40 mt-1 mb-4">La Direction conserve toujours l’accès. Sélectionne les autres grades autorisés à consulter les candidatures acceptées et refusées.</p><div className="flex flex-wrap gap-2">{ROLES.map(r=><button key={r} type="button" onClick={()=>toggle(r)} className={roles.includes(r)?'rounded-xl border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold':'rounded-xl border border-[var(--ink)]/10 px-3 py-2 text-xs'}>{ROLE_LABELS[r]}</button>)}</div><Button className="mt-5" onClick={save}>{saved?'Enregistré':'Enregistrer'}</Button></Card>
}
