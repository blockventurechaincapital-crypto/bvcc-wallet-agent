# Audits

Security & test report for the BVCC Agent Wallet (Arbitrum Sepolia engagement, 2026-06).

| File | Description |
|---|---|
| `BVCC-Agent-Wallet-Security-Report.pdf` | Report (English) |
| `BVCC-Agent-Wallet-Informe-Seguridad.pdf` | Report (Spanish) |
| `bvcc-security-report.html` | Source for the English PDF |
| `bvcc-security-report-es.html` | Source for the Spanish PDF |
| `render-pdf.mjs` | HTML → PDF renderer (headless Chromium via Playwright) |

## Regenerate the PDFs

Requires Node.js + Playwright with Chromium (`npm i playwright && npx playwright install chromium`).

```bash
# English (defaults)
node render-pdf.mjs

# Spanish
node render-pdf.mjs bvcc-security-report-es.html BVCC-Agent-Wallet-Informe-Seguridad.pdf
```

Edit the corresponding `.html` and re-run to update a report.
