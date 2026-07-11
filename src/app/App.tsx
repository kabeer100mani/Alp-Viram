import { Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppShell } from '@/components/layout/AppShell'
import { AuthScreen } from '@/modules/auth/components/AuthScreen'
import { ProtectedRoute } from '@/modules/auth/components/ProtectedRoute'
import { HomeScreen } from '@/app/HomeScreen'

export function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/login" element={<AuthScreen />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell>
                <HomeScreen />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProviders>
  )
}
