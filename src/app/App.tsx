import { Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppShell } from '@/components/layout/AppShell'
import { AuthScreen } from '@/modules/auth/components/AuthScreen'
import { ResetPassword } from '@/modules/auth/components/ResetPassword'
import { ProtectedRoute } from '@/modules/auth/components/ProtectedRoute'
import { HomeScreen } from '@/app/HomeScreen'
import { AcceptInvite } from '@/modules/people/components/AcceptInvite'

export function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/login" element={<AuthScreen />} />
        {/* Public: the emailed recovery link lands here with a recovery session —
            reachable while otherwise locked out, so NOT behind ProtectedRoute. */}
        <Route path="/reset-password" element={<ResetPassword />} />
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
        {/* Invite acceptance requires sign-in; ProtectedRoute preserves the
            token through the auth redirect so a new user can sign up then land here. */}
        <Route
          path="/invite"
          element={
            <ProtectedRoute>
              <AppShell>
                <AcceptInvite />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProviders>
  )
}
