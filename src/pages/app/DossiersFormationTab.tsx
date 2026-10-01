import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { supabase, type TrainingFolder } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'

export function DossiersFormationTab() {
  const [documents, setDocuments] = useState<TrainingFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('training_folders')
      .select('*')
      .order('position')
      .order('name')

    if (err) setError(err.message)
    else setDocuments((data ?? []) as TrainingFolder[])

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  function openDocument(document: TrainingFolder) {
    if (!document.external_url) return
    window.open(document.external_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[var(--ink)] font-bold text-lg">Documents</h2>
        <p className="text-[var(--ink)]/40 text-sm mt-1">
          Seuls les documents autorisés par tes habilitations ou affiliations sont affichés.
        </p>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((document) => (
          <button
            key={document.id}
            type="button"
            disabled={!document.external_url}
            onClick={() => openDocument(document)}
            className="rounded-2xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-4 text-left hover:bg-[var(--ink)]/[0.06] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center text-[var(--ink)]/60">
                <FileText size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[var(--ink)] font-bold text-sm">{document.name}</p>
                  {document.external_url && <ExternalLink size={13} className="text-[var(--ink)]/35 shrink-0" />}
                </div>
                {document.description && (
                  <p className="text-[var(--ink)]/40 text-xs mt-1 line-clamp-2">{document.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!loading && documents.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/35 text-sm">Aucun document disponible avec tes accès.</p>
        </Card>
      )}
    </div>
  )
}
