import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ROLE_LABELS, shortLabel, type StaffRole, type SousGrade, type Affiliation } from '@/lib/supabase'
import { Select } from '@/components/ui/Select'
import { Field } from '@/components/ui/Field'
import { cn } from '@/lib/utils'

const ROLE_KEYS = Object.keys(ROLE_LABELS) as StaffRole[]

export interface Eligibility {
  grade: StaffRole[]
  sous_grade_id: string
  affiliation_id: string
}

export function EligibilitySelector({
  value,
  onChange,
  sousGrades,
  affiliations,
}: {
  value: Eligibility
  onChange: (next: Eligibility) => void
  sousGrades: SousGrade[]
  affiliations: Affiliation[]
}) {
  const [open, setOpen] = useState(false)
  const availableAffiliations = affiliations.filter((a) => !a.sous_grade_id || a.sous_grade_id === value.sous_grade_id)

  const summaryParts = [
    value.grade.length > 0 ? `${value.grade.length} grade${value.grade.length > 1 ? 's' : ''}` : null,
    value.sous_grade_id ? '1 habilitation' : null,
    value.affiliation_id ? '1 affiliation' : null,
  ].filter(Boolean)

  function toggleGrade(r: StaffRole) {
    const next = value.grade.includes(r) ? value.grade.filter((g) => g !== r) : [...value.grade, r]
    onChange({ ...value, grade: next })
  }

  return (
    <div className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.015]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer"
      >
        <div>
          <p className="text-[var(--ink)]/55 text-xs font-semibold">Accès / grades</p>
          <p className="text-[var(--ink)]/30 text-[11px]">
            {summaryParts.length > 0 ? summaryParts.join(' · ') : 'Tous les grades'}
          </p>
        </div>
        {open ? <ChevronDown size={15} className="text-[var(--ink)]/45" /> : <ChevronRight size={15} className="text-[var(--ink)]/45" />}
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3 border-t border-[var(--ink)]/8 pt-3">
          <Field label="Grades (optionnel, plusieurs possibles)">
            <div className="flex flex-wrap gap-1.5">
              {ROLE_KEYS.map((r) => {
                const active = value.grade.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleGrade(r)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                      active
                        ? 'border-amber/40 bg-amber/15 text-amber-300'
                        : 'border-[var(--ink)]/10 bg-[var(--ink)]/[0.03] text-[var(--ink)]/50 hover:text-[var(--ink)]',
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Habilitation (optionnelle)">
              <Select
                value={value.sous_grade_id}
                onChange={(e) => onChange({ ...value, sous_grade_id: e.target.value, affiliation_id: '' })}
              >
                <option value="">— tous —</option>
                {sousGrades.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {shortLabel(sg.label)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Affiliation (optionnel)">
              <Select value={value.affiliation_id} onChange={(e) => onChange({ ...value, affiliation_id: e.target.value })}>
                <option value="">— toutes —</option>
                {availableAffiliations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {shortLabel(a.label)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}
