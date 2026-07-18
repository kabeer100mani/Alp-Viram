import { describe, it, expect } from 'vitest'
import { rankLists } from '@/modules/inbox/rank-lists'
import type { ListForRanking } from '@/modules/lists/data/lists-repository'

const lists: ListForRanking[] = [
  { id: 'acme', name: 'Acme deck', projectName: 'Acme', projectContext: 'Slides and reports for the Acme client account.' },
  { id: 'ops', name: 'Operations', projectName: 'Internal', projectContext: 'Office and admin tasks.' },
  { id: 'fin', name: 'Finance', projectName: 'Internal', projectContext: 'GST, reconciliation, ledgers.' },
]

describe('rankLists (keyword-first, no AI — PDL-044)', () => {
  it('floats the list whose name matches the capture to the top', () => {
    const ranked = rankLists('prepare the Acme slide deck', lists)
    expect(ranked[0].id).toBe('acme')
    expect(ranked[0].score).toBeGreaterThan(0)
  })

  it('matches on the project context, not just names ("reconcile" → Finance)', () => {
    const ranked = rankLists('reconcile the vendor ledger', lists)
    expect(ranked[0].id).toBe('fin')
  })

  it('returns EVERY list — ranking never hides an option (D1)', () => {
    const ranked = rankLists('acme', lists)
    expect(ranked).toHaveLength(3)
  })

  it('a no-signal capture leaves all scores 0 and keeps the input order', () => {
    const ranked = rankLists('follow up later', lists)
    expect(ranked.every((r) => r.score === 0)).toBe(true)
    expect(ranked.map((r) => r.id)).toEqual(['acme', 'ops', 'fin'])
  })

  it('ignores stopwords/common verbs so they do not create false matches', () => {
    // "prepare"/"the"/"deck"... "deck" matches Acme's name; but "prepare" (stopword)
    // must not match anything on its own.
    const ranked = rankLists('prepare something', lists)
    expect(ranked.every((r) => r.score === 0)).toBe(true)
  })
})
