import { Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppShell } from '@/components/layout/AppShell'
import { AuthScreen } from '@/modules/auth/components/AuthScreen'
import { ResetPassword } from '@/modules/auth/components/ResetPassword'
import { ProtectedRoute } from '@/modules/auth/components/ProtectedRoute'
import { AcceptInvite } from '@/modules/people/components/AcceptInvite'
import { HomeSection } from '@/app/sections/HomeSection'
import { CaptureSection } from '@/app/sections/CaptureSection'
import { ProjectsSection } from '@/app/sections/ProjectsSection'
import { PeopleSection } from '@/app/sections/PeopleSection'
import { SettingsSection } from '@/app/sections/SettingsSection'
import { StatusesSection } from '@/app/sections/StatusesSection'

export function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/login" element={<AuthScreen />} />
        {/* Public: the emailed recovery link lands here with a recovery session —
            reachable while otherwise locked out, so NOT behind ProtectedRoute. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Invite acceptance requires sign-in but sits outside the section shell —
            the accepter may not be in the target org yet. */}
        <Route
          path="/invite"
          element={
            <ProtectedRoute>
              <AcceptInvite />
            </ProtectedRoute>
          }
        />
        {/* The main app: one responsive shell (sidebar on desktop, bottom bar on
            mobile — PDL-048) over the five section routes, via <Outlet>. */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          {/* Neutral landing (PDL-050) — the Overview/Home, not a section tab. */}
          <Route path="/" element={<HomeSection />} />
          <Route path="/capture" element={<CaptureSection />} />
          <Route path="/projects" element={<ProjectsSection />} />
          <Route path="/people" element={<PeopleSection />} />
          <Route path="/settings" element={<SettingsSection />} />
          <Route path="/statuses" element={<StatusesSection />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProviders>
  )
}
