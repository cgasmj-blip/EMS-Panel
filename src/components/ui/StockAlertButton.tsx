import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type StockItem = { key: string; label: string }

const ITEM_ICONS: Record<string, string> = {
  bandage: '🩹',
  creme_brulures: '🧴',
  defibrillateur: '⚡',
  kit_de_nettoyage: '🧼',
  kit_de_reparation: '🧰',
  kit_de_suture: '🪡',
  medicaments: '💊',
  methadone: '💊',
  morceaux_de_tissus: '🧻',
  morphine_30mg: '💉',
  percocet_10mg: '💊',
  percocet_30mg: '💊',
  percocet_5mg: '💊',
  pince_a_epiler: '🩺',
  poche_de_glace: '🧊',
  produit_chimique: '🧪',
  sedatif: '💉',
  trousse_de_soin: '🧰',
  vicodin_5mg: '💊',
}

export function StockAlertButton() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<StockItem[]>([])
  const [sending, setSending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || items.length > 0) return
    supabase
      .from('stock_items')
      .select('key,label')
      .order('label')
      .then(({ data }) => setItems((data ?? []) as StockItem[]))
  }, [open, items.length])

  async function sendAlert(item: StockItem) {
    if (sending) return
    setSending(item.key)
    setMessage(null)

    const { data, error } = await supabase.functions.invoke('notify-low-stock', {
      body: { itemKey: item.key },
    })

    if (error || !data?.ok) {
      setMessage(data?.message ?? "La notification Discord n'a pas pu être envoyée.")
    } else {
      setMessage(`Signalement envoyé pour « ${item.label} ».`)
      window.setTimeout(() => {
        setOpen(false)
        setMessage(null)
      }, 1200)
    }

    setSending(null)
  }

  return (
    <>
      <Button
        type="button"
        variant="red"
        className="w-full sm:w-auto self-start"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle size={15} /> Signaler un stock bas
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[82vh] overflow-hidden rounded-2xl border border-[var(--ink)]/10 bg-[var(--bg)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/8 px-5 py-4">
              <div>
                <h2 className="text-[var(--ink)] font-bold">Signaler un stock bas</h2>
                <p className="text-[var(--ink)]/40 text-xs mt-1">Choisis le matériel concerné. Un clic envoie le signalement.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 cursor-pointer"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[65vh]">
              <div className="grid sm:grid-cols-2 gap-2">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={Boolean(sending)}
                    onClick={() => sendAlert(item)}
                    className="flex items-center gap-3 rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-3 text-left hover:bg-[var(--ink)]/[0.06] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-[var(--ink)]/5 flex items-center justify-center text-xl">
                      {ITEM_ICONS[item.key] ?? '📦'}
                    </span>
                    <span className="text-[var(--ink)] text-sm font-semibold">{item.label}</span>
                  </button>
                ))}
              </div>

              {items.length === 0 && (
                <p className="text-[var(--ink)]/35 text-sm text-center py-8">Chargement du stock…</p>
              )}

              {message && (
                <p className="mt-4 rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.03] p-3 text-[var(--ink)]/65 text-xs">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
