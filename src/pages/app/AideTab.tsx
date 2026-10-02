import { useCallback, useEffect, useState } from 'react'
import { supabase, type HelpArticle } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

type HelpArticleWithImage = HelpArticle & { imageSrc?: string }

export function AideTab() {
  const [articles, setArticles] = useState<HelpArticleWithImage[]>([])

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

  return (
    <div className="flex flex-col gap-4">
      <AnimatedList className="flex flex-col gap-4">
        {articles.map((a) => (
          <AnimatedListItem key={a.id}>
            <Card className="p-5">
              <h3 className="text-[var(--ink)] font-bold text-sm mb-2">{a.title}</h3>
              {a.imageSrc && (
                <img src={a.imageSrc} alt={a.title} className="w-full rounded-xl border border-[var(--ink)]/8 mb-3 object-cover" />
              )}
              {a.content && <p className="text-[var(--ink)]/60 text-sm leading-relaxed whitespace-pre-wrap">{a.content}</p>}
            </Card>
          </AnimatedListItem>
        ))}
      </AnimatedList>
      {articles.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[var(--ink)]/30 text-sm">Aucune fiche d'aide pour le moment.</p>
        </Card>
      )}
    </div>
  )
}
