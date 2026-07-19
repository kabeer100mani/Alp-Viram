// Shared helpers for the post-M8 shell (sections + Quick-capture dialog + Overview).
// Walkthroughs use these so the shell interaction lives in one place.

export async function signUp(page, base = process.env.M3_BASE ?? 'http://localhost:5173') {
  const email = `wt_${Math.random().toString(36).slice(2, 8)}@example.com`
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  // Lands on the Overview/Home (its greeting heading).
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  return email
}

/** Navigate to a top-level section via the sidebar / bottom bar. */
export async function goToSection(page, name) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true }).first().click()
  await page.waitForTimeout(400)
}

/** Go to Home (the task views live there, PDL-051) and select a view in its rail (desktop). */
export async function goToView(page, viewName) {
  await goToSection(page, 'Home')
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: viewName, exact: true }).click()
  await page.waitForTimeout(600)
}

/**
 * Quick-capture through the modal dialog: open, type, classify, (optionally) confirm.
 * Returns the dialog locator (useful before confirm to edit chips).
 */
export async function quickCapture(page, text, { confirm = true } = {}) {
  await page.getByRole('button', { name: 'Quick capture' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder(/capture in plain words/i).fill(text)
  await dialog.getByRole('button', { name: /^capture$/i }).click()
  await dialog.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  if (confirm) {
    await dialog.getByRole('button', { name: /confirm/i }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  }
  return dialog
}
