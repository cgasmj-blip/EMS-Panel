import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { VitalsBar } from '@/components/ui/VitalsBar'
import { DISCORD_INVITE_URL } from '@/lib/supabase'
import logo from '@/assets/logo.webp'

const DENIAL_MESSAGES: Record<string, string> = {
  not_member: "Tu dois être membre du serveur Discord E.M.S. | LJ Life pour accéder au dashboard.",
  no_gate_role: "Tu es sur le serveur, mais tu n'as pas encore le rôle E.M.S. Contacte ta hiérarchie.",
  discord_error: "Discord n'a pas répondu correctement. Réessaie dans un instant.",
  server_error: "Une erreur est survenue pendant la vérification. Réessaie.",
  missing_token: "La connexion Discord n'a pas transmis les informations nécessaires. Réessaie.",
}

export function Login() {
  const { session, loading, denialReason, signInWithDiscord } = useAuth()
  const [connecting, setConnecting] = useState(false)

  if (!loading && session) return <Navigate to="/dashboard" replace />

  async function handleDiscordLogin() {
    setConnecting(true)
    await signInWithDiscord()
    setConnecting(false)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 bg-[var(--bg)]">
      <div className="absolute inset-x-0 top-1/3 h-32 overflow-hidden -z-0">
        <VitalsBar />
      </div>

      <ThemeToggle className="absolute top-5 right-5 z-20" />

      <div className="relative z-10 flex flex-col items-center mb-8 animate-fade-up">
        <img src={logo} alt="EMS" className="w-20 h-20 rounded-full object-cover mb-4" />
        <h1 className="font-display font-black text-2xl text-neon-red">EMS Dashboard</h1>
        <p className="text-[var(--ink)]/40 text-sm mt-1">Connexion réservée au personnel médical</p>
      </div>

      <Card className="relative z-10 w-full max-w-sm p-7 flex flex-col items-center gap-5" delay={0.15}>
        <p className="text-[var(--ink)]/50 text-xs text-center leading-relaxed">
          Connecte-toi avec ton compte Discord pour accéder à l'effectif de service.
        </p>

        <Button
          type="button"
          size="md"
          variant="red"
          disabled={connecting}
          onClick={handleDiscordLogin}
          className="relative w-full overflow-hidden"
        >
          <DiscordIcon /> {connecting ? 'Redirection...' : 'Se connecter avec Discord'}
        </Button>

        {denialReason && (
          <div className="w-full rounded-lg bg-red/10 border border-red/25 p-3 flex flex-col gap-2 animate-pop-in">
            <p className="text-red-300 text-xs text-center leading-relaxed">
              {DENIAL_MESSAGES[denialReason] ?? DENIAL_MESSAGES.server_error}
            </p>
            {denialReason === 'not_member' && (
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-cyan text-xs text-center underline underline-offset-2"
              >
                Rejoindre le serveur E.M.S. | LJ Life
              </a>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}
