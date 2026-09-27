import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, staffMatchesEligibility, type PrestationType, type Prestation } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR') + ' ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function PrestationsTab() {
  const { staff } = useAuth()
  const [types, setTypes] = useState<PrestationType[]>([])
  const [typeId, setTypeId] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [details, setDetails] = useState('')
  const [mine, setMine] = useState<Prestation[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!staff) return
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('prestation_types').select('*').order('label'),
      supabase.from('prestations').select('*').eq('staff_id', staff.id).is('archived_at', null).order('created_at', { ascending: false }).limit(30),
    ])
    if (t) setTypes(t)
    if (p) setMine(p)
  }, [staff])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const eligibleTypes = staff ? types.filter((t) => staffMatchesEligibility(staff, t)) : types

  const selectedType = types.find((t) => t.id === typeId)
  const applicablePrice = selectedType ? (isPublic ? selectedType.tarif_public ?? 0 : selectedType.tarif) : null

  async function handleSubmit() {
    if (!staff || !typeId || submitting) return
    const type = types.find((t) => t.id === typeId)
    if (!type) return
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    const { error: err } = await supabase.from('prestations').insert({
      staff_id: staff.id,
      prestation_type_id: typeId,
      montant: isPublic ? type.tarif_public ?? 0 : type.tarif,
      is_public: isPublic,
      details: details.trim() || null,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setSuccess(true)
    setTypeId('')
    setIsPublic(false)
    setDetails('')
    await fetchAll()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Prestations</h2>
        {error && <p className="text-red-300 text-xs mb-3 animate-pop-in">{error}</p>}
        {success && <p className="text-green-300 text-xs mb-3 animate-pop-in">Enregistré.</p>}
        <div className="mb-4">
          <Field label="Type de soin">
            <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Choisir...</option>
              {eligibleTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.tarif}$
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]/70 mb-1 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-red" />
          Service public (gratuit / pris en charge)
        </label>
        {selectedType && (
          <p className="text-[var(--ink)]/40 text-xs mb-4">
            Prix applicable{isPublic ? ' (service public)' : ''} : <span className="text-[var(--ink)] font-semibold">{applicablePrice}$</span>
          </p>
        )}
        <div className="mb-4">
          <Field label="Détails">
            <Textarea rows={3} placeholder="Détails de la prestation..." value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
        </div>
        <Button variant="red" className="w-full" disabled={submitting || !typeId} onClick={handleSubmit}>
          Valider
        </Button>
      </Card>

      <Card className="p-5" delay={0.1}>
        <h2 className="text-[var(--ink)]/60 text-xs uppercase tracking-[2px] font-bold mb-4">Mes prestations</h2>
        <AnimatedList className="flex flex-col gap-2">
          {mine.map((p) => (
            <AnimatedListItem key={p.id} className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5">
              <div>
                <p className="text-[var(--ink)] text-sm font-semibold">
                  {types.find((t) => t.id === p.prestation_type_id)?.label ?? p.prestation_type_id}
                  {p.is_public && <span className="text-cyan text-xs ml-2">Service public</span>}
                </p>
                <p className="text-[var(--ink)]/40 text-xs">{formatDateTime(p.created_at)} {p.details ? `· ${p.details}` : ''}</p>
              </div>
              <p className="text-[var(--ink)] font-bold text-sm">{p.montant}$</p>
            </AnimatedListItem>
          ))}
          {mine.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucune prestation.</p>}
        </AnimatedList>
      </Card>
    </div>
  )
}
