import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemCard } from '@/modules/items/components/ItemCard'
import type { Item } from '@/modules/items/types'

// vi.mock is hoisted above the file, so the factory cannot close over ordinary
// top-level consts — vi.hoisted lifts the spy with it.
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock('@/modules/items/hooks/use-items', () => {
  const stub = () => ({ mutate, isPending: false })
  return {
    useCompleteItem: stub,
    useReopenItem: stub,
    useSnoozeItem: stub,
    useSetItemState: stub,
  }
})

const item = (over: Partial<Item> = {}): Item =>
  ({
    id: 'i1',
    title: 'Prepare July MIS',
    type: 'task',
    state: 'captured',
    is_reminder: false,
    ...over,
  }) as Item

describe('ItemCard', () => {
  beforeEach(() => mutate.mockReset())

  // PDL-027: storage internals must never reach the user.
  it('never shows the raw item_state enum', () => {
    render(<ItemCard item={item({ state: 'captured' })} canWrite />)
    expect(screen.getByText('Inbox')).toBeInTheDocument()
    expect(screen.queryByText('captured')).not.toBeInTheDocument()
  })

  it('renders in_progress in human language', () => {
    render(<ItemCard item={item({ state: 'in_progress' })} canWrite />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument()
  })

  // PDL-027: a Reminder is stored as Task metadata but must present as a Reminder.
  it('presents a reminder as "Reminder", never leaking that it is a Task', () => {
    render(<ItemCard item={item({ is_reminder: true })} canWrite />)
    expect(screen.getByText('Reminder')).toBeInTheDocument()
    expect(screen.queryByText('Task')).not.toBeInTheDocument()
  })

  // IA §Item types: a Note has no done-state and no owner-to-execute.
  it('offers no Done or Start on a Note', () => {
    render(<ItemCard item={item({ type: 'note', title: 'Client prefers email' })} canWrite />)
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
    // A note can still be snoozed out of the way.
    expect(screen.getByRole('button', { name: /snooze/i })).toBeInTheDocument()
  })

  it('offers Done, Snooze and Start on a writable task', () => {
    render(<ItemCard item={item()} canWrite />)
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /snooze/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  // The UI must never offer an action the database will refuse (Doc 8).
  it('offers NO actions when the user may not write', () => {
    render(<ItemCard item={item()} canWrite={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Prepare July MIS')).toBeInTheDocument() // still readable
  })

  it('offers Reopen instead of Done once complete — Done is recoverable', () => {
    render(<ItemCard item={item({ state: 'done' })} canWrite />)
    expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument()
  })

  it('does not offer Start on an item already in progress', () => {
    render(<ItemCard item={item({ state: 'in_progress' })} canWrite />)
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
  })
})
