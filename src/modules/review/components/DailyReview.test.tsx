import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DailyReview } from '@/modules/review/components/DailyReview'
import type { Item } from '@/modules/items/types'

const { rollover, queue, roles, projects, mutate } = vi.hoisted(() => ({
  rollover: { data: [] as unknown[], isLoading: false },
  queue: { data: [] as unknown[], isLoading: false },
  roles: { data: [] as unknown[] },
  projects: { data: [] as unknown[] },
  mutate: vi.fn(),
}))
const rolesEnabled = vi.hoisted(() => ({ value: undefined as boolean | undefined }))

vi.mock('@/modules/review/hooks/use-review', () => {
  const m = () => ({ mutate, isPending: false })
  return {
    useRollover: () => rollover,
    useTriageQueue: () => queue,
    useProjects: () => projects,
    useRoles: (_org: string, enabled: boolean) => {
      rolesEnabled.value = enabled
      return roles
    },
    useConfirmItems: m,
    useBacklogItems: m,
    useRescheduleItems: m,
    useEditChip: m,
  }
})
vi.mock('@/modules/items/hooks/use-items', () => {
  const m = () => ({ mutate, isPending: false })
  return { useCompleteItem: m, useSnoozeItem: m }
})

const item = (over: Partial<Item> = {}): Item =>
  ({ id: 'i1', title: 'Prepare July MIS', type: 'task', state: 'captured', is_reminder: false, ...over }) as Item

const renderReview = (isSolo = true) =>
  render(<DailyReview organizationId="org-1" isSolo={isSolo} onClose={() => {}} />)

describe('Daily Review', () => {
  beforeEach(() => {
    rollover.data = []
    queue.data = []
    roles.data = []
    projects.data = []
    rolesEnabled.value = undefined
    mutate.mockReset()
  })

  it('reaches "Inbox clear" when nothing is left to triage', () => {
    renderReview()
    expect(screen.getByText(/inbox clear/i)).toBeInTheDocument()
  })

  it('counts "N to triage" and states the 5–10 minute target (PDL-016)', () => {
    queue.data = [item(), item({ id: 'i2', title: 'Follow up with TCS' })]
    renderReview()
    expect(screen.getByText(/2 to triage/i)).toBeInTheDocument()
    expect(screen.getByText(/5–10 minutes/i)).toBeInTheDocument()
  })

  // FR-12b + Doc 4: there is no raw overdue state, and a shaming state is rejected.
  it('never says "overdue" — unfinished work gets neutral moves', () => {
    rollover.data = [item({ id: 'r1', title: 'Old thing', state: 'committed' })]
    renderReview()
    expect(screen.getByText(/yesterday: 1 unfinished/i)).toBeInTheDocument()
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move old thing to today/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move old thing to tomorrow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move old thing to backlog/i })).toBeInTheDocument()
  })

  // PDL-022: roles must not even be fetched for a solo user.
  it('does not fetch roles for a solo user', () => {
    queue.data = [item()]
    renderReview(true)
    expect(rolesEnabled.value).toBe(false)
  })

  it('does fetch roles once there is a team', () => {
    queue.data = [item()]
    renderReview(false)
    expect(rolesEnabled.value).toBe(true)
  })

  it('groups the queue by type and can confirm a whole group at once', () => {
    queue.data = [item(), item({ id: 'i2', title: 'Client prefers email', type: 'note' })]
    renderReview()
    expect(screen.getByText('Task · 1')).toBeInTheDocument()
    expect(screen.getByText('Note · 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm all task/i })).toBeInTheDocument()
  })

  // A Note has no done-state (IA) — the 2-minute-rule Done must not appear.
  it('offers no Done on a Note in triage', () => {
    queue.data = [item({ id: 'n1', title: 'Client prefers email', type: 'note' })]
    renderReview()
    expect(screen.queryByRole('button', { name: /^done client prefers email$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm client prefers email/i })).toBeInTheDocument()
  })

  it('shows the Project chip only when projects exist (PDL-008: optional, lazy)', () => {
    queue.data = [item()]
    renderReview()
    expect(screen.queryByLabelText(/project for/i)).not.toBeInTheDocument()

    projects.data = [{ id: 'p1', name: 'Acme' }]
    renderReview()
    expect(screen.getAllByLabelText(/project for/i).length).toBeGreaterThan(0)
  })
})
