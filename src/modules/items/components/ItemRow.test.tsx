import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const renderRow = (
  over: Partial<Item> = {},
  canWrite = true,
  showAssignee = false,
  assignee: { userId: string; name: string | null } | null = null,
  onOpen = () => {},
) =>
  render(
    <div>
      <ItemRow
        item={item(over)}
        canWrite={canWrite}
        columns={{ showAssignee }}
        assignee={assignee}
        onOpen={onOpen}
        onError={() => {}}
      />
    </div>,
  )

describe('ItemRow (dense table)', () => {
  beforeEach(() => mutate.mockReset())

  // PDL-027: the raw item_state enum must never reach the user. The Select trigger
  // shows the human label; the enum string never appears as visible text.
  it('shows Status as a human label, never the enum', () => {
    renderRow({ state: 'in_progress' })
    expect(screen.getByLabelText(/status for/i)).toHaveTextContent('In progress')
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument()
  })

  // PDL-037: the `captured` state reads "To Do". It used to read "Inbox", which
  // collided with the Inbox *view* in the rail — one word meaning both a status and
  // a place. The rail's Inbox view keeps its name; only the state label changed.
  it('labels the captured state "To Do", not "Inbox" (which is a view)', () => {
    renderRow({ state: 'captured' })
    const status = screen.getByLabelText(/status for/i)
    expect(status).toHaveTextContent('To Do')
    expect(status).not.toHaveTextContent('Inbox')
  })

  it('presents a reminder as "Reminder"', () => {
    renderRow({ is_reminder: true })
    expect(screen.getByText('Reminder')).toBeInTheDocument()
  })

  // IA §Item types: a Note has no done-state. Open the status Select and confirm
  // the menu opened (To Do present) but never offers Done for a Note.
  it('offers no "Done" status option on a Note', async () => {
    renderRow({ type: 'note', title: 'Client prefers email' })
    await userEvent.click(screen.getByLabelText(/status for/i))
    expect(await screen.findByRole('menuitem', { name: 'To Do' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Done' })).not.toBeInTheDocument()
  })

  it('has no Due editor on a Note (no execution)', () => {
    renderRow({ type: 'note' })
    expect(screen.queryByLabelText(/due date for/i)).not.toBeInTheDocument()
  })

  it('offers inline Priority, Due and Status editors on a writable task', () => {
    renderRow()
    expect(screen.getByLabelText(/priority for/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/due date for/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/status for/i)).toBeInTheDocument()
  })

  // An always-rendered <input type="date"> prints the browser's own "dd-mm-yyyy"
  // placeholder as literal text in the cell. The cell must show a date, not a form
  // control: no date input exists until the cell is actually clicked.
  it('shows no date input (and so no "dd-mm-yyyy" text) until the Due cell is clicked', async () => {
    const { container } = renderRow()
    expect(container.querySelector('input[type="date"]')).toBeNull()

    await userEvent.click(screen.getByLabelText(/due date for/i))
    expect(container.querySelector('input[type="date"]')).not.toBeNull()
  })

  it('renders a set due date human-formatted, never as a raw ISO string', () => {
    renderRow({ due_at: '2026-08-20T12:00:00Z' })
    expect(screen.getByLabelText(/due date for/i)).toHaveTextContent('20 Aug')
    expect(screen.queryByText(/2026-08-20/)).not.toBeInTheDocument()
  })

  // "—" rendered as a stray dash wedged between the flag and the dropdown arrow,
  // which read as a broken control rather than a priority.
  it('labels the "none" priority as a word, not a bare dash', async () => {
    renderRow({ priority: 'none' })
    // The trigger shows "None"; opening the styled dropdown reveals the menu item.
    expect(screen.getByLabelText(/priority for/i)).toHaveTextContent('None')
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/priority for/i))
    expect(await screen.findByRole('menuitem', { name: /None/ })).toBeInTheDocument()
  })

  // PDL-036: the row carries only the four common fields; Start moved to the panel.
  it('has no Start column in the row', () => {
    renderRow()
    expect(screen.queryByLabelText(/start date for/i)).not.toBeInTheDocument()
  })

  // The UI must never offer an edit the DB will refuse (Doc 8).
  it('offers NO editors when the user may not write — but stays readable', () => {
    renderRow({ priority: 'high' }, false)
    expect(screen.queryByLabelText(/priority for/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/status for/i)).not.toBeInTheDocument()
    expect(screen.getByText('Prepare July MIS')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument() // priority still shown, read-only
  })

  // PDL-036: the row no longer expands — clicking the name opens the detail panel.
  it('opens the detail panel when the name is clicked', async () => {
    const onOpen = vi.fn()
    renderRow({}, true, false, null, onOpen)
    await userEvent.click(screen.getByRole('button', { name: 'Prepare July MIS' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('shows the Assignee as an avatar only when the column is enabled (team mode)', () => {
    const { rerender } = renderRow({}, true, false)
    expect(screen.queryByTitle('Priya')).not.toBeInTheDocument()
    rerender(
      <div>
        <ItemRow
          item={item()}
          canWrite
          columns={{ showAssignee: true }}
          assignee={{ userId: 'u1', name: 'Priya' }}
          onOpen={() => {}}
          onError={() => {}}
        />
      </div>,
    )
    // Avatar only — initials, not the full name taking up a column.
    expect(screen.getByTitle('Priya')).toBeInTheDocument()
    expect(screen.queryByText('Priya')).not.toBeInTheDocument()
  })
})
