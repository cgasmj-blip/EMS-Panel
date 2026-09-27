import { cn } from '@/lib/utils'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'red' | 'ghost' | 'outline' | 'green'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'red', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={disabled ? undefined : { y: -1 }}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-red text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:brightness-110': variant === 'red',
            'bg-[var(--ink)]/5 text-[var(--ink)]/80 border border-[var(--ink)]/12 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)] hover:border-[var(--ink)]/25': variant === 'ghost',
            'bg-transparent text-[var(--ink)] border border-red/50 hover:bg-red/10 hover:border-red': variant === 'outline',
            'bg-green text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:brightness-110': variant === 'green',
          },
          {
            'px-4 py-2 text-xs': size === 'sm',
            'px-6 py-3 text-sm': size === 'md',
            'px-8 py-4 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'
