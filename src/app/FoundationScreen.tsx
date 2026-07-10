import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

/**
 * Milestone 0 placeholder. Proves the theming, animation, and UI primitives
 * work end to end. Replaced by the real Inbox / workspace in later milestones.
 */
export function FoundationScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Milestone 0 · Foundation
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Alp-Viram</h1>
        <p className="max-w-xl text-muted-foreground">
          The foundation is ready. Next we build identity &amp; multi-tenant
          organizations, then the unified work model with role-based
          responsibility, then the AI Inbox.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button>Primary action</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
        <h2 className="text-sm font-semibold">Everything you see is themeable</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle dark / light with the button in the top-right — your choice is
          remembered across reloads. Supabase connects in Milestone 1.
        </p>
      </div>
    </motion.div>
  )
}
