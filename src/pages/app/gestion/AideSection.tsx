import { useCallback, useEffect, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { supabase, type HelpArticle } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function cleanFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export function AideSection() {
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [title, setTitle] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArticles = useCallback(async () => {
    const { data } = await supabase.from('help_articles').select('*').order('position').order('created_at')
    if (data) setArticles(data as HelpArticle[])
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  async function handleAdd() {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setError(null)

    const { data: created, error: insertError } = await supabase
      .from('help_articles')
      .insert({
        title: title.trim(),
        image_url: null,
        image_path: null,
        content: content.trim() || null,
        position: articles.length,
      })
      .select('id')
      .single()

    if (insertError || !created) {
      setSubmitting(false)
      setError(insertError?.message ?? 'Impossible de créer la fiche.')
      return
    }

    if (imageFile) {
      const path = `help/${created.id}/${Date.now()}-${cleanFileName(imageFile.name)}`
      const { error: uploadError } = await supabase.storage
        .from('training-documents')
        .upload(path, imageFile, { contentType: imageFile.type, upsert: false })

      if (uploadError) {
        await supabase.from('help_articles').delete().eq('id', created.id)
        setSubmitting(false)
        setError(uploadError.message)
        return
      }

      const { error: updateError } = await supabase
        .from('help_articles')
        .update({ image_path: path })
        .eq('id', created.id)

      if (updateError) {
        await supabase.storage.from('training-documents').remove([path])
        await supabase.from('help_articles').delete().eq('id', created.id)
        setSubmitting(false)
        setError(updateError.message)
        return
      }
    }

    setSubmitting(false)
    setTitle('')
    setImageFile(null)
    setContent('')
    await fetchArticles()
  }

  async function handleDelete(article: HelpArticle) {
    setError(null)

    if (article.image_path) {
      const { error: storageError } = await supabase.storage
        .from('training-documents')
        .remove([article.image_path])

      if (storageError) {
        setError(storageError.message)
        return
      }
    }

    const { error: deleteError } = await supabase.from('help_articles').delete().eq('id', article.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

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

          <Field label="Image (optionnelle)">
            <label className="inline-flex w-full items-center gap-2 rounded-xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.02] px-3 py-2.5 text-sm text-[var(--ink)]/55 cursor-pointer hover:bg-[var(--ink)]/[0.05]">
              <ImagePlus size={15} />
              {imageFile ? imageFile.name : 'Choisir une image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </Field>

          <Field label="Texte (optionnel)">
            <Textarea rows={3} placeholder="Explication..." value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
        </div>
        <Button variant="red" className="w-full" disabled={submitting || !title.trim()} onClick={handleAdd}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </Button>
      </Card>

      <Card className="p-5" delay={0.06}>
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Fiches existantes</h2>
        <AnimatedList className="flex flex-col gap-2">
          {articles.map((a) => (
            <AnimatedListItem key={a.id} className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[var(--ink)] text-sm font-semibold truncate">{a.title}</p>
                {a.image_path && <p className="text-[var(--ink)]/30 text-[11px] mt-0.5">Image importée</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(a)}>
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
