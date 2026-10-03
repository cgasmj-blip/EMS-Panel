import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Power, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

type ChecklistPhase = 'start' | 'end'

type ChecklistItem = {
  id: number
  phase: ChecklistPhase
  label: string
  required: boolean
  active: boolean
  position: number
}

export function ChecklistsSection() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [label, setLabel] = useState('')
  const [phase, setPhase] = useState<ChecklistPhase>('start')
  const [required, setRequired] = useState(true)

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('service_checklist_items')
      .select('*')
      .order('phase')
      .order('position')
    setItems((data ?? []) as ChecklistItem[])
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  async function addItem() {
    const nextLabel = label.trim()
    if (!nextLabel) return
    const phaseItems = items.filter((item) => item.phase === phase)
    const nextPosition = phaseItems.length > 0 ? Math.max(...phaseItems.map((item) => item.position)) + 10 : 10
    await supabase.from('service_checklist_items').insert({
      label: nextLabel,
      phase,
      required,
      active: true,
      position: nextPosition,
    })
    setLabel('')
    setRequired(true)
    await fetchItems()
  }

  async function updateItem(id: number, patch: Partial<ChecklistItem>) {
    await supabase.from('service_checklist_items').update(patch).eq('id', id)
    await fetchItems()
  }

  async function deleteItem(id: number) {
    await supabase.from('service_checklist_items').delete().eq('id', id)
    await fetchItems()
  }

  async function moveItem(item: ChecklistItem, delta: -1 | 1) {
    const phaseItems = items
      .filter((candidate) => candidate.phase === item.phase)
      .sort((a, b) => a.position - b.position)
    const index = phaseItems.findIndex((candidate) => candidate.id === item.id)
    const swap = phaseItems[index + delta]
    if (!swap) return

    await Promise.all([
      supabase.from('service_checklist_items').update({ position: swap.position }).eq('id', item.id),
      supabase.from('service_checklist_items').update({ position: item.position }).eq('id', swap.id),
    ])
    await fetchItems()
  }

  const renderPhase = (target: ChecklistPhase, title: string) => {
    const phaseItems = items.filter((item) => item.phase === target).sort((a, b) => a.position - b.position)

    return (
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[var(--ink)] font-bold text-sm">{title}</h2>
            <p className="text-[var(--ink)]/35 text-xs mt-0.5">
              Active, désactive, rends obligatoire ou réordonne chaque point.
            </p>
          </div>
          <span className="text-[var(--ink)]/30 text-xs">{phaseItems.filter((item) => item.active).length} actif(s)</span>
        </div>

        <AnimatedList className="flex flex-col gap-2">
          {phaseItems.map((item, index) => (
            <AnimatedListItem
              key={item.id}
              className={item.active
                ? 'rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3'
                : 'rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.015] p-3 opacity-55'}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={item.label}
                    onChange={(e) =>
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id ? { ...candidate, label: e.target.value } : candidate,
                        ),
                      )
                    }
                    onBlur={() => updateItem(item.id, { label: item.label.trim() || item.label })}
                    className="flex-1"
                  />

                  <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => moveItem(item, -1)} title="Monter">
                    <ArrowUp size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={index === phaseItems.length - 1} onClick={() => moveItem(item, 1)} title="Descendre">
                    <ArrowDown size={13} />
                  </Button>
                  <Button
                    size="sm"
                    variant={item.active ? 'green' : 'ghost'}
                    onClick={() => updateItem(item.id, { active: !item.active })}
                    title={item.active ? 'Désactiver' : 'Activer'}
                  >
                    <Power size={13} />
                    {item.active ? 'Actif' : 'Inactif'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteItem(item.id)} title="Supprimer">
                    <Trash2 size={13} />
                  </Button>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[var(--ink)]/55 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => updateItem(item.id, { required: e.target.checked })}
                    className="h-4 w-4 accent-red"
                  />
                  Obligatoire avant validation
                </label>
              </div>
            </AnimatedListItem>
          ))}

          {phaseItems.length === 0 && (
            <p className="text-[var(--ink)]/30 text-sm text-center py-5">Aucun élément configuré.</p>
          )}
        </AnimatedList>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Ajouter un point de checklist</h2>
        <div className="grid sm:grid-cols-[1fr_180px_auto_auto] gap-2 items-end">
          <div>
            <p className="text-[var(--ink)]/40 text-xs mb-1.5">Libellé</p>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : Niveau d'oxygène vérifié"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addItem()
              }}
            />
          </div>
          <div>
            <p className="text-[var(--ink)]/40 text-xs mb-1.5">Moment</p>
            <Select value={phase} onChange={(e) => setPhase(e.target.value as ChecklistPhase)}>
              <option value="start">Début de service</option>
              <option value="end">Fin de service</option>
            </Select>
          </div>
          <label className="h-10 px-3 rounded-xl border border-[var(--ink)]/10 flex items-center gap-2 text-xs text-[var(--ink)]/60 cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 accent-red"
            />
            Obligatoire
          </label>
          <Button onClick={addItem} disabled={!label.trim()}>Ajouter</Button>
        </div>
      </Card>

      {renderPhase('start', 'Checklist début de service')}
      {renderPhase('end', 'Checklist fin de service')}
    </div>
  )
}
