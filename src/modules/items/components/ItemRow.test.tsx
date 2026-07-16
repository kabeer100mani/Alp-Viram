import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemRow } from '@/modules/items/components/ItemRow'
import type { Item } from '@/modules/items/types'

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock('@/modules/items/hooks/use-items', () => {
  const stub = () => ({ mutate, isPending: false })
  return {
    useUpdateItem: stub,
    useCompleteItem: stub,
    useReopenItem: stub,
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
    priority: 'none',
    start_at: null,
    due_at: null,
    list_id: null,
    ...over,
  }) as Item

const renderRow = (over: Partial<Item> = {}, canWrite = true, showAssignee = false, assigneeName: string | null = null) =>
  render(
    <div>
      <ItemRow
        item={item(over)}
        canWrite={canWrite}
        columns={{ showAssignee }}
        assigneeName={assigneeName}
        organizationId="org-1"
        currentUserId="user-1"
        onError={() => {}}
      />
    </div>,
  )

describe('ItemRow (dense table)', () => {
  beforeEach(() => mutate.mockReset())

  // PDL-027: the raw item_state enum must never reach the user.
  it('shows Status as a human label, never the enum', () => {
    renderRow({ state: 'in_progress' })
    const status = screen.getByLabelText(/status for/i) as HTMLSelectElement
    expect(status.value).toBe('in_progress') // option VALUE is the enum…
    // …but no visible text leaks the enum.
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'In progress' })).toBeInTheDocument()
  })

  it('presents a reminder as "Reminder"', () => {
    renderRow({ is_reminder: true })
    expect(screen.getByText('Reminder')).toBeInTheDocument()
  })

  // IA §Item types: a Note has no done-state.
  it('offers no "Done" status option on a Note', () => {
    renderRow({ type: 'note', title: 'Client prefers email' })
    expect(screen.queryByRole('option', { name: 'Done' })).not.toBeInTheDocument()
  })

  it('has no Start/Due editors on a Note (no execution)', () => {
    renderRow({ type: 'note' })
    expect(screen.queryByLabelText(/start date for/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/due date for/i)).not.toBeInTheDocument()
  })

  it('offers inline Priority, Start, Due and Status editors on a writable task', () => {
    renderRow()
    expect(screen.getByLabelText(/priority for/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date for/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/due date for/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/status for/i)).toBeInTheDocument()
  })

  // The UI must never offer an edit the DB will refuse (Doc 8).
  it('offers NO editors when the user may not write — but stays readable', () => {
    renderRow({ priority: 'high' }, false)
    expect(screen.queryByLabelText(/priority for/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/status for/i)).not.toBeInTheDocument()
    expect(screen.getByText('Prepare July MIS')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument() // priority still shown, read-only
  })

  it('shows the Assignee cell only when the column is enabled (team mode)', () => {
    const { rerender } = renderRow({}, true, false)
    expect(screen.queryByText('Priya')).not.toBeInTheDocument()
    rerender(
      <div>
        <ItemRow
          item={item()}
          canWrite
          columns={{ showAssignee: true }}
          assigneeName="Priya"
          organizationId="org-1"
          currentUserId="user-1"
          onError={() => {}}
        />
      </div>,
    )
    expect(screen.getByText('Priya')).toBeInTheDocument()
  })
})
