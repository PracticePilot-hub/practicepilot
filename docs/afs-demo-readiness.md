# AFS demo readiness — 2 November 2026

## Included product fixes

- AFS statement, complete equity, cash-flow and comparative reconciliation; explicit cash workpapers take precedence over inferred movements.
- Measured pagination and note spacing, policy deduplication, note disclosure requirements and framework/edition/scope checks.
- Related-party account links and supporting disclosure capture.
- Tax computation worksheet with supporting workings, dated P1/P2/top-up payments, comparative review and balanced difference journals.
- Ordinary SA trusts use 45%; qualifying special trusts use supported progressive tables without personal rebates. Legacy company-rate trust workings reopen for review. Existing payments and underlying balances are preserved.
- PDF filenames use the reporting entity name, not the practitioner named in the compiler report.

## Demo boundary

Highveld is a fictional comprehensive mapping and disclosure fixture. Its arithmetic and presentation are testable. Its illustrative tax-base, foreign-tax and discontinued-operation assumptions remain subject to technical review. The explicit tax-basis review gate is retained. Do not describe the fixture or the product as independently approved by a CA or as automatically compliant for every real client. Client-specific valuations, terms, tax facts, beneficiary vesting/attribution and approvals still require evidence.

A commit does not update practicepilot.co.za. Demo localhost unless the commit is separately pushed and deployed with authorisation. Saved engagement data is separate from source control.

## Checks

Run `node tests/afs/run.cjs` and `node tests/highveld-comprehensive/run.cjs`. The latter generates a fictional balanced opening and two-year ledger and renders all selected notes across six framework/scope combinations. It performs no database writes. Run the project TypeScript check and a production build against the exact commit candidate before release. Generated fixture outputs are ignored.
