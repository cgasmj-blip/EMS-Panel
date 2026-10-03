import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, RotateCcw, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TILE_SECTIONS, type TabKey } from '@/lib/tiles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type UiPreferences = {
  background_color: string | null
  background_image_path: string | null
  sidebar_color: string | null
  sidebar_position: 'left' | 'right'
  tile_shape: 'square' | 'soft' | 'rounded' | 'pill'
  tile_colors: Record<string, string>
}

function normalizeHex(value: string) {
  const raw = value.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  return `#${raw.toLowerCase()}`
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex) ?? '#1c2027'
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`
}

export function CustomizationPanel({
  staffId,
  visibleTabs,
  initial,
  onClose,
  onSaved,
  onEditLayout,
}: {
  staffId: string
  visibleTabs: TabKey[]
  initial: UiPreferences
  onClose: () => void
  onSaved: (next: UiPreferences) => void
  onEditLayout: () => void
}) {
  const [backgroundColor, setBackgroundColor] = useState(initial.background_color ?? '#1c2027')
  const [backgroundDefault, setBackgroundDefault] = useState(initial.background_color == null)
  const [backgroundImagePath, setBackgroundImagePath] = useState<string | null>(initial.background_image_path)
  const [sidebarColor, setSidebarColor] = useState(initial.sidebar_color ?? '#16191f')
  const [sidebarDefault, setSidebarDefault] = useState(initial.sidebar_color == null)
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>(initial.sidebar_position ?? 'left')
  const [tileShape, setTileShape] = useState<'square' | 'soft' | 'rounded' | 'pill'>(initial.tile_shape ?? 'rounded')
  const [tileColors, setTileColors] = useState<Record<string, string>>(initial.tile_colors ?? {})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const rgb = useMemo(() => hexToRgb(backgroundColor), [backgroundColor])
  const sidebarRgb = useMemo(() => hexToRgb(sidebarColor), [sidebarColor])

  useEffect(() => {
    let active = true
    async function loadPreview() {
      if (!backgroundImagePath) {
        setPreviewUrl(null)
        return
      }
      const { data } = await supabase.storage.from('user-backgrounds').createSignedUrl(backgroundImagePath, 3600)
      if (active) setPreviewUrl(data?.signedUrl ?? null)
    }
    loadPreview()
    return () => {
      active = false
    }
  }, [backgroundImagePath])

  function setRgb(channel: 'r' | 'g' | 'b', value: number) {
    const next = { ...rgb, [channel]: value }
    setBackgroundDefault(false)
    setBackgroundColor(rgbToHex(next.r, next.g, next.b))
  }

  function setSidebarRgb(channel: 'r' | 'g' | 'b', value: number) {
    const next = { ...sidebarRgb, [channel]: value }
    setSidebarDefault(false)
    setSidebarColor(rgbToHex(next.r, next.g, next.b))
  }

  async function uploadBackground(file: File | null) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${staffId}/background-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('user-backgrounds')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      if (backgroundImagePath) {
        await supabase.storage.from('user-backgrounds').remove([backgroundImagePath])
      }
      setBackgroundImagePath(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function removeBackgroundImage() {
    if (backgroundImagePath) {
      await supabase.storage.from('user-backgrounds').remove([backgroundImagePath])
    }
    setBackgroundImagePath(null)
    setPreviewUrl(null)
  }

  async function save() {
    const normalized = normalizeHex(backgroundColor)
    if (!normalized) {
      setError('Couleur de fond invalide.')
      return
    }

    setSaving(true)
    setError(null)

    const normalizedSidebar = normalizeHex(sidebarColor)
    if (!normalizedSidebar) {
      setError('Couleur de sidebar invalide.')
      return
    }

    const next: UiPreferences = {
      background_color: backgroundDefault ? null : normalized,
      background_image_path: backgroundImagePath,
      sidebar_color: sidebarDefault ? null : normalizedSidebar,
      sidebar_position: sidebarPosition,
      tile_shape: tileShape,
      tile_colors: tileColors,
    }

    const { error: saveError } = await supabase.from('user_ui_preferences').upsert({
      staff_id: staffId,
      ...next,
      updated_at: new Date().toISOString(),
    })

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    onSaved(next)
  }

  const availableTiles = TILE_SECTIONS.filter((section) => visibleTabs.includes(section.key))

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--ink)]/10 bg-[var(--surface)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--ink)]/8 bg-[var(--surface)]/95 backdrop-blur">
          <div>
            <h2 className="text-[var(--ink)] font-bold">Personnalisation</h2>
            <p className="text-[var(--ink)]/40 text-xs mt-0.5">Fond, sidebar, image et couleurs des tuiles.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}><X size={15} /></Button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {error && <p className="text-red-300 text-xs">{error}</p>}

          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[var(--ink)] font-bold text-sm">Couleur du fond</h3>
              <Button size="sm" variant="ghost" onClick={() => { setBackgroundDefault(true); setBackgroundColor('#1c2027') }}>
                <RotateCcw size={13} /> Par défaut
              </Button>
            </div>
            <div className="grid sm:grid-cols-[120px_1fr] gap-4">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => { setBackgroundDefault(false); setBackgroundColor(e.target.value) }}
                className="w-full h-24 rounded-xl border border-[var(--ink)]/10 bg-transparent cursor-pointer"
              />

              <div className="grid gap-3">
                {(['r', 'g', 'b'] as const).map((channel) => (
                  <label key={channel} className="grid grid-cols-[22px_1fr_54px] items-center gap-2">
                    <span className="text-[var(--ink)]/45 uppercase text-xs font-bold">{channel}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={rgb[channel]}
                      onChange={(e) => setRgb(channel, Number(e.target.value))}
                      className="w-full"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={255}
                      value={rgb[channel]}
                      onChange={(e) => setRgb(channel, Number(e.target.value))}
                    />
                  </label>
                ))}
                <Input
                  value={backgroundColor}
                  onChange={(e) => { setBackgroundDefault(false); setBackgroundColor(e.target.value) }}
                  onBlur={() => {
                    const normalized = normalizeHex(backgroundColor)
                    if (normalized) setBackgroundColor(normalized)
                  }}
                  placeholder="#1c2027"
                />
              </div>
            </div>
          </section>


          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[var(--ink)] font-bold text-sm">Couleur de la sidebar</h3>
              <Button size="sm" variant="ghost" onClick={() => { setSidebarDefault(true); setSidebarColor('#16191f') }}>
                <RotateCcw size={13} /> Par défaut
              </Button>
            </div>
            <div className="grid sm:grid-cols-[120px_1fr] gap-4">
              <input
                type="color"
                value={sidebarColor}
                onChange={(e) => { setSidebarDefault(false); setSidebarColor(e.target.value) }}
                className="w-full h-24 rounded-xl border border-[var(--ink)]/10 bg-transparent cursor-pointer"
              />

              <div className="grid gap-3">
                {(['r', 'g', 'b'] as const).map((channel) => (
                  <label key={channel} className="grid grid-cols-[22px_1fr_54px] items-center gap-2">
                    <span className="text-[var(--ink)]/45 uppercase text-xs font-bold">{channel}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={sidebarRgb[channel]}
                      onChange={(e) => setSidebarRgb(channel, Number(e.target.value))}
                      className="w-full"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={255}
                      value={sidebarRgb[channel]}
                      onChange={(e) => setSidebarRgb(channel, Number(e.target.value))}
                    />
                  </label>
                ))}
                <Input
                  value={sidebarColor}
                  onChange={(e) => { setSidebarDefault(false); setSidebarColor(e.target.value) }}
                  onBlur={() => {
                    const normalized = normalizeHex(sidebarColor)
                    if (normalized) setSidebarColor(normalized)
                  }}
                  placeholder="#16191f"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[var(--ink)] font-bold text-sm">Position de la sidebar</h3>
                <p className="text-[var(--ink)]/35 text-xs">Choisis de quel côté elle s’affiche sur ordinateur.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSidebarPosition('left')}>
                <RotateCcw size={13} /> Par défaut
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                ['left', 'À gauche'],
                ['right', 'À droite'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSidebarPosition(value)}
                  className={`relative h-24 rounded-2xl border transition-all overflow-hidden cursor-pointer ${sidebarPosition === value ? 'border-red bg-red/10 ring-2 ring-red/20' : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] hover:bg-[var(--ink)]/[0.05]'}`}
                >
                  <span className={`absolute top-2 bottom-2 w-3 rounded-md bg-[var(--ink)]/45 ${value === 'left' ? 'left-2' : 'right-2'}`} />
                  <span className="text-[var(--ink)]/75 text-sm font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[var(--ink)] font-bold text-sm">Fond d’écran</h3>
                <p className="text-[var(--ink)]/35 text-xs">Image personnelle, jusqu’à 5 Mo.</p>
              </div>
              {backgroundImagePath && (
                <Button size="sm" variant="ghost" onClick={removeBackgroundImage}>
                  <RotateCcw size={13} /> Retirer
                </Button>
              )}
            </div>

            {previewUrl && (
              <img src={previewUrl} alt="" className="w-full h-40 object-cover rounded-xl border border-[var(--ink)]/10 mb-3" />
            )}

            <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--ink)]/15 px-4 py-5 text-[var(--ink)]/55 text-sm cursor-pointer hover:bg-[var(--ink)]/[0.03]">
              <ImagePlus size={17} />
              {uploading ? 'Import en cours…' : 'Choisir une image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => uploadBackground(e.target.files?.[0] ?? null)}
              />
            </label>
          </section>


          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[var(--ink)] font-bold text-sm">Disposition des tuiles</h3>
                <p className="text-[var(--ink)]/35 text-xs mt-1">Déplace et redimensionne librement les tuiles sur l’accueil.</p>
              </div>
              <Button type="button" onClick={onEditLayout}>
                Modifier
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[var(--ink)] font-bold text-sm">Forme des tuiles</h3>
                <p className="text-[var(--ink)]/35 text-xs">Choisis l’arrondi général des tuiles de l’accueil.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTileShape('rounded')}>
                <RotateCcw size={13} /> Par défaut
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['square', 'Carrées', 'rounded-none'],
                ['soft', 'Douces', 'rounded-lg'],
                ['rounded', 'Arrondies', 'rounded-3xl'],
                ['pill', 'Très rondes', 'rounded-[2.5rem]'],
              ] as const).map(([value, label, radius]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTileShape(value)}
                  className={`h-20 border transition-all cursor-pointer ${radius} ${tileShape === value ? 'border-red bg-red/10 ring-2 ring-red/20' : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] hover:bg-[var(--ink)]/[0.05]'}`}
                >
                  <span className="text-[var(--ink)]/75 text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ink)]/8 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[var(--ink)] font-bold text-sm">Couleurs des tuiles</h3>
                <p className="text-[var(--ink)]/35 text-xs">Chaque raccourci peut avoir sa propre couleur RGB.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTileColors({})}>
                <RotateCcw size={13} /> Réinitialiser
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {availableTiles.map((section) => {
                const current = tileColors[section.key] ?? ''
                return (
                  <div key={section.key} className="flex items-center gap-3 rounded-xl border border-[var(--ink)]/8 px-3 py-2.5">
                    <span className="text-[var(--ink)]/70 text-sm flex-1">{section.label}</span>
                    <input
                      type="color"
                      value={current || '#64748b'}
                      onChange={(e) => setTileColors((colors) => ({ ...colors, [section.key]: e.target.value }))}
                      className="w-10 h-8 rounded-lg cursor-pointer"
                    />
                    {current && (
                      <button
                        type="button"
                        onClick={() => setTileColors((colors) => {
                          const next = { ...colors }
                          delete next[section.key]
                          return next
                        })}
                        className="text-[var(--ink)]/35 hover:text-[var(--ink)] cursor-pointer"
                        title="Couleur par défaut"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <Button className="w-full" onClick={save} disabled={saving || uploading}>
            <Save size={15} /> {saving ? 'Enregistrement…' : 'Enregistrer la personnalisation'}
          </Button>
        </div>
      </div>
    </div>
  )
}
