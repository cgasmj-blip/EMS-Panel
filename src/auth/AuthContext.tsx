import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, mapStaffRow, STAFF_SELECT_WITH_GRADES, type Staff } from '@/lib/supabase'

export type AuthDenialReason = 'not_member' | 'no_gate_role' | 'discord_error' | 'server_error' | 'missing_token'

interface AuthState {
  session: Session | null
  staff: Staff | null
  loading: boolean
  denialReason: AuthDenialReason | null
  signInWithDiscord: () => Promise<void>
  signOut: () => Promise<void>
  refreshStaff: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  staff: null,
  loading: true,
  denialReason: null,
  signInWithDiscord: async () => {},
  signOut: async () => {},
  refreshStaff: async () => {},
})

function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [denialReason, setDenialReason] = useState<AuthDenialReason | null>(null)

  const loadStaff = useCallback(async (userId: string) => {
    try {
      const { data } = await withTimeout(supabase.from('staff').select(STAFF_SELECT_WITH_GRADES).eq('id', userId).single())
      setStaff(data ? mapStaffRow(data) : null)
    } catch {
      setStaff(null)
    }
  }, [])

  // Confirms the user is in the E.M.S. Discord server and syncs their in-game
  // rank from their Discord roles. Only possible right after a fresh OAuth
  // sign-in, since that's the only time Supabase exposes the Discord token.
  const verifyDiscordMembership = useCallback(async (currentSession: Session) => {
    const providerToken = currentSession.provider_token
    if (!providerToken) return true // session restore, not a fresh login — trust the cached rank

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke<{ authorized: boolean; reason?: AuthDenialReason }>('verify-discord-member', {
          body: { providerToken },
        }),
        15000,
      )
      if (error || !data?.authorized) {
        setDenialReason(data?.reason ?? 'server_error')
        return false
      }
      setDenialReason(null)
      return true
    } catch {
      setDenialReason('server_error')
      return false
    }
  }, [])

  const refreshStaff = useCallback(async () => {
    if (session?.user.id) await loadStaff(session.user.id)
  }, [session, loadStaff])

  useEffect(() => {
    withTimeout(supabase.auth.getSession())
      .then(async ({ data }) => {
        setSession(data.session)
        if (data.session) await loadStaff(data.session.user.id)
      })
      .catch(() => {
        setSession(null)
      })
      .finally(() => setLoading(false))

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' && newSession) {
        const authorized = await verifyDiscordMembership(newSession)
        if (!authorized) {
          setSession(null)
          setStaff(null)
          await supabase.auth.signOut({ scope: 'local' })
          return
        }
      }

      setSession(newSession)
      if (newSession) {
        await loadStaff(newSession.user.id)
      } else {
        setStaff(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [loadStaff, verifyDiscordMembership])

  const signInWithDiscord = useCallback(async () => {
    setDenialReason(null)
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
        scopes: 'identify guilds.members.read',
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, staff, loading, denialReason, signInWithDiscord, signOut, refreshStaff }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
