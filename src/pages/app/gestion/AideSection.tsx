import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase, type HelpArticle } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

export function AideSection() {
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArticles = useCallback(async () => {
    const { data } = await supabase.from('help_articles').select('*').order('position').order('created_at')
    if (data) setArticles(data)
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  async function handleAdd() {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('help_articles').insert({
      title: title.trim(),
      image_url: imageUrl.trim() || null,
      content: content.trim() || null,
      position: articles.length,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setTitle('')
    setImageUrl('')
    setContent('')
    await fetchArticles()
  }

  async function handleDelete(id: number) {
    await supabase.from('help_articles').delete().eq('id', id)
    await fetchArticles()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Ajouter une fiche d'aide</h2>
        {error && <p className="text-red-300 text-xs mb-3 animate-pop-in">{error}</p>}
        <div className="grid gap-4 mb-4">
          <Field label="Titre">
            <Input placeholder="ex: Comment prendre son service" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="URL de l'image (optionnel)">
            <Input placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </Field>
          <Field label="Texte (optionnel)">
            <Textarea rows={3} placeholder="Explication..." value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
        </div>
        <Button variant="red" className="w-full" disabled={submitting || !title.trim()} onClick={handleAdd}>
          Ajouter
        </Button>
      </Card>

      <Card className="p-5" delay={0.06}>
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Fiches existantes</h2>
        <AnimatedList className="flex flex-col gap-2">
          {articles.map((a) => (
            <AnimatedListItem key={a.id} className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5">
              <p className="text-[var(--ink)] text-sm font-semibold truncate">{a.title}</p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                <Trash2 size={13} />
              </Button>
            </AnimatedListItem>
          ))}
          {articles.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune fiche pour le moment.</p>}
        </AnimatedList>
      </Card>
    </div>
  )
}
