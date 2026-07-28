# Audits

Security & test report for the BVCC Agent Wallet, covering three review rounds (2026-06 → 2026-07):

- **V1** — the Arbitrum Sepolia engagement: static analysis, the `approve` token-cap bypass, the redeployed patch and the full agent-permission battery, plus guardian recovery verified end-to-end.
- **V2** — mainnet gas hardening (`PROBE_GAS_CAP`) and the deterministic multichain deployment of the V2 factories.
- **V3** — per-selector call policies, the on-chain validator registry and its 48-hour asymmetric governance, verified by unit/fork/fuzz tests and on Arbitrum One mainnet, deployed across six networks.
- **Post-release review** — a cross-function reentrancy affecting V1, V2 and V3 alike (fixed in source, awaiting a V4 deployment) and four further findings from an external reviewer, including guardian squatting through the permissionless factory (open). See §12.1, §13 and §14.

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
