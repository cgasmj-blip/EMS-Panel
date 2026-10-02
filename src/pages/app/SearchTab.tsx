import { useEffect, useMemo, useState } from 'react'
import { Search, User, FolderOpen, PackageSearch, Ambulance, CalendarClock, History, Stethoscope, BadgeInfo } from 'lucide-react'
import { supabase, displayRoleLabel, type StaffRole } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

type SearchResult = {
  key: string
  category: string
  title: string
  detail?: string
  meta?: string
  icon: typeof Search
}

function safeTerm(value: string) {
  return value.trim().replace(/[,%_]/g, ' ')
}

export function SearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = safeTerm(query)
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const like = `%${term}%`

      const [
        staff,
        folders,
        documents,
        stock,
        units,
        appointments,
        shifts,
        prestations,
        help,
        grades,
        affiliations,
      ] = await Promise.all([
        supabase.from('staff').select('id,full_name,discord_id,role,status').or(`full_name.ilike.${like},discord_id.ilike.${like}`).limit(30),
        supabase.from('training_folders').select('id,name,description,section_title').or(`name.ilike.${like},description.ilike.${like},section_title.ilike.${like}`).limit(30),
        supabase.from('training_documents').select('id,title,file_name,folder_id').or(`title.ilike.${like},file_name.ilike.${like}`).limit(30),
        supabase.from('stock_items').select('key,label').or(`key.ilike.${like},label.ilike.${like}`).limit(30),
        supabase.from('units').select('id,name,sector,code,vehicule,commentaire,status').or(`name.ilike.${like},sector.ilike.${like},code.ilike.${like},vehicule.ilike.${like},commentaire.ilike.${like}`).limit(30),
        supabase.from('appointments').select('id,type,title,scheduled_at').or(`type.ilike.${like},title.ilike.${like}`).order('scheduled_at', { ascending: false }).limit(30),
        supabase.from('shifts').select('id,unit_name,sector,code,vehicule,commentaire,status_label,started_at,ended_at').or(`unit_name.ilike.${like},sector.ilike.${like},code.ilike.${like},vehicule.ilike.${like},commentaire.ilike.${like},status_label.ilike.${like}`).order('started_at', { ascending: false }).limit(30),
        supabase.from('prestations').select('id,prestation_type_id,details,montant,created_at').or(`prestation_type_id.ilike.${like},details.ilike.${like}`).order('created_at', { ascending: false }).limit(30),
        supabase.from('help_articles').select('id,title,content').or(`title.ilike.${like},content.ilike.${like}`).limit(30),
        supabase.from('sous_grades').select('id,label').or(`id.ilike.${like},label.ilike.${like}`).limit(30),
        supabase.from('affiliations').select('id,label').or(`id.ilike.${like},label.ilike.${like}`).limit(30),
      ])

      if (cancelled) return

      const next: SearchResult[] = []

      for (const row of staff.data ?? []) {
        next.push({
          key: `staff-${row.id}`,
          category: 'Utilisateur',
          title: row.full_name,
          detail: displayRoleLabel(row.role as StaffRole) ?? 'Grade non détecté',
          meta: row.status?.replaceAll('_', ' '),
          icon: User,
        })
      }

      for (const row of folders.data ?? []) {
        next.push({
          key: `folder-${row.id}`,
          category: 'Documents',
          title: row.name,
          detail: row.description ?? undefined,
          meta: row.section_title ?? undefined,
          icon: FolderOpen,
        })
      }

      for (const row of documents.data ?? []) {
        next.push({
          key: `document-${row.id}`,
          category: 'Document',
          title: row.title,
          detail: row.file_name,
          icon: FolderOpen,
        })
      }

      for (const row of stock.data ?? []) {
        next.push({
          key: `stock-${row.key}`,
          category: 'Stock',
          title: row.label,
          detail: row.key,
          icon: PackageSearch,
        })
      }

      for (const row of units.data ?? []) {
        next.push({
          key: `unit-${row.id}`,
          category: 'Service / unité',
          title: row.name,
          detail: [row.sector, row.code, row.vehicule, row.commentaire].filter(Boolean).join(' · '),
          meta: row.status?.replaceAll('_', ' '),
          icon: Ambulance,
        })
      }

      for (const row of appointments.data ?? []) {
        next.push({
          key: `appointment-${row.id}`,
          category: 'Rendez-vous',
          title: row.title || row.type,
          detail: row.type,
          meta: new Date(row.scheduled_at).toLocaleString('fr-FR'),
          icon: CalendarClock,
        })
      }

      for (const row of shifts.data ?? []) {
        next.push({
          key: `shift-${row.id}`,
          category: 'Historique service',
          title: row.unit_name || 'Service',
          detail: [row.sector, row.code, row.vehicule, row.commentaire, row.status_label].filter(Boolean).join(' · '),
          meta: new Date(row.started_at).toLocaleString('fr-FR'),
          icon: History,
        })
      }

      for (const row of prestations.data ?? []) {
        next.push({
          key: `prestation-${row.id}`,
          category: 'Prestation',
          title: row.prestation_type_id,
          detail: row.details ?? undefined,
          meta: `${row.montant} $ · ${new Date(row.created_at).toLocaleString('fr-FR')}`,
          icon: Stethoscope,
        })
      }

      for (const row of help.data ?? []) {
        next.push({
          key: `help-${row.id}`,
          category: 'Aide',
          title: row.title,
          detail: row.content ?? undefined,
          icon: BadgeInfo,
        })
      }

      for (const row of grades.data ?? []) {
        next.push({
          key: `grade-${row.id}`,
          category: 'Habilitation',
          title: row.label,
          detail: row.id,
          icon: BadgeInfo,
        })
      }

      for (const row of affiliations.data ?? []) {
        next.push({
          key: `aff-${row.id}`,
          category: 'Affiliation',
          title: row.label,
          detail: row.id,
          icon: BadgeInfo,
        })
      }

      setResults(next)
      setLoading(false)
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>()
    for (const result of results) {
      const list = map.get(result.category) ?? []
      list.push(result)
      map.set(result.category, list)
    }
    return Array.from(map.entries())
  }, [results])

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/35" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherche globale : personne, document, véhicule, code, stock, historique…"
            className="pl-10"
          />
        </div>
        <p className="text-[var(--ink)]/35 text-xs mt-2">
          La recherche regarde dans toutes les données auxquelles ton compte a accès.
        </p>
      </Card>

      {loading && (
        <p className="text-[var(--ink)]/40 text-sm text-center py-6">Recherche…</p>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-[var(--ink)]/40 text-sm">Aucun résultat.</p>
        </Card>
      )}

      {grouped.map(([category, items]) => (
        <div key={category}>
          <p className="text-[var(--ink)]/45 text-xs font-bold uppercase tracking-wide mb-2">{category}</p>
          <div className="grid gap-2">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.key} className="p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center text-[var(--ink)]/55 shrink-0">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--ink)] text-sm font-semibold">{item.title}</p>
                      {item.detail && <p className="text-[var(--ink)]/45 text-xs mt-0.5 whitespace-pre-wrap line-clamp-3">{item.detail}</p>}
                      {item.meta && <p className="text-[var(--ink)]/30 text-[11px] mt-1">{item.meta}</p>}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
