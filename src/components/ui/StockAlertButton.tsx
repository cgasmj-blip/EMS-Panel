import { useState } from 'react'
import { AlertTriangle, ArrowLeft, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type StockItem = { key: string; label: string; icon: string }

const STOCK_ALERT_ITEMS: StockItem[] = [
  { key: 'pseudoephedrine', label: 'Pseudoéphédrine', icon: '💊' },
  { key: 'antibiotique', label: 'Antibiotique', icon: '💊' },
  { key: 'pommade_antiseptique', label: 'Pommade antiseptique', icon: '🧴' },
  { key: 'defibrillateur', label: 'Défibrillateur', icon: '⚡' },
  { key: 'bequille', label: 'Béquille', icon: '🩼' },
  { key: 'chaise_roulante', label: 'Chaise roulante', icon: '♿' },
  { key: 'medicament', label: 'Médicament', icon: '💊' },
  { key: 'methadone', label: 'Méthadone', icon: '💊' },
  { key: 'bandage', label: 'Bandage', icon: '🩹' },
  { key: 'trousse_de_soin', label: 'Trousse de soin', icon: '🧰' },
  { key: 'kit_de_nettoyage', label: 'Kit de nettoyage', icon: '🧼' },
  { key: 'kit_de_reparation', label: 'Kit de réparation', icon: '🧰' },
  { key: 'menu', label: 'Menu', icon: '📋' },
  { key: 'masque_a_gaz', label: 'Masque à gaz', icon: '😷' },
  { key: 'poche_sang_a_pos', label: 'Poche de sang A+', icon: '🩸' },
  { key: 'poche_sang_a_neg', label: 'Poche de sang A-', icon: '🩸' },
  { key: 'poche_sang_b_pos', label: 'Poche de sang B+', icon: '🩸' },
  { key: 'poche_sang_b_neg', label: 'Poche de sang B-', icon: '🩸' },
  { key: 'poche_sang_ab_pos', label: 'Poche de sang AB+', icon: '🩸' },
  { key: 'poche_sang_ab_neg', label: 'Poche de sang AB-', icon: '🩸' },
  { key: 'poche_sang_o_pos', label: 'Poche de sang O+', icon: '🩸' },
  { key: 'poche_sang_o_neg', label: 'Poche de sang O-', icon: '🩸' },
  { key: 'morceaux_de_tissu', label: 'Morceaux de tissu', icon: '🧻' },
]

function alertLevel(quantity: number) {
  if (quantity <= 0) return { label: 'Rupture', badge: 'bg-red/15 text-red-300 border-red/25' }
  if (quantity <= 2) return { label: 'Critique', badge: 'bg-red/15 text-red-300 border-red/25' }
  if (quantity <= 5) return { label: 'Faible', badge: 'bg-amber/15 text-amber-300 border-amber/25' }
  return { label: 'Surveillance', badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' }
}

export function StockAlertButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function close() {
    if (sending) return
    setOpen(false)
    setSelectedItem(null)
    setQuantity('')
    setNote('')
    setMessage(null)
  }

  function chooseItem(item: StockItem) {
    setSelectedItem(item)
    setQuantity('')
    setNote('')
    setMessage(null)
  }

  async function sendAlert() {
    if (!selectedItem || sending) return
    const quantityRemaining = Number(quantity)
    if (!Number.isInteger(quantityRemaining) || quantityRemaining < 0) {
      setMessage('Indique une quantité restante valide.')
      return
    }

    setSending(true)
    setMessage(null)

    const { data, error } = await supabase.functions.invoke('notify-low-stock', {
      body: {
        itemKey: selectedItem.key,
        quantityRemaining,
        note: note.trim() || null,
      },
    })

    if (error || !data?.ok) {
      setMessage(data?.message ?? "La notification Discord n'a pas pu être envoyée.")
    } else {
      setMessage(`Alerte envoyée pour « ${selectedItem.label} ».`)
      window.setTimeout(close, 1200)
    }

    setSending(false)
  }

  const quantityNumber = Number(quantity)
  const level = quantity !== '' && Number.isInteger(quantityNumber) && quantityNumber >= 0 ? alertLevel(quantityNumber) : null

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Signaler un stock bas"
          title="Signaler un stock bas"
          className="w-10 h-10 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 hover:text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer"
        >
          <AlertTriangle size={17} />
        </button>
      ) : (
        <Button type="button" variant="red" className="w-full sm:w-auto self-start" onClick={() => setOpen(true)}>
          <AlertTriangle size={15} /> Signaler un stock bas
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-2xl border border-[var(--ink)]/10 bg-[var(--bg)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/8 px-5 py-4">
              <div className="flex items-center gap-3">
                {selectedItem && (
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    disabled={sending}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 cursor-pointer disabled:opacity-50"
                    aria-label="Retour"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div>
                  <h2 className="text-[var(--ink)] font-bold">Alerte stock bas</h2>
                  <p className="text-[var(--ink)]/40 text-xs mt-1">
                    {selectedItem ? 'Indique la quantité restante avant envoi.' : 'Choisis le matériel concerné.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={sending}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--ink)]/5 text-[var(--ink)]/60 hover:bg-[var(--ink)]/10 cursor-pointer disabled:opacity-50"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {!selectedItem ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {STOCK_ALERT_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => chooseItem(item)}
                      className="flex items-center gap-3 rounded-xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.02] px-3 py-3 text-left hover:bg-[var(--ink)]/[0.06] transition-colors cursor-pointer"
                    >
                      <span className="w-10 h-10 shrink-0 rounded-xl bg-[var(--ink)]/5 flex items-center justify-center text-xl">
                        {item.icon}
                      </span>
                      <span className="text-[var(--ink)] text-sm font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-[var(--ink)]/8 bg-[var(--ink)]/[0.025] p-4 flex items-center gap-4">
                    <span className="w-14 h-14 shrink-0 rounded-2xl bg-[var(--ink)]/5 flex items-center justify-center text-3xl">
                      {selectedItem.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[var(--ink)] font-bold">{selectedItem.label}</p>
                      <p className="text-[var(--ink)]/35 text-xs mt-1">Matériel sélectionné</p>
                    </div>
                    {level && (
                      <span className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-bold ${level.badge}`}>
                        {level.label}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[var(--ink)]/55 text-xs font-semibold block mb-1.5">Quantité restante</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      placeholder="Ex : 2"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[var(--ink)]/55 text-xs font-semibold block mb-1.5">Commentaire (optionnel)</label>
                    <Textarea
                      rows={3}
                      placeholder="Ex : Il n'en reste presque plus au stock principal"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  {message && (
                    <p className="rounded-lg border border-[var(--ink)]/8 bg-[var(--ink)]/[0.03] p-3 text-[var(--ink)]/65 text-xs">
                      {message}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="red"
                    className="w-full"
                    disabled={sending || quantity === '' || !Number.isInteger(quantityNumber) || quantityNumber < 0}
                    onClick={sendAlert}
                  >
                    <AlertTriangle size={15} /> {sending ? 'Envoi…' : 'Envoyer l’alerte'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
