import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, staff, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <span className="w-8 h-8 border-2 border-[var(--ink)]/20 border-t-red rounded-full animate-spin" />
      </div>
    )
  }

  // The public visitor portal is the application's signed-out landing page.
  // Staff authentication is initiated from there; the old standalone /login
  // screen must never be shown after signing out of the panel.
  if (!session || !staff) return <Navigate to="/visiteur" replace />

  return <>{children}</>
}
