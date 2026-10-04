import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { Bone, CalendarCheck, CheckCircle2, FileBadge, FileCheck2, FileClock, FileText, ArrowLeft, ImagePlus, MessageSquareText, Paperclip, Trash2, Receipt, Send, ShieldCheck } from 'lucide-react'

const folders = [
  { key: 'veterinary_followup', label: 'Suivi vétérinaire', detail: 'Prénom de l’animal + document', subject: 'animal', reference: false, fileRequired: true, access: 'Vétérinaire', icon: Bone },
  { key: 'periodic_medical_visit', label: 'Visite médicale périodique', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'Tous les EMS', icon: CalendarCheck },
  { key: 'cas', label: 'C.A.S.', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'APU + affiliation C.A.S.', icon: FileBadge },
  { key: 'cappa', label: 'C.A.P.P.A.', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'AU + affiliation C.A.P.P.A.', icon: FileCheck2 },
  { key: 'work_stoppage', label: 'Arrêt de travail', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'Tous les EMS', icon: FileClock },
  { key: 'sick_leave', label: 'Arrêt maladie', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'Tous les EMS', icon: FileText },
  { key: 'billing', label: 'Facturation LSPD', detail: 'Nom, prénom, référence + facture', subject: 'person', reference: true, fileRequired: true, access: 'Tous les EMS', icon: Receipt },
  { key: 'criminal_record_request', label: 'Casier judiciaire vierge', detail: 'Nom, prénom + pièce d’identité', subject: 'person', reference: false, fileRequired: true, access: 'Tous les EMS', icon: ShieldCheck },
] as const

type FolderKey = (typeof folders)[number]['key']
type Draft = { id: string; senderId?: string; kind: string; summary: string; files: string[]; images?: { name: string; dataUrl: string }[]; createdAt: string }

const TILE_COLORS = ['bg-blue-900', 'bg-indigo-900', 'bg-slate-900', 'bg-blue-800', 'bg-indigo-950', 'bg-sky-900', 'bg-blue-950', 'bg-slate-800'] as const

const OUTBOX_KEY = 'ems-lspd-outbox'

function deleteDraft(id: string) { const existing = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) || '[]') as Draft[]; window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(existing.filter((item) => item.id !== id))) }

