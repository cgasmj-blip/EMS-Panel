import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const webhookUrl = Deno.env.get('DISCORD_STOCK_WEBHOOK_URL')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ ok: false, message: 'Session invalide.' }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ ok: false, message: 'Session invalide.' }, 401)

    const { itemKey, quantityRemaining, note } = await req.json()
    if (!itemKey || typeof itemKey !== 'string') return json({ ok: false, message: 'Matériel invalide.' }, 400)
    if (!Number.isInteger(quantityRemaining) || quantityRemaining < 0) {
      return json({ ok: false, message: 'La quantité restante doit être un nombre positif ou nul.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const [{ data: staff }, { data: item }] = await Promise.all([
      admin.from('staff').select('id,full_name,active').eq('id', userData.user.id).single(),
      admin.from('stock_items').select('key,label').eq('key', itemKey).single(),
    ])

    if (!staff?.active) return json({ ok: false, message: 'Compte EMS inactif.' }, 403)
    if (!item) return json({ ok: false, message: 'Matériel introuvable.' }, 404)

    const since = new Date(Date.now() - 60_000).toISOString()
    const { data: recent } = await admin
      .from('stock_alerts')
      .select('id')
      .eq('staff_id', userData.user.id)
      .eq('item_key', itemKey)
      .gte('created_at', since)
      .limit(1)

    if ((recent ?? []).length > 0) {
      return json({ ok: false, message: 'Ce stock a déjà été signalé il y a moins d’une minute.' }, 429)
    }

    const { error: insertErr } = await admin.from('stock_alerts').insert({
      staff_id: userData.user.id,
      item_key: itemKey,
      quantity_remaining: quantityRemaining,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
    })
    if (insertErr) return json({ ok: false, message: 'Impossible d’enregistrer le signalement.' }, 500)

    if (!webhookUrl) {
      console.error('DISCORD_STOCK_WEBHOOK_URL is not configured')
      return json({ ok: false, message: 'La notification Discord doit encore être configurée par la Direction.' }, 503)
    }

    const level =
      quantityRemaining <= 0
        ? { label: 'Rupture', color: 0xff0000 }
        : quantityRemaining <= 2
          ? { label: 'Critique', color: 0xcc0000 }
          : quantityRemaining <= 5
            ? { label: 'Faible', color: 0xff9900 }
            : { label: 'Surveillance', color: 0xffcc00 }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'EMS • Stock',
        content: '@everyone',
        allowed_mentions: { parse: ['everyone'] },
        embeds: [{
          title: '🚨 Alerte stock bas',
          description: `**${item.label}** a été signalé comme stock bas.`,
          color: level.color,
          fields: [
            { name: 'Matériel', value: item.label, inline: true },
            { name: 'Quantité restante', value: String(quantityRemaining), inline: true },
            { name: 'Niveau d’alerte', value: level.label, inline: true },
            { name: 'Signalé par', value: staff.full_name || 'Agent EMS', inline: true },
            { name: 'Commentaire', value: typeof note === 'string' && note.trim() ? note.trim() : 'Aucun', inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    })

    if (!discordRes.ok) {
      console.error('Discord webhook failed', discordRes.status, await discordRes.text())
      return json({ ok: false, message: 'Discord n’a pas accepté la notification.' }, 502)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('notify-low-stock crashed', e)
    return json({ ok: false, message: 'Erreur pendant l’envoi du signalement.' }, 500)
  }
})
