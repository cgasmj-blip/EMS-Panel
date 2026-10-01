import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, FilePlus2, ImagePlus, Link2, Trash2 } from 'lucide-react'
import {
  supabase,
  type Affiliation,
  type SousGrade,
  type TrainingDocument,
  type TrainingFolder,
} from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type FolderEdit = {
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
          <p className="text-[var(--ink)] font-semibold text-xs">Accès au dossier</p>
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
          ? 'Ce dossier est accessible à tous les EMS.'
          : `${sousGradeIds.length} habilitation(s) · ${affiliationIds.length} affiliation(s) autorisée(s).`}
      </p>
    </div>
  )
}

function cleanFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export function TrainingFoldersSection() {
  const [folders, setFolders] = useState<TrainingFolder[]>([])
  const [documents, setDocuments] = useState<TrainingDocument[]>([])
  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [edits, setEdits] = useState<Record<number, FolderEdit>>({})
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newExternalUrl, setNewExternalUrl] = useState('')
  const [newSousGrades, setNewSousGrades] = useState<string[]>([])
  const [newAffiliations, setNewAffiliations] = useState<string[]>([])
  const [uploadingFolder, setUploadingFolder] = useState<number | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: folderData, error: folderError }, { data: docData }, { data: sg }, { data: aff }] = await Promise.all([
      supabase.from('training_folders').select('*').order('position').order('name'),
      supabase.from('training_documents').select('*').order('folder_id').order('position').order('created_at'),
      supabase.from('sous_grades').select('*').order('position'),
      supabase.from('affiliations').select('*').order('position'),
    ])

    if (folderError) setError(folderError.message)
    if (folderData) setFolders(folderData as TrainingFolder[])
    if (docData) setDocuments(docData as TrainingDocument[])
    if (sg) setSousGrades(sg as SousGrade[])
    if (aff) setAffiliations(aff as Affiliation[])
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const docsByFolder = useMemo(() => {
    const map = new Map<number, TrainingDocument[]>()
    for (const doc of documents) {
      const list = map.get(doc.folder_id) ?? []
      list.push(doc)
      map.set(doc.folder_id, list)
    }
    return map
  }, [documents])

  function editOf(folder: TrainingFolder): FolderEdit {
    return edits[folder.id] ?? {
      name: folder.name,
      description: folder.description ?? '',
      external_url: folder.external_url ?? '',
      allowed_sous_grade_ids: folder.allowed_sous_grade_ids ?? [],
      allowed_affiliation_ids: folder.allowed_affiliation_ids ?? [],
    }
  }

  async function addFolder() {
    if (!newName.trim()) return
    setError(null)

    const { error: err } = await supabase.from('training_folders').insert({
      name: newName.trim(),
      description: newDescription.trim() || null,
      external_url: newExternalUrl.trim() || null,
      allowed_roles: null,
      allowed_sous_grade_ids: newSousGrades.length > 0 ? newSousGrades : null,
      allowed_affiliation_ids: newAffiliations.length > 0 ? newAffiliations : null,
      position: folders.length,
    })

    if (err) {
      setError(err.message)
      return
    }

    setNewName('')
    setNewDescription('')
    setNewExternalUrl('')
    setNewSousGrades([])
    setNewAffiliations([])
    await fetchAll()
  }

  async function saveFolder(folder: TrainingFolder) {
    const edit = editOf(folder)
    if (!edit.name.trim()) return
    setError(null)

    const { error: err } = await supabase
      .from('training_folders')
      .update({
        name: edit.name.trim(),
        description: edit.description.trim() || null,
        external_url: edit.external_url.trim() || null,
        allowed_roles: null,
        allowed_sous_grade_ids: edit.allowed_sous_grade_ids.length > 0 ? edit.allowed_sous_grade_ids : null,
        allowed_affiliation_ids: edit.allowed_affiliation_ids.length > 0 ? edit.allowed_affiliation_ids : null,
      })
      .eq('id', folder.id)

    if (err) {
      setError(err.message)
      return
    }

    setEdits((prev) => {
      const next = { ...prev }
      delete next[folder.id]
      return next
    })
    await fetchAll()
  }

  async function deleteFolder(folder: TrainingFolder) {
    setError(null)
    const folderDocs = docsByFolder.get(folder.id) ?? []
    const paths = folderDocs.map((doc) => doc.storage_path)

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from('training-documents').remove(paths)
      if (storageError) {
        setError(storageError.message)
        return
      }
    }

    const { error: err } = await supabase.from('training_folders').delete().eq('id', folder.id)
    if (err) {
      setError(err.message)
      return
    }

    await fetchAll()
  }

  async function uploadImages(folder: TrainingFolder, files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return

    setUploadingFolder(folder.id)
    setError(null)

    const currentCount = (docsByFolder.get(folder.id) ?? []).length

    for (let i = 0; i < images.length; i++) {
      const file = images[i]
      const path = `${folder.id}/${Date.now()}-${i}-${cleanFileName(file.name)}`

      const { error: uploadError } = await supabase.storage
        .from('training-documents')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        setError(uploadError.message)
        setUploadingFolder(null)
        return
      }

      const title = file.name.replace(/\.[^.]+$/, '')
      const { error: insertError } = await supabase.from('training_documents').insert({
        folder_id: folder.id,
        title,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        position: currentCount + i,
      })

      if (insertError) {
        await supabase.storage.from('training-documents').remove([path])
        setError(insertError.message)
        setUploadingFolder(null)
        return
      }
    }

    setUploadingFolder(null)
    await fetchAll()
  }

  async function deleteImage(doc: TrainingDocument) {
    setError(null)

    const { error: storageError } = await supabase.storage.from('training-documents').remove([doc.storage_path])
    if (storageError) {
      setError(storageError.message)
      return
    }

    const { error: err } = await supabase.from('training_documents').delete().eq('id', doc.id)
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
          <h2 className="text-[var(--ink)] font-bold text-sm">Nouveau dossier</h2>
        </div>
        <p className="text-[var(--ink)]/35 text-xs mb-4">
          Crée soit un dossier avec des images intégrées, soit un accès direct vers un lien externe.
        </p>

        {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

        <div className="grid gap-3">
          <Input placeholder="Nom du dossier (ex : Formation A.U.)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Textarea rows={2} placeholder="Description (optionnelle)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <Input
            placeholder="Lien direct (optionnel — laisse vide pour un dossier avec images)"
            value={newExternalUrl}
            onChange={(e) => setNewExternalUrl(e.target.value)}
          />
          <AccessSelector
            sousGrades={sousGrades}
            affiliations={affiliations}
            sousGradeIds={newSousGrades}
            affiliationIds={newAffiliations}
            onSousGradesChange={setNewSousGrades}
            onAffiliationsChange={setNewAffiliations}
          />
          <Button size="sm" onClick={addFolder} disabled={!newName.trim()}>
            Ajouter le dossier
          </Button>
        </div>
      </Card>

      {folders.map((folder) => {
        const edit = editOf(folder)
        const folderDocs = docsByFolder.get(folder.id) ?? []
        const expanded = expandedFolders.includes(folder.id)
        const isDirectLink = !!edit.external_url.trim()

        return (
          <Card key={folder.id} className="p-0 overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setExpandedFolders((prev) =>
                  prev.includes(folder.id) ? prev.filter((id) => id !== folder.id) : [...prev, folder.id],
                )
              }
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--ink)]/[0.04] transition-colors cursor-pointer"
            >
              {expanded ? <ChevronDown size={16} className="text-[var(--ink)]/45 shrink-0" /> : <ChevronRight size={16} className="text-[var(--ink)]/45 shrink-0" />}
              <span className="text-[var(--ink)] font-bold text-sm flex-1 min-w-0 truncate">{folder.name}</span>
              <span className="text-[var(--ink)]/35 text-[11px] shrink-0">
                {folder.external_url ? 'Lien direct' : `${folderDocs.length} image(s)`}
              </span>
            </button>

            {expanded && (
              <div className="px-4 pb-4 pt-1 border-t border-[var(--ink)]/8 grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid gap-2 flex-1 min-w-0">
                    <Input
                      value={edit.name}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [folder.id]: { ...edit, name: e.target.value },
                        }))
                      }
                    />
                    <Textarea
                      rows={2}
                      placeholder="Description"
                      value={edit.description}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [folder.id]: { ...edit, description: e.target.value },
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Lien direct (optionnel)"
                        value={edit.external_url}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [folder.id]: { ...edit, external_url: e.target.value },
                          }))
                        }
                      />
                      {edit.external_url && (
                        <Button size="sm" variant="ghost" onClick={() => window.open(edit.external_url, '_blank', 'noopener,noreferrer')}>
                          <ExternalLink size={14} />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => saveFolder(folder)}>OK</Button>
                    <Button size="sm" variant="ghost" title="Supprimer le dossier" onClick={() => deleteFolder(folder)}>
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
                    setEdits((prev) => ({ ...prev, [folder.id]: { ...edit, allowed_sous_grade_ids } }))
                  }
                  onAffiliationsChange={(allowed_affiliation_ids) =>
                    setEdits((prev) => ({ ...prev, [folder.id]: { ...edit, allowed_affiliation_ids } }))
                  }
                />

                {!isDirectLink && (
                  <div className="pt-3 border-t border-[var(--ink)]/8">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[var(--ink)] text-sm font-semibold">Images du dossier</p>
                        <p className="text-[var(--ink)]/35 text-xs">Elles s'affichent dans le même ordre que l'import.</p>
                      </div>

                      <label className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)]/5 px-3 py-2 text-[var(--ink)]/60 text-xs font-semibold hover:bg-[var(--ink)]/10 cursor-pointer">
                        <ImagePlus size={14} />
                        {uploadingFolder === folder.id ? 'Import…' : 'Importer des images'}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploadingFolder === folder.id}
                          onChange={(e) => {
                            if (e.target.files?.length) uploadImages(folder, e.target.files)
                            e.currentTarget.value = ''
                          }}
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      {folderDocs.map((doc, index) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-2.5"
                        >
                          <span className="w-7 h-7 rounded-lg bg-[var(--ink)]/5 flex items-center justify-center text-[var(--ink)]/45 text-xs font-bold shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[var(--ink)] text-sm font-semibold truncate">{doc.title}</p>
                            <p className="text-[var(--ink)]/30 text-[11px] truncate">{doc.file_name}</p>
                          </div>
                          <Button size="sm" variant="ghost" title="Supprimer l'image" onClick={() => deleteImage(doc)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      ))}

                      {folderDocs.length === 0 && (
                        <p className="text-[var(--ink)]/30 text-xs py-2">Aucune image dans ce dossier.</p>
                      )}
                    </div>
                  </div>
                )}

                {isDirectLink && (
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 text-[var(--ink)]/45 text-xs">
                    <Link2 size={14} />
                    Ce dossier ouvre directement le lien configuré.
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {folders.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">Aucun dossier configuré.</p>
        </Card>
      )}
    </div>
  )
}
