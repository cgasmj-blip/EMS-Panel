import { useCallback, useEffect, useState } from 'react'
import { ImagePlus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

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
}

export function SiteManagementSection() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('public_site_settings').select('*').eq('id', 1).maybeSingle()
    if (data) setSettings(data as SiteSettings)
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  async function uploadAsset(kind: 'hero' | 'background', file: File | null) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${kind}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('public-site-assets').upload(path, file, { upsert: false })
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

  const positions: Array<[SiteSettings['background_position'], string]> = [
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

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="font-bold text-sm">Contenu de la page publique</h2>
        <p className="text-[var(--ink)]/40 text-xs mt-1 mb-4">
          Modifie ici les textes, les images et les sections visibles avant la connexion EMS.
        </p>

        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--ink)]/55">Titre principal</span>
            <Input value={settings.hero_title} onChange={(e) => setSettings((current) => ({ ...current, hero_title: e.target.value }))} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--ink)]/55">Texte d’introduction</span>
            <textarea
              rows={4}
              value={settings.hero_subtitle}
              onChange={(e) => setSettings((current) => ({ ...current, hero_subtitle: e.target.value }))}
              className="w-full resize-y rounded-xl border border-[var(--ink)]/10 bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-red/35"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink)]/55">Titre du bloc contact</span>
              <Input value={settings.contact_title} onChange={(e) => setSettings((current) => ({ ...current, contact_title: e.target.value }))} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink)]/55">Texte du bloc contact</span>
              <Input value={settings.contact_text} onChange={(e) => setSettings((current) => ({ ...current, contact_text: e.target.value }))} />
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Images</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--ink)]/8 p-4">
            <p className="font-semibold text-sm">Image principale</p>
            <p className="text-[var(--ink)]/35 text-xs mt-1 mb-3">Image décorative affichée dans le bloc d’accueil.</p>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="h-10 rounded-xl border border-dashed border-[var(--ink)]/15 px-3 flex items-center justify-center gap-2 cursor-pointer text-xs text-[var(--ink)]/55">
                  <ImagePlus size={14} /> {settings.hero_image_path ? 'Remplacer' : 'Ajouter une image'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadAsset('hero', e.target.files?.[0] ?? null)} />
              </label>
              {settings.hero_image_path && (
                <Button size="sm" variant="ghost" onClick={() => void removeAsset('hero')}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
            <Select
              className="mt-3"
              value={settings.hero_image_position}
              onChange={(e) => setSettings((current) => ({ ...current, hero_image_position: e.target.value as SiteSettings['hero_image_position'] }))}
            >
              {positions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </div>

          <div className="rounded-xl border border-[var(--ink)]/8 p-4">
            <p className="font-semibold text-sm">Fond de la page publique</p>
            <p className="text-[var(--ink)]/35 text-xs mt-1 mb-3">Image utilisée derrière toute l’interface publique.</p>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="h-10 rounded-xl border border-dashed border-[var(--ink)]/15 px-3 flex items-center justify-center gap-2 cursor-pointer text-xs text-[var(--ink)]/55">
                  <ImagePlus size={14} /> {settings.background_image_path ? 'Remplacer' : 'Ajouter une image'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadAsset('background', e.target.files?.[0] ?? null)} />
              </label>
              {settings.background_image_path && (
                <Button size="sm" variant="ghost" onClick={() => void removeAsset('background')}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Select
                value={settings.background_position}
                onChange={(e) => setSettings((current) => ({ ...current, background_position: e.target.value as SiteSettings['background_position'] }))}
              >
                {positions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <label className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.background_opacity}
                  onChange={(e) => setSettings((current) => ({ ...current, background_opacity: Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs text-[var(--ink)]/45">{settings.background_opacity}%</span>
              </label>
            </div>
          </div>
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
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={settings[key]
                ? 'rounded-xl border border-green-400/20 bg-green-400/7 px-3 py-3 text-left'
                : 'rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-3 text-left opacity-55'}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-[var(--ink)]/35 mt-1">{settings[key] ? 'Visible' : 'Masqué'}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setSettings(DEFAULTS)}>
          <RotateCcw size={14} /> Réinitialiser
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {message && <p className="text-xs text-[var(--ink)]/50 text-right">{message}</p>}
    </div>
  )
}
