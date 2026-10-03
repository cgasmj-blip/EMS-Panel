import { useState } from 'react'
import { AlertTriangle, Flame, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function CodeRougeAlertButton() {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function sendAlert() {
    if (sending) return
    setSending(true)
    setMessage(null)

    const { data, error } = await supabase.functions.invoke('notify-code-rouge', { body: {} })

    if (error || !data?.ok) {
      setMessage(data?.message ?? "L'alerte Code Rouge n'a pas pu être envoyée.")
      setSending(false)
      return
    }

    setMessage('Code Rouge envoyé aux pompiers sur Discord.')
    setSending(false)
    window.setTimeout(() => {
      setOpen(false)
      setMessage(null)
    }, 1200)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Déclencher un Code Rouge"
        title="Code Rouge — incendie"
        className="w-10 h-10 rounded-xl bg-white text-red-600 border border-white hover:bg-white/90 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
      >
        <Flame size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-red/20 bg-[var(--bg)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--ink)]/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-red/15 text-red-300 flex items-center justify-center">
                  <Flame size={20} />
                </span>
                <div>
                  <h2 className="text-[var(--ink)] font-bold">Code Rouge</h2>
                  <p className="text-[var(--ink)]/40 text-xs mt-0.5">Alerte incendie — pompiers uniquement</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !sending && setOpen(false)}
                disabled={sending}
                aria-label="Fermer"
                className="w-9 h-9 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-xl border border-red/15 bg-red/5 p-4">
                <div className="flex gap-3">
                  <AlertTriangle size={18} className="text-red-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[var(--ink)] font-semibold text-sm">Déclencher un Code Rouge incendie ?</p>
                    <p className="text-[var(--ink)]/50 text-xs mt-1 leading-relaxed">
                      L’alerte Discord mentionnera uniquement le rôle Pompier pour demander une intervention incendie.
                    </p>
                  </div>
                </div>
              </div>

              {message && (
                <p className="mt-3 rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.03] p-3 text-[var(--ink)]/65 text-xs">
                  {message}
                </p>
              )}

              <button
                type="button"
                onClick={sendAlert}
                disabled={sending}
                className="mt-4 w-full rounded-xl bg-red px-4 py-3 text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {sending ? 'Envoi du Code Rouge…' : 'Déclencher le Code Rouge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
