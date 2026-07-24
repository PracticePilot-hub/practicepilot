"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type TrialBalanceLine = {
  id?: string | number | null;
  account_code?: string | null;
  account_name?: string | null;
  description?: string | null;
  mapping_label?: string | null;
};

type JournalLine = {
  id: string;
  accountKey: string;
  debit: string;
  credit: string;
  note: string;
};

type JournalPeriod =
  | "current_year"
  | "prior_year"
  | "opening_balance";

type PostedJournal = {
  id: string;
  number: number;
  reference: string;
  description: string;
  journalPeriod: JournalPeriod;
  status: "Balanced" | "Unbalanced";
  lines: JournalLine[];
  debitTotal: number;
  creditTotal: number;
  difference: number;
  postedAt: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseAmount(value: unknown) {
  const raw = clean(value);
  if (!raw) return 0;
  const negative = raw.startsWith("(") && raw.endsWith(")");
  const number = Number(raw.replace(/[R\s]/g, "").replace(/,/g, ".").replace(/[()]/g, ""));
  if (!Number.isFinite(number)) return 0;
  return negative ? -Math.abs(number) : number;
}

function formatMoney(value: number) {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(number));
  return number < 0 ? `(${formatted})` : formatted;
}

function accountKey(line: TrialBalanceLine, index: number) {
  return clean(line.id) || `${clean(line.account_code)}::${clean(line.account_name || line.description)}::${index}`;
}

function accountCode(line: TrialBalanceLine) {
  return clean(line.account_code);
}

function accountName(line: TrialBalanceLine) {
  return clean(line.account_name || line.description || line.mapping_label || "Account");
}

function accountLabel(line: TrialBalanceLine) {
  const code = accountCode(line);
  const name = accountName(line);
  return code ? `${code} · ${name}` : name;
}

const emptyLine = (): JournalLine => ({
  id: uid(),
  accountKey: "",
  debit: "",
  credit: "",
  note: "",
});


function mapDatabaseJournal(rawJournal: any): PostedJournal {
  const rawLines = Array.isArray(rawJournal?.lines) ? rawJournal.lines : [];

  const debitTotal = Number(rawJournal?.debit_total ?? rawJournal?.debitTotal ?? 0);
  const creditTotal = Number(rawJournal?.credit_total ?? rawJournal?.creditTotal ?? 0);
  const difference = Number(rawJournal?.difference ?? debitTotal - creditTotal);

  return {
    id: clean(rawJournal?.id) || uid(),
    number: Number(rawJournal?.journal_number ?? rawJournal?.number ?? 0) || 0,
    reference:
      clean(rawJournal?.journal_reference ?? rawJournal?.journalReference) ||
      `AJ${String(Number(rawJournal?.journal_number ?? rawJournal?.number ?? 0) || 0).padStart(3, "0")}`,
    description: clean(rawJournal?.description),
    journalPeriod:
      clean(rawJournal?.journal_period ?? rawJournal?.journalPeriod) ===
      "prior_year"
        ? "prior_year"
        : clean(rawJournal?.journal_period ?? rawJournal?.journalPeriod) ===
            "opening_balance"
          ? "opening_balance"
          : "current_year",
    status:
      clean(rawJournal?.status).toLowerCase() === "unbalanced"
        ? "Unbalanced"
        : Math.abs(difference) < 0.005
          ? "Balanced"
          : "Unbalanced",
    lines: rawLines.map((line: any, index: number) => {
      const code = clean(line?.account_code ?? line?.accountCode);
      const name = clean(line?.account_name ?? line?.accountName);
      const label = code && name ? `${code} · ${name}` : code || name || "Account";

      return {
        id: clean(line?.id) || `${rawJournal?.id || "journal"}-${index}`,
        accountKey: label,
        debit: clean(line?.debit),
        credit: clean(line?.credit),
        note: clean(line?.note),
      };
    }),
    debitTotal,
    creditTotal,
    difference,
    postedAt: clean(rawJournal?.posted_at ?? rawJournal?.postedAt) || new Date().toISOString(),
  };
}

