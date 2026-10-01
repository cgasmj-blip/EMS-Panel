import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilePlus2, FileText, Trash2, Upload } from 'lucide-react'
import {
  ROLE_LABELS,
  supabase,
  type StaffRole,
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
  allowed_roles: StaffRole[]
}

const SELECTABLE_ROLES = (Object.keys(ROLE_LABELS) as StaffRole[]).filter((role) => role !== 'membre')

function cleanFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
}

function RoleSelector({
  value,
  onChange,
}: {
  value: StaffRole[]
  onChange: (value: StaffRole[]) => void
}) {
  function toggle(role: StaffRole) {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role])
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[var(--ink)]/45 text-xs font-semibold">Grades autorisés</p>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[var(--ink)]/35 hover:text-[var(--ink)] text-[11px] cursor-pointer"
        >
          Tous les grades
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SELECTABLE_ROLES.map((role) => {
          const active = value.includes(role)
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggle(role)}
              className={
                active
                  ? 'rounded-full border border-red/25 bg-red/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 cursor-pointer'
                  : 'rounded-full border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-2.5 py-1 text-[11px] text-[var(--ink)]/45 hover:bg-[var(--ink)]/[0.06] cursor-pointer'
              }
            >
              {ROLE_LABELS[role]}
            </button>
          )
        })}
      </div>
      <p className="text-[var(--ink)]/30 text-[11px] mt-2">
        {value.length === 0 ? 'Accessible à tous les grades EMS.' : `${value.length} grade(s) autorisé(s).`}
      </p>
    </div>
  )
}

export function TrainingFoldersSection() {
  const [folders, setFolders] = useState<TrainingFolder[]>([])
  const [documents, setDocuments] = useState<TrainingDocument[]>([])
  const [edits, setEdits] = useState<Record<number, FolderEdit>>({})
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newRoles, setNewRoles] = useState<StaffRole[]>([])
  const [uploadingFolder, setUploadingFolder] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: f, error: folderError }, { data: d, error: docError }] = await Promise.all([
      supabase.from('training_folders').select('*').order('position').order('name'),
      supabase.from('training_documents').select('*').order('position').order('title'),
    ])
    if (folderError || docError) setError(folderError?.message ?? docError?.message ?? null)
    if (f) setFolders(f as TrainingFolder[])
    if (d) setDocuments(d as TrainingDocument[])
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
      allowed_roles: folder.allowed_roles ?? [],
    }
  }

  async function addFolder() {
    if (!newName.trim()) return
    setError(null)
    const { error: err } = await supabase.from('training_folders').insert({
      name: newName.trim(),
      description: newDescription.trim() || null,
      allowed_roles: newRoles.length > 0 ? newRoles : null,
      position: folders.length,
    })
    if (err) {
      setError(err.message)
      return
    }
    setNewName('')
    setNewDescription('')
    setNewRoles([])
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
        allowed_roles: edit.allowed_roles.length > 0 ? edit.allowed_roles : null,
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
    const paths = (docsByFolder.get(folder.id) ?? []).map((doc) => doc.storage_path)
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

  async function uploadDocument(folder: TrainingFolder, file: File) {
    if (!file) return
    setUploadingFolder(folder.id)
    setError(null)

    const safeName = cleanFileName(file.name)
    const path = `${folder.id}/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('training-documents')
      .upload(path, file, { contentType: file.type || undefined, upsert: false })

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
      mime_type: file.type || null,
      position: (docsByFolder.get(folder.id) ?? []).length,
    })

    if (insertError) {
      await supabase.storage.from('training-documents').remove([path])
      setError(insertError.message)
      setUploadingFolder(null)
      return
    }

    setUploadingFolder(null)
    await fetchAll()
  }

  async function deleteDocument(doc: TrainingDocument) {
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
          <h2 className="text-[var(--ink)] font-bold text-sm">Nouveau dossier de formation</h2>
        </div>
        <p className="text-[var(--ink)]/35 text-xs mb-4">
          Crée un dossier puis choisis exactement quels grades peuvent le consulter.
        </p>

        {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

        <div className="grid gap-3">
          <Input placeholder="Nom du dossier" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Textarea
            rows={2}
            placeholder="Description (optionnelle)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <RoleSelector value={newRoles} onChange={setNewRoles} />
          <Button size="sm" onClick={addFolder} disabled={!newName.trim()}>
            Ajouter le dossier
          </Button>
        </div>
      </Card>

      {folders.map((folder) => {
        const edit = editOf(folder)
        const folderDocs = docsByFolder.get(folder.id) ?? []

        return (
          <Card key={folder.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 grid gap-3">
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
                <RoleSelector
                  value={edit.allowed_roles}
                  onChange={(allowed_roles) =>
                    setEdits((prev) => ({
                      ...prev,
                      [folder.id]: { ...edit, allowed_roles },
                    }))
                  }
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => saveFolder(folder)}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" title="Supprimer le dossier" onClick={() => deleteFolder(folder)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--ink)]/8">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[var(--ink)] font-semibold text-sm">Documents</p>
                  <p className="text-[var(--ink)]/35 text-xs">{folderDocs.length} document(s)</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)]/5 px-3 py-2 text-[var(--ink)]/60 text-xs font-semibold hover:bg-[var(--ink)]/10 cursor-pointer">
                  <Upload size={14} />
                  {uploadingFolder === folder.id ? 'Envoi…' : 'Ajouter un document'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingFolder === folder.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadDocument(folder, file)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {folderDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-2.5"
                  >
                    <FileText size={16} className="text-[var(--ink)]/45 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--ink)] text-sm font-semibold truncate">{doc.title}</p>
                      <p className="text-[var(--ink)]/30 text-[11px] truncate">{doc.file_name}</p>
                    </div>
                    <Button size="sm" variant="ghost" title="Supprimer le document" onClick={() => deleteDocument(doc)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
                {folderDocs.length === 0 && (
                  <p className="text-[var(--ink)]/30 text-xs py-2">Aucun document dans ce dossier.</p>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      {folders.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">Aucun dossier de formation créé.</p>
        </Card>
      )}
    </div>
  )
}
