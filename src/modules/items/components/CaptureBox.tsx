import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateItem } from '@/modules/items/hooks/use-items'

/** Minimal capture box (M2). The AI-classified Inbox arrives in M3. */
export function CaptureBox({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [title, setTitle] = useState('')
  const create = useCreateItem(organizationId)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    create.mutate({ title: trimmed, createdBy: userId }, { onSuccess: () => setTitle('') })
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        placeholder="Capture anything…  (e.g. Prepare July MIS before 8th)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button type="submit" disabled={create.isPending}>
        <Plus className="h-4 w-4" /> Add
      </Button>
    </form>
  )
}