export default function AdjustingJournalsPanel({
  engagementId,
  trialBalanceLines = [],
  onAccountCreated,
  onTrialBalanceLinesChanged,
  onDataChanged,
}: {
  engagementId?: string;
  trialBalanceLines?: TrialBalanceLine[];
  onAccountCreated?: (line: TrialBalanceLine) => void;
  onTrialBalanceLinesChanged?: (lines: TrialBalanceLine[]) => void;
  onDataChanged?: () => void | Promise<void>;
}) {
  const [journalReference, setJournalReference] = useState("");
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [journalPeriod, setJournalPeriod] =
    useState<JournalPeriod>("current_year");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [posted, setPosted] = useState<PostedJournal[]>([]);
  const [loadingPosted, setLoadingPosted] = useState(false);
  const [customAccounts, setCustomAccounts] = useState<TrialBalanceLine[]>([]);
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [showAccountPickerForLineId, setShowAccountPickerForLineId] = useState<string | null>(null);
  const [showCreateAccountPopup, setShowCreateAccountPopup] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const storageKey = useMemo(() => {
    const key = engagementId || (typeof window === "undefined" ? "unknown" : window.location.pathname);
    return `afs-adjusting-journals:${key}`;
  }, [engagementId]);

  const customAccountsStorageKey = useMemo(() => {
    const key = engagementId || (typeof window === "undefined" ? "unknown" : window.location.pathname);
    return `afs-journal-custom-accounts:${key}`;
  }, [engagementId]);

  async function loadPostedJournals() {
    if (!engagementId) {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPosted(parsed);
      } catch {
        // ignore corrupt local draft storage
      }

      return;
    }

    try {
      setLoadingPosted(true);

      const response = await fetch(`/api/afs/engagements/${engagementId}/journal-post`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to load posted journals.");
      }

      const dbJournals = Array.isArray(result?.journals)
        ? result.journals.map(mapDatabaseJournal)
        : [];

      setPosted(dbJournals);
    } catch (error) {
      console.error("Failed to load posted AFS journals", error);

      try {
        const saved = window.localStorage.getItem(storageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPosted(parsed);
      } catch {
        // ignore fallback storage
      }
    } finally {
      setLoadingPosted(false);
    }
  }

  useEffect(() => {
    loadPostedJournals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, storageKey]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(customAccountsStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setCustomAccounts(parsed);
    } catch {
      // ignore corrupt custom account storage
    }
  }, [customAccountsStorageKey]);

  function savePostedJournals(next: PostedJournal[]) {
    setPosted(next);

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable in private mode
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(posted));
    } catch {
      // localStorage may be unavailable in private mode
    }
  }, [posted, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(customAccountsStorageKey, JSON.stringify(customAccounts));
    } catch {
      // localStorage may be unavailable in private mode
    }
  }, [customAccounts, customAccountsStorageKey]);

  const accountOptions = useMemo(() => {
    const merged = [...trialBalanceLines, ...customAccounts];
    const seen = new Set<string>();
    return merged
      .map((line, index) => ({
        key: accountKey(line, index),
        code: accountCode(line),
        name: accountName(line),
        label: accountLabel(line),
        line,
      }))
      .filter((option) => {
        const codeKey = option.code || option.key;
        if (seen.has(codeKey)) return false;
        seen.add(codeKey);
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [trialBalanceLines, customAccounts]);

  const filteredAccountOptions = useMemo(() => {
    const query = clean(accountSearch).toLowerCase();

    if (!query) return accountOptions;

    return accountOptions.filter((option) => {
      return (
        option.code.toLowerCase().includes(query) ||
        option.name.toLowerCase().includes(query) ||
        option.label.toLowerCase().includes(query)
      );
    });
  }, [accountOptions, accountSearch]);

  function upsertTrialBalanceLines(updatedLines: TrialBalanceLine[]) {
    if (!updatedLines.length) return;

    const merged = [...trialBalanceLines];

    for (const updated of updatedLines) {
      const updatedCode = accountCode(updated);
      const updatedId = clean(updated.id);
      const index = merged.findIndex((line) => {
        const sameId = updatedId && clean(line.id) === updatedId;
        const sameCode = updatedCode && accountCode(line) === updatedCode;
        return Boolean(sameId || sameCode);
      });

      if (index >= 0) {
        merged[index] = { ...merged[index], ...updated };
      } else {
        merged.push(updated);
      }
    }

    onTrialBalanceLinesChanged?.(merged);
  }

  function selectedAccountLabel(key: string) {
    if (!key) return "Select account...";
    return accountOptions.find((option) => option.key === key)?.label || key;
  }

  function selectAccountForLine(lineId: string, accountKeyValue: string) {
    updateLine(lineId, { accountKey: accountKeyValue });
    setShowAccountPickerForLineId(null);
    setAccountSearch("");
  }

  async function createAccount() {
    const code = clean(newAccountCode);
    const name = clean(newAccountName);
    if (!code || !name) {
      setAccountError("Add both an account code and account name.");
      return;
    }

    try {
      setCreatingAccount(true);
      setAccountError("");

      let created: TrialBalanceLine;

      if (engagementId) {
        const response = await fetch(`/api/afs/engagements/${engagementId}/journal-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_code: code, account_name: name }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Failed to create account.");
        created = result.line;
      } else {
        created = {
          id: `custom-${code}-${uid()}`,
          account_code: code,
          account_name: name,
          description: name,
          mapping_label: "Unmapped",
        };
      }

      setCustomAccounts((current) => {
        const next = current.some((line) => accountCode(line) === code) ? current : [...current, created];
        try {
          window.localStorage.setItem(customAccountsStorageKey, JSON.stringify(next));
        } catch {
          // localStorage may be unavailable in private mode
        }
        return next;
      });

      upsertTrialBalanceLines([created]);

      if (showAccountPickerForLineId) {
        const createdKey = accountKey(created, trialBalanceLines.length + customAccounts.length);
        selectAccountForLine(showAccountPickerForLineId, createdKey);
      }

      setNewAccountCode("");
      setNewAccountName("");
      setShowCreateAccountPopup(false);
      setAccountSearch("");
    } catch (error: any) {
      setAccountError(error?.message || "Failed to create account.");
    } finally {
      setCreatingAccount(false);
    }
  }

  const debitTotal = lines.reduce((sum, line) => sum + Math.max(0, parseAmount(line.debit)), 0);
  const creditTotal = lines.reduce((sum, line) => sum + Math.max(0, parseAmount(line.credit)), 0);
  const difference = debitTotal - creditTotal;
  const isBalanced = Math.abs(difference) < 0.005;

  function updateLine(id: string, patch: Partial<JournalLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(id: string) {
    setLines((current) => (current.length <= 2 ? current : current.filter((line) => line.id !== id)));
  }

  function clearDraft() {
    setEditingJournalId(null);
    setJournalReference("");
    setJournalPeriod("current_year");
    setDescription("");
    setLines([emptyLine(), emptyLine()]);
  }

  function startEditJournal(journal: PostedJournal) {
    setEditingJournalId(journal.id);
    setJournalReference(journal.reference || "");
    setJournalPeriod(journal.journalPeriod || "current_year");
    setDescription(journal.description);

    setLines(
      journal.lines.map((line) => {
        const copiedAccountKey = String(line.accountKey || "");
        const copiedAccountCode = copiedAccountKey.split("·")[0]?.trim();

        const matchedAccount =
          accountOptions.find((option) => option.key === copiedAccountKey) ||
          accountOptions.find(
            (option) =>
              option.code &&
              copiedAccountCode &&
              option.code.toUpperCase() === copiedAccountCode.toUpperCase(),
          );

        return {
          id: uid(),
          accountKey: matchedAccount?.key || copiedAccountKey,
          debit: line.debit,
          credit: line.credit,
          note: line.note,
        };
      }),
    );
  }

  async function deletePostedJournal(journal: PostedJournal) {
    const confirmed = window.confirm(
      `Delete ${journal.reference || (journal.number ? `AJ${String(journal.number).padStart(3, "0")}` : "this journal")}? This will reverse the journal effect from the trial balance.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/afs/engagements/${engagementId}/journal-post`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journalId: journal.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete journal.");
      }

      const updatedTrialBalanceLines = Array.isArray(result?.trialBalanceLines)
        ? result.trialBalanceLines
        : [];

      savePostedJournals(posted.filter((item) => item.id !== journal.id));

      if (updatedTrialBalanceLines.length) {
        upsertTrialBalanceLines(updatedTrialBalanceLines);
      }

      await loadPostedJournals();
    } catch (error: any) {
      alert(error.message || "Failed to delete journal.");
    }
  }

  async function postJournal() {
    const cleanLines = lines.filter((line) => line.accountKey || parseAmount(line.debit) || parseAmount(line.credit) || clean(line.note));

    if (!clean(description)) {
      alert("Add a journal description first.");
      return;
    }

    if (cleanLines.length < 2) {
      alert("A journal needs at least two lines.");
      return;
    }

    const resolvedLines = cleanLines.map((line) => {
      const option = accountOptions.find((item) => item.key === line.accountKey);
      return {
        ...line,
        accountCode: option?.code || "",
        accountName: option?.name || "",
        accountLabel: option?.label || selectedAccountLabel(line.accountKey),
      };
    });

    const missingAccount = resolvedLines.find((line) => !line.accountCode);
    if (missingAccount) {
      alert("Each journal line must have an account selected.");
      return;
    }

    const debitTotalNext = resolvedLines.reduce((sum, line) => sum + Math.max(0, parseAmount(line.debit)), 0);
    const creditTotalNext = resolvedLines.reduce((sum, line) => sum + Math.max(0, parseAmount(line.credit)), 0);
    const differenceNext = debitTotalNext - creditTotalNext;
    const balancedNext = Math.abs(differenceNext) < 0.005;

    if (!balancedNext) {
      const proceed = window.confirm(
        `This journal is not balanced. Difference: R ${formatMoney(differenceNext)}. Post anyway?`
      );
      if (!proceed) return;
    }

    try {
      let updatedTrialBalanceLines: TrialBalanceLine[] = [];
      let postResult: any = null;

      if (engagementId) {
        const response = await fetch(`/api/afs/engagements/${engagementId}/journal-post`, {
          method: editingJournalId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journalId: editingJournalId,
            journal_reference: clean(journalReference),
            journal_period: journalPeriod,
            description: clean(description),
            lines: resolvedLines.map((line) => ({
              account_code: line.accountCode,
              account_name: line.accountName,
              debit: parseAmount(line.debit),
              credit: parseAmount(line.credit),
              note: clean(line.note),
            })),
          }),
        });

        postResult = await response.json();
        if (!response.ok) {
          throw new Error(postResult?.error || "Failed to post journal to trial balance.");
        }
        updatedTrialBalanceLines = Array.isArray(postResult?.trialBalanceLines)
          ? postResult.trialBalanceLines
          : [];
      }

      const journal: PostedJournal = postResult?.journal
        ? mapDatabaseJournal(postResult.journal)
        : {
            id: uid(),
            number: posted.length + 1,
            reference: clean(journalReference) || `AJ${String(posted.length + 1).padStart(3, "0")}`,
            description: clean(description),
            journalPeriod,
            status: balancedNext ? "Balanced" : "Unbalanced",
            lines: resolvedLines.map((line) => ({
              id: line.id,
              accountKey: line.accountLabel,
              debit: line.debit,
              credit: line.credit,
              note: line.note,
            })),
            debitTotal: debitTotalNext,
            creditTotal: creditTotalNext,
            difference: differenceNext,
            postedAt: new Date().toISOString(),
          };

      savePostedJournals(
        editingJournalId
          ? posted.map((item) => (item.id === editingJournalId ? journal : item))
          : [journal, ...posted],
      );

      if (updatedTrialBalanceLines.length) upsertTrialBalanceLines(updatedTrialBalanceLines);

      clearDraft();

      if (engagementId) {
        await loadPostedJournals();
      }
    } catch (error: any) {
      alert(error?.message || "Failed to post journal.");
    }
  }


  return (
    <div style={styles.wrapper}>
      <section style={styles.headerPanel}>
        <div>
          <div style={styles.eyebrow}>Adjusting journals</div>
          <h2 style={styles.title}>Journal entries</h2>
          <p style={styles.muted}>Each journal line has its own account, debit and credit column. Balanced journals should have a nil difference.</p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={() => window.location.reload()}>Refresh</button>
      </section>

      <div style={styles.grid}>
        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>{editingJournalId ? "Edit journal" : "New journal"}</h3>

          <label style={styles.label}>Journal reference</label>
          <input
            value={journalReference}
            onChange={(event) => setJournalReference(event.target.value.toUpperCase())}
            placeholder="Journal reference"
            style={styles.input}
          />

          <label style={styles.label}>Journal period</label>
          <select
            value={journalPeriod}
            onChange={(event) =>
              setJournalPeriod(event.target.value as JournalPeriod)
            }
            style={styles.input}
          >
            <option value="current_year">Current year</option>
            <option value="prior_year">Prior-year comparative</option>
            <option value="opening_balance">Opening balance adjustment</option>
          </select>

          <p style={styles.periodHelp}>
            Current-year journals affect the active TB. Prior-year journals
            adjust the comparative year. Opening balance journals correct the
            brought-forward opening position.
          </p>

          <label style={styles.label}>Description</label>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Accrual, depreciation, reclassification..."
            style={styles.input}
          />

          <div style={styles.journalTableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thAccount}>Account</th>
                  <th style={styles.thAmount}>Debit</th>
                  <th style={styles.thAmount}>Credit</th>
                  <th style={styles.thNote}>Note</th>
                  <th style={styles.thAction}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.accountPickButton}
                        onClick={() => {
                          setAccountSearch("");
                          setShowAccountPickerForLineId(line.id);
                        }}
                      >
                        {selectedAccountLabel(line.accountKey)}
                      </button>
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.debit}
                        onChange={(event) => updateLine(line.id, { debit: event.target.value, credit: event.target.value ? "" : line.credit })}
                        placeholder="0.00"
                        inputMode="decimal"
                        style={styles.amountInput}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        value={line.credit}
                        onChange={(event) => updateLine(line.id, { credit: event.target.value, debit: event.target.value ? "" : line.debit })}
                        placeholder="0.00"
                        inputMode="decimal"
                        style={styles.amountInput}
                      />
                    </td>
                    <td style={styles.td}>
                      <input value={line.note} onChange={(event) => updateLine(line.id, { note: event.target.value })} placeholder="Optional" style={styles.input} />
                    </td>
                    <td style={styles.tdAction}>
                      <button type="button" style={styles.linkButton} onClick={() => removeLine(line.id)} disabled={lines.length <= 2}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.actionsRow}>
            <button type="button" style={styles.secondaryButton} onClick={addLine}>Add line</button>
            <button type="button" style={styles.secondaryButton} onClick={clearDraft}>Clear</button>
            <button type="button" style={styles.primaryButton} onClick={postJournal}>{editingJournalId ? "Save journal" : "Post journal"}</button>
          </div>

          <div style={isBalanced ? styles.totalBarOk : styles.totalBarBad}>
            <span>Debit: <strong>R {formatMoney(debitTotal)}</strong></span>
            <span>Credit: <strong>R {formatMoney(creditTotal)}</strong></span>
            <span>Difference: <strong>R {formatMoney(difference)}</strong></span>
          </div>
        </section>

        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>Posted journals</h3>
          {loadingPosted ? (
            <p style={styles.muted}>Loading posted journals...</p>
          ) : posted.length === 0 ? (
            <p style={styles.muted}>No posted journals saved in the database yet.</p>
          ) : (
            <div style={styles.postedList}>
              {posted.map((journal) => (
                <article key={journal.id} style={styles.postedCard}>
                  <div style={styles.postedHeader}>
                    <div>
                      <strong>
                        {journal.reference ||
                          `AJ${String(journal.number).padStart(3, "0")}`}{" "}
                        · {journal.description}
                      </strong>
                      <div style={styles.periodBadge}>
                        {journal.journalPeriod === "prior_year"
                          ? "Prior-year comparative"
                          : journal.journalPeriod === "opening_balance"
                            ? "Opening balance adjustment"
                            : "Current year"}
                      </div>
                    </div>
                    <span
                      style={
                        journal.status === "Balanced"
                          ? styles.statusOk
                          : styles.statusBad
                      }
                    >
                      {journal.status}
                    </span>
                  </div>
                  <table style={styles.postedTable}>
                    <tbody>
                      {journal.lines.map((line) => {
                        const label = selectedAccountLabel(line.accountKey);
                        return (
                          <tr key={line.id}>
                            <td style={styles.postedTd}>{label}</td>
                            <td style={styles.postedAmount}>{parseAmount(line.debit) ? formatMoney(parseAmount(line.debit)) : "-"}</td>
                            <td style={styles.postedAmount}>{parseAmount(line.credit) ? formatMoney(parseAmount(line.credit)) : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={styles.postedActions}>
                    <button
                      type="button"
                      style={styles.linkButton}
                      onClick={() => startEditJournal(journal)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      style={styles.dangerButton}
                      onClick={() => deletePostedJournal(journal)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showAccountPickerForLineId ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.accountPickerCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.panelTitle}>Select account</h3>
              <button
                type="button"
                style={styles.linkButton}
                onClick={() => {
                  setShowAccountPickerForLineId(null);
                  setAccountSearch("");
                }}
              >
                Close
              </button>
            </div>
            <div style={styles.accountPickerActions}>
              <input
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder="Search account number or name..."
                style={styles.accountSearchInput}
                autoFocus
              />
              <button type="button" style={styles.primaryButton} onClick={() => setShowCreateAccountPopup(true)}>Add new account</button>
            </div>
            <div style={styles.accountPickerTableWrap}>
              <table style={styles.accountPickerTable}>
                <thead>
                  <tr>
                    <th style={styles.accountCodeTh}>Account no.</th>
                    <th style={styles.accountNameTh}>Account name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccountOptions.map((option) => (
                    <tr
                      key={option.key}
                      style={styles.accountPickerRow}
                      onClick={() => selectAccountForLine(showAccountPickerForLineId, option.key)}
                    >
                      <td style={styles.accountCodeTd}>{option.code}</td>
                      <td style={styles.accountNameTd}>{option.name}</td>
                    </tr>
                  ))}

                  {filteredAccountOptions.length === 0 ? (
                    <tr>
                      <td style={styles.accountNameTd} colSpan={2}>
                        No matching accounts. Use “Add new account” to create it.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateAccountPopup ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.panelTitle}>Add new account</h3>
              <button type="button" style={styles.linkButton} onClick={() => setShowCreateAccountPopup(false)}>Close</button>
            </div>
            <p style={styles.muted}>This creates a zero-balance trial balance line so it can appear in Mapping as unmapped.</p>
            {accountError ? <p style={styles.errorText}>{accountError}</p> : null}
            <div style={styles.newAccountGrid}>
              <input value={newAccountCode} onChange={(event) => setNewAccountCode(event.target.value)} placeholder="Account code" style={styles.input} autoFocus />
              <input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder="Account name" style={styles.input} />
              <button type="button" style={creatingAccount ? styles.primaryButtonDisabled : styles.primaryButton} onClick={createAccount} disabled={creatingAccount}>
                {creatingAccount ? "Creating..." : "Create account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "grid", gap: "10px", color: "#0f172a" },
  headerPanel: { border: "1px solid #cbd5e1", background: "#fff", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: "#2563eb", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em" },
  title: { margin: "2px 0", fontSize: "20px", fontWeight: 900 },
  muted: { margin: 0, color: "#475569", fontSize: "14px", lineHeight: 1.35 },
  periodHelp: { margin: "5px 0 10px", color: "#64748b", fontSize: "12px", lineHeight: 1.35 },
  periodBadge: { marginTop: "4px", display: "inline-block", border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", padding: "2px 6px", fontSize: "11px", fontWeight: 800 },
  errorText: { margin: "0 0 10px", color: "#b91c1c", fontSize: "13px", fontWeight: 800 },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 0.9fr)", gap: "10px" },
  panel: { border: "1px solid #cbd5e1", background: "#fff", padding: "12px" },
  panelTitle: { margin: "0 0 10px", fontSize: "16px", fontWeight: 900 },
  newAccountGrid: { display: "grid", gridTemplateColumns: "120px minmax(180px, 1fr) auto", gap: "6px", alignItems: "center" },
  label: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 850, color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", padding: "7px 8px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" },
  amountInput: { width: "100%", border: "1px solid #cbd5e1", padding: "7px 8px", fontSize: "14px", fontFamily: "inherit", textAlign: "right", boxSizing: "border-box" },
  accountPickButton: { width: "100%", border: "1px solid #cbd5e1", background: "#ffffff", padding: "7px 8px", fontSize: "13px", fontFamily: "inherit", textAlign: "left", cursor: "pointer" },
  journalTableWrap: { marginTop: "12px", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  thAccount: { textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: "7px", width: "34%", fontSize: "13px" },
  thAmount: { textAlign: "right", borderBottom: "1px solid #cbd5e1", padding: "7px", width: "16%", fontSize: "13px" },
  thNote: { textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: "7px", width: "26%", fontSize: "13px" },
  thAction: { borderBottom: "1px solid #cbd5e1", padding: "7px", width: "70px" },
  td: { padding: "6px 4px", borderBottom: "1px solid #eef2f7", verticalAlign: "top" },
  tdAction: { padding: "6px 4px", borderBottom: "1px solid #eef2f7", textAlign: "right" },
  actionsRow: { display: "flex", justifyContent: "flex-end", gap: "7px", marginTop: "10px" },
  primaryButton: { border: "1px solid #0f172a", background: "#0f172a", color: "#fff", padding: "8px 12px", fontSize: "13px", fontWeight: 900, cursor: "pointer" },
  primaryButtonDisabled: { border: "1px solid #93c5fd", background: "#93c5fd", color: "#fff", padding: "8px 12px", fontSize: "13px", fontWeight: 900, cursor: "not-allowed" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", padding: "8px 12px", fontSize: "13px", fontWeight: 850, cursor: "pointer" },
  secondaryButtonSmall: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", padding: "5px 8px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  linkButton: { border: 0, background: "transparent", color: "#2563eb", padding: 0, fontSize: "13px", fontWeight: 850, cursor: "pointer" },
  totalBarOk: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "10px", padding: "10px", border: "1px solid #bbf7d0", background: "#f0fdf4", fontSize: "14px" },
  totalBarBad: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "10px", padding: "10px", border: "1px solid #fed7aa", background: "#fff7ed", fontSize: "14px" },
  postedList: { display: "grid", gap: "8px" },
  postedCard: { border: "1px solid #e2e8f0", padding: "9px", background: "#f8fafc" },
  postedHeader: { display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px", fontSize: "13px" },
  statusOk: { color: "#166534", fontWeight: 900 },
  statusBad: { color: "#b45309", fontWeight: 900 },
  postedTable: { width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "6px" },
  postedActions: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" },
  mutedSmall: { margin: 0, color: "#64748b", fontSize: "12px", lineHeight: 1.3 },
  postedTd: { padding: "3px 0", borderBottom: "1px solid #e2e8f0" },
  postedAmount: { padding: "3px 0", borderBottom: "1px solid #e2e8f0", textAlign: "right", width: "70px" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalCard: { width: "640px", background: "#ffffff", border: "1px solid #cbd5e1", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "18px" },
  accountPickerCard: { width: "760px", maxHeight: "75vh", overflow: "auto", background: "#ffffff", border: "1px solid #cbd5e1", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "18px" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
  accountPickerActions: { display: "flex", justifyContent: "flex-end", marginBottom: "10px" },
  accountPickerTableWrap: { border: "1px solid #e2e8f0" },
  accountPickerRow: { cursor: "pointer" },
  accountPickerTable: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  accountCodeTh: { textAlign: "left", width: "150px", padding: "8px", borderBottom: "1px solid #cbd5e1", background: "#f8fafc" },
  accountNameTh: { textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1", background: "#f8fafc" },
  accountActionTh: { width: "80px", padding: "8px", borderBottom: "1px solid #cbd5e1", background: "#f8fafc" },
  accountCodeTd: { padding: "7px 8px", borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap", fontWeight: 800 },
  accountNameTd: { padding: "7px 8px", borderBottom: "1px solid #eef2f7" },
  accountActionTd: { padding: "7px 8px", borderBottom: "1px solid #eef2f7", textAlign: "right" },
};
