import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FilePlus2, Trash2 } from 'lucide-react'
import {
  supabase,
  type Affiliation,
  type SousGrade,
  type TrainingFolder,
} from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type DocumentEdit = {
  name: string
  description: string
  external_url: string
  allowed_sous_grade_ids: string[]
  allowed_affiliation_ids: string[]
}

function AccessSelector({
  sousGrades,
  affiliations,
  sousGradeIds,
  affiliationIds,
  onSousGradesChange,
  onAffiliationsChange,
}: {
  sousGrades: SousGrade[]
  affiliations: Affiliation[]
  sousGradeIds: string[]
  affiliationIds: string[]
  onSousGradesChange: (ids: string[]) => void
  onAffiliationsChange: (ids: string[]) => void
}) {
  const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  const unrestricted = sousGradeIds.length === 0 && affiliationIds.length === 0

  return (
    <div className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[var(--ink)] font-semibold text-xs">Accès au document</p>
          <p className="text-[var(--ink)]/35 text-[11px] mt-0.5">
            Une habilitation ou une affiliation sélectionnée suffit pour donner accès.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSousGradesChange([])
            onAffiliationsChange([])
          }}
          className="text-[var(--ink)]/40 hover:text-[var(--ink)] text-[11px] cursor-pointer shrink-0"
        >
          Accès à tous
        </button>
      </div>

      <p className="text-[var(--ink)]/45 text-[11px] font-semibold mb-1.5">Habilitations</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sousGrades.map((sg) => {
          const active = sousGradeIds.includes(sg.id)
          return (
            <button
              key={sg.id}
              type="button"
              onClick={() => onSousGradesChange(toggle(sousGradeIds, sg.id))}
              className={
                active
                  ? 'rounded-full border border-red/25 bg-red/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 cursor-pointer'
                  : 'rounded-full border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-2.5 py-1 text-[11px] text-[var(--ink)]/45 hover:bg-[var(--ink)]/[0.06] cursor-pointer'
              }
            >
              {sg.label}
            </button>
          )
        })}
      </div>

      <p className="text-[var(--ink)]/45 text-[11px] font-semibold mb-1.5">Affiliations</p>
      <div className="flex flex-wrap gap-1.5">
        {affiliations.map((aff) => {
          const active = affiliationIds.includes(aff.id)
          return (
            <button
              key={aff.id}
              type="button"
              onClick={() => onAffiliationsChange(toggle(affiliationIds, aff.id))}
              className={
                active
                  ? 'rounded-full border border-red/25 bg-red/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 cursor-pointer'
                  : 'rounded-full border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-2.5 py-1 text-[11px] text-[var(--ink)]/45 hover:bg-[var(--ink)]/[0.06] cursor-pointer'
              }
            >
              {aff.label}
            </button>
          )
        })}
      </div>

      <p className="text-[var(--ink)]/30 text-[11px] mt-3">
        {unrestricted
          ? 'Ce document est accessible à tous les EMS.'
          : `${sousGradeIds.length} habilitation(s) · ${affiliationIds.length} affiliation(s) autorisée(s).`}
      </p>
    </div>
  )
}

