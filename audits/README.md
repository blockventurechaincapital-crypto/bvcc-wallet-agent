# Audits

Internal security review of the BVCC Agent Wallet, covering four review rounds (2026-06 → 2026-07) of the contracts at commit `a3e28f1` (`contracts/src` tree `337e84f0`, generation V4).

**This is an internal review, not an external audit.** It was performed by the development team on its own code, and **no independent party has reviewed it**. Four of the findings came from a later pass over the V3 code with a different analysis tool, and each had survived three earlier rounds — changing the tool found what repeating the method did not. That pass was internal too. Section 7 of the report states the limits of what it establishes.

## Findings

Thirteen findings in the current codebase, plus two closed in superseded generations. Severity is impact × likelihood, recorded as found rather than as it stands after remediation.

| Severity | Count | Status |
|---|---|---|
| Critical | 2 | both fixed |
| High | 3 | 2 fixed, **1 open** |
| Medium | 5 | 3 fixed, 1 open (interface), 1 accepted |
| Low | 1 | fixed |
| Informational | 2 | 1 mitigated, 1 accepted |

Nine findings are remediated in bytecode deployed and verified on all six networks. Seven of them required a bytecode change and shipped together as the **V4** generation.

**The one that should change behaviour today is BVCC-03**, which V4 does not close: where the owner has already granted a token allowance to a protocol, anchoring a call's destination does not bound its value, so a compromised agent key is worth more than its budget. Zero standing allowances before authorizing an agent that can reach that protocol.

**A deployed wallet cannot be upgraded in place.** Wallets still on V1, V2 or V3 run the vulnerable bytecode — including the Critical BVCC-01 — until their owners migrate.

## Structure

Part I is the audit: executive summary, scope and severity model, the findings register, the findings in detail (`BVCC-01` … `BVCC-13`), remediation and deployment verification, residual risk, conclusion and limitations. Part II holds the appendices: security architecture, test evidence, static analysis, the V1 and V2 findings with their evidence, the remediation timeline, key identifiers, and process notes.

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
