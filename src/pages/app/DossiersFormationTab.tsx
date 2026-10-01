import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FolderOpen, Image as ImageIcon } from 'lucide-react'
import { supabase, type TrainingDocument, type TrainingFolder } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type ImageDoc = TrainingDocument & { signedUrl?: string }

export function DossiersFormationTab() {
  const [folders, setFolders] = useState<TrainingFolder[]>([])
  const [documents, setDocuments] = useState<ImageDoc[]>([])
  const [selected, setSelected] = useState<TrainingFolder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    setError(null)
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
    setError(null)

    const { data, error: err } = await supabase
      .from('training_documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('position')
      .order('created_at')

    if (err) {
      setError(err.message)
      setDocuments([])
      setLoading(false)
      return
    }

    const docs = (data ?? []) as TrainingDocument[]
    const withUrls = await Promise.all(
      docs.map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from('training-documents')
          .createSignedUrl(doc.storage_path, 60 * 30)
        return { ...doc, signedUrl: signed?.signedUrl }
      }),
    )

    setDocuments(withUrls)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  useEffect(() => {
    if (selected) fetchDocuments(selected.id)
  }, [selected, fetchDocuments])

  const imageDocs = useMemo(
    () => documents.filter((doc) => !doc.mime_type || doc.mime_type.startsWith('image/')),
    [documents],
  )

  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-[var(--ink)] font-bold text-lg">Documents</h2>
          <p className="text-[var(--ink)]/40 text-sm mt-1">
            Les dossiers visibles dépendent de tes habilitations et affiliations.
          </p>
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
              {folder.description && (
                <p className="text-[var(--ink)]/40 text-xs mt-1 line-clamp-2">{folder.description}</p>
              )}
            </button>
          ))}
        </div>

        {!loading && folders.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-[var(--ink)]/35 text-sm">Aucun dossier disponible avec tes accès.</p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelected(null)
            setDocuments([])
          }}
        >
          <ArrowLeft size={15} />
        </Button>
        <div>
          <h2 className="text-[var(--ink)] font-bold text-lg">{selected.name}</h2>
          {selected.description && <p className="text-[var(--ink)]/40 text-sm mt-1">{selected.description}</p>}
        </div>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}

      <div className="flex flex-col gap-4">
        {imageDocs.map((doc, index) => (
          <Card key={doc.id} className="overflow-hidden p-0">
            {doc.signedUrl ? (
              <img
                src={doc.signedUrl}
                alt={doc.title}
                className="w-full max-h-[520px] object-contain bg-black/5"
                loading={index < 2 ? 'eager' : 'lazy'}
              />
            ) : (
              <div className="p-8 flex items-center justify-center text-[var(--ink)]/35">
                <ImageIcon size={24} />
              </div>
            )}
            <div className="px-4 py-3 border-t border-[var(--ink)]/8">
              <p className="text-[var(--ink)] text-sm font-semibold">{doc.title}</p>
            </div>
          </Card>
        ))}
      </div>

      {!loading && imageDocs.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">Aucune image dans ce dossier pour le moment.</p>
        </Card>
      )}
    </div>
  )
}