export function TrainingFoldersSection() {
  const [documents, setDocuments] = useState<TrainingFolder[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [edits, setEdits] = useState<Record<number, DocumentEdit>>({})
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newSousGrades, setNewSousGrades] = useState<string[]>([])
  const [newAffiliations, setNewAffiliations] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: docs, error: docError }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('training_folders').select('*').order('position').order('name'),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])

    if (docError) setError(docError.message)
    if (docs) setDocuments(docs as TrainingFolder[])
    if (sg) setSousGrades(sg as SousGrade[])
    if (aff) setAffiliations(aff as Affiliation[])
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function editOf(document: TrainingFolder): DocumentEdit {
    return edits[document.id] ?? {
      name: document.name,
      description: document.description ?? '',
      external_url: document.external_url ?? '',
      allowed_sous_grade_ids: document.allowed_sous_grade_ids ?? [],
      allowed_affiliation_ids: document.allowed_affiliation_ids ?? [],
    }
  }

  async function addDocument() {
    if (!newName.trim() || !newUrl.trim()) return
    setError(null)

    const { error: err } = await supabase.from('training_folders').insert({
      name: newName.trim(),
      description: newDescription.trim() || null,
      external_url: newUrl.trim(),
      allowed_roles: null,
      allowed_sous_grade_ids: newSousGrades.length > 0 ? newSousGrades : null,
      allowed_affiliation_ids: newAffiliations.length > 0 ? newAffiliations : null,
      position: documents.length,
    })

    if (err) {
      setError(err.message)
      return
    }

    setNewName('')
    setNewDescription('')
    setNewUrl('')
    setNewSousGrades([])
    setNewAffiliations([])
    await fetchAll()
  }

  async function saveDocument(document: TrainingFolder) {
    const edit = editOf(document)
    if (!edit.name.trim() || !edit.external_url.trim()) return
    setError(null)

    const { error: err } = await supabase
      .from('training_folders')
      .update({
        name: edit.name.trim(),
        description: edit.description.trim() || null,
        external_url: edit.external_url.trim(),
        allowed_roles: null,
        allowed_sous_grade_ids: edit.allowed_sous_grade_ids.length > 0 ? edit.allowed_sous_grade_ids : null,
        allowed_affiliation_ids: edit.allowed_affiliation_ids.length > 0 ? edit.allowed_affiliation_ids : null,
      })
      .eq('id', document.id)

    if (err) {
      setError(err.message)
      return
    }

    setEdits((prev) => {
      const next = { ...prev }
      delete next[document.id]
      return next
    })
    await fetchAll()
  }

  async function deleteDocument(id: number) {
    setError(null)
    const { error: err } = await supabase.from('training_folders').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    await fetchAll()
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <FilePlus2 size={17} className="text-[var(--ink)]/55" />
          <h2 className="text-[var(--ink)] font-bold text-sm">Nouveau document</h2>
        </div>
        <p className="text-[var(--ink)]/35 text-xs mb-4">
          Donne un nom au document, colle son lien, puis choisis les habilitations et affiliations qui y ont accès.
        </p>

        {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

        <div className="grid gap-3">
          <Input placeholder="Nom affiché (ex : Dossier formation A.U.)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="Lien du document" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <Textarea rows={2} placeholder="Description (optionnelle)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <AccessSelector
            sousGrades={sousGrades}
            affiliations={affiliations}
            sousGradeIds={newSousGrades}
            affiliationIds={newAffiliations}
            onSousGradesChange={setNewSousGrades}
            onAffiliationsChange={setNewAffiliations}
          />
          <Button size="sm" onClick={addDocument} disabled={!newName.trim() || !newUrl.trim()}>
            Ajouter le document
          </Button>
        </div>
      </Card>

      {documents.map((document) => {
        const edit = editOf(document)
        return (
          <Card key={document.id} className="p-5">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <div className="grid gap-2 flex-1 min-w-0">
                  <Input
                    value={edit.name}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [document.id]: { ...edit, name: e.target.value } }))}
                  />
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={edit.external_url}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [document.id]: { ...edit, external_url: e.target.value } }))}
                    />
                    {edit.external_url && (
                      <Button size="sm" variant="ghost" onClick={() => window.open(edit.external_url, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink size={14} />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Description"
                    value={edit.description}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [document.id]: { ...edit, description: e.target.value } }))}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => saveDocument(document)}>OK</Button>
                  <Button size="sm" variant="ghost" title="Supprimer" onClick={() => deleteDocument(document.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <AccessSelector
                sousGrades={sousGrades}
                affiliations={affiliations}
                sousGradeIds={edit.allowed_sous_grade_ids}
                affiliationIds={edit.allowed_affiliation_ids}
                onSousGradesChange={(allowed_sous_grade_ids) =>
                  setEdits((prev) => ({ ...prev, [document.id]: { ...edit, allowed_sous_grade_ids } }))
                }
                onAffiliationsChange={(allowed_affiliation_ids) =>
                  setEdits((prev) => ({ ...prev, [document.id]: { ...edit, allowed_affiliation_ids } }))
                }
              />
            </div>
          </Card>
        )
      })}

      {documents.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">Aucun document configuré.</p>
        </Card>
      )}
    </div>
  )
}
