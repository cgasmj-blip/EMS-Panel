import { useCallback, useEffect, useState } from 'react'
import { supabase, type HelpArticle } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

export function AideTab() {
  const [articles, setArticles] = useState<HelpArticle[]>([])

  const fetchArticles = useCallback(async () => {
    const { data } = await supabase.from('help_articles').select('*').order('position').order('created_at')
    if (data) setArticles(data)
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

  return (
    <div className="flex flex-col gap-4">
      <AnimatedList className="flex flex-col gap-4">
        {articles.map((a) => (
          <AnimatedListItem key={a.id}>
            <Card className="p-5">
              <h3 className="text-[var(--ink)] font-bold text-sm mb-2">{a.title}</h3>
              {a.image_url && (
                <img src={a.image_url} alt={a.title} className="w-full rounded-xl border border-[var(--ink)]/8 mb-3 object-cover" />
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
