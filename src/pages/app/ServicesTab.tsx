import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Pause, Square, RefreshCw } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import {
  supabase,
  displayRoleLabel,
  staffMatchesEligibility,
  mapStaffRow,
  shortLabel,
  STAFF_SELECT_WITH_GRADES,
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

  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitLieu, setNewUnitLieu] = useState('')

  const [vehicule, setVehicule] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [defibrillateur, setDefibrillateur] = useState(false)
  const [detailsDirty, setDetailsDirty] = useState(false)

  const [codes, setCodes] = useState<EmergencyCodeRow[]>([])
  const [shortcuts, setShortcuts] = useState<InterventionShortcut[]>([])
  const codeLabel = (code: EmergencyCode) => codes.find((c) => c.code === code)?.label ?? `Code ${code}`

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

  const fetchAll = useCallback(async () => {
    const [{ data: staffData }, { data: unitData }] = await Promise.all([
      supabase.from('staff').select(STAFF_SELECT_WITH_GRADES).eq('active', true).neq('role', 'membre').order('full_name'),
      supabase.from('units').select('*').order('created_at', { ascending: false }),
    ])
    if (staffData) setRoster(staffData.map(mapStaffRow))
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
    if (detailsDirty) return
    const unit = staff?.unit_id ? unitsById.get(staff.unit_id) : null
    setVehicule(unit?.vehicule ?? '')
    setCommentaire(unit?.commentaire ?? '')
    setDefibrillateur(unit?.defibrillateur ?? false)
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

  async function handlePrendreService() {
    if (!staff || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      let unitId = staff.unit_id
      let unitName = staff.unit_id ? unitsById.get(staff.unit_id)?.name ?? null : null
      let unitSector = staff.unit_id ? unitsById.get(staff.unit_id)?.sector ?? null : null

      if (newUnitName.trim()) {
        const { data, error: unitErr } = await supabase
          .from('units')
          .insert({ name: newUnitName.trim(), status: 'en_service', sector: newUnitLieu.trim() || null })
          .select()
          .single()
        if (unitErr || !data) throw new Error(unitErr?.message ?? "Création d'unité impossible")
        unitId = data.id
        unitName = data.name
        unitSector = data.sector
      }

      if (!unitId) throw new Error("Donne un nom d'unité, ou rejoins un service actif ci-dessous.")

      const isNewShift = !staff.shift_started_at
      const startedAt = staff.shift_started_at ?? new Date().toISOString()

      const { error: staffErr } = await supabase
        .from('staff')
        .update({ unit_id: unitId, status: 'en_service', shift_started_at: startedAt })
        .eq('id', staff.id)
      if (staffErr) throw new Error(staffErr.message)

      if (isNewShift) {
        await supabase.from('shifts').insert({
          staff_id: staff.id,
          unit_name: unitName,
          sector: unitSector,
          status_label: 'en_service',
          started_at: startedAt,
        })
      } else {
        await supabase
          .from('shifts')
          .update({ status_label: 'en_service', unit_name: unitName, sector: unitSector })
          .eq('staff_id', staff.id)
          .is('ended_at', null)
      }

      setNewUnitName('')
      setNewUnitLieu('')
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

  async function handleSetCode(code: EmergencyCode) {
    if (!staff?.unit_id || submitting) return
    setSubmitting(true)
    try {
      await supabase.from('units').update({ code }).eq('id', staff.unit_id)
      await supabase.from('shifts').update({ code }).eq('staff_id', staff.id).is('ended_at', null)
      await fetchAll()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMettreAJour() {
    if (!staff?.unit_id || submitting) return
    setSubmitting(true)
    try {
      await supabase
        .from('units')
        .update({ vehicule: vehicule.trim() || null, commentaire: commentaire.trim() || null, defibrillateur })
        .eq('id', staff.unit_id)
      await supabase
        .from('shifts')
        .update({ vehicule: vehicule.trim() || null, commentaire: commentaire.trim() || null, defibrillateur })
        .eq('staff_id', staff.id)
        .is('ended_at', null)
      setDetailsDirty(false)
      await fetchAll()
    } finally {
      setSubmitting(false)
    }
  }

  function applyShortcut(label: string) {
    setCommentaire(label)
    setDetailsDirty(true)
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
        <div className="mb-4">
          <Field label="Nom d'unité (créer)">
            <Input placeholder="Unité Alpha" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} />
          </Field>
        </div>
        <p className="text-[var(--ink)]/30 text-xs mb-4">Pour rejoindre un service déjà actif, utilise le bouton "Rejoindre" ci-dessous plutôt que de créer une unité.</p>
        {newUnitName.trim() && (
          <div className="mb-4">
            <Field label="Lieu">
              <Input placeholder="ex: Pillbox, Sandy Shores..." value={newUnitLieu} onChange={(e) => setNewUnitLieu(e.target.value)} />
            </Field>
          </div>
        )}
        {staff.unit_id && staff.status === 'en_service' && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[1.5px] text-[var(--ink)]/40 font-semibold mb-1.5">Code d'urgence</p>
            <div className="flex gap-2">
              {codes.map((c) => (
                <Button
                  key={c.code}
                  type="button"
                  size="sm"
                  variant={unitsById.get(staff.unit_id!)?.code === c.code ? 'red' : 'ghost'}
                  disabled={submitting}
                  onClick={() => handleSetCode(c.code)}
                  className="flex-1"
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
        )}
        {staff.unit_id && staff.status !== 'hors_service' && (
          <div className="mb-4 flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Véhicule">
                <Select
                  value={vehicule}
                  onChange={(e) => {
                    setVehicule(e.target.value)
                    setDetailsDirty(true)
                  }}
                >
                  <option value="">— Aucun —</option>
                  {eligibleVehicles.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Défibrillateur">
                <Select
                  value={defibrillateur ? 'oui' : 'non'}
                  onChange={(e) => {
                    setDefibrillateur(e.target.value === 'oui')
                    setDetailsDirty(true)
                  }}
                >
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </Select>
              </Field>
            </div>
            <Field label="Commentaire">
              <Input
                placeholder="ex: Code 3, RDV Psy..."
                value={commentaire}
                onChange={(e) => {
                  setCommentaire(e.target.value)
                  setDetailsDirty(true)
                }}
              />
            </Field>
            <div>
              <p className="text-xs uppercase tracking-[1.5px] text-[var(--ink)]/40 font-semibold mb-1.5">Interventions</p>
              <div className="flex flex-wrap gap-2">
                {shortcuts.filter((s) => staffMatchesEligibility(staff, s)).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyShortcut(s.label)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                      commentaire === s.label
                        ? 'border-red/50 bg-red/10 text-neon-red'
                        : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--ink)]/[0.06]',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={submitting || !detailsDirty} onClick={handleMettreAJour}>
              Mettre à jour
            </Button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          {staff.status !== 'en_service' && (
            <Button variant="green" disabled={submitting} onClick={handlePrendreService} className="flex-1">
              <Play size={14} /> Prendre service
            </Button>
          )}
          {staff.status === 'en_service' && (
            <Button variant="ghost" disabled={submitting} onClick={handlePause} className="flex-1">
              <Pause size={14} /> En pause
            </Button>
          )}
          {staff.status !== 'hors_service' && (
            <Button variant="red" disabled={submitting} onClick={handleFin} className="flex-1">
              <Square size={14} /> Fin de service
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
                    {unit.code && <Badge variant="red">{codeLabel(unit.code)}</Badge>}
                    <Badge variant={STATUS_BADGE[unit.status]}>
                      {unit.status === 'en_service' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-status-pulse" />}
                      {STATUS_LABELS[unit.status]}
                    </Badge>
                    {staff.unit_id !== unit.id && (
                      <Button size="sm" variant="green" disabled={submitting} onClick={() => handleJoinUnit(unit)}>
                        Rejoindre
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[var(--ink)]/40 text-xs mb-1">
                  {unit.sector ? `Lieu : ${unit.sector} · ` : ''}
                  Début : {formatTime(unit.created_at)} · {teamLabel(members.length)}
                  {unit.vehicule ? ` · Véhicule : ${unit.vehicule}` : ''}
                </p>
                {unit.commentaire && <p className="text-[var(--ink)]/50 text-xs mb-1 italic">{unit.commentaire}</p>}
                <div className="flex flex-col gap-1">
                  {members.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[var(--ink)]/70 text-xs font-medium">{s.full_name}</span>
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
                <p className="text-[var(--ink)] text-sm font-semibold truncate">{member.full_name}</p>
                <p className="text-[var(--ink)]/40 text-xs truncate">
                  {[
                    displayRoleLabel(member.role),
                    member.unit_id ? unitsById.get(member.unit_id)?.name : null,
                    member.unit_id ? unitsById.get(member.unit_id)?.vehicule : null,
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
