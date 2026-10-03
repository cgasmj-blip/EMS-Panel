import { useEffect, useState } from 'react'
import { Archive, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Row={id:number;public_id:string;full_name:string;phone:string|null;discord_id:string|null;discord_username:string|null;subject:string;message:string;driving_license:string|null;identity_document:string|null;status:string;created_at:string}

export function RecruitmentArchiveSection(){
 const [rows,setRows]=useState<Row[]>([])
 const [kind,setKind]=useState<'acceptee'|'refusee'>('acceptee')
 const [selected,setSelected]=useState<Row|null>(null)
 useEffect(()=>{supabase.from('visitor_requests').select('*').eq('request_type','recrutement').in('status',['acceptee','refusee']).order('updated_at',{ascending:false}).then(({data})=>setRows((data??[]) as Row[]))},[])
 const visible=rows.filter(x=>x.status===kind)
 return <div className="grid lg:grid-cols-[340px_1fr] gap-4">
  <Card className="p-4">
   <div className="flex gap-2 mb-4"><Button size="sm" variant={kind==='acceptee'?'primary':'ghost'} onClick={()=>{setKind('acceptee');setSelected(null)}}><CheckCircle2 size={14}/> Acceptées</Button><Button size="sm" variant={kind==='refusee'?'primary':'ghost'} onClick={()=>{setKind('refusee');setSelected(null)}}><XCircle size={14}/> Refusées</Button></div>
   <div className="grid gap-2">{visible.map(r=><button key={r.id} onClick={()=>setSelected(r)} className="text-left rounded-xl border border-[var(--ink)]/8 p-3 hover:bg-[var(--ink)]/[0.04]"><p className="font-semibold text-sm">{r.full_name}</p><p className="text-xs text-[var(--ink)]/40">{new Date(r.created_at).toLocaleDateString('fr-FR')} · {r.subject}</p></button>)}{visible.length===0&&<p className="text-sm text-[var(--ink)]/35 py-6 text-center">Aucune candidature archivée.</p>}</div>
  </Card>
  <Card className="p-5">{!selected?<div className="min-h-80 flex flex-col items-center justify-center text-[var(--ink)]/35"><Archive size={28}/><p className="mt-2 text-sm">Sélectionne une candidature archivée</p></div>:<div><h3 className="font-bold text-lg">{selected.full_name}</h3><p className="text-xs text-[var(--ink)]/40 mt-1">Réf. {selected.public_id.slice(0,8).toUpperCase()}</p><div className="grid gap-1 text-sm mt-4"><p><b>Téléphone :</b> {selected.phone||'—'}</p><p><b>ID Discord :</b> {selected.discord_id||'—'}</p><p><b>Permis :</b> {selected.driving_license||'—'}</p><p><b>Pièce d’identité :</b> {selected.identity_document||'—'}</p></div><div className="rounded-xl border border-[var(--ink)]/8 p-4 mt-4"><p className="font-semibold">{selected.subject}</p><p className="text-sm whitespace-pre-wrap mt-2">{selected.message}</p></div></div>}</Card>
 </div>
}
