const KEY = 'alpviram.activeOrgId'

/**
 * The user's chosen active organization (PDL-009: one active org at a time).
 *
 * A user can belong to several orgs — their own personal one, plus any they are
 * invited to. Without a stored choice, "active org" would just be whichever they
 * joined first (their personal org), so someone who accepts a team invite would
 * never actually land in the team. Persisting the choice fixes that, and is the
 * seed of the org switcher the full multi-org feature will grow into.
 */
export function getActiveOrgId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setActiveOrgId(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable — fall back to the default (first membership) */
  }
}
