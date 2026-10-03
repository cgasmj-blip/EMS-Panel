import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Check, ChevronLeft, ChevronRight, Clock3, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import {
  supabase,
  staffMatchesEligibility,
  type Appointment,
  type AppointmentStatus,
  type AppointmentTypeRow,
} from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function dateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function appointmentDateKey(iso: string) {
  return dateKey(new Date(iso))
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function defaultTimeForDay(day: Date) {
  const d = new Date(day)
  d.setHours(9, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function statusLabel(status: AppointmentStatus) {
  if (status === 'effectue') return 'Effectué'
  if (status === 'annule') return 'Annulé'
  return 'Prévu'
}

function statusClass(status: AppointmentStatus) {
  if (status === 'effectue') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  if (status === 'annule') return 'bg-red/10 text-red-300 border-red/20 line-through opacity-65'
  return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
}

export function AgendaTab() {
  const { staff } = useAuth()
  const [types, setTypes] = useState<AppointmentTypeRow[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => defaultTimeForDay(new Date()))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [remindDayBefore, setRemindDayBefore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!staff) return

    const [{ data: a }, { data: t }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .eq('staff_id', staff.id)
        .order('scheduled_at', { ascending: true }),
      supabase.from('appointment_types').select('*').order('position'),
    ])

    if (a) setAppointments(a as Appointment[])
    if (t) {
      setTypes(t)
      const eligible = t.filter((ty) => staffMatchesEligibility(staff, ty))
      setType((current) => current || eligible[0]?.id || '')
    }
  }, [staff])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('agenda-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const eligibleTypes = staff ? types.filter((t) => staffMatchesEligibility(staff, t)) : types
  const typeLabel = (id: string) => types.find((t) => t.id === id)?.label ?? id
  const selectedKey = dateKey(selectedDay)

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const appointment of appointments) {
      const key = appointmentDateKey(appointment.scheduled_at)
      const list = map.get(key) ?? []
      list.push(appointment)
      map.set(key, list)
    }
    return map
  }, [appointments])

  const calendarDays = useMemo(() => {
    const first = startOfMonth(month)
    const mondayIndex = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - mondayIndex)

    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      return day
    })
  }, [month])

  const selectedAppointments = appointmentsByDay.get(selectedKey) ?? []

  function selectDay(day: Date) {
    const copy = new Date(day)
    setSelectedDay(copy)
    setMonth(startOfMonth(copy))
    setEditingId(null)
    setScheduledAt(defaultTimeForDay(copy))
    setTitle('')
    setError(null)
  }

  function openNewAppointment(day = selectedDay) {
    selectDay(day)
    setRemindDayBefore(false)
    setShowForm(true)
  }

  function startMove(appointment: Appointment) {
    setSelectedDay(new Date(appointment.scheduled_at))
    setMonth(startOfMonth(new Date(appointment.scheduled_at)))
    setEditingId(appointment.id)
    setType(appointment.type)
    setTitle(appointment.title ?? '')
    setScheduledAt(toLocalInput(appointment.scheduled_at))
    setRemindDayBefore(appointment.remind_day_before)
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setTitle('')
    setScheduledAt(defaultTimeForDay(selectedDay))
    setRemindDayBefore(false)
    setError(null)
  }

  async function handleSubmit() {
    if (!staff || submitting || !type) return
    if (!scheduledAt) {
      setError('Indique une date et une heure.')
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      type,
      title: title.trim() || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: 'prevu' as AppointmentStatus,
      remind_day_before: remindDayBefore,
      reminder_day_before_sent_at: null,
      reminder_30m_sent_at: null,
    }

    const { error: err } = editingId
      ? await supabase.from('appointments').update(payload).eq('id', editingId).eq('staff_id', staff.id)
      : await supabase.from('appointments').insert({ ...payload, staff_id: staff.id })

    setSubmitting(false)

    if (err) {
      setError(err.message)
      return
    }

    const movedDate = new Date(scheduledAt)
    setSelectedDay(movedDate)
    setMonth(startOfMonth(movedDate))
    closeForm()
    await fetchAll()
  }

  async function setStatus(id: number, status: AppointmentStatus) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    await fetchAll()
  }

  async function handleDelete(id: number) {
    await supabase.from('appointments').delete().eq('id', id)
    await fetchAll()
  }

  function goMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function goToday() {
    const today = new Date()
    setMonth(startOfMonth(today))
    selectDay(today)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[var(--ink)] font-bold text-base">
              {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-[var(--ink)]/35 text-xs mt-0.5">Clique sur un jour pour ouvrir sa journée.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => goMonth(-1)} title="Mois précédent">
              <ChevronLeft size={15} />
            </Button>
            <Button size="sm" variant="ghost" onClick={goToday}>Aujourd’hui</Button>
            <Button size="sm" variant="ghost" onClick={() => goMonth(1)} title="Mois suivant">
              <ChevronRight size={15} />
            </Button>
            <Button size="sm" variant="red" onClick={() => openNewAppointment()}>
              <Plus size={14} /> RDV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border border-[var(--ink)]/8 rounded-xl overflow-hidden">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2 text-center text-[10px] sm:text-xs font-bold text-[var(--ink)]/35 bg-[var(--ink)]/[0.025] border-b border-[var(--ink)]/8">
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const key = dateKey(day)
            const dayAppointments = appointmentsByDay.get(key) ?? []
            const inCurrentMonth = day.getMonth() === month.getMonth()
            const selected = key === selectedKey
            const today = key === dateKey(new Date())

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(day)}
                onDoubleClick={() => openNewAppointment(day)}
                className={cn(
                  'min-h-[84px] sm:min-h-[112px] p-1.5 sm:p-2 text-left border-r border-b border-[var(--ink)]/8 transition-colors cursor-pointer overflow-hidden',
                  !inCurrentMonth && 'opacity-35',
                  selected ? 'bg-red/8 ring-1 ring-inset ring-red/25' : 'hover:bg-[var(--ink)]/[0.035]',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-semibold',
                    today ? 'bg-red text-white' : 'text-[var(--ink)]/65',
                  )}>
                    {day.getDate()}
                  </span>
                  {dayAppointments.length > 0 && (
                    <span className="text-[9px] text-[var(--ink)]/30">{dayAppointments.length}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {dayAppointments.slice(0, 3).map((appointment) => (
                    <span
                      key={appointment.id}
                      className={cn(
                        'block rounded-md border px-1.5 py-1 text-[9px] sm:text-[10px] truncate',
                        statusClass(appointment.status),
                      )}
                    >
                      {new Date(appointment.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {appointment.title || typeLabel(appointment.type)}
                    </span>
                  ))}
                  {dayAppointments.length > 3 && (
                    <span className="text-[9px] text-[var(--ink)]/35 px-1">+{dayAppointments.length - 3} autres</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[var(--ink)]/35 text-[10px] uppercase tracking-[1.5px] font-bold">Journée</p>
            <h3 className="text-[var(--ink)] font-bold">
              {selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
          </div>
          <Button size="sm" variant="red" onClick={() => openNewAppointment(selectedDay)}>
            <Plus size={14} /> Ajouter
          </Button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-red/15 bg-red/[0.035] p-4 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[var(--ink)] font-bold text-sm">
                {editingId ? 'Déplacer le rendez-vous' : 'Nouveau rendez-vous'}
              </p>
              <Button size="sm" variant="ghost" onClick={closeForm}>Fermer</Button>
            </div>

            {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  {eligibleTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Date et heure">
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Titre (optionnel)">
                  <Input
                    placeholder="ex : RDV avec M. Dupont"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
              </div>

              <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-[var(--ink)]/10 bg-[var(--ink)]/[0.025] px-3 py-2.5 cursor-pointer">
                <div>
                  <p className="text-[var(--ink)] text-sm font-semibold">Ajouter un rappel la veille ?</p>
                  <p className="text-[var(--ink)]/35 text-xs">Le rappel 30 minutes avant reste automatique.</p>
                </div>
                <input
                  type="checkbox"
                  checked={remindDayBefore}
                  onChange={(e) => setRemindDayBefore(e.target.checked)}
                  className="h-4 w-4 accent-red"
                />
              </label>
            </div>

            <Button variant="red" className="w-full mt-3" disabled={submitting || !type} onClick={handleSubmit}>
              {editingId ? 'Enregistrer le déplacement' : 'Ajouter au calendrier'}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {selectedAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] p-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', statusClass(appointment.status))}>
                    {statusLabel(appointment.status)}
                  </span>
                  <span className="text-[var(--ink)] font-bold text-sm">
                    {new Date(appointment.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[var(--ink)]/45 text-xs">{typeLabel(appointment.type)}</span>
                </div>
                {appointment.title && <p className="text-[var(--ink)]/65 text-sm mt-1">{appointment.title}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {appointment.status !== 'effectue' && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(appointment.id, 'effectue')} title="Marquer effectué">
                    <Check size={13} />
                  </Button>
                )}
                {appointment.status !== 'annule' && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(appointment.id, 'annule')} title="Annuler">
                    <Ban size={13} />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startMove(appointment)} title="Déplacer">
                  <Clock3 size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(appointment.id)} title="Supprimer">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}

          {selectedAppointments.length === 0 && (
            <button
              type="button"
              onClick={() => openNewAppointment(selectedDay)}
              className="rounded-xl border border-dashed border-[var(--ink)]/12 py-8 text-center text-[var(--ink)]/35 text-sm hover:bg-[var(--ink)]/[0.025] cursor-pointer"
            >
              Aucun rendez-vous. Clique ici pour en ajouter un.
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
