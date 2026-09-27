import { useMemo } from 'react'
import { cn } from '@/lib/utils'

const BASE_Y = 30
const BEAT_WIDTH = 125
const BEATS = 8 // 4 per 500-wide half, doubled so translateX(-50%) loops seamlessly

function buildEcgPath() {
  let d = `M0,${BASE_Y} `
  for (let i = 0; i < BEATS; i++) {
    const x = i * BEAT_WIDTH
    d +=
      `L${x + 14},${BASE_Y - 3} L${x + 24},${BASE_Y} L${x + 34},${BASE_Y + 2} ` +
      `L${x + 40},${BASE_Y - 22} L${x + 46},${BASE_Y + 24} L${x + 52},${BASE_Y} ` +
      `L${x + 70},${BASE_Y - 7} L${x + 86},${BASE_Y} H${x + BEAT_WIDTH} `
  }
  return d
}

// Decorative backdrop only: a translucent red ECG trace meant to sit behind
// other content (absolutely positioned by the caller), not a boxed widget.
export function VitalsBar({ className }: { className?: string }) {
  const path = useMemo(buildEcgPath, [])

  return (
    <svg
      className={cn('w-[200%] h-full animate-ecg-scroll opacity-20 pointer-events-none', className)}
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="#e11d2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
