# QuickBooks Online → PP AFS

Status: local connector implemented; Intuit development callback and private local credentials configured. QuickBooks storage migration applied to the linked PracticePilot database after a rollback-only integration test passed. Sandbox Company US da24 is authorised and connected through the local callback. No source deployment to production. No paid service selected.

## User flow

In an AFS engagement, open Trial Balance and use QuickBooks Online. Connect, inspect the selected company name and realm ID, then confirm that company belongs to the engagement. Retrieve the full reporting period. Each server request advances a durable import step; closing the page pauses progress and Resume continues it. This is resumable processing, not an unattended background scheduler.

The import retrieves all active and inactive source accounts, opening/closing accrual trial balances and monthly GL reports with explicit debit/credit columns. It rechecks the TB after extraction. A reconciled preview is required before Apply. Supporting GL import is the default. Updating TB figures is an explicit option. Existing mappings, comparatives, evidence and PP adjustments are preserved by the existing ledger import transaction. Relevant sign-offs reopen.

Uncoded QuickBooks accounts use explicit QBO-<source ID> identifiers, not guessed account numbers. Existing TB accounts absent from the source snapshot prevent updating figures. Matching those accounts is currently a manual account-code task; supporting detail can be imported without changing the TB.

## Server configuration

Add these through the deployment environment's secret settings. For local sandbox testing use an ignored .env.local. Never paste client secrets or tokens in chat, screenshots, public environment variables, logs or committed files.

- QBO_CLIENT_ID: Intuit app client ID for the chosen environment.
- QBO_CLIENT_SECRET: matching Intuit client secret.
- QBO_ENVIRONMENT: sandbox or production (explicit).
- QBO_REDIRECT_URI: exact registered callback, e.g. https://practicepilot.co.za/api/quickbooks/callback. Local sandbox supports http://localhost:3000/api/quickbooks/callback.
- QBO_TOKEN_KEY: a securely generated 32-byte encryption key encoded as base64. Keep a protected backup. Rotating it requires re-encrypting existing credentials or disconnecting/reconnecting.

Apply supabase/migrations/20261107120000_quickbooks_afs.sql after the working-paper migration. The new tables have RLS enabled and no anon/authenticated grants. Only authenticated, practice/engagement-scoped server routes use service-role access. Do not run migrations against production until the exact change/destination is reviewed.

## Intuit portal

Existing app: PracticePilot AFS, AppID ac0b66e7-c98e-485d-be29-6e10e691571a. Workspace Corepilot Software Holdings, ID 9341458656582578.

Register the exact callback URL in the appropriate environment. Request Accounting access only. Intuit's accounting scope is broader than read-only; this implementation only reads accounting data and never posts source journals. OAuth state is random, hashed, one-use, expires in ten minutes and is bound to an HttpOnly browser cookie. Tokens are AES-256-GCM encrypted server-side; refreshes use a database lease to avoid token rotation races. Production requires Intuit app details/compliance approval. Do not assert untested implementation controls as verified facts.

Disconnect from PP removes local token access and cancels pending imports. It does not revoke the separate app consent in Intuit; the user can also remove it under QuickBooks connected apps. Imported ledger history remains. Reconnect must be done after disconnecting the old local binding.

No marketplace listing, paid tier or subscription is required by the code. If the portal presents fees or a paid commitment, stop and show the user the price before proceeding.

## Limits and explicit review gates

