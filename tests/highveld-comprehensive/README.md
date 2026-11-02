# Highveld comprehensive AFS regression

Run from the project root: `node tests/highveld-comprehensive/run.cjs`.

This is a fictional test company. The runner reads the current mapping catalogue, creates balanced opening and two-year journals, constructs captured Work schedules, renders all selected notes and tests six framework/scope combinations. It does not connect to a database, import data, sign off, commit, push or deploy.

Coverage: 367 unique mappings (363 financial and 4 disclosure-only memo mappings), 371 accounts including consolidation elimination accounts; 57 notes and 58 policies. Every financial mapping has individual current and prior activity or balances. Memo mappings are supported by disclosure case facts and do not create fictitious financial balances. The duplicate generic/tenth stakeholder-loan mapping is tested with a legacy alias.

The principal case is full IFRS consolidated, allowing the full mapping catalogue, including IFRS 5 and IFRS 16, to be exercised. Separate and SME 2015/2025 variants test the necessary recognition and classification changes. All money comes from balanced journal postings; cash receipts/payments are classified from transactions, never a financing residual. The fictional current financing defaults and collateralised overdue receivables are explicitly disclosed and included in liquidity assessment.

The actual browser/PDF acceptance check must also confirm the complete disclosure text, note/table continuations, index, cash note, cash-flow closing figures and tax computation. A successful fixture is not a statement that an arbitrary real client TB supplies valuations, contractual terms, related-party transactions, actuarial facts or all required disclosures. Those remain captured Work facts.
