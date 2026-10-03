import { useMemo, useState, type FormEvent } from 'react'
import { Bone, CalendarCheck, CheckCircle2, FileBadge, FileCheck2, FileClock, FileText, MessageSquareText, Paperclip, Receipt, Send, ShieldCheck, Upload, X } from 'lucide-react'

const folders = [
  { key: 'veterinary_followup', label: 'Suivi vétérinaire', detail: 'Prénom de l’animal + document', subject: 'animal', reference: false, fileRequired: true, access: 'Vétérinaire', icon: Bone },
  { key: 'periodic_medical_visit', label: 'Visite médicale périodique', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'Médecin', icon: CalendarCheck },
  { key: 'cas', label: 'C.A.S.', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'APU + affiliation C.A.S.', icon: FileBadge },
  { key: 'cappa', label: 'C.A.P.P.A.', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'AU + affiliation C.A.P.P.A.', icon: FileCheck2 },
  { key: 'work_stoppage', label: 'Arrêt de travail', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'Tous les EMS', icon: FileClock },
  { key: 'sick_leave', label: 'Arrêt maladie', detail: 'Nom, prénom + document', subject: 'person', reference: false, fileRequired: true, access: 'Tous les EMS', icon: FileText },
  { key: 'billing', label: 'Facturation LSPD', detail: 'Nom, prénom, référence + facture', subject: 'person', reference: true, fileRequired: true, access: 'Tous les EMS', icon: Receipt },
  { key: 'criminal_record_request', label: 'Casier judiciaire vierge', detail: 'Nom et prénom — demande au LSPD', subject: 'person', reference: false, fileRequired: false, access: 'Tous les EMS', icon: ShieldCheck },
] as const

type FolderKey = (typeof folders)[number]['key']
type Draft = { id: string; kind: string; summary: string; files: string[]; createdAt: string }

const OUTBOX_KEY = 'ems-lspd-outbox'

function saveDraft(draft: Draft) {
  const existing = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) || '[]') as Draft[]
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify([draft, ...existing].slice(0, 100)))
}

