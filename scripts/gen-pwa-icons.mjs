// Generate PWA PNG icons from the brand mark (public/favicon.svg), using the
// already-installed Playwright/Chromium — no image dependency. Re-run if the brand
// mark changes:  node scripts/gen-pwa-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8')
const svgData = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
const outDir = join(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

// Each icon: a white square (opaque — iOS/maskable need no transparency), the mark
// centred. "any" icons get rounded corners (they render as-is); "maskable" is a
// full-bleed square with the mark inside the ~80% safe zone (the launcher masks it).
const icons = [
  { file: 'icon-192.png', size: 192, mark: 62, radius: 22 },
  { file: 'icon-512.png', size: 512, mark: 62, radius: 22 },
  { file: 'icon-maskable-512.png', size: 512, mark: 54, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, mark: 64, radius: 0 },
]

const browser = await chromium.launch()
try {
  for (const { file, size, mark, radius } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(
      `<body style="margin:0">
        <div style="width:${size}px;height:${size}px;background:#ffffff;border-radius:${radius}%;
                    display:flex;align-items:center;justify-content:center;overflow:hidden">
          <img src="${svgData}" style="width:${mark}%;height:${mark}%;object-fit:contain"/>
        </div>
      </body>`,
      { waitUntil: 'networkidle' },
    )
    await page.screenshot({ path: join(outDir, file), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false })
    await page.close()
    console.log(`✓ ${file} (${size}×${size})`)
  }
} finally {
  await browser.close()
}

console.log('\nIcons written to public/icons/. The manifest references them by that path.')
