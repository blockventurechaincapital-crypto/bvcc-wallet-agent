// Render the HTML report to a print-quality PDF via headless Chromium.
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
// Usage: node render-pdf.mjs [input.html] [output.pdf]
const htmlPath = join(here, process.argv[2] || 'bvcc-security-report.html')
const pdfPath = join(here, process.argv[3] || 'BVCC-Agent-Wallet-Security-Report.pdf')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' })
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: false,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
  displayHeaderFooter: false,
})
await browser.close()
console.log('PDF written:', pdfPath)