export function LspdTransferTab() {
  const [selected, setSelected] = useState<FolderKey | null>(null)
  const [directionOpen, setDirectionOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [animalName, setAnimalName] = useState('')
  const [reference, setReference] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [directionText, setDirectionText] = useState('')
  const [appointmentAt, setAppointmentAt] = useState('')
  const [directionFiles, setDirectionFiles] = useState<File[]>([])
  const [success, setSuccess] = useState<string | null>(null)

  const current = useMemo(() => folders.find((folder) => folder.key === selected) ?? null, [selected])

  function resetDocumentForm() {
    setFirstName(''); setLastName(''); setAnimalName(''); setReference(''); setFiles([])
  }

  function simulateSend(event: FormEvent) {
    event.preventDefault()
    if (!current) return
    const subject = current.subject === 'animal' ? animalName.trim() : `${firstName.trim()} ${lastName.trim()}`.trim()
    if (!subject || (current.reference && !reference.trim()) || (current.fileRequired && files.length === 0)) return

    saveDraft({
      id: crypto.randomUUID(),
      kind: current.key,
      summary: current.reference ? `${subject} — ${reference.trim()}` : subject,
      files: files.map((file) => file.name),
      createdAt: new Date().toISOString(),
    })
    setSuccess(`${current.label} placé dans la file d’envoi LSPD.`)
    resetDocumentForm()
    window.setTimeout(() => setSuccess(null), 4500)
  }

  function simulateDirectionSend(event: FormEvent) {
    event.preventDefault()
    if (!directionText.trim() && !appointmentAt && directionFiles.length === 0) return
    saveDraft({
      id: crypto.randomUUID(),
      kind: 'direction_message',
      summary: directionText.trim() || (appointmentAt ? `Rendez-vous : ${appointmentAt}` : 'Pièce jointe Direction'),
      files: directionFiles.map((file) => file.name),
      createdAt: new Date().toISOString(),
    })
    setSuccess('Message Direction placé dans la file d’envoi LSPD.')
    setDirectionText(''); setAppointmentAt(''); setDirectionFiles([])
    window.setTimeout(() => setSuccess(null), 4500)
  }

  return (
    <div className="space-y-5">
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm font-semibold text-[var(--ink)]">
          <CheckCircle2 size={18} className="text-emerald-500" /> {success}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red/15 text-red"><Upload size={20} /></span>
          <div>
            <h2 className="font-display text-lg font-black text-[var(--ink)]">Liaison directe EMS ↔ LSPD</h2>
            <p className="mt-1 text-sm text-[var(--ink)]/55">Tous les modules sont actifs. Tant que la passerelle LSPD n’est pas connectée, les envois sont placés dans une file locale temporaire.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {folders.map((folder) => {
          const Icon = folder.icon
          return (
            <button key={folder.key} type="button" onClick={() => { setSelected(folder.key); setDirectionOpen(false); setSuccess(null) }}
              className="group rounded-2xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-red/30 hover:bg-red/[0.06]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/70 group-hover:bg-red/15 group-hover:text-red"><Icon size={18} /></span>
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

      <button type="button" onClick={() => { setDirectionOpen(true); setSelected(null); setSuccess(null) }}
        className="w-full rounded-2xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] p-4 text-left transition hover:border-red/30 hover:bg-red/[0.06]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/15 text-red"><MessageSquareText size={18} /></span>
          <div><p className="font-bold text-[var(--ink)]">Messagerie Direction</p><p className="mt-1 text-xs text-[var(--ink)]/50">Messages, images, documents, factures et rendez-vous.</p></div>
        </div>
      </button>

      {current && (
        <form onSubmit={simulateSend} className="space-y-4 rounded-2xl border border-red/20 bg-red/[0.05] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-[var(--ink)]">{current.label}</p><p className="text-xs text-[var(--ink)]/45">{current.access}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-[var(--ink)]/5"><X size={17}/></button></div>
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
            <Paperclip size={17}/><span className="text-sm text-[var(--ink)]/60">{files.length ? `${files.length} fichier(s) sélectionné(s)` : current.fileRequired ? 'Ajouter le document obligatoire' : 'Ajouter un document (facultatif)'}</span>
            <input className="hidden" type="file" multiple required={current.fileRequired} onChange={(e) => setFiles(Array.from(e.target.files ?? []))}/>
          </label>
          {files.length > 0 && <p className="text-xs text-[var(--ink)]/45">{files.map((file) => file.name).join(' • ')}</p>}
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-red px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"><Send size={17}/> Envoyer au LSPD</button>
        </form>
      )}

      {directionOpen && (
        <form onSubmit={simulateDirectionSend} className="space-y-4 rounded-2xl border border-red/20 bg-red/[0.05] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><p className="font-bold text-[var(--ink)]">Messagerie Direction</p><p className="text-xs text-[var(--ink)]/45">Conversation EMS ↔ LSPD</p></div><button type="button" onClick={() => setDirectionOpen(false)} className="rounded-lg p-2 hover:bg-[var(--ink)]/5"><X size={17}/></button></div>
          <textarea value={directionText} onChange={(e) => setDirectionText(e.target.value)} rows={4} placeholder="Écrire un message à la Direction LSPD…" className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/40"/>
          <div><label className="mb-1 block text-xs font-semibold text-[var(--ink)]/50">Proposer un rendez-vous</label><input type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} className="w-full rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/40"/></div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--ink)]/20 bg-[var(--bg)] p-3 hover:border-red/35"><Paperclip size={17}/><span className="text-sm text-[var(--ink)]/60">{directionFiles.length ? `${directionFiles.length} fichier(s) sélectionné(s)` : 'Ajouter images, documents ou factures'}</span><input className="hidden" type="file" multiple onChange={(e) => setDirectionFiles(Array.from(e.target.files ?? []))}/></label>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-red px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"><Send size={17}/> Envoyer à la Direction LSPD</button>
        </form>
      )}
    </div>
  )
}