- Single base-currency companies only for this first connector. Multi-currency preferences block direct import until home-currency columns and controls are proven against real samples.
- Accrual only. Unknown report schemas, ambiguous signs/account identity, unexpected undated rows and period/basis/currency mismatches stop the import.
- Maximum 24 reporting months, 20,000 source accounts, 10,000 postings in any monthly report, 100,000 postings in a staged import, 12 MB in a provider response. Oversized extracts stop without applying partial results. No file-import limit is silently bypassed.
- Source income closing/retained-earnings transitions may mean prior-day TB plus period postings does not match the closing TB. The connector blocks these differences. Do not plug retained earnings or invent a journal. A sandbox proof of fiscal-year semantics is required before live release; if the provider report resets income at year-start, support that documented opening convention before enabling affected clients.
- Report checks cannot establish completeness against changes that leave all control totals unchanged. Original source reports, company/period identity and import snapshots are retained for review. No source-system transactional snapshot is claimed.
- No supporting-document attachment download, automatic nightly sync, source journal write-back or QuickBooks Desktop support.
- The schema migration and rollback-only SQL activation checks have passed. OAuth exchange has succeeded. A live read from the authorised sandbox retrieved 90 source accounts and 334 GL postings for 1 January to 7 November 2026; these reconciled to the source trial balance with zero differences. No sandbox figures were applied to the existing Highveld demo engagement.

## Required pilot before release

1. Apply migration in an isolated test database and run ledger activation/rollback tests, including locked/finalising engagements and concurrent cancel/apply.
2. Configure sandbox credentials and callback; connect an authorised test company and reject a mismatched company confirmation.
3. Import an independent TB/GL fixture with duplicate identical postings, inactive and zero-movement accounts; compare against exports. Verify ordinary fiscal-year opening, retained earnings and report schema explicitly.
4. Pause/reload/resume; retry a month and confirm no duplication. Test revoked access, rotating refresh tokens, throttling and interrupted steps.
5. Confirm preview does not change ledger or TB. Apply supporting detail; then test explicit TB update, existing mapping/comparative/journal preservation, sign-off invalidation and final locks. Unknown legacy account codes must block TB update.
6. Complete accurate Intuit production questionnaire and obtain production keys. Deploy only the reviewed change, run the exact build candidate and verify the production callback/company import. No production connection is established by app registration alone.

Official references:
- https://static.developer.intuit.com/output_html/qbo/docs/develop/authentication-and-authorization/oauth-2.0.html
- https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/generalledger
- https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/trialbalance
- https://developer.intuit.com/app/developer/qbo/docs/workflows/run-reports

## Verified on 7 November 2026

- Intuit development callback saved as http://localhost:3000/api/quickbooks/callback. Existing playground callback retained.
- Development client ID/secret and a generated token-encryption key saved only in ignored .env.local (mode 0600). No credentials added to source or deliverables.
- Migration 20261107120000 applied to linked PracticePilot_projects (zzzxcruraftwnbtcetju); migration history recorded. SQL activation tests first ran inside a rolled-back transaction.
- Authorised sandbox realm 9341458656486869 connected to the existing Highveld fictional engagement for connection testing. No new billable AFS engagement created and no source figures applied.
- Read-only source probe: 90 accounts, 334 GL postings, zero source-TB reconciliation issues. Observed real report differences covered by regression tests: TB rows without type, explicit NoReportData periods, Beginning Balance in the date column, .00 formatting and zero-value unallocated credit-link rows.
- The provider ignores an isolated end_date on TrialBalance and can return the current month. Requests now supply start_date and end_date; response period validation prevents accepting a default report for the wrong year.
- Local TypeScript, scoped lint, 23 connector checks and 31 existing working-paper checks are the validation set. Full production build/deployment and production Intuit approval remain outstanding.

## 12 November production preparation

Intuit assessment approval is confirmed. The current candidate ports the connector onto the newer AFS source without replacing notes pages. The production keys/HTTPS callback configuration is awaiting the user confirmation requested in this chat. No real-company consent or import has been performed.

28 focused checks pass, including token rotation, invalid refresh grants, revoked access and matching source/AFS reporting currency. Connector/import-control scoped TypeScript and lint pass with a 768 MB heap limit. Full-project checking hit that cap; the full build remains deferred until the notes work completes. No deployment is claimed.

The first report currency is now checked against the AFS reporting currency; ambiguous symbols are rejected, and currency is rechecked before applying. PP does not silently convert USD into a Rand AFS.
