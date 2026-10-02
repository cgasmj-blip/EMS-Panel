import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FolderOpen, Image as ImageIcon } from 'lucide-react'
import { supabase, type TrainingDocument, type TrainingFolder } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type ImageDoc = TrainingDocument & { signedUrl?: string }
type FolderWithCover = TrainingFolder & { coverUrl?: string }

export function DossiersFormationTab() {
  const [folders, setFolders] = useState<FolderWithCover[]>([])
  const [documents, setDocuments] = useState<ImageDoc[]>([])
  const [folderStack, setFolderStack] = useState<TrainingFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImageDoc | null>(null)

  const currentFolder = folderStack[folderStack.length - 1] ?? null
  const currentParentId = currentFolder?.id ?? null

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('training_folders')
      .select('*')
      .order('position')
      .order('name')

    if (err) {
      setError(err.message)
    } else {
      const rows = (data ?? []) as TrainingFolder[]
      const withCovers = await Promise.all(
        rows.map(async (folder) => {
          if (!folder.cover_image_path) return folder
          const { data: blob, error: coverError } = await supabase.storage
            .from('training-documents')
            .download(folder.cover_image_path)
          return {
            ...folder,
            coverUrl: !coverError && blob ? URL.createObjectURL(blob) : undefined,
          }
        }),
      )
      setFolders(withCovers)
    }

    setLoading(false)
  }, [])

  const fetchDocuments = useCallback(async (folderId: number | null) => {
    if (!folderId) {
      setDocuments([])
      return
    }

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
        const { data: blob, error: downloadError } = await supabase.storage
          .from('training-documents')
          .download(doc.storage_path)

        return {
          ...doc,
          signedUrl: !downloadError && blob ? URL.createObjectURL(blob) : undefined,
        }
      }),
    )

    setDocuments(withUrls)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  useEffect(() => {
    fetchDocuments(currentParentId)
  }, [currentParentId, fetchDocuments])

  useEffect(() => {
    return () => {
      documents.forEach((doc) => {
        if (doc.signedUrl?.startsWith('blob:')) URL.revokeObjectURL(doc.signedUrl)
      })
    }
  }, [documents])

  const childFolders = useMemo(
    () => folders.filter((folder) => folder.parent_id === currentParentId),
    [folders, currentParentId],
  )

  const folderGroups = useMemo(() => {
    const groups = new Map<string, FolderWithCover[]>()
    for (const folder of childFolders) {
      const key = folder.section_title?.trim() || ''
      const list = groups.get(key) ?? []
      list.push(folder)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
  }, [childFolders])

  const imageDocs = useMemo(
    () => documents.filter((doc) => !doc.mime_type || doc.mime_type.startsWith('image/')),
    [documents],
  )

  const previewIndex = preview ? imageDocs.findIndex((doc) => doc.id === preview.id) : -1

  const showPreviousImage = useCallback(() => {
    if (previewIndex <= 0) return
    setPreview(imageDocs[previewIndex - 1])
  }, [imageDocs, previewIndex])

  const showNextImage = useCallback(() => {
    if (previewIndex < 0 || previewIndex >= imageDocs.length - 1) return
    setPreview(imageDocs[previewIndex + 1])
  }, [imageDocs, previewIndex])

  useEffect(() => {
    if (!preview) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') showPreviousImage()
      if (event.key === 'ArrowRight') showNextImage()
      if (event.key === 'Escape') setPreview(null)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [preview, showPreviousImage, showNextImage])

  function openFolder(folder: TrainingFolder) {
    if (folder.external_url) {
      window.open(folder.external_url, '_blank', 'noopener,noreferrer')
      return
    }
    setFolderStack((prev) => [...prev, folder])
  }

  function goBack() {
    setFolderStack((prev) => prev.slice(0, -1))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {currentFolder && (
          <Button size="sm" variant="ghost" onClick={goBack}>
            <ArrowLeft size={15} />
          </Button>
        )}
        <div>
          <h2 className="text-[var(--ink)] font-bold text-lg">{currentFolder?.name ?? 'Documents'}</h2>
          <p className="text-[var(--ink)]/40 text-sm mt-1">
            {currentFolder?.description ?? 'Les dossiers visibles dépendent de tes habilitations et affiliations.'}
          </p>
        </div>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}

      {childFolders.length > 0 && (
        <div className="flex flex-col gap-4">
          {folderGroups.map(([sectionTitle, sectionFolders]) => {
            const cards = (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sectionFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => openFolder(folder)}
                    className="rounded-2xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-4 text-left hover:bg-[var(--ink)]/[0.06] transition-colors cursor-pointer"
                  >
                    {folder.coverUrl ? (
                      <img
                        src={folder.coverUrl}
                        alt=""
                        className="w-full h-28 rounded-xl object-cover mb-3"
                      />
                    ) : (
                      <span className="w-11 h-11 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center mb-3 text-[var(--ink)]/60">
                        {folder.external_url ? <ExternalLink size={20} /> : <FolderOpen size={20} />}
                      </span>
                    )}
                    <p className="text-[var(--ink)] font-bold text-sm">{folder.name}</p>
                    {folder.description && (
                      <p className="text-[var(--ink)]/40 text-xs mt-1 line-clamp-2">{folder.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )

            if (!sectionTitle) return <div key="sans-section">{cards}</div>

            return (
              <details
                key={sectionTitle}
                className="rounded-2xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.015] overflow-hidden"
              >
                <summary className="px-4 py-3.5 cursor-pointer text-[var(--ink)] font-bold text-sm select-none hover:bg-[var(--ink)]/[0.04]">
                  {sectionTitle}
                </summary>
                <div className="p-3 border-t border-[var(--ink)]/8">
                  {cards}
                </div>
              </details>
            )
          })}
        </div>
      )}

      {currentFolder && (
        <div className="flex flex-col gap-4 items-center">
          {imageDocs.map((doc, index) => (
            <Card key={doc.id} className="overflow-hidden p-0 w-full max-w-3xl">
              {doc.signedUrl ? (
                <button
                  type="button"
                  onClick={() => setPreview(doc)}
                  className="block w-full cursor-zoom-in"
                  title="Agrandir l'image"
                >
                  <img
                    src={doc.signedUrl}
                    alt={doc.title}
                    className="w-full max-h-[420px] object-contain bg-black/5"
                    loading={index < 2 ? 'eager' : 'lazy'}
                  />
                </button>
              ) : (
                <div className="p-8 flex items-center justify-center text-[var(--ink)]/35">
                  <ImageIcon size={24} />
                </div>
              )}

            </Card>
          ))}
        </div>
      )}

      {!loading && childFolders.length === 0 && (!currentFolder || imageDocs.length === 0) && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">
            {currentFolder ? 'Ce dossier est vide.' : 'Aucun dossier disponible avec tes accès.'}
          </p>
        </Card>
      )}
      {preview?.signedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            aria-label="Fermer l'image"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 text-white text-xl hover:bg-white/15 cursor-pointer"
          >
            ×
          </button>

          {imageDocs.length > 1 && previewIndex > 0 && (
            <button
              type="button"
              aria-label="Image précédente"
              onClick={(e) => {
                e.stopPropagation()
                showPreviousImage()
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={26} />
            </button>
          )}

          {imageDocs.length > 1 && previewIndex < imageDocs.length - 1 && (
            <button
              type="button"
              aria-label="Image suivante"
              onClick={(e) => {
                e.stopPropagation()
                showNextImage()
              }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <ChevronRight size={26} />
            </button>
          )}
          <div
            className="max-w-[95vw] max-h-[92vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.signedUrl}
              alt={preview.title}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            {imageDocs.length > 1 && (
              <p className="text-white/45 text-xs">
                {previewIndex + 1} / {imageDocs.length}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