export function LspdTransferTab() {
  const { session, staff } = useAuth()
  const canDeleteDraft = (item: Draft) => staff?.role === 'directeur' || (!!item.senderId && item.senderId === session?.user.id)
  const [selected, setSelected] = useState<FolderKey | null>(null)
  const [directionOpen, setDirectionOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [animalName, setAnimalName] = useState('')
  const [reference, setReference] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [directionText, setDirectionText] = useState('')
  const [directionFiles, setDirectionFiles] = useState<File[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [bridgeDirection, setBridgeDirection] = useState<any[]>([])
  const [bridgeHistory, setBridgeHistory] = useState<any[]>([])

  const current = useMemo(() => folders.find((folder) => folder.key === selected) ?? null, [selected])
  const currentTileColor = current ? TILE_COLORS[folders.findIndex((folder) => folder.key === current.key) % TILE_COLORS.length] : 'bg-blue-950'
  const history = bridgeHistory
  const directionHistory = bridgeDirection

  async function loadDirectionHistory(){ const {data:{session}}=await supabase.auth.getSession(); if(!session)return; try{const r=await fetch('https://pvahrnrtivzbkipborcd.supabase.co/functions/v1/ems-lspd-send',{headers:{Authorization:'Bearer '+session.access_token}});const data=await r.json();if(r.ok)setBridgeDirection(data.items||[])}catch{} }
  async function loadTransferHistory(){if(!selected)return;const {data:{session}}=await supabase.auth.getSession();if(!session)return;try{const r=await fetch('https://pvahrnrtivzbkipborcd.supabase.co/functions/v1/ems-lspd-send?category='+encodeURIComponent(selected),{headers:{Authorization:'Bearer '+session.access_token}});const data=await r.json();if(r.ok)setBridgeHistory(data.items||[])}catch{}}
  useEffect(()=>{if(directionOpen)void loadDirectionHistory()},[directionOpen,revision])
  useEffect(()=>{if(selected)void loadTransferHistory();else setBridgeHistory([])},[selected,revision])

  function resetDocumentForm() {
    setFirstName(''); setLastName(''); setAnimalName(''); setReference(''); setFiles([])
  }

  async function simulateSend(event: FormEvent) {
    event.preventDefault()
    if (!current) return
    const subject = current.subject === 'animal' ? animalName.trim() : `${firstName.trim()} ${lastName.trim()}`.trim()
    if (!subject || (current.reference && !reference.trim()) || (current.fileRequired && files.length === 0)) return
    setSuccess(null)
    const form = new FormData()
    form.append('action','transfer'); form.append('category',current.key); form.append('first_name',firstName.trim()); form.append('last_name',lastName.trim()); form.append('animal_name',animalName.trim()); form.append('reference',reference.trim()); files.forEach(file=>form.append('files',file))
    const { data, error } = await supabase.functions.invoke('ems-lspd-send',{body:form})
    if (error || data?.error) { setSuccess(`Erreur d’envoi : ${data?.error || error?.message || 'inconnue'}`); return }
    setSuccess(`${current.label} envoyé au LSPD.`)
    setRevision((value) => value + 1)
    resetDocumentForm()
    window.setTimeout(() => setSuccess(null), 4500)
  }

  function removeDocumentSend(id: string) { if (!window.confirm('Supprimer définitivement cet envoi ?')) return; deleteDraft(id); setRevision((value) => value + 1) }

  async function simulateDirectionSend(event: FormEvent) {
    event.preventDefault()
    if (!directionText.trim() && directionFiles.length === 0) return
    setSuccess(null)
    const form=new FormData(); form.append('action','direction'); form.append('body',directionText.trim()); directionFiles.forEach(file=>form.append('files',file))
    const {data,error}=await supabase.functions.invoke('ems-lspd-send',{body:form})
    if(error||data?.error){setSuccess(`Erreur d’envoi : ${data?.error||error?.message||'inconnue'}`);return}
    setSuccess('Message Direction envoyé au LSPD.')
    setRevision((value) => value + 1)
    setDirectionText(''); setDirectionFiles([]); await loadDirectionHistory()
    window.setTimeout(() => setSuccess(null), 4500)
  }

  return (
    <div className="space-y-5">
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm font-semibold text-[var(--ink)]">
          <CheckCircle2 size={18} className="text-emerald-500" /> {success}
        </div>
      )}

      {!current && !directionOpen && (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {folders.map((folder, index) => {
          const Icon = folder.icon
          return (
            <button key={folder.key} type="button" onClick={() => { setSelected(folder.key); setDirectionOpen(false); setSuccess(null) }}
              className={`group rounded-2xl border border-white/10 ${TILE_COLORS[index % TILE_COLORS.length]} p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:border-white/25 hover:brightness-110`}>
              <div className="flex min-h-28 flex-col items-center justify-center gap-3 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white"><Icon size={20} /></span><p className="font-bold text-white">{folder.label}</p></div>
            </button>
          )
        })}
        <button type="button" onClick={() => { setDirectionOpen(true); setSelected(null); setSuccess(null) }}
          className="group col-span-2 rounded-2xl border border-white/10 bg-blue-950 p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:border-white/25 hover:brightness-110 sm:col-span-3 lg:col-span-4">
          <div className="flex min-h-28 flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red/15 text-red"><MessageSquareText size={20}/></span>
            <p className="font-bold text-white">Messagerie Direction</p>
          </div>
        </button>
      </div>
        </>
      )}

      {current && (
        <>
          <button type="button" onClick={() => setSelected(null)} className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]/60 hover:text-[var(--ink)]">
            <ArrowLeft size={17}/> Retour à Liaison LSPD
          </button>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`rounded-2xl border border-white/10 ${currentTileColor} p-4 text-white`}>
            <p className="mb-4 font-bold text-white">Historique — {current.label}</p>
            <div className="max-h-[430px] space-y-2 overflow-y-auto">
              {history.map((item:any) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-white">
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{[item.subject_last_name,item.subject_first_name].filter(Boolean).join(' ')||item.animal_first_name||item.reference||'Envoi EMS'}</span><span className="text-[10px] text-white/50">{new Date(item.created_at).toLocaleString('fr-FR')}</span></div>
                  <p className="mt-1 text-xs text-white/60">Envoyé par {item.sender_display_name||'EMS'}</p>
                  {item.reference&&<p className="mt-1 text-xs text-white/60">Référence : {item.reference}</p>}
                  {item.files?.length>0&&<p className="mt-2 text-xs text-white/70">{item.files.map((file:any)=>file.original_name).join(' • ')}</p>}
                  <span className="mt-2 inline-block text-[10px] font-bold text-amber-500">{current.key === 'criminal_record_request' ? 'DOSSIER CASIER' : 'ENVOYÉ AU LSPD'}</span>
                </div>
              ))}
              {history.length === 0 && <p className="py-12 text-center text-sm text-[var(--ink)]/35">Aucun envoi pour le moment.</p>}
            </div>
          </div>

          <form onSubmit={simulateSend} className={`space-y-4 rounded-2xl border border-white/10 ${currentTileColor} p-4 text-white`}>
            <p className="font-bold text-[var(--ink)]">{current.label}</p>
            {current.subject === 'animal' ? (
              <input required value={animalName} onChange={(e) => setAnimalName(e.target.value)} placeholder="Prénom de l’animal" className="w-full rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/40" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/40" />
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className="rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/40" />
              </div>
            )}
            {current.reference && <input required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence de facturation" className="w-full rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/40" />}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--ink)]/20 bg-[var(--bg)] p-3 hover:border-red/35">
              <Paperclip size={17}/>
              <span className="text-sm text-[var(--ink)]/60">{files.length ? `${files.length} fichier(s) sélectionné(s)` : current.key === 'criminal_record_request' ? 'Ajouter la pièce d’identité obligatoire' : 'Ajouter le document obligatoire'}</span>
              <input className="hidden" type="file" multiple required={current.fileRequired} onChange={(e) => setFiles(Array.from(e.target.files ?? []))}/>
            </label>
            {files.length > 0 && <p className="text-xs text-[var(--ink)]/45">{files.map((file) => file.name).join(' • ')}</p>}
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-red px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"><Send size={17}/> Envoyer au LSPD</button>
          </form>
        </div>
        </>
      )}

      {previewImage && (
        <div role="presentation" onClick={() => setPreviewImage(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <img src={previewImage} alt="Aperçu du document" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"/>
        </div>
      )}

      {directionOpen && (
        <>
          <button type="button" onClick={() => setDirectionOpen(false)} className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]/60 hover:text-[var(--ink)]">
            <ArrowLeft size={17}/> Retour à Liaison LSPD
          </button>
        <form onSubmit={simulateDirectionSend} className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-blue-950 text-white">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red/15 text-red"><MessageSquareText size={18}/></span>
            <div><p className="font-bold text-[var(--ink)]">Direction LSPD</p><p className="text-xs text-[var(--ink)]/45">Liaison interservices</p></div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {directionHistory.map((item:any) => {const mine=item.sender_service==='EMS';return <div key={item.id} className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-white ${mine?'ml-auto rounded-br-md bg-red':'mr-auto rounded-bl-md bg-slate-800'}`}><p className="mb-1 text-[10px] text-white/60">{item.sender_service} · {item.sender_display_name||'Expéditeur'}</p>{item.body&&<p className="whitespace-pre-wrap text-sm">{item.body}</p>}{item.files?.length>0&&<div className="mt-2 flex flex-wrap gap-2">{item.files.map((file:any)=>file.mime_type?.startsWith('image/')?<button key={file.id} type="button" onClick={()=>setPreviewImage(file.url)} className="overflow-hidden rounded-lg border border-white/20"><img src={file.url} alt={file.original_name} className="h-24 w-28 object-cover"/></button>:<a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="text-xs underline">{file.original_name}</a>)}</div>}<p className="mt-1 text-right text-[10px] text-white/60">{new Date(item.created_at).toLocaleString('fr-FR')}</p></div>})}
            {directionHistory.length === 0 && <p className="pt-12 text-center text-sm text-[var(--ink)]/35">Aucun message pour le moment.</p>}
          </div>
          {directionFiles.length > 0 && <div className="border-t border-[var(--ink)]/8 px-4 py-2 text-xs text-[var(--ink)]/50">{directionFiles.map(file => file.name).join(' • ')}</div>}
          <div className="flex items-end gap-2 border-t border-white/10 bg-black/20 p-3">
            <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.035] text-[var(--ink)]/60 hover:border-red/30 hover:text-red" title="Ajouter une image ou un document">
              <ImagePlus size={18}/><input className="hidden" type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={(e) => setDirectionFiles(Array.from(e.target.files ?? []))}/>
            </label>
            <textarea value={directionText} onChange={(e) => setDirectionText(e.target.value)} rows={2} placeholder="Écrire un message…" className="min-h-11 flex-1 resize-none rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/50 focus:border-red/40"/>
            <button type="submit" className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-red text-white transition hover:opacity-90" aria-label="Envoyer"><Send size={18}/></button>
          </div>
        </form>
        </>
      )}
    </div>
  )
}
