import type { ListForRanking } from '@/modules/lists/data/lists-repository'

/**
 * Keyword-first ranking of the user's real lists against a capture (PDL-044).
 *
 * No AI: score each list by how many meaningful words from the capture appear in
 * its name (weight 3), its project's name (2), or the project's free-text context
 * (1). This handles the explicit-mention majority ("prep the Acme deck" → the Acme
 * list floats up) for free, deterministically, with nothing sent to a provider.
 *
 * This is a *suggestion* only — the app still shows the real lists and the user taps
 * to confirm (D1); the AI never guesses a list (PDL-032). A zero score just means
 * "no keyword signal", not "wrong" — those lists keep their name order below the
 * matches, and the user can still pick any of them.
 */
export interface RankedList extends ListForRanking {
  score: number
}

// Short/very-common words carry no filing signal and would create false matches.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'about', 'into', 'your', 'our',
  'get', 'got', 'make', 'need', 'want', 'please', 'today', 'tomorrow', 'week', 'day',
  'task', 'note', 'reminder', 'remind', 'prep', 'prepare', 'send', 'call', 'email', 'meeting',
])

function tokens(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) seen.add(raw)
  }
  return [...seen]
}

function scoreList(capture: string, list: ListForRanking): number {
  const words = tokens(capture)
  if (words.length === 0) return 0
  const name = list.name.toLowerCase()
  const proj = (list.projectName ?? '').toLowerCase()
  const ctx = (list.projectContext ?? '').toLowerCase()
  let score = 0
  for (const w of words) {
    if (name.includes(w)) score += 3
    else if (proj.includes(w)) score += 2
    else if (ctx.includes(w)) score += 1
  }
  return score
}

/**
 * Lists ordered best-match first (stable: equal scores keep the incoming name
 * order). Every list is returned — ranking never hides an option (D1).
 */
export function rankLists(capture: string, lists: ListForRanking[]): RankedList[] {
  return lists
    .map((list) => ({ ...list, score: scoreList(capture, list) }))
    .sort((a, b) => b.score - a.score) // stable in modern V8 for equal keys
}
