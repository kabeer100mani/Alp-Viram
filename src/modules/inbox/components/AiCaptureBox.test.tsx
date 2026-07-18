import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AiCaptureBox } from '@/modules/inbox/components/AiCaptureBox'
import type { Classification } from '@/lib/ai/classification'

// The AI + storage boundaries are mocked; this test verifies the UI faithfully
// DISPLAYS whatever classification comes back, and persists the confirmed
// (already-validated) proposal — the plumbing, not model behaviour.
const classifyCapture = vi.fn()
const mutateAsync = vi.fn()
const createAiCapture = vi.fn()
const { createListMutate } = vi.hoisted(() => ({ createListMutate: vi.fn() }))

vi.mock('@/lib/ai/classify', () => ({ classifyCapture: (input: string) => classifyCapture(input) }))
vi.mock('@/modules/inbox/data/ai-captures-repository', () => ({
  createAiCapture: (input: unknown) => createAiCapture(input),
}))
vi.mock('@/modules/items/hooks/use-items', () => ({
  useCreateItem: () => ({ mutateAsync, isPending: false }),
}))
// The org's real lists (with project name/context) back the tap-to-answer follow-up
// (PDL-042) and its keyword ranking (PDL-044).
vi.mock('@/modules/lists/hooks/use-lists', () => ({
  useListsForRanking: () => ({
    data: [
      { id: 'list-a', name: 'Acme', projectName: 'Acme', projectContext: null },
      { id: 'list-b', name: 'Beta', projectName: 'Beta', projectContext: null },
    ],
  }),
  useCreateListInGeneral: () => ({ mutateAsync: createListMutate, isPending: false }),
}))

// A mock classification exercising every badge the proposal card can render.
const mockProposal: Classification = {
  type: 'task',
  title: 'Review July MIS',
  body: null,
  is_reminder: true,
  due_at: '2026-07-17T09:00:00.000Z',
  remind_at: '2026-07-17T09:00:00.000Z',
  priority: 'high',
  confidence: 0.42,
  needs_clarification: false,
  clarifying_question: null,
  clarify: null,
}

function renderBox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiCaptureBox organizationId="org-1" userId="user-1" />
    </QueryClientProvider>,
  )
}

describe('AiCaptureBox — displays what the (mock) provider returns', () => {
  beforeEach(() => {
    classifyCapture.mockReset().mockResolvedValue(mockProposal)
    mutateAsync.mockReset().mockResolvedValue({ id: 'item-1' })
    createAiCapture.mockReset().mockResolvedValue(undefined)
    createListMutate.mockReset().mockResolvedValue({ id: 'list-new', name: 'Ledger' })
  })

  it('renders the classification the provider returned', async () => {
    const user = userEvent.setup()
    renderBox()

    await user.type(screen.getByPlaceholderText(/capture in plain words/i), 'remind me to review mis')
    await user.click(screen.getByRole('button', { name: /capture/i }))

    // The proposal card reflects the mock's fields — humanised, not verbatim.
    expect(await screen.findByText(/AI proposal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/item type/i)).toHaveValue('task')
    expect(screen.getByDisplayValue('Review July MIS')).toBeInTheDocument()
    expect(screen.getByText(/reminder/i)).toBeInTheDocument()
    // A date is shown to a human as "17 Jul", never as the raw ISO string it
    // arrived as. This assertion previously pinned the bug (`due 2026-07-17`).
    expect(screen.getByText(/due 17 jul/i)).toBeInTheDocument()
    expect(screen.queryByText(/2026-07-17/)).not.toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    // TD-006: confidence is no longer DISPLAYED — it was 1.0 on 28/30 captures
    // including the misclassification, so a percentage told the user something
    // untrue. It is still stored (see the persist test below), just not shown.
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument()
  })

  it('persists the confirmed proposal via the item + ai_capture write path', async () => {
    const user = userEvent.setup()
    renderBox()

    await user.type(screen.getByPlaceholderText(/capture in plain words/i), 'remind me to review mis')
    await user.click(screen.getByRole('button', { name: /capture/i }))
    await screen.findByText(/AI proposal/i)
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Review July MIS', type: 'task', isReminder: true, priority: 'high', source: 'inbox' }),
    )
    expect(createAiCapture).toHaveBeenCalledWith(
      expect.objectContaining({ resultingItemId: 'item-1', requiredClarification: false, confidence: 0.42 }),
    )
  })

  // PDL-042: when the AI flags clarify='list', the app offers the org's REAL lists
  // as taps; one tap files the item. The AI never names a list (PDL-032).
  it('shows the tap-to-answer List picker and files the item on the tapped list', async () => {
    classifyCapture.mockResolvedValue({ ...mockProposal, clarify: 'list' })
    const user = userEvent.setup()
    renderBox()

    await user.type(screen.getByPlaceholderText(/capture in plain words/i), 'prep the deck for the client')
    await user.click(screen.getByRole('button', { name: /capture/i }))
    await screen.findByText(/which list\?/i)

    // The buttons are the org's real lists + an Inbox escape.
    expect(screen.getByRole('button', { name: 'Acme' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /inbox for now/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Acme' }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    // Filed onto the tapped list.
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ listId: 'list-a' }))
  })

  // Skippable + non-blocking: confirming without tapping leaves it in the Inbox.
  it('files to the Inbox (listId null) when the List question is skipped', async () => {
    classifyCapture.mockResolvedValue({ ...mockProposal, clarify: 'list' })
    const user = userEvent.setup()
    renderBox()

    await user.type(screen.getByPlaceholderText(/capture in plain words/i), 'prep the deck')
    await user.click(screen.getByRole('button', { name: /capture/i }))
    await screen.findByText(/which list\?/i)
    await user.click(screen.getByRole('button', { name: /confirm/i })) // no list tapped

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ listId: null }))
  })

  // "+ Create new list" (ruled 2026-07-18): one field (the list name); it lands
  // under "General" and the item files into the new list.
  it('creates a new list on the spot and files the item into it', async () => {
    classifyCapture.mockResolvedValue({ ...mockProposal, clarify: 'list' })
    const user = userEvent.setup()
    renderBox()

    await user.type(screen.getByPlaceholderText(/capture in plain words/i), 'reconcile the ledger')
    await user.click(screen.getByRole('button', { name: /capture/i }))
    await screen.findByText(/which list\?/i)

    await user.click(screen.getByRole('button', { name: /create new list/i }))
    await user.type(screen.getByLabelText(/new list name/i), 'Ledger')
    await user.click(screen.getByRole('button', { name: /create & use/i }))

    expect(createListMutate).toHaveBeenCalledWith({ name: 'Ledger' })

    await user.click(screen.getByRole('button', { name: /confirm/i }))
    // The item is filed into the just-created list (returned id).
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ listId: 'list-new' }))
  })
})
