import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { supabase, type HelpArticle } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

type HelpArticleWithImage = HelpArticle & { imageSrc?: string }

export function AideTab() {
  const [articles, setArticles] = useState<HelpArticleWithImage[]>([])
  const [previewId, setPreviewId] = useState<number | null>(null)

  const fetchArticles = useCallback(async () => {
    const { data } = await supabase.from('help_articles').select('*').order('position').order('created_at')
    const rows = (data ?? []) as HelpArticle[]

    const hydrated = await Promise.all(
      rows.map(async (article) => {
        if (article.image_path) {
          const { data: blob, error } = await supabase.storage
            .from('training-documents')
            .download(article.image_path)

          return {
            ...article,
            imageSrc: !error && blob ? URL.createObjectURL(blob) : undefined,
          }
        }

        return {
          ...article,
          imageSrc: article.image_url ?? undefined,
        }
      }),
    )

    setArticles((prev) => {
      for (const article of prev) {
        if (article.imageSrc?.startsWith('blob:')) URL.revokeObjectURL(article.imageSrc)
      }
      return hydrated
    })
  }, [])

  useEffect(() => {
    fetchArticles()
    const channel = supabase
      .channel('aide-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_articles' }, fetchArticles)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchArticles])

  useEffect(() => {
    return () => {
      for (const article of articles) {
        if (article.imageSrc?.startsWith('blob:')) URL.revokeObjectURL(article.imageSrc)
      }
    }
  }, [articles])

  const imageArticles = useMemo(() => articles.filter((article) => !!article.imageSrc), [articles])
  const previewIndex = previewId === null ? -1 : imageArticles.findIndex((article) => article.id === previewId)
  const preview = previewIndex >= 0 ? imageArticles[previewIndex] : null

  const showPrevious = useCallback(() => {
    if (previewIndex <= 0) return
    setPreviewId(imageArticles[previewIndex - 1].id)
  }, [imageArticles, previewIndex])

  const showNext = useCallback(() => {
    if (previewIndex < 0 || previewIndex >= imageArticles.length - 1) return
    setPreviewId(imageArticles[previewIndex + 1].id)
  }, [imageArticles, previewIndex])

  useEffect(() => {
    if (!preview) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewId(null)
      if (event.key === 'ArrowLeft') showPrevious()
      if (event.key === 'ArrowRight') showNext()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview, showPrevious, showNext])

  return (
    <div className="flex flex-col gap-4">
      <AnimatedList className="flex flex-col gap-4 items-center">
        {articles.map((a) => (
          <AnimatedListItem key={a.id} className="w-full max-w-3xl">
            <Card className="overflow-hidden p-0">
              {a.imageSrc ? (
                <button
                  type="button"
                  onClick={() => setPreviewId(a.id)}
                  className="block w-full cursor-zoom-in"
                  title="Agrandir l'image"
                >
                  <img
                    src={a.imageSrc}
                    alt={a.title}
                    className="w-full max-h-[420px] object-contain bg-black/5"
                  />
                </button>
              ) : (
                <div className="p-8 flex items-center justify-center text-[var(--ink)]/25">
                  <ImageIcon size={24} />
                </div>
              )}

              <div className="p-5">
                <h3 className="text-[var(--ink)] font-bold text-sm">{a.title}</h3>
                {a.content && (
                  <p className="text-[var(--ink)]/60 text-sm leading-relaxed whitespace-pre-wrap mt-2">{a.content}</p>
                )}
              </div>
            </Card>
          </AnimatedListItem>
        ))}
      </AnimatedList>

      {articles.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[var(--ink)]/30 text-sm">Aucune fiche d'aide pour le moment.</p>
        </Card>
      )}

      {preview?.imageSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={() => setPreviewId(null)}
        >
          <button
            type="button"
            aria-label="Fermer l'image"
            onClick={() => setPreviewId(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 text-white text-xl hover:bg-white/15 cursor-pointer"
          >
            ×
          </button>

          {previewIndex > 0 && (
            <button
              type="button"
              aria-label="Image précédente"
              onClick={(e) => {
                e.stopPropagation()
                showPrevious()
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={26} />
            </button>
          )}

          {previewIndex >= 0 && previewIndex < imageArticles.length - 1 && (
            <button
              type="button"
              aria-label="Image suivante"
              onClick={(e) => {
                e.stopPropagation()
                showNext()
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
              src={preview.imageSrc}
              alt={preview.title}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="text-center">
              <p className="text-white font-semibold text-sm">{preview.title}</p>
              {imageArticles.length > 1 && (
                <p className="text-white/45 text-xs mt-1">{previewIndex + 1} / {imageArticles.length}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
