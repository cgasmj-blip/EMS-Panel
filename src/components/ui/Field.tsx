import { type ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[1.5px] text-[var(--ink)]/40 font-semibold mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
