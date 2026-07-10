import { Route, Routes } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppShell } from '@/components/layout/AppShell'
import { FoundationScreen } from '@/app/FoundationScreen'

export function App() {
  return (
    <AppProviders>
      <AppShell>
        <Routes>
          <Route path="/" element={<FoundationScreen />} />
        </Routes>
      </AppShell>
    </AppProviders>
  )
}
