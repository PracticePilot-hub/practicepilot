"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { workpaperRequest } from "./client";
import styles from "./QuickBooksImport.module.css";

type Account = { code: string; name: string; opening: number; closing: number; debit: number; credit: number };
type Job = { id: string; status: string; progress: string; rowCount: number; periodStart: string; periodEnd: string; verified: boolean; issues: string[]; accounts?: Account[]; currency?: string; company?: string };
type Status = { configured: boolean; environment?: string; connection: { status: string; realmId: string; environment: string; companyName: string | null } | null; companyError?: string | null; job: Job | null };
const callbackErrors: Record<string, string> = {
  cancelled: "The QuickBooks connection was cancelled. Nothing was imported.",
  invalid_state: "This connection attempt expired. Start again from this file.",
  failed: "PP could not finish the QuickBooks connection. Nothing was imported. Please try again.",
  access_changed: "Your access to this AFS file changed. The company was not connected.",
  already_connected: "This file already has a QuickBooks connection. Check the company below.",
};

export default function QuickBooksImport({ engagementId, clientName, locked, onImported, onTrialBalanceFile, onGeneralLedgerFile }: {
  engagementId: string; clientName: string; locked: boolean; onImported: () => void;
  onTrialBalanceFile: () => void; onGeneralLedgerFile?: () => void;
}) {
  const returned = useSearchParams().get("qbo");
  const [open, setOpen] = useState(Boolean(returned));
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [updateTB, setUpdateTB] = useState(false);
  const [applied, setApplied] = useState(false);
  const pause = useRef(false), dialog = useRef<HTMLDialogElement>(null), menuBox = useRef<HTMLDivElement>(null);
  const endpoint = `/api/afs/engagements/${engagementId}/quickbooks`;
  const fetchStatus = useCallback(() => workpaperRequest<Status>(endpoint), [endpoint]);

  useEffect(() => {
    let active = true;
    pause.current = false;
    void fetchStatus().then(result => { if (active) { setStatus(result); setChecking(false); } }).catch(e => { if (active) { setError((e as Error).message); setChecking(false); } });
    return () => { active = false; pause.current = true; };
  }, [fetchStatus]);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open && dialog.current?.open) dialog.current.close(); }, [open]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!menuBox.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  async function reload() {
    setChecking(true); setError("");
    try { setStatus(await fetchStatus()); } catch (e) { setError((e as Error).message); } finally { setChecking(false); }
  }
  async function action<T = Record<string, unknown>>(actionName: string, extra: Record<string, unknown> = {}) {
    return workpaperRequest<T>(endpoint, { method: "POST", body: JSON.stringify({ action: actionName, ...extra }) });
  }
  async function perform(fn: () => Promise<void>) {
    setError(""); setBusy(true);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function retrieve(job: Job) {
    pause.current = false; let current = job;
    setStatus(s => s ? { ...s, job: current } : s);
    while (current.status === "loading" && !pause.current) {
      current = await action<Job>("step", { jobId: current.id });
      setStatus(s => s ? { ...s, job: current } : s);
    }
  }
  function close() {
    pause.current = true; setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("qbo");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  function show() { setMenu(false); setOpen(true); }
  const connection = status?.connection, job = status?.job;
  const connected = connection?.status === "connected";
  const companyName = connection?.companyName;
  const test = connection?.environment === "sandbox";
  const callbackMessage = returned ? callbackErrors[returned] : undefined;
  const missingSavedConnection = returned === "connected" && !checking && status && !connected;
  const unavailable = !checking && !status;
  const money = (n: number) => n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <div className={styles.source}>
    <button className={styles.connection} type="button" onClick={show} aria-label="QuickBooks connection details">
      <span className={`${styles.dot} ${connected ? (test ? styles.testDot : styles.liveDot) : ""}`} />
      {checking ? "Checking QuickBooks…" : connection?.status === "reconnect_required" ? "QuickBooks · reconnect required" : connected ? (companyName || "QuickBooks · company check failed") : unavailable ? "QuickBooks unavailable · retry" : "QuickBooks not linked"}
      {connected && test ? <span className={styles.testTag}>TEST DATA</span> : null}
    </button>
    <div ref={menuBox} className={styles.menuBox}>
      <button className={styles.primary} type="button" disabled={locked || busy} aria-expanded={menu} aria-controls="afs-import-menu" onClick={() => setMenu(!menu)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg> Import data <svg className={styles.chevron} aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m4 6 4 4 4-4"/></svg></button>
      {menu ? <div id="afs-import-menu" className={styles.menu}>
        <button type="button" onClick={show}><span className={styles.providerIcon} aria-hidden="true">qb</span><span><strong>QuickBooks Online</strong><small>Connect and import TB + ledger</small></span></button>
        <button type="button" onClick={() => { setMenu(false); onTrialBalanceFile(); }}><span className={styles.fileIcon} aria-hidden="true">TB</span><span><strong>Trial balance file</strong><small>Excel or CSV balances</small></span></button>
        {onGeneralLedgerFile ? <button type="button" onClick={() => { setMenu(false); onGeneralLedgerFile(); }}><span className={styles.fileIcon} aria-hidden="true">GL</span><span><strong>General ledger file</strong><small>Excel or CSV transactions</small></span></button> : null}
      </div> : null}
    </div>

    <dialog ref={dialog} className={styles.dialog} onCancel={close} onClose={() => setOpen(false)} aria-labelledby="qbo-dialog-title">
      <header className={styles.header}><div><span className={styles.eyebrow}>IMPORT FROM QUICKBOOKS</span><h2 id="qbo-dialog-title">{checking ? "Checking your connection" : applied ? "Import applied" : connected ? "Confirm the accounting company" : "Connect your accounting company"}</h2></div><button type="button" className={styles.close} onClick={close} aria-label="Close QuickBooks import">×</button></header>
      <div className={styles.body}>
        <ol className={styles.steps} aria-label="Import steps"><li className={!job ? styles.current : ""}>1 · Company</li><li className={job ? styles.current : ""}>2 · Preview</li><li className={applied ? styles.current : ""}>3 · Apply</li></ol>
        {error ? <div role="alert" className={styles.error}>{error} <button type="button" onClick={() => void reload()} disabled={checking || busy}>Retry</button></div> : null}
        {callbackMessage ? <p className={styles.notice}>{callbackMessage}</p> : null}
        {missingSavedConnection ? <p role="alert" className={styles.error}>Intuit returned to PP, but no saved company connection could be verified. Nothing was imported. Retry the connection.</p> : null}
        {checking ? <div className={styles.loading} role="status">Checking which QuickBooks company is linked to this file…</div> : <>
          <div className={styles.identity}><span>PP AFS file</span><strong>{clientName}</strong></div>
          {connected ? <>
            <div className={styles.identity}><span>QuickBooks company</span><strong>{companyName || "Company name could not be verified"}</strong><small>Company reference {connection.realmId}</small></div>
            {test ? <div className={styles.warning}><strong>This is an Intuit test company.</strong><p>{companyName || "The connected company"} contains sample data. It is not {clientName}’s live accounting records.</p><p>This file is linked to sample data. To use real accounting records, disconnect this company and connect through PP’s live QuickBooks connection.</p></div> : null}
            {status?.companyError ? <div role="alert" className={styles.error}>{status.companyError} <button type="button" onClick={() => void reload()}>Retry company check</button></div> : null}
            {!job && !applied ? <>
              <p className={styles.muted}>Connecting does not import data. Review a preview before applying it to this file.</p>
              <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={!companyName || locked}/><span>{test ? "I want to preview this sample company’s data in this file." : `This is the correct accounting company for ${clientName}.`}</span></label>
              <button type="button" className={styles.primary} disabled={busy || locked || !confirmed || !companyName || Boolean(status?.companyError)} onClick={() => void perform(async () => { const next = await action<Job>("start", { confirmCompany: true, companyName, realmId: connection.realmId }); await retrieve(next); })}>{busy ? "Retrieving…" : test ? "Preview test TB + ledger" : "Preview TB + ledger"}</button>
            </> : null}
          </> : !unavailable && status ? <>
            <div className={styles.warning}><strong>{!status.configured ? "QuickBooks connection setup is incomplete." : status.environment === "sandbox" ? "This connection is currently in test mode." : "Connect your QuickBooks company."}</strong><p>{!status.configured ? "The app settings must be completed before a company can connect." : status.environment === "sandbox" ? "PP is configured for Intuit sample companies. Your practice administrator must enable the production connection to use real client companies." : "Continue to Intuit to choose the company for this AFS file."}</p></div>
            <p className={styles.muted}>You sign in and choose a company on Intuit’s secure screen. PP never receives your password. If you are already signed in, Intuit may reuse that session.</p>
            <button type="button" className={styles.primary} disabled={busy || locked || !status.configured || Boolean(connection)} onClick={() => void perform(async () => { const result = await action<{ url: string }>("connect"); window.location.assign(result.url); })}>{busy ? "Opening Intuit…" : "Continue to Intuit"}</button>
          </> : null}
        </>}
        {job ? <section className={styles.preview}><h3>Import preview</h3><p aria-live="polite">{job.progress}</p><p className={styles.muted}>{job.periodStart} to {job.periodEnd} · {job.rowCount.toLocaleString()} postings · {job.currency}</p>
          {job.status === "review" && !job.verified ? <button type="button" className={styles.secondary} disabled={busy || locked} onClick={() => void perform(async () => retrieve(await action<Job>("recheck", {jobId:job.id})))}>Recheck reconciliation</button> : null}
          {job.status === "loading" ? <button type="button" className={styles.secondary} disabled={locked} onClick={() => busy ? (pause.current = true) : void perform(() => retrieve(job))}>{busy ? "Pause after this step" : "Resume retrieval"}</button> : null}
          {job.status === "review" ? <>
            <p className={job.verified ? styles.success : styles.error}>{job.verified ? "GL agrees to the source trial balance. Review before applying." : "The source reports do not reconcile. Nothing can be applied."}</p>
            {job.issues.length ? <ul>{job.issues.slice(0, 30).map((issue, i) => <li key={i}>{issue}</li>)}</ul> : null}
            <div className={styles.tableScroll}><table><thead><tr><th>Account</th><th>Opening</th><th>Debits</th><th>Credits</th><th>Closing</th></tr></thead><tbody>{job.accounts?.map(a => <tr key={a.code}><td>{a.code} · {a.name}</td><td>{money(a.opening)}</td><td>{money(a.debit)}</td><td>{money(a.credit)}</td><td>{money(a.closing)}</td></tr>)}</tbody></table></div>
            <label className={styles.check}><input type="checkbox" checked={updateTB} onChange={e => setUpdateTB(e.target.checked)}/><span>Also update current TB figures. Keep existing mappings, comparatives and PP adjustments.</span></label>
            <button type="button" className={styles.primary} disabled={busy || locked || !job.verified} onClick={() => void perform(async () => { await action("apply", { jobId: job.id, updateTrialBalance: updateTB }); await reload(); setApplied(true); onImported(); })}>{busy ? "Applying…" : updateTB ? "Apply GL + update TB" : "Apply supporting GL only"}</button>
          </> : null}
          <button type="button" className={styles.textButton} disabled={busy || locked} onClick={() => void perform(async () => { await action("cancel", { jobId: job.id }); await reload(); })}>Discard this preview</button>
        </section> : null}
        {applied ? <p role="status" className={styles.success}>The reviewed import was applied. Your trial balance has refreshed.</p> : null}
      </div>
      <p className={styles.muted}>Need help? <a href="mailto:support@practicepilot.co.za">Contact PracticePilot support</a>. Include the support reference if one is shown.</p>
      <footer className={styles.footer}>{connection ? <button type="button" className={styles.textButton} disabled={busy || locked} onClick={() => void perform(async () => { await action("disconnect"); setConfirmed(false); setApplied(false); await reload(); })}>Disconnect this company</button> : <span className={styles.muted}>Nothing is imported until you review and apply.</span>}<button type="button" className={styles.secondary} onClick={close}>Back to trial balance</button></footer>
    </dialog>
  </div>;
}
