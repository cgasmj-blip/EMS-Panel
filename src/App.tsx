import { HashRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ThemeProvider } from '@/theme/ThemeContext'
import { VisitorPortal } from '@/pages/VisitorPortal'
import { Dashboard } from '@/pages/Dashboard'

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<VisitorPortal />} />
            <Route path="/visiteur" element={<VisitorPortal />} />
            <Route path="/login" element={<Navigate to="/visiteur" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
