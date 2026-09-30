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
    const webhookUrl = Deno.env.get('DISCORD_CODE_BLANC_WEBHOOK_URL')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ ok: false, message: 'Session invalide.' }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ ok: false, message: 'Session invalide.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: staff } = await admin
      .from('staff')
      .select('id,full_name,active')
      .eq('id', userData.user.id)
      .single()

    if (!staff?.active) return json({ ok: false, message: 'Compte EMS inactif.' }, 403)

    if (!webhookUrl) {
      return json({ ok: false, message: 'Le webhook Discord Code Blanc doit encore être configuré.' }, 503)
    }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'EMS • Code Blanc',
        content: '@everyone',
        allowed_mentions: { parse: ['everyone'] },
        embeds: [{
          title: '🚨 CODE BLANC — BESOIN DE RENFORT',
          description: 'Besoin de renfort. Veuillez prendre votre service afin d’aider les équipes actuellement mobilisées.',
          color: 0xff0000,
          fields: [
            { name: 'Déclenché par', value: staff.full_name || 'Agent EMS', inline: true },
            { name: 'Action demandée', value: 'Prendre son service et venir en renfort', inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    })

    if (!discordRes.ok) {
      return json({ ok: false, message: 'Discord n’a pas accepté l’alerte Code Blanc.' }, 502)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('notify-code-blanc crashed', e)
    return json({ ok: false, message: 'Erreur pendant l’envoi du Code Blanc.' }, 500)
  }
})
