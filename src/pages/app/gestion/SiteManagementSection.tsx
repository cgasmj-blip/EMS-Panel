import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GripVertical, Heading1, ImagePlus, Link2, Maximize2, Plus, RotateCcw, Save, Trash2, Type } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { VisitorSubjectsSection } from './VisitorSubjectsSection'

type LayoutKey = 'hero' | 'contact' | 'navigation' | 'content'
type LayoutItem = { x: number; y: number; w: number; h: number }
type SiteLayout = Record<LayoutKey, LayoutItem>
type Position = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type CustomBlockType = 'title' | 'text' | 'image' | 'button'

type CustomBlock = LayoutItem & {
  id: string
  type: CustomBlockType
  title?: string
  text?: string
  image_path?: string | null
  image_position?: Position
  label?: string
  url?: string
}

type SiteSettings = {
  id: number
  hero_title: string
  hero_subtitle: string
  contact_title: string
  contact_text: string
  hero_image_path: string | null
  background_image_path: string | null
  background_position: Position
  background_opacity: number
  hero_image_position: Position
  show_reglement: boolean
  show_contact: boolean
  show_recrutement: boolean
  show_rendez_vous: boolean
  show_suivi: boolean
  layout_json: SiteLayout
  custom_blocks: CustomBlock[]
}

const DEFAULT_LAYOUT: SiteLayout = {
  hero: { x: 0, y: 0, w: 64, h: 300 },
  contact: { x: 66, y: 0, w: 34, h: 300 },
  navigation: { x: 0, y: 320, w: 100, h: 64 },
  content: { x: 0, y: 404, w: 100, h: 520 },
}

const DEFAULTS: SiteSettings = {
  id: 1,
  hero_title: 'Bienvenue sur l’espace public EMS',
  hero_subtitle: 'Consulte le règlement, pose une question, dépose une candidature ou demande un rendez-vous directement auprès de l’équipe EMS.',
  contact_title: 'Besoin de nous joindre ?',
  contact_text: 'Les demandes envoyées ici arrivent directement dans le panel EMS afin que l’équipe puisse les traiter et assurer leur suivi.',
  hero_image_path: null,
  background_image_path: null,
  background_position: 'center',
  background_opacity: 100,
  hero_image_position: 'center',
  show_reglement: true,
  show_contact: true,
  show_recrutement: true,
  show_rendez_vous: true,
  show_suivi: true,
  layout_json: DEFAULT_LAYOUT,
  custom_blocks: [],
}

function mergeLayout(value: unknown): SiteLayout {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<SiteLayout>
  return {
    hero: { ...DEFAULT_LAYOUT.hero, ...(source.hero ?? {}) },
    contact: { ...DEFAULT_LAYOUT.contact, ...(source.contact ?? {}) },
    navigation: { ...DEFAULT_LAYOUT.navigation, ...(source.navigation ?? {}) },
    content: { ...DEFAULT_LAYOUT.content, ...(source.content ?? {}) },
  }
}

function normalizeCustomBlocks(value: unknown): CustomBlock[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const block = item as Partial<CustomBlock>
      return {
        id: String(block.id || crypto.randomUUID()),
        type: (['title', 'text', 'image', 'button'].includes(String(block.type)) ? block.type : 'text') as CustomBlockType,
        x: Number(block.x ?? 0),
        y: Number(block.y ?? 0),
        w: Number(block.w ?? 30),
        h: Number(block.h ?? 120),
        title: block.title ?? '',
        text: block.text ?? '',
        image_path: block.image_path ?? null,
        image_position: block.image_position ?? 'center',
        label: block.label ?? '',
        url: block.url ?? '',
      }
    })
}

const POSITIONS: Array<[Position, string]> = [
  ['center', 'Centre'],
  ['top', 'Haut'],
  ['bottom', 'Bas'],
  ['left', 'Gauche'],
  ['right', 'Droite'],
  ['top-left', 'Haut gauche'],
  ['top-right', 'Haut droite'],
  ['bottom-left', 'Bas gauche'],
  ['bottom-right', 'Bas droite'],
]

