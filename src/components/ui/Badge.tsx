import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

type BadgeVariant = 'green' | 'amber' | 'gray' | 'red' | 'cyan'

const variants: Record<BadgeVariant, string> = {
  green: 'bg-green/15 text-green-300 border-green/30',
  amber: 'bg-amber/15 text-amber-300 border-amber/30',
  gray:  'bg-[var(--ink)]/8 text-[var(--ink)]/60 border-[var(--ink)]/12',
  red:   'bg-red/15 text-red-300 border-red/30',
  cyan:  'bg-cyan/15 text-cyan-300 border-cyan/30',
}

export function Badge({ children, variant = 'gray', className }: { children: ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full tracking-[2px] uppercase border', variants[variant], className)}>
      {children}
    </span>
  )
}
