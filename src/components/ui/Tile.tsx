import { motion } from 'framer-motion'
import { Star, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Tile({
  icon: Icon,
  label,
  stat,
  color,
  big,
  delay = 0,
  onClick,
  favorite = false,
  onToggleFavorite,
}: {
  icon: LucideIcon
  label: string
  stat?: string | null
  color: string
  big?: boolean
  delay?: number
  onClick: () => void
  favorite?: boolean
  onToggleFavorite?: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative rounded-3xl p-4 flex flex-col justify-between text-left text-white cursor-pointer overflow-hidden min-h-[125px] sm:min-h-[145px]',
        big && 'col-span-2 min-h-[165px] sm:min-h-[185px]',
      )}
      style={{
        background: color,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.2), 0 12px 26px -10px color-mix(in srgb, ${color} 65%, transparent)`,
      }}
    >
      {onToggleFavorite && (
        <span
          role="button"
          tabIndex={0}
          aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite()
            }
          }}
          className="absolute right-3 top-3 z-20 w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 backdrop-blur-sm flex items-center justify-center cursor-pointer"
        >
          <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
        </span>
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/15 blur-2xl pointer-events-none" />

      <div
        className={cn(
          'relative z-10 flex items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0',
          big ? 'w-14 h-14' : 'w-11 h-11',
        )}
      >
        <Icon size={big ? 28 : 22} />
      </div>

      <div className="relative z-10">
        {stat && <p className={cn('font-display font-black leading-tight', big ? 'text-5xl' : 'text-xl')}>{stat}</p>}
        <p className={cn('font-bold opacity-95 uppercase tracking-wide', big ? 'text-base mt-2' : 'text-sm mt-2')}>{label}</p>
      </div>
    </motion.button>
  )
}