export function SiteManagementSection() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [customImageUrls, setCustomImageUrls] = useState<Record<string, string>>({})
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('public_site_settings').select('*').eq('id', 1).maybeSingle()
    if (!data) return
    setSettings({
      ...(data as SiteSettings),
      layout_json: mergeLayout(data.layout_json),
      custom_blocks: normalizeCustomBlocks(data.custom_blocks),
    })
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    setHeroUrl(settings.hero_image_path ? supabase.storage.from('public-site-assets').getPublicUrl(settings.hero_image_path).data.publicUrl : null)
    setBackgroundUrl(settings.background_image_path ? supabase.storage.from('public-site-assets').getPublicUrl(settings.background_image_path).data.publicUrl : null)

    const urls: Record<string, string> = {}
    for (const block of settings.custom_blocks) {
      if (block.image_path) {
        urls[block.id] = supabase.storage.from('public-site-assets').getPublicUrl(block.image_path).data.publicUrl
      }
    }
    setCustomImageUrls(urls)
  }, [settings.hero_image_path, settings.background_image_path, settings.custom_blocks])

  const canvasHeight = useMemo(() => {
    const fixedBottoms = Object.values(settings.layout_json).map((item) => item.y + item.h + 24)
    const customBottoms = settings.custom_blocks.map((item) => item.y + item.h + 24)
    return Math.max(760, ...fixedBottoms, ...customBottoms)
  }, [settings.layout_json, settings.custom_blocks])

  function setLayoutItem(key: LayoutKey, value: LayoutItem) {
    setSettings((current) => ({
      ...current,
      layout_json: { ...current.layout_json, [key]: value },
    }))
  }

  function setCustomBlock(id: string, patch: Partial<CustomBlock>) {
    setSettings((current) => ({
      ...current,
      custom_blocks: current.custom_blocks.map((block) => block.id === id ? { ...block, ...patch } : block),
    }))
  }

  function startDrag(event: ReactPointerEvent, key: LayoutKey) {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const startRect = canvas.getBoundingClientRect()
    const start = settings.layout_json[key]
    const startX = event.clientX
    const startY = event.clientY

    const move = (pointer: PointerEvent) => {
      const dx = ((pointer.clientX - startX) / startRect.width) * 100
      const dy = pointer.clientY - startY
      setLayoutItem(key, {
        ...start,
        x: Math.max(0, Math.min(100 - start.w, start.x + dx)),
        y: Math.max(0, start.y + dy),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function startResize(event: ReactPointerEvent, key: LayoutKey) {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    const startRect = canvas.getBoundingClientRect()
    const start = settings.layout_json[key]
    const startX = event.clientX
    const startY = event.clientY

    const move = (pointer: PointerEvent) => {
      const dw = ((pointer.clientX - startX) / startRect.width) * 100
      const dh = pointer.clientY - startY
      setLayoutItem(key, {
        ...start,
        w: Math.max(8, Math.min(100 - start.x, start.w + dw)),
        h: Math.max(44, start.h + dh),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function startCustomDrag(event: ReactPointerEvent, id: string) {
    event.preventDefault()
    const canvas = canvasRef.current
    const block = settings.custom_blocks.find((item) => item.id === id)
    if (!canvas || !block) return
    const rect = canvas.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY

    const move = (pointer: PointerEvent) => {
      const dx = ((pointer.clientX - startX) / rect.width) * 100
      const dy = pointer.clientY - startY
      setCustomBlock(id, {
        x: Math.max(0, Math.min(100 - block.w, block.x + dx)),
        y: Math.max(0, block.y + dy),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function startCustomResize(event: ReactPointerEvent, id: string) {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    const block = settings.custom_blocks.find((item) => item.id === id)
    if (!canvas || !block) return
    const rect = canvas.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY

    const move = (pointer: PointerEvent) => {
      const dw = ((pointer.clientX - startX) / rect.width) * 100
      const dh = pointer.clientY - startY
      setCustomBlock(id, {
        w: Math.max(6, Math.min(100 - block.x, block.w + dw)),
        h: Math.max(36, block.h + dh),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function addBlock(type: CustomBlockType) {
    const bottom = Math.max(
      0,
      ...Object.values(settings.layout_json).map((item) => item.y + item.h),
      ...settings.custom_blocks.map((item) => item.y + item.h),
    )

    const base: CustomBlock = {
      id: crypto.randomUUID(),
      type,
      x: 4,
      y: bottom + 20,
      w: type === 'button' ? 26 : type === 'title' ? 48 : 38,
      h: type === 'image' ? 220 : type === 'text' ? 140 : type === 'title' ? 90 : 70,
      title: type === 'title' ? 'Nouveau titre' : '',
      text: type === 'text' ? 'Nouveau bloc de texte. Tu peux modifier ce contenu depuis la gestion du site.' : '',
      image_path: null,
      image_position: 'center',
      label: type === 'button' ? 'Nouveau bouton' : '',
      url: '',
    }

    setSettings((current) => ({ ...current, custom_blocks: [...current.custom_blocks, base] }))
  }

  async function uploadAsset(kind: 'hero' | 'background', file: File | null) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${kind}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('public-site-assets').upload(path, file)
    if (error) {
      setMessage(error.message)
      return
    }
    const oldPath = kind === 'hero' ? settings.hero_image_path : settings.background_image_path
    if (oldPath) await supabase.storage.from('public-site-assets').remove([oldPath])
    setSettings((current) => ({
      ...current,
      [kind === 'hero' ? 'hero_image_path' : 'background_image_path']: path,
    }))
  }

  async function uploadCustomImage(id: string, file: File | null) {
    if (!file) return
    const block = settings.custom_blocks.find((item) => item.id === id)
    if (!block) return
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `block-${id}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('public-site-assets').upload(path, file)
    if (error) {
      setMessage(error.message)
      return
    }
    if (block.image_path) await supabase.storage.from('public-site-assets').remove([block.image_path])
    setCustomBlock(id, { image_path: path })
  }

  async function removeAsset(kind: 'hero' | 'background') {
    const path = kind === 'hero' ? settings.hero_image_path : settings.background_image_path
    if (path) await supabase.storage.from('public-site-assets').remove([path])
    setSettings((current) => ({
      ...current,
      [kind === 'hero' ? 'hero_image_path' : 'background_image_path']: null,
    }))
  }

  async function removeCustomBlock(block: CustomBlock) {
    if (block.image_path) await supabase.storage.from('public-site-assets').remove([block.image_path])
    setSettings((current) => ({
      ...current,
      custom_blocks: current.custom_blocks.filter((item) => item.id !== block.id),
    }))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('public_site_settings').upsert({
      ...settings,
      id: 1,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setMessage(error ? error.message : 'Interface publique enregistrée.')
  }

  function toggle(key: keyof Pick<SiteSettings, 'show_reglement' | 'show_contact' | 'show_recrutement' | 'show_rendez_vous' | 'show_suivi'>) {
    setSettings((current) => ({ ...current, [key]: !current[key] }))
  }

  const previewBlock = (key: LayoutKey, title: string, children: ReactNode) => {
    const item = settings.layout_json[key]
    return (
      <div
        className="absolute rounded-2xl border border-white/15 bg-black/45 backdrop-blur-md overflow-hidden shadow-xl"
        style={{ left: `${item.x}%`, top: item.y, width: `${item.w}%`, height: item.h }}
      >
        <button
          type="button"
          onPointerDown={(event) => startDrag(event, key)}
          className="absolute z-20 top-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/55 px-2 py-1 text-[10px] text-white/75 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={11} /> {title}
        </button>
        <button
          type="button"
          onPointerDown={(event) => startResize(event, key)}
          className="absolute z-20 bottom-2 right-2 w-7 h-7 rounded-lg bg-black/55 text-white/75 flex items-center justify-center cursor-se-resize"
        >
          <Maximize2 size={12} />
        </button>
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-bold text-sm">Aperçu & positionnement libre</h2>
            <p className="text-[var(--ink)]/40 text-xs mt-1">
              Déplace et redimensionne les blocs. Tu peux aussi ajouter autant de titres, textes, images et boutons que nécessaire.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSettings((current) => ({ ...current, layout_json: DEFAULT_LAYOUT }))}>
            <RotateCcw size={13} /> Placement par défaut
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant="ghost" onClick={() => addBlock('title')}><Heading1 size={14} /> Titre</Button>
          <Button size="sm" variant="ghost" onClick={() => addBlock('text')}><Type size={14} /> Texte</Button>
          <Button size="sm" variant="ghost" onClick={() => addBlock('image')}><ImagePlus size={14} /> Image</Button>
          <Button size="sm" variant="ghost" onClick={() => addBlock('button')}><Link2 size={14} /> Bouton</Button>
        </div>

        <div className="rounded-2xl border border-[var(--ink)]/10 bg-[var(--bg)] p-3 overflow-auto">
          <div
            ref={canvasRef}
            className="relative min-w-[760px] rounded-xl overflow-hidden bg-[var(--bg)]"
            style={{
              height: canvasHeight,
              backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: settings.background_position.replace('-', ' '),
            }}
          >
            {backgroundUrl && <div className="absolute inset-0 bg-[var(--bg)]" style={{ opacity: 1 - settings.background_opacity / 100 }} />}

            {previewBlock(
              'hero',
              'Accueil',
              <div className="h-full flex">
                {heroUrl && <div className="w-2/5 h-full bg-cover bg-no-repeat" style={{ backgroundImage: `url("${heroUrl}")`, backgroundPosition: settings.hero_image_position.replace('-', ' ') }} />}
                <div className="flex-1 p-8 flex flex-col justify-center">
                  <p className="text-white font-black text-2xl leading-tight">{settings.hero_title}</p>
                  <p className="text-white/60 text-sm mt-3 leading-relaxed">{settings.hero_subtitle}</p>
                </div>
              </div>,
            )}

            {previewBlock(
              'contact',
              'Bloc contact',
              <div className="h-full p-8 flex flex-col justify-center">
                <p className="text-white font-bold text-xl">{settings.contact_title}</p>
                <p className="text-white/60 text-sm mt-3 leading-relaxed">{settings.contact_text}</p>
              </div>,
            )}

            {previewBlock(
              'navigation',
              'Navigation',
              <div className="h-full px-5 flex items-center gap-2 flex-wrap">
                {['Règlement', 'Nous contacter', 'Recrutement', 'Rendez-vous', 'Mes demandes'].map((label) => (
                  <span key={label} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-xs text-white/70">{label}</span>
                ))}
              </div>,
            )}

            {previewBlock(
              'content',
              'Contenu',
              <div className="h-full p-8">
                <p className="text-white/35 text-xs uppercase tracking-widest mb-3">Zone de contenu</p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <p className="text-white font-semibold">Règlement / formulaire / suivi</p>
                  <p className="text-white/45 text-sm mt-2">Le contenu de l’onglet sélectionné s’affiche dans cette zone.</p>
                </div>
              </div>,
            )}

            {settings.custom_blocks.map((block) => (
              <div
                key={block.id}
                className="absolute rounded-2xl border border-emerald-300/25 bg-black/40 backdrop-blur-md overflow-hidden shadow-xl"
                style={{ left: `${block.x}%`, top: block.y, width: `${block.w}%`, height: block.h }}
              >
                <button
                  type="button"
                  onPointerDown={(event) => startCustomDrag(event, block.id)}
                  className="absolute z-20 top-2 left-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/80 px-2 py-1 text-[10px] text-white cursor-grab active:cursor-grabbing"
                >
                  <GripVertical size={11} /> Bloc {block.type}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startCustomResize(event, block.id)}
                  className="absolute z-20 bottom-2 right-2 w-7 h-7 rounded-lg bg-black/55 text-white/75 flex items-center justify-center cursor-se-resize"
                >
                  <Maximize2 size={12} />
                </button>

                {block.type === 'title' && (
                  <div className="h-full p-6 flex items-center">
                    <p className="text-white font-black text-2xl">{block.title || 'Titre'}</p>
                  </div>
                )}
                {block.type === 'text' && (
                  <div className="h-full p-6 flex items-center">
                    <p className="text-white/70 text-sm whitespace-pre-wrap">{block.text || 'Texte'}</p>
                  </div>
                )}
                {block.type === 'image' && (
                  customImageUrls[block.id]
                    ? <div className="w-full h-full bg-cover bg-no-repeat" style={{ backgroundImage: `url("${customImageUrls[block.id]}")`, backgroundPosition: (block.image_position ?? 'center').replace('-', ' ') }} />
                    : <div className="h-full flex items-center justify-center text-white/35 text-sm">Ajoute une image</div>
                )}
                {block.type === 'button' && (
                  <div className="h-full flex items-center justify-center p-4">
                    <span className="rounded-xl bg-red px-5 py-3 text-white text-sm font-semibold">{block.label || 'Bouton'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-sm">Blocs libres</h3>
            <p className="text-[var(--ink)]/40 text-xs mt-1">Modifie le contenu de chaque bloc ajouté à la page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => addBlock('title')}><Plus size={13} /> Titre</Button>
            <Button size="sm" variant="ghost" onClick={() => addBlock('text')}><Plus size={13} /> Texte</Button>
            <Button size="sm" variant="ghost" onClick={() => addBlock('image')}><Plus size={13} /> Image</Button>
            <Button size="sm" variant="ghost" onClick={() => addBlock('button')}><Plus size={13} /> Bouton</Button>
          </div>
        </div>

        <div className="grid gap-3">
          {settings.custom_blocks.map((block, index) => (
            <div key={block.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-[var(--ink)]/55">Bloc {index + 1} · {block.type}</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void removeCustomBlock(block)}>
                  <Trash2 size={13} />
                </Button>
              </div>

              {block.type === 'title' && (
                <Input value={block.title ?? ''} onChange={(e) => setCustomBlock(block.id, { title: e.target.value })} placeholder="Titre" />
              )}

              {block.type === 'text' && (
                <textarea
                  rows={4}
                  value={block.text ?? ''}
                  onChange={(e) => setCustomBlock(block.id, { text: e.target.value })}
                  className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/35"
                  placeholder="Texte du bloc"
                />
              )}

              {block.type === 'image' && (
                <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                  <label>
                    <span className="h-10 rounded-xl border border-dashed border-[var(--ink)]/15 px-3 flex items-center justify-center gap-2 cursor-pointer text-xs text-[var(--ink)]/55">
                      <ImagePlus size={14} /> {block.image_path ? 'Remplacer l’image' : 'Ajouter une image'}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadCustomImage(block.id, e.target.files?.[0] ?? null)} />
                  </label>
                  <Select value={block.image_position ?? 'center'} onChange={(e) => setCustomBlock(block.id, { image_position: e.target.value as Position })}>
                    {POSITIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </Select>
                </div>
              )}

              {block.type === 'button' && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input value={block.label ?? ''} onChange={(e) => setCustomBlock(block.id, { label: e.target.value })} placeholder="Texte du bouton" />
                  <Input value={block.url ?? ''} onChange={(e) => setCustomBlock(block.id, { url: e.target.value })} placeholder="Lien (https://...)" />
                </div>
              )}
            </div>
          ))}

          {settings.custom_blocks.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--ink)]/12 p-6 text-center text-[var(--ink)]/35 text-sm">
              Aucun bloc libre. Ajoute un titre, un texte, une image ou un bouton.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Textes principaux</h3>
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--ink)]/55">Titre principal</span>
            <Input value={settings.hero_title} onChange={(e) => setSettings((current) => ({ ...current, hero_title: e.target.value }))} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--ink)]/55">Texte principal</span>
            <textarea rows={4} value={settings.hero_subtitle} onChange={(e) => setSettings((current) => ({ ...current, hero_subtitle: e.target.value }))} className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/35" />
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink)]/55">Titre bloc contact</span>
              <Input value={settings.contact_title} onChange={(e) => setSettings((current) => ({ ...current, contact_title: e.target.value }))} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink)]/55">Texte bloc contact</span>
              <Input value={settings.contact_text} onChange={(e) => setSettings((current) => ({ ...current, contact_text: e.target.value }))} />
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Images principales</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {([
            ['hero', 'Image principale', settings.hero_image_path],
            ['background', 'Fond de page', settings.background_image_path],
          ] as const).map(([kind, label, path]) => (
            <div key={kind} className="rounded-xl border border-[var(--ink)]/8 p-4">
              <p className="font-semibold text-sm mb-3">{label}</p>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="h-10 rounded-xl border border-dashed border-[var(--ink)]/15 px-3 flex items-center justify-center gap-2 cursor-pointer text-xs text-[var(--ink)]/55">
                    <ImagePlus size={14} /> {path ? 'Remplacer' : 'Ajouter une image'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadAsset(kind, e.target.files?.[0] ?? null)} />
                </label>
                {path && <Button size="sm" variant="ghost" onClick={() => void removeAsset(kind)}><Trash2 size={13} /></Button>}
              </div>

              {kind === 'hero' ? (
                <Select className="mt-3" value={settings.hero_image_position} onChange={(e) => setSettings((current) => ({ ...current, hero_image_position: e.target.value as Position }))}>
                  {POSITIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </Select>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <Select value={settings.background_position} onChange={(e) => setSettings((current) => ({ ...current, background_position: e.target.value as Position }))}>
                    {POSITIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </Select>
                  <label className="flex items-center gap-3">
                    <input type="range" min="0" max="100" value={settings.background_opacity} onChange={(e) => setSettings((current) => ({ ...current, background_opacity: Number(e.target.value) }))} className="flex-1" />
                    <span className="w-10 text-right text-xs text-[var(--ink)]/45">{settings.background_opacity}%</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Sections visibles</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {([
            ['show_reglement', 'Règlement'],
            ['show_contact', 'Nous contacter'],
            ['show_recrutement', 'Recrutement'],
            ['show_rendez_vous', 'Rendez-vous'],
            ['show_suivi', 'Mes demandes'],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => toggle(key)} className={settings[key] ? 'rounded-xl border border-green-400/20 bg-green-400/7 px-3 py-3 text-left' : 'rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-3 text-left opacity-55'}>
              <span className="text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-[var(--ink)]/35 mt-1">{settings[key] ? 'Visible' : 'Masqué'}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-1">Objets visiteurs</h3>
        <p className="text-[var(--ink)]/40 text-xs mb-4">
          Configure ici les objets de contact, rendez-vous et recrutement ainsi que les habilitations autorisées à les traiter.
        </p>
        <VisitorSubjectsSection />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setSettings(DEFAULTS)}><RotateCcw size={14} /> Réinitialiser</Button>
        <Button onClick={() => void save()} disabled={saving}><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
      {message && <p className="text-xs text-[var(--ink)]/50 text-right">{message}</p>}
    </div>
  )
}
