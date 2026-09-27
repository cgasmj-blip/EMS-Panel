import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { type CSSProperties, type ReactNode } from 'react'

const OFFSETS = {
  bottom: { y: 26, x: 0 },
  left: { y: 0, x: -32 },
  right: { y: 0, x: 32 },
}

export function Card({
  children,
  className,
  style,
  delay = 0,
  hoverable = false,
  from = 'bottom',
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  delay?: number
  hoverable?: boolean
  from?: 'bottom' | 'left' | 'right'
}) {
  const offset = OFFSETS[from]
  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      whileHover={hoverable ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay }}
      style={style}
      className={cn(
        'rounded-2xl border border-[var(--ink)]/8 bg-[var(--surface)] shadow-[var(--card-shadow)] transition-shadow duration-300',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}
