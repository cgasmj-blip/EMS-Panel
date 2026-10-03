import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Pause, Square, RefreshCw } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import {
  supabase,
  displayRoleLabel,
  staffMatchesEligibility,
  shortLabel,
  STATUS_LABELS,
  type Staff,
  type Unit,
  type DutyStatus,
  type EmergencyCode,
  type EmergencyCodeRow,
  type InterventionShortcut,
  type SousGrade,
  type Affiliation,
  type Vehicle,
} from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'
import { cn } from '@/lib/utils'

type ChecklistPhase = 'start' | 'end'
type ChecklistItem = { id: number; phase: ChecklistPhase; label: string; required: boolean; active: boolean; position: number }

function teamLabel(count: number) {
  if (count <= 1) return 'Solo'
  if (count === 2) return 'Duo'
  if (count === 3) return 'Trio'
  return `Équipe (${count})`
}

const STATUS_BADGE: Record<DutyStatus, 'green' | 'amber' | 'gray'> = {
  en_service: 'green',
  en_pause: 'amber',
  hors_service: 'gray',
}

const STATUS_ORDER: Record<DutyStatus, number> = { en_service: 0, en_pause: 1, hors_service: 2 }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(startIso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export function ServicesTab() {
  const { staff, refreshStaff } = useAuth()
  const [roster, setRoster] = useState<Staff[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [now, setNow] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklistPhase, setChecklistPhase] = useState<ChecklistPhase | null>(null)
  const [checklistChecked, setChecklistChecked] = useState<number[]>([])
  const [pendingJoinUnit, setPendingJoinUnit] = useState<Unit | null>(null)

  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitLieu, setNewUnitLieu] = useState('Nord')
  const [newCode, setNewCode] = useState<EmergencyCode | ''>('')
  const [vehicule, setVehicule] = useState('')
  const [defibrillateurChoice, setDefibrillateurChoice] = useState<'' | 'oui' | 'non'>('')
  const [commentaire, setCommentaire] = useState('')
  const [intervention, setIntervention] = useState('')
  const [detailsDirty, setDetailsDirty] = useState(false)

  const [codes, setCodes] = useState<EmergencyCodeRow[]>([])
  const [shortcuts, setShortcuts] = useState<InterventionShortcut[]>([])
  const codeLabel = (code: EmergencyCode) => codes.find((c) => c.code === code)?.label ?? code

  const [sousGrades, setSousGrades] = useState<SousGrade[]>([])
  const [affiliations, setAffiliations] = useState<Affiliation[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const sousGradeLabel = (id: string | null) => {
    const l = sousGrades.find((sg) => sg.id === id)?.label
    return l ? shortLabel(l) : undefined
  }
  const affiliationLabel = (id: string | null) => {
    const l = affiliations.find((a) => a.id === id)?.label
    return l ? shortLabel(l) : undefined
  }
  const vehicleLabel = (name: string | null) => {
    if (!name) return null
    const vehicle = vehicles.find((v) => v.name === name)
    return vehicle?.plate ? `${name} · Plaque ${vehicle.plate}` : name
  }
  const memberNameClass = (status: DutyStatus) =>
    status === 'en_service'
      ? 'text-green-400'
      : status === 'en_pause'
        ? 'text-amber-300'
        : 'text-[var(--ink)]'

  const fetchAll = useCallback(async () => {
    const [{ data: staffData, error: staffError }, { data: unitData }] = await Promise.all([
      supabase.from('staff').select('*').eq('active', true).neq('role', 'membre').order('full_name'),
      supabase.from('units').select('*').order('created_at', { ascending: false }),
    ])
    if (staffError) {
      console.error('Chargement effectif impossible', staffError)
      setError('Impossible de charger tout l’effectif.')
    }
    if (staffData) {
      const baseRoster = staffData.map((row) => ({
        ...row,
        sous_grade_ids: [] as string[],
        affiliation_ids: [] as string[],
      })) as Staff[]

      const ids = baseRoster.map((s) => s.id)
      if (ids.length > 0) {
        const [{ data: sgLinks }, { data: affLinks }] = await Promise.all([
          supabase.from('staff_sous_grades').select('staff_id,sous_grade_id').in('staff_id', ids),
          supabase.from('staff_affiliations').select('staff_id,affiliation_id').in('staff_id', ids),
        ])
        const sgByStaff = new Map<string, string[]>()
        const affByStaff = new Map<string, string[]>()
        for (const link of sgLinks ?? []) {
          sgByStaff.set(link.staff_id, [...(sgByStaff.get(link.staff_id) ?? []), link.sous_grade_id])
        }
        for (const link of affLinks ?? []) {
          affByStaff.set(link.staff_id, [...(affByStaff.get(link.staff_id) ?? []), link.affiliation_id])
        }
        for (const member of baseRoster) {
          member.sous_grade_ids = sgByStaff.get(member.id) ?? []
          member.affiliation_ids = affByStaff.get(member.id) ?? []
        }
      }
      setRoster(baseRoster)
    }
    if (unitData) setUnits(unitData)
  }, [])

  useEffect(() => {
    supabase.from('emergency_codes').select('*').order('position').then(({ data }) => {
      if (data) setCodes(data)
    })
    supabase.from('intervention_shortcuts').select('*').order('position').then(({ data }) => {
      if (data) setShortcuts(data)
    })
    supabase.from('sous_grades').select('*').order('position').then(({ data }) => {
      if (data) setSousGrades(data)
    })
    supabase.from('affiliations').select('*').order('position').then(({ data }) => {
      if (data) setAffiliations(data)
    })
    supabase.from('vehicles').select('*').order('name').then(({ data }) => {
      if (data) setVehicles(data)
    })
    supabase.from('service_checklist_items').select('*').eq('active', true).order('position').then(({ data }) => {
      if (data) setChecklistItems(data as ChecklistItem[])
    })
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('services-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(tick)
  }, [])

  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])

  useEffect(() => {
    if (!staff?.unit_id || detailsDirty) return
    const unit = unitsById.get(staff.unit_id)
    if (!unit) return
    setNewUnitName(unit.name ?? '')
    setNewUnitLieu(unit.sector ?? 'Nord')
    setNewCode(unit.code ?? '')
    setVehicule(unit.vehicule ?? '')
    setDefibrillateurChoice(unit.defibrillateur ? 'oui' : 'non')
    setCommentaire(unit.commentaire ?? '')
    setIntervention(unit.intervention ?? '')
  }, [staff?.unit_id, unitsById, detailsDirty])

  const activeUnits = useMemo(() => units.filter((u) => roster.some((s) => s.unit_id === u.id)), [units, roster])

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.full_name.localeCompare(b.full_name)),
    [roster],
  )

  const counts = useMemo(
    () =>
      roster.reduce(
        (acc, s) => {
          acc[s.status] += 1
          return acc
        },
        { en_service: 0, en_pause: 0, hors_service: 0 } as Record<DutyStatus, number>,
      ),
    [roster],
  )

  function requestStartChecklist() {
    openChecklist('start')
  }

  function openChecklist(phase: ChecklistPhase, unit: Unit | null = null) {
    setChecklistPhase(phase)
    setChecklistChecked([])
    setPendingJoinUnit(unit)
    setError(null)
  }

  function closeChecklist() {
    setChecklistPhase(null)
    setChecklistChecked([])
    setPendingJoinUnit(null)
  }

  async function submitChecklist() {
    if (!staff || !checklistPhase || submitting) return
    const items = checklistItems.filter((item) => item.phase === checklistPhase)
    const requiredIds = items.filter((item) => item.required).map((item) => item.id)
    const missing = requiredIds.filter((id) => !checklistChecked.includes(id))

    if (missing.length > 0) {
      setError('Tous les points obligatoires de la checklist doivent être validés.')
      return
    }

    const answers = Object.fromEntries(items.map((item) => [String(item.id), checklistChecked.includes(item.id)]))
    const { error: checklistError } = await supabase.from('service_checklist_submissions').insert({
      staff_id: staff.id,
      phase: checklistPhase,
      answers,
    })

    if (checklistError) {
      setError(checklistError.message)
      return
    }

    const phase = checklistPhase
    const unit = pendingJoinUnit
    closeChecklist()

    if (phase === 'start') {
      if (unit) await handleJoinUnit(unit)
      else await handlePrendreService()
    } else {
      await handleFin()
    }
  }

  async function handlePrendreService() {
    if (!staff || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const startedAt = new Date().toISOString()
      const unitPayload = {
        name: newUnitName.trim() || `Unité de ${staff.full_name}`,
        status: 'en_service' as DutyStatus,
        sector: newUnitLieu || null,
        code: newCode || null,
        vehicule: vehicule || null,
        commentaire: commentaire.trim() || null,
        intervention: intervention || null,
        defibrillateur: defibrillateurChoice === 'oui',
      }

      const { data: unit, error: unitErr } = await supabase
        .from('units')
        .insert(unitPayload)
        .select()
        .single()
      if (unitErr || !unit) throw new Error(unitErr?.message ?? "Création d'unité impossible")

      const { error: staffErr } = await supabase
        .from('staff')
        .update({ unit_id: unit.id, status: 'en_service', shift_started_at: startedAt })
        .eq('id', staff.id)
      if (staffErr) throw new Error(staffErr.message)

      const { error: shiftErr } = await supabase.from('shifts').insert({
        staff_id: staff.id,
        unit_name: unit.name,
        sector: unit.sector,
        code: newCode || null,
        vehicule: vehicule || null,
        commentaire: commentaire.trim() || null,
        intervention: intervention || null,
        defibrillateur: defibrillateurChoice === 'oui',
        status_label: 'en_service',
        started_at: startedAt,
      })
      if (shiftErr) throw new Error(shiftErr.message)

      setNewUnitName('')
      setNewUnitLieu('Nord')
      setNewCode('')
      setVehicule('')
      setDefibrillateurChoice('')
      setCommentaire('')
      setIntervention('')
      setDetailsDirty(false)
      await Promise.all([refreshStaff(), fetchAll()])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoinUnit(unit: Unit) {
    if (!staff || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const isNewShift = !staff.shift_started_at
      const startedAt = staff.shift_started_at ?? new Date().toISOString()

      const { error: staffErr } = await supabase
        .from('staff')
        .update({ unit_id: unit.id, status: 'en_service', shift_started_at: startedAt })
        .eq('id', staff.id)
      if (staffErr) throw new Error(staffErr.message)

      if (isNewShift) {
        await supabase.from('shifts').insert({
          staff_id: staff.id,
          unit_name: unit.name,
          sector: unit.sector,
          status_label: 'en_service',
          started_at: startedAt,
        })
      } else {
        await supabase
          .from('shifts')
          .update({ status_label: 'en_service', unit_name: unit.name, sector: unit.sector })
          .eq('staff_id', staff.id)
          .is('ended_at', null)
      }

      await Promise.all([refreshStaff(), fetchAll()])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMettreAJour() {
    if (!staff?.unit_id || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const patch = {
        name: newUnitName.trim() || `Unité de ${staff.full_name}`,
        sector: newUnitLieu || null,
        code: newCode || null,
        vehicule: vehicule || null,
        defibrillateur: defibrillateurChoice === 'oui',
        commentaire: commentaire.trim() || null,
        intervention: intervention || null,
      }

      const { error: unitError } = await supabase.from('units').update(patch).eq('id', staff.unit_id)
      if (unitError) throw new Error(unitError.message)

      const { error: shiftError } = await supabase
        .from('shifts')
        .update({
          unit_name: patch.name,
          sector: patch.sector,
          code: patch.code,
          vehicule: patch.vehicule,
          defibrillateur: patch.defibrillateur,
          commentaire: patch.commentaire,
          intervention: patch.intervention,
        })
        .eq('staff_id', staff.id)
        .is('ended_at', null)
      if (shiftError) throw new Error(shiftError.message)

      setDetailsDirty(false)
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePause() {
    if (!staff || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await supabase.from('staff').update({ status: 'en_pause' }).eq('id', staff.id)
      await supabase.from('shifts').update({ status_label: 'en_pause' }).eq('staff_id', staff.id).is('ended_at', null)
      await Promise.all([refreshStaff(), fetchAll()])
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResume() {
    if (!staff || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await supabase.from('staff').update({ status: 'en_service' }).eq('id', staff.id)
      await supabase.from('shifts').update({ status_label: 'en_service' }).eq('staff_id', staff.id).is('ended_at', null)
      await Promise.all([refreshStaff(), fetchAll()])
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFin() {
    if (!staff || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await supabase.from('staff').update({ unit_id: null, status: 'hors_service', shift_started_at: null }).eq('id', staff.id)
      await supabase.from('shifts').update({ ended_at: new Date().toISOString() }).eq('staff_id', staff.id).is('ended_at', null)
      setDetailsDirty(false)
      await Promise.all([refreshStaff(), fetchAll()])
    } finally {
      setSubmitting(false)
    }
  }

  if (!staff) return null

  const eligibleVehicles = vehicles.filter((v) => staffMatchesEligibility(staff, v))

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[var(--ink)] font-bold text-sm">Prise de service</h2>
          <Button variant="ghost" size="sm" onClick={fetchAll}>
            <RefreshCw size={13} /> Synchroniser
          </Button>
        </div>
        {error && <p className="text-red-300 text-xs mb-3">{error}</p>}
        <div className="flex flex-col gap-4 mb-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nom de l’unité (facultatif)">
              <Input
                value={newUnitName}
                onChange={(e) => {
                  setNewUnitName(e.target.value)
                  if (staff.status !== 'hors_service') setDetailsDirty(true)
                }}
                placeholder="Ex : Unité Nord 1"
              />
            </Field>
            <Field label="Lieu (facultatif)">
              <Select
                value={newUnitLieu}
                onChange={(e) => {
                  setNewUnitLieu(e.target.value)
                  if (staff.status !== 'hors_service') setDetailsDirty(true)
                }}
              >
                <option value="Nord">⛰️ Nord</option>
                <option value="Sud">🏙️ Sud</option>
                <option value="Nord-Sud">⛰️🏙️ Nord-Sud</option>
              </Select>
            </Field>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[1.5px] text-[var(--ink)]/40 font-semibold mb-1.5">Code d’urgence (facultatif)</p>
            <div className="flex flex-wrap gap-2">
              {codes.map((code) => (
                <Button
                  key={code.code}
                  type="button"
                  size="sm"
                  variant={newCode === code.code ? 'red' : 'ghost'}
                  onClick={() => {
                    setNewCode(code.code)
                    if (staff.status !== 'hors_service') setDetailsDirty(true)
                  }}
                >
                  {'CODE ' + code.code + (code.label ? ' · ' + code.label : '')}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Véhicule (facultatif)">
              <Select
                value={vehicule}
                onChange={(e) => {
                  setVehicule(e.target.value)
                  if (staff.status !== 'hors_service') setDetailsDirty(true)
                }}
              >
                <option value="">— Aucun / non renseigné —</option>
                {eligibleVehicles.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.plate ? v.name + ' · ' + v.plate : v.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Défibrillateur (facultatif)">
              <Select
                value={defibrillateurChoice}
                onChange={(e) => {
                  setDefibrillateurChoice(e.target.value as '' | 'oui' | 'non')
                  if (staff.status !== 'hors_service') setDetailsDirty(true)
                }}
              >
                <option value="">— Non renseigné —</option>
                <option value="oui">OUI</option>
                <option value="non">NON</option>
              </Select>
            </Field>
          </div>

          <Field label="Commentaire (facultatif)">
            <Input
              value={commentaire}
              onChange={(e) => {
                setCommentaire(e.target.value)
                if (staff.status !== 'hors_service') setDetailsDirty(true)
              }}
            />
          </Field>

          <div>
            <p className="text-xs uppercase tracking-[1.5px] text-[var(--ink)]/40 font-semibold mb-1.5">Interventions</p>
            <div className="flex flex-wrap gap-2">
              {shortcuts.filter((s) => staffMatchesEligibility(staff, s)).map((shortcut) => (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => {
                    setIntervention((current) => current === shortcut.label ? '' : shortcut.label)
                    if (staff.status !== 'hors_service') setDetailsDirty(true)
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                    intervention === shortcut.label
                      ? 'border-red/50 bg-red/10 text-neon-red'
                      : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--ink)]/[0.06]',
                  )}
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </div>

          {staff.status !== 'hors_service' && (
            <Button variant="ghost" size="sm" disabled={submitting || !detailsDirty} onClick={handleMettreAJour}>
              Mettre à jour
            </Button>
          )}
        </div>
        {checklistPhase && (
          <div className="mb-4 rounded-xl border border-cyan/20 bg-cyan/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[var(--ink)] font-bold text-sm">
                  Checklist {checklistPhase === 'start' ? 'début de service' : 'fin de service'}
                </p>
                <p className="text-[var(--ink)]/35 text-xs mt-0.5">Valide les points obligatoires avant de continuer.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={closeChecklist}>Annuler</Button>
            </div>
            <div className="grid gap-2">
              {checklistItems.filter((item) => item.phase === checklistPhase).map((item) => {
                const checked = checklistChecked.includes(item.id)
                return (
                  <label key={item.id} className="flex items-center gap-3 rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setChecklistChecked((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])}
                      className="h-4 w-4 accent-red"
                    />
                    <span className="text-[var(--ink)]/75 text-sm flex-1">{item.label}</span>
                    {item.required && <span className="text-[10px] uppercase tracking-wide text-red-300">obligatoire</span>}
                  </label>
                )
              })}
            </div>
            <Button
              className="w-full mt-3"
              variant={checklistPhase === 'start' ? 'green' : 'red'}
              disabled={submitting}
              onClick={submitChecklist}
            >
              {checklistPhase === 'start' ? 'Valider et prendre service' : 'Valider et terminer le service'}
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {staff.status === 'hors_service' && (
            <Button variant="green" disabled={submitting} onClick={requestStartChecklist} className="flex-1">
              <Play size={14} /> PRENDRE LE SERVICE
            </Button>
          )}
          {staff.status === 'en_service' && (
            <Button variant="ghost" disabled={submitting} onClick={handlePause} className="flex-1">
              <Pause size={14} /> En pause
            </Button>
          )}
          {staff.status === 'en_pause' && (
            <Button variant="green" disabled={submitting} onClick={handleResume} className="flex-1">
              <Play size={14} /> Reprendre le service
            </Button>
          )}
          {staff.status !== 'hors_service' && (
            <Button variant="red" disabled={submitting} onClick={() => openChecklist('end')} className="flex-1">
              <Square size={14} /> FIN DE SERVICE
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="En service" value={counts.en_service} variant="green" delay={0.05} />
        <StatTile label="En pause" value={counts.en_pause} variant="amber" delay={0.1} />
        <StatTile label="Hors service" value={counts.hors_service} variant="gray" delay={0.15} />
      </div>

      <Card className="p-5" delay={0.1}>
        <h2 className="text-[var(--ink)]/60 text-xs uppercase tracking-[2px] font-bold mb-4">Services actifs</h2>
        <AnimatedList className="flex flex-col gap-2">
          {activeUnits.map((unit) => {
            const members = roster.filter((s) => s.unit_id === unit.id)
            return (
              <AnimatedListItem key={unit.id} className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5">
                <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                  <p className="text-[var(--ink)] text-sm font-semibold">{unit.name}</p>
                  <div className="flex items-center gap-1.5">
                    {unit.code && <Badge variant="red">{`CODE ${unit.code} · ${codeLabel(unit.code)}`}</Badge>}
                    <Badge variant={STATUS_BADGE[unit.status]}>
                      {unit.status === 'en_service' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-status-pulse" />}
                      {STATUS_LABELS[unit.status]}
                    </Badge>
                    {staff.unit_id !== unit.id && (
                      <Button size="sm" variant="green" disabled={submitting} onClick={() => openChecklist('start', unit)}>
                        Rejoindre
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[var(--ink)]/40 text-xs mb-1">
                  {unit.sector ? `Lieu : ${unit.sector} · ` : ''}
                  Début : {formatTime(unit.created_at)} · {teamLabel(members.length)}
                  {unit.vehicule ? ` · Véhicule : ${vehicleLabel(unit.vehicule)}` : ''}
                </p>
                {unit.intervention && <p className="text-[var(--ink)]/55 text-xs mb-1">Intervention : {unit.intervention}</p>}
                {unit.commentaire && <p className="text-[var(--ink)]/50 text-xs mb-1 italic">{unit.commentaire}</p>}
                <div className="flex flex-col gap-1">
                  {members.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('text-xs font-semibold', memberNameClass(s.status))}>{s.full_name}</span>
                      {displayRoleLabel(s.role) && <Badge variant="gray">{displayRoleLabel(s.role)}</Badge>}
                      {s.sous_grade_ids.map((id) => sousGradeLabel(id) && <Badge key={id} variant="cyan">{sousGradeLabel(id)}</Badge>)}
                      {s.affiliation_ids.map((id) => affiliationLabel(id) && <Badge key={id} variant="red">{affiliationLabel(id)}</Badge>)}
                    </div>
                  ))}
                </div>
                {unit.defibrillateur && (
                  <div className="mt-1">
                    <Badge variant="cyan">Défibrillateur</Badge>
                  </div>
                )}
              </AnimatedListItem>
            )
          })}
          {activeUnits.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucun service actif.</p>}
        </AnimatedList>
      </Card>

      <Card className="p-5" delay={0.15}>
        <h2 className="text-[var(--ink)]/60 text-xs uppercase tracking-[2px] font-bold mb-4">Effectif ({roster.length})</h2>
        <AnimatedList className="flex flex-col gap-2">
          {sortedRoster.map((member) => (
            <AnimatedListItem
              key={member.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5',
                member.id === staff.id && 'border-red/30 bg-red/5',
                member.discord_id && 'cursor-pointer',
              )}
              onClick={
                member.discord_id ? () => window.open(`https://discord.com/users/${member.discord_id}`, '_blank', 'noopener') : undefined
              }
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="w-9 h-9 rounded-full border border-[var(--ink)]/15" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--ink)]/10 border border-[var(--ink)]/15" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold truncate', memberNameClass(member.status))}>{member.full_name}</p>
                <p className="text-[var(--ink)]/40 text-xs truncate">
                  {[
                    displayRoleLabel(member.role),
                    member.unit_id ? unitsById.get(member.unit_id)?.name : null,
                    member.unit_id ? vehicleLabel(unitsById.get(member.unit_id)?.vehicule ?? null) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {member.status !== 'hors_service' && (member.sous_grade_ids.length > 0 || member.affiliation_ids.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.sous_grade_ids.map((id) => sousGradeLabel(id) && <Badge key={id} variant="cyan">{sousGradeLabel(id)}</Badge>)}
                    {member.affiliation_ids.map((id) => affiliationLabel(id) && <Badge key={id} variant="red">{affiliationLabel(id)}</Badge>)}
                  </div>
                )}
                {member.unit_id && unitsById.get(member.unit_id)?.commentaire && (
                  <p className="text-[var(--ink)]/40 text-xs italic truncate">{unitsById.get(member.unit_id)!.commentaire}</p>
                )}
              </div>
              {member.unit_id && unitsById.get(member.unit_id)?.defibrillateur && <Badge variant="cyan">DEA</Badge>}
              {member.status !== 'hors_service' && member.shift_started_at && (
                <span className="text-[var(--ink)]/30 text-xs hidden sm:block">{formatDuration(member.shift_started_at, now)}</span>
              )}
              <Badge variant={STATUS_BADGE[member.status]}>
                {member.status === 'en_service' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-status-pulse" />}
                {STATUS_LABELS[member.status]}
              </Badge>
            </AnimatedListItem>
          ))}
          {sortedRoster.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-6">Aucun agent enregistré.</p>}
        </AnimatedList>
      </Card>
    </div>
  )
}

function StatTile({
  label,
  value,
  variant,
  delay,
}: {
  label: string
  value: number
  variant: 'green' | 'amber' | 'gray'
  delay?: number
}) {
  const colors = { green: 'text-green-400', amber: 'text-amber-400', gray: 'text-[var(--ink)]/50' }
  return (
    <Card className="p-4 text-center" delay={delay} hoverable>
      <p className={cn('font-display font-black text-2xl', colors[variant])}>
        <AnimatedNumber value={value} />
      </p>
      <p className="text-[var(--ink)]/40 text-[11px] uppercase tracking-[1.5px] mt-1">{label}</p>
    </Card>
  )
}
