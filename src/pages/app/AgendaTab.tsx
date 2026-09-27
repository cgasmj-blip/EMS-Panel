import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { supabase, isDirection, staffMatchesEligibility, type Appointment, type AppointmentTypeRow, type Staff } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR') + ' ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function AgendaTab() {
  const { staff } = useAuth()
  const [types, setTypes] = useState<AppointmentTypeRow[]>([])
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: a }, { data: s }, { data: t }] = await Promise.all([
      supabase.from('appointments').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('staff').select('*'),
      supabase.from('appointment_types').select('*').order('position'),
    ])
    if (a) setAppointments(a)
    if (s) setStaffList(s)
    if (t) {
      setTypes(t)
      const eligible = staff ? t.filter((ty) => staffMatchesEligibility(staff, ty)) : t
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

  async function handleSubmit() {
    if (!staff || submitting || !type) return
    if (!scheduledAt) {
      setError('Indique une date et une heure.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('appointments').insert({
      staff_id: staff.id,
      type,
      title: title.trim() || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setTitle('')
    setScheduledAt('')
    await fetchAll()
  }

  async function handleDelete(id: number) {
    await supabase.from('appointments').delete().eq('id', id)
    await fetchAll()
  }

  const staffById = new Map(staffList.map((s) => [s.id, s]))
  const typeLabel = (id: string) => types.find((t) => t.id === id)?.label ?? id
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at).getTime() >= Date.now() - 3600_000)
  const eligibleTypes = staff ? types.filter((t) => staffMatchesEligibility(staff, t)) : types

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Nouveau rendez-vous</h2>
        {error && <p className="text-red-300 text-xs mb-3 animate-pop-in">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {eligibleTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date et heure">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
        </div>
        <div className="mb-4">
          <Field label="Titre (optionnel)">
            <Input placeholder="ex: RDV avec M. Dupont" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
        <Button variant="red" className="w-full" disabled={submitting || !type} onClick={handleSubmit}>
          Ajouter au calendrier
        </Button>
      </Card>

      <Card className="p-5" delay={0.1}>
        <h2 className="text-[var(--ink)]/60 text-xs uppercase tracking-[2px] font-bold mb-4">Rendez-vous à venir</h2>
        <AnimatedList className="flex flex-col gap-2">
          {upcoming.map((a) => {
            const canDelete = a.staff_id === staff?.id || isDirection(staff?.role)
            return (
              <AnimatedListItem
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3.5 py-2.5"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="cyan">{typeLabel(a.type)}</Badge>
                    <p className="text-[var(--ink)] text-sm font-semibold">{formatDateTime(a.scheduled_at)}</p>
                  </div>
                  <p className="text-[var(--ink)]/40 text-xs">
                    {staffById.get(a.staff_id)?.full_name ?? 'Agent'} {a.title ? `· ${a.title}` : ''}
                  </p>
                </div>
                {canDelete && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                    <Trash2 size={13} />
                  </Button>
                )}
              </AnimatedListItem>
            )
          })}
          {upcoming.length === 0 && <p className="text-[var(--ink)]/30 text-sm text-center py-4">Aucun rendez-vous à venir.</p>}
        </AnimatedList>
      </Card>
    </div>
  )
}
