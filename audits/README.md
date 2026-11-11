# Audits

Internal security review of the BVCC Agent Wallet, covering every generation from V1 (2026-06) to V5 (2026-11). V5 is the current generation: commit `838a70f`, `contracts-v5/src` tree `64a5c674`. The review of V4 and earlier refers to commit `a3e28f1` (`contracts/src` tree `337e84f0`).

**This is an internal review, not an external audit.** The development team performed it on its own code. The five V5 review rounds and the red-team exercise were run by the team with AI analysis tools, and **no independent party has reviewed any generation**. Section 7 of the report states the limits of what it establishes.

## Findings

Thirty findings: thirteen from the review of V4 and earlier (`BVCC-01` … `BVCC-13`) and seventeen from the V5 rounds (`BVCC-14` … `BVCC-30`), plus two closed in superseded generations. Severity is impact × likelihood, recorded as found rather than as it stands after remediation.

| Severity | V4 review | V5 review |
|---|---|---|
| Critical | 2 | 0 |
| High | 3 | 10 |
| Medium | 5 | 5 |
| Low | 1 | 2 |
| Informational | 2 | 0 |

**On V5 nothing is open.** Twenty-six findings are closed in code. Four are accepted and documented as trust assumptions: validators must be immutable, approved Uniswap v4 hooks and allowed tokens are trusted, and the wallet only measures tokens a validator declares. Every V5 finding was handled before deployment.

**V5 closes BVCC-03**, the one material risk V4 left open, by measuring what each agent batch takes out of the wallet and charging it, fee included, against the agent's limits, whatever allowances already exist.

**V5 is live on six networks** (Ethereum, Arbitrum One, Base, BNB Chain, Polygon, Arbitrum Sepolia). All 72 contracts are source-verified and all 30 validators are active, both read back from each network on 2026-11-11.

**A deployed wallet cannot be upgraded in place.** V4 wallets still have BVCC-03 open, and wallets on V1 to V3 run the Critical BVCC-01, until their owners migrate to V5.

## Structure

Part I is the audit: executive summary, scope and severity model, the findings register, the findings in detail (`BVCC-01` … `BVCC-30`), remediation and deployment verification, residual risk, conclusion and limitations. Part II holds the appendices: security architecture (V5 first), test evidence, static analysis, the V1 and V2 findings with their evidence, the remediation timeline, key identifiers, and process notes.

Findings are cited by identifier throughout, not by section number.

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

Edit the corresponding `.html` and re-run to update a report. The PDFs are also served by the app from `public/audits/` — keep every copy in sync.
