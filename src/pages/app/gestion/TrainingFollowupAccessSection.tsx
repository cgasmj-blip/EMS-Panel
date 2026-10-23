import { useCallback, useEffect, useState } from 'react'
import { supabase, isDirection } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { normalizeSearch } from '@/lib/traumaRecords'

export function TrainingFollowupAccessSection(){
 const {staff}=useAuth()
 const [templates,setTemplates]=useState<{key:string;label:string}[]>([]),[people,setPeople]=useState<{id:string;full_name:string}[]>([]),[access,setAccess]=useState<{checklist_key:string;staff_id:string}[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=useCallback(async()=>{
  const [t,p,a]=await Promise.all([supabase.from('training_checklists').select('key,label').order('label'),supabase.from('staff').select('id,full_name,staff_affiliations(affiliation_id)').eq('active',true).order('full_name'),supabase.from('training_access').select('*')])
  if(t.error||p.error||a.error)throw Error(t.error?.message||p.error?.message||a.error?.message)
  setTemplates(t.data||[]);setPeople((p.data||[]).filter(x=>x.staff_affiliations.some((g:{affiliation_id:string})=>g.affiliation_id==='formateur')));setAccess(a.data||[])
 },[])
 useEffect(()=>{async function start(){try{await load()}catch(e){setError(e instanceof Error?e.message:'Chargement impossible')}}if(isDirection(staff?.role))void start()},[load,staff?.role])
 if(!staff?.active||!isDirection(staff.role))return <p>Accès réservé à la direction.</p>
 async function toggle(key:string,id:string,checked:boolean){setBusy(true);setError('');try{const r=checked?await supabase.from('training_access').insert({checklist_key:key,staff_id:id}):await supabase.from('training_access').delete().eq('checklist_key',key).eq('staff_id',id);if(r.error)throw Error(r.error.message);await load()}catch(e){setError(e instanceof Error?e.message:'Modification impossible')}finally{setBusy(false)}}
 return <div className="space-y-4"><Card className="p-4"><h2 className="font-bold">Accès nominatifs au suivi formation</h2><p className="text-sm text-[var(--ink)]/50 mt-2">La tuile est réservée aux formateurs. Pour chaque checklist, cochez les personnes autorisées à consulter et compléter les suivis. Aucun accès n’est attribué automatiquement.</p><Input className="mt-3" type="search" placeholder="Rechercher un formateur" aria-label="Rechercher un formateur" value={query} onChange={e=>setQuery(e.target.value)}/></Card>{error&&<p role="alert" className="text-red">{error}</p>}{templates.map(t=><Card key={t.key} className="p-4"><h3 className="font-semibold mb-3">{t.label}</h3><div className="grid sm:grid-cols-2 gap-2">{people.filter(p=>normalizeSearch(p.full_name).includes(normalizeSearch(query))).map(p=><label key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ink)]/5 text-sm"><input type="checkbox" className="accent-red" checked={access.some(a=>a.checklist_key===t.key&&a.staff_id===p.id)} disabled={busy} onChange={e=>void toggle(t.key,p.id,e.target.checked)}/>{p.full_name}</label>)}</div>{!people.length&&<p className="text-sm text-[var(--ink)]/50">Aucun formateur actif.</p>}</Card>)}</div>
}
