import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, ImagePlus, Maximize2, RotateCcw, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type LayoutKey = 'hero' | 'contact' | 'navigation' | 'content'
type LayoutItem = { x: number; y: number; w: number; h: number }
type SiteLayout = Record<LayoutKey, LayoutItem>

type SiteSettings = {
  id: number
  hero_title: string
  hero_subtitle: string
  contact_title: string
  contact_text: string
  hero_image_path: string | null
  background_image_path: string | null
  background_position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  background_opacity: number
  hero_image_position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  show_reglement: boolean
  show_contact: boolean
  show_recrutement: boolean
  show_rendez_vous: boolean
  show_suivi: boolean
  layout_json: SiteLayout
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

const POSITIONS: Array<[SiteSettings['background_position'], string]> = [
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
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('public_site_settings').select('*').eq('id', 1).maybeSingle()
    if (!data) return
    setSettings({ ...(data as SiteSettings), layout_json: mergeLayout(data.layout_json) })
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    setHeroUrl(settings.hero_image_path ? supabase.storage.from('public-site-assets').getPublicUrl(settings.hero_image_path).data.publicUrl : null)
    setBackgroundUrl(settings.background_image_path ? supabase.storage.from('public-site-assets').getPublicUrl(settings.background_image_path).data.publicUrl : null)
  }, [settings.hero_image_path, settings.background_image_path])

  const canvasHeight = useMemo(
    () => Math.max(760, ...Object.values(settings.layout_json).map((item) => item.y + item.h + 24)),
    [settings.layout_json],
  )

  function setLayoutItem(key: LayoutKey, value: LayoutItem) {
    setSettings((current) => ({
      ...current,
      layout_json: { ...current.layout_json, [key]: value },
    }))
  }

  function startDrag(event: React.PointerEvent, key: LayoutKey) {
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

  function startResize(event: React.PointerEvent, key: LayoutKey) {
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
        w: Math.max(12, Math.min(100 - start.x, start.w + dw)),
        h: Math.max(60, start.h + dh),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
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

  async function removeAsset(kind: 'hero' | 'background') {
    const path = kind === 'hero' ? settings.hero_image_path : settings.background_image_path
    if (path) await supabase.storage.from('public-site-assets').remove([path])
    setSettings((current) => ({
      ...current,
      [kind === 'hero' ? 'hero_image_path' : 'background_image_path']: null,
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

  const previewBlock = (key: LayoutKey, title: string, children: React.ReactNode) => {
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
              Déplace les blocs directement dans l’aperçu et redimensionne-les avec le coin inférieur droit.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSettings((current) => ({ ...current, layout_json: DEFAULT_LAYOUT }))}>
            <RotateCcw size={13} /> Placement par défaut
          </Button>
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
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Textes</h3>
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
        <h3 className="font-bold text-sm mb-4">Images</h3>
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
                <Select className="mt-3" value={settings.hero_image_position} onChange={(e) => setSettings((current) => ({ ...current, hero_image_position: e.target.value as SiteSettings['hero_image_position'] }))}>
                  {POSITIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </Select>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <Select value={settings.background_position} onChange={(e) => setSettings((current) => ({ ...current, background_position: e.target.value as SiteSettings['background_position'] }))}>
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

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setSettings(DEFAULTS)}><RotateCcw size={14} /> Réinitialiser</Button>
        <Button onClick={() => void save()} disabled={saving}><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
      {message && <p className="text-xs text-[var(--ink)]/50 text-right">{message}</p>}
    </div>
  )
}
