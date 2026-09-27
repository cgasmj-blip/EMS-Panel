import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export function SectionHeader({
  label,
  icon: Icon,
  color,
  onBack,
}: {
  label: string
  icon: LucideIcon
  color: string
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="rounded-2xl px-5 py-4 flex items-center gap-3 text-white"
      style={{ background: color }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Retour à l'accueil"
        className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center cursor-pointer shrink-0"
      >
        <ArrowLeft size={16} />
      </button>
      <Icon size={20} className="shrink-0" />
      <h1 className="font-display font-black text-lg leading-tight">{label}</h1>
    </motion.div>
  )
}
