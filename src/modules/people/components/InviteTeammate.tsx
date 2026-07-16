import { useState, type FormEvent } from 'react'
import { Copy, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateInvitation } from '@/modules/people/hooks/use-people'

/**
 * The one team action a solo user needs before they have a team.
 *
 * People & Roles is hidden while solo (PDL-022), which created a deadlock: you
 * must invite someone to stop being solo, but the only invite UI lived inside the
 * hidden surface. "Invite members" is Must-Have (Doc 4), so a solo admin gets this
 * minimal entry point — nothing else about the org/roles model is revealed.
 */
export function InviteTeammate({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createInvite = useCreateInvitation(organizationId)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setError(null)
    setLink(null)
    setCopied(false)
    try {
      const { link } = await createInvite.mutateAsync({ email: trimmed, role: 'member' })
      setLink(link)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The invite could not be created.')
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Invite a teammate
      </Button>
    )
  }

  return (
    <div className="absolute right-4 top-16 z-20 w-80 space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Invite a teammate</h3>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-2">
        <Input
          type="email"
          placeholder="their@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Teammate email"
        />
        <Button type="submit" disabled={createInvite.isPending || !email.trim()} className="w-full">
          Create invite link
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {link && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Copy this link and share it — no email is sent.</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="flex-1 text-xs" aria-label="Invite link" />
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopied(true)
              }}
            >
              <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
