# QuickBooks live import: morning test

## Preparation state

This candidate recovers the local QuickBooks connector onto the newer pushed AFS source without replacing the notes pages. It has not yet been deployed or configured with production credentials. Intuit assessment approval has been verified.

28 focused checks pass, including token renewal and rotation, invalid refresh grants, revoked access, callback state rejection, source report parsing and reconciliation. The connector/import-controls scoped type check passes under a 768 MB heap cap. The full-project type check did not complete under the deliberately restricted 768 MB heap cap. It must pass with the final merged notes source before deployment. No successful production build is claimed.

Hosted QuickBooks and GL tables and functions were checked read-only. The tables have RLS and do not grant browser roles direct access; the two apply/import functions are service-only. No schema changes were made during this preparation.

## Required before live test

1. Wait for the notes work to complete; update this candidate to that pushed commit, preserving its AFS changes.
2. Run one type check and one production build at a time. Do not start a second full build on this Mac.
3. Production configuration is awaiting explicit approval in the chat. Register the exact HTTPS callback and store production credentials privately; never put them in browser code, source control, the checklist or chat output.
4. Verify the deployed callback and live environment. Confirm no sandbox connection is presented as a real client company. Existing test bindings must be disconnected before the new live authorisation.
5. User selects the real company on Intuit and approves its accounting access. Do not grant this on the user's behalf overnight.

## Test in PP

- Open the correct AFS file and Trial Balance, then Import data > QuickBooks Online.
- Sign in on Intuit and select the actual company. On return, check the exact QuickBooks company name against the AFS client. There must be no TEST DATA badge.
- Check the financial year end, confirm the company and retrieve a preview.
- Check that the AFS reporting currency is set explicitly. Different source/AFS currencies and ambiguous currency symbols are blocked; PP does not convert the imported amounts.
- Review account count, opening/closing balances and GL debit/credit totals against a QuickBooks export. Any reconciliation mismatch stops the import; do not plug a difference.
- Choose whether to update current TB figures or import supporting ledger only. Review before Apply. Existing mappings, comparatives and PP journals must remain.
- Confirm imported figures and sign-off reopening. Repeat retrieval must not duplicate transactions.

Accrual-basis companies are supported in this version. Multicurrency companies use Intuit home-currency debit/credit columns and must match the AFS currency. No source journals are posted to QuickBooks. PP never asks for the QuickBooks password; Intuit owns sign-in and company selection.

## Recovery

Work candidate: /private/tmp/pp-qbo-live-20261112
Durable recovery patch/archive and STATUS.txt: workspace/QuickBooks-preparation

13 November: Multicurrency imports now verify Preferences.CurrencyPrefs.HomeCurrency, request debt_home_amt/credit_home_amt and refuse foreign/ambiguous ledger columns. PP does no FX calculation; every account must reconcile before Apply. Specification: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/generalledger .
