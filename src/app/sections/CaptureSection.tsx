import { Mic, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSection } from '@/app/section-context'

/**
 * Capture (PDL-051) — a dedicated capture surface: drop a message or voice note and
 * see a history of past captures and the tasks they became. Gate A ships the shell;
 * the input, history feed and the clarifying pop-up land in Gate B, voice in Gate C.
 * For now, use the "+" quick capture (which already works from anywhere).
 */
export function CaptureSection() {
  const { openCapture } = useSection()
  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Capture</h1>
        <p className="text-sm text-muted-foreground">
          Drop a message or record a voice note — SutraDhar turns it into a task and keeps a history
          here. The input, history feed and voice notes are landing next.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button onClick={openCapture}>
          <Plus className="h-4 w-4" /> Quick capture
        </Button>
        <Button variant="outline" disabled>
          <Mic className="h-4 w-4" /> Record (soon)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Meanwhile, the “+” captures from any tab.</p>
    </div>
  )
}
