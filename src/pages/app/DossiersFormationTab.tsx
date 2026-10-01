import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileText, FolderOpen, ExternalLink } from 'lucide-react'
import { supabase, type TrainingDocument, type TrainingFolder } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function DossiersFormationTab() {
  const [folders, setFolders] = useState<TrainingFolder[]>([])
  const [documents, setDocuments] = useState<TrainingDocument[]>([])
  const [selected, setSelected] = useState<TrainingFolder | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('training_folders')
      .select('*')
      .order('position')
      .order('name')

    if (err) setError(err.message)
    else setFolders((data ?? []) as TrainingFolder[])
    setLoading(false)
  }, [])

  const fetchDocuments = useCallback(async (folderId: number) => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('training_documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('position')
      .order('title')

    if (err) setError(err.message)
    else setDocuments((data ?? []) as TrainingDocument[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  useEffect(() => {
    if (selected) fetchDocuments(selected.id)
  }, [selected, fetchDocuments])

  async function openDocument(doc: TrainingDocument) {
    setOpening(doc.id)
    setError(null)
    const { data, error: err } = await supabase.storage
      .from('training-documents')
      .createSignedUrl(doc.storage_path, 60 * 10)

    setOpening(null)
    if (err || !data?.signedUrl) {
      setError("Impossible d'ouvrir ce document.")
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-[var(--ink)] font-bold text-lg">Dossiers de formation</h2>
          <p className="text-[var(--ink)]/40 text-sm mt-1">Les dossiers affichés dépendent de ton grade.</p>
        </div>

        {error && <p className="text-red-300 text-xs">{error}</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelected(folder)}
              className="rounded-2xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-4 text-left hover:bg-[var(--ink)]/[0.06] transition-colors cursor-pointer"
            >
              <span className="w-11 h-11 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center mb-3 text-[var(--ink)]/60">
                <FolderOpen size={20} />
              </span>
              <p className="text-[var(--ink)] font-bold text-sm">{folder.name}</p>
              {folder.description && <p className="text-[var(--ink)]/40 text-xs mt-1 line-clamp-2">{folder.description}</p>}
            </button>
          ))}
        </div>

        {!loading && folders.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-[var(--ink)]/35 text-sm">Aucun dossier disponible pour ton grade.</p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setDocuments([]) }}>
          <ArrowLeft size={15} />
        </Button>
        <div>
          <h2 className="text-[var(--ink)] font-bold text-lg">{selected.name}</h2>
          {selected.description && <p className="text-[var(--ink)]/40 text-sm mt-1">{selected.description}</p>}
        </div>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}

      <div className="flex flex-col gap-2">
        {documents.map((doc) => (
          <Card key={doc.id} className="p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center text-[var(--ink)]/60 shrink-0">
              <FileText size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--ink)] font-semibold text-sm truncate">{doc.title}</p>
              <p className="text-[var(--ink)]/35 text-xs truncate">{doc.file_name}</p>
            </div>
            <Button size="sm" variant="ghost" disabled={opening === doc.id} onClick={() => openDocument(doc)}>
              <ExternalLink size={14} /> {opening === doc.id ? 'Ouverture…' : 'Ouvrir'}
            </Button>
          </Card>
        ))}
      </div>

      {!loading && documents.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">Aucun document dans ce dossier pour le moment.</p>
        </Card>
      )}
    </div>
  )
}
