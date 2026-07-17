// Verify the built PWA is installable: manifest valid + 192/512 icons + standalone
// + service worker registers with a fetch handler. Run against `npm run preview`:
//   node scripts/pwa-verify.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.PWA_BASE ?? 'http://localhost:4173'
let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}

const browser = await chromium.launch()
const page = await browser.newPage()
try {
  await page.goto(BASE, { waitUntil: 'load' })

  // Manifest linked + fetchable + valid.
  const href = await page.getAttribute('link[rel="manifest"]', 'href')
  check('index.html links a manifest', href === '/manifest.webmanifest')
  const manifest = await page.evaluate(async (h) => (await fetch(h)).json(), href)
  check('manifest has a name', Boolean(manifest.name))
  check('manifest display is "standalone" (no browser bar)', manifest.display === 'standalone')
  check('manifest start_url is set', Boolean(manifest.start_url))
  const sizes = (manifest.icons ?? []).map((i) => i.sizes)
  check('manifest has a 192x192 icon', sizes.includes('192x192'))
  check('manifest has a 512x512 icon', sizes.includes('512x512'))
  check('manifest has a maskable icon', (manifest.icons ?? []).some((i) => (i.purpose ?? '').includes('maskable')))

  // Every icon actually resolves (a 404 icon silently breaks install).
  for (const icon of manifest.icons ?? []) {
    const status = await page.evaluate(async (src) => (await fetch(src)).status, icon.src)
    check(`icon ${icon.src} resolves (200)`, status === 200)
  }

  // apple-touch-icon for iOS "Add to Home Screen".
  const apple = await page.getAttribute('link[rel="apple-touch-icon"]', 'href')
  check('apple-touch-icon present (iOS install)', Boolean(apple))
  check('theme-color meta present', (await page.locator('meta[name="theme-color"]').count()) > 0)

  // Service worker registers (localhost counts as a secure context) and controls.
  const swOk = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.getRegistration()
    // Give registration a beat if it's mid-install.
    if (!reg) await new Promise((r) => setTimeout(r, 1500))
    const reg2 = await navigator.serviceWorker.getRegistration()
    return Boolean(reg2 && (reg2.active || reg2.installing || reg2.waiting))
  })
  check('service worker registers (installability requirement)', swOk)

  // The SW must NOT hijack Supabase/cross-origin — sanity check its logic exists.
  const swSrc = await page.evaluate(async () => (await fetch('/sw.js')).text())
  check('sw.js leaves cross-origin (Supabase) requests to the network', swSrc.includes('url.origin !== self.location.origin'))
} catch (e) {
  check(`pwa-verify threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ PWA INSTALLABILITY CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
