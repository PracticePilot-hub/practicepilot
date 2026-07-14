"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type SubordinationSelection = {
  id?: string;
  trial_balance_line_id?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  creditor_name?: string | null;
  relationship?: string | null;
  balance_current?: number | null;
  balance_prior?: number | null;
  include_in_agreement?: boolean;
  interest_terms?: string | null;
  repayment_terms?: string | null;
  security_terms?: string | null;
  subordination_terms?: string | null;
  company_signatory_person_id?: string | null;
  company_signatory_name?: string | null;
  company_signatory_capacity?: string | null;
  agreement_status?: string | null;
};

type ClientPerson = {
  id: string;
  person_type: string;
  full_name: string;
};

type Props = {
  lines: any[];
  selections: Record<string, SubordinationSelection>;
  people: ClientPerson[];
  savingId: string | null;
  getLineKey: (line: any, index: number) => string;
  getAccountCode: (line: any) => string;
  getAccountName: (line: any) => string;
  getCurrentBalance: (line: any) => number;
  formatMoney: (value: unknown) => string;
  onChange: (
    key: string,
    patch: Partial<SubordinationSelection>
  ) => void;
  onSave: (line: any, index: number) => Promise<void>;
};

export default function SubordinationAgreementEditor({
  lines,
  selections,
  people,
  savingId,
  getLineKey,
  getAccountCode,
  getAccountName,
  getCurrentBalance,
  formatMoney,
  onChange,
  onSave,
}: Props) {
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});

  const signatories = useMemo(
    () =>
      [...(people || [])]
        .filter((person) => String(person.full_name || "").trim())
        .sort((a, b) =>
          String(a.full_name || "").localeCompare(String(b.full_name || ""))
        ),
    [people]
  );

  useEffect(() => {
    const nextSaved: Record<string, boolean> = {};

    lines.forEach((line, index) => {
      const key = getLineKey(line, index);
      if (selections[key]?.id) {
        nextSaved[key] = true;
      }
    });

    setSavedKeys(nextSaved);
  }, [lines, selections, getLineKey]);

  if (!lines.length) {
    return (
      <div style={styles.emptyState}>
        No eligible shareholder, director or member loans were found.
      </div>
    );
  }

  const includedCount = lines.filter((line, index) => {
    const key = getLineKey(line, index);
    return Boolean(selections[key]?.include_in_agreement);
  }).length;

  function changeSelection(
    key: string,
    patch: Partial<SubordinationSelection>
  ) {
    onChange(key, patch);
    setDirtyKeys((current) => ({ ...current, [key]: true }));
    setSavedKeys((current) => ({ ...current, [key]: false }));
  }

  async function saveLine(line: any, index: number) {
    const key = getLineKey(line, index);
    await onSave(line, index);

    setDirtyKeys((current) => ({ ...current, [key]: false }));
    setSavedKeys((current) => ({ ...current, [key]: true }));
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.summaryBar}>
        <div>
          <div style={styles.summaryTitle}>Subordination Agreements</div>
          <div style={styles.summaryText}>
            Select the loans to include, complete the agreement terms and choose
            the person signing for the company.
          </div>
        </div>

        <div style={styles.summaryCount}>
          {includedCount} of {lines.length} selected
        </div>
      </div>

      <div style={styles.list}>
        {lines.map((line, index) => {
          const key = getLineKey(line, index);
          const accountCode = getAccountCode(line);
          const accountName = getAccountName(line);
          const saved = selections[key] || {};
          const isIncluded = Boolean(saved.include_in_agreement);
          const isSaving = savingId === key;
          const isSaved = Boolean(savedKeys[key]) && !dirtyKeys[key];

          return (
            <section
              key={key}
              style={{
                ...styles.card,
                ...(isIncluded ? styles.cardSelected : {}),
              }}
            >
              <div style={styles.cardHeader}>
                <label style={styles.includeLabel}>
                  <input
                    type="checkbox"
                    checked={isIncluded}
                    onChange={(event) =>
                      changeSelection(key, {
                        include_in_agreement: event.target.checked,
                      })
                    }
                    style={styles.checkbox}
                  />
                  <span>
                    <strong style={styles.accountCode}>
                      {accountCode || "No account code"}
                    </strong>
                    <span style={styles.accountName}>
                      {accountName || "Unnamed loan account"}
                    </span>
                  </span>
                </label>

                <div style={styles.balanceBlock}>
                  <span style={styles.balanceLabel}>Balance</span>
                  <strong style={styles.balanceValue}>
                    {formatMoney(getCurrentBalance(line))}
                  </strong>
                </div>
              </div>

              <div style={styles.formGrid}>
                <Field
                  label="Creditor name"
                  value={saved.creditor_name || accountName}
                  placeholder="Full creditor name"
                  onChange={(value) =>
                    changeSelection(key, { creditor_name: value })
                  }
                />

                <Field
                  label="Interest terms"
                  value={saved.interest_terms || ""}
                  placeholder="e.g. Interest free or 10% per annum"
                  onChange={(value) =>
                    changeSelection(key, { interest_terms: value })
                  }
                />

                <Field
                  label="Repayment terms"
                  value={saved.repayment_terms || ""}
                  placeholder="e.g. No fixed repayment terms"
                  onChange={(value) =>
                    changeSelection(key, { repayment_terms: value })
                  }
                />

                <Field
                  label="Security"
                  value={saved.security_terms || ""}
                  placeholder="e.g. Unsecured"
                  onChange={(value) =>
                    changeSelection(key, { security_terms: value })
                  }
                />

                <label style={styles.fieldWide}>
                  <span style={styles.fieldLabel}>
                    Person signing for the company
                  </span>
                  <select
                    value={saved.company_signatory_person_id || ""}
                    onChange={(event) => {
                      const person = signatories.find(
                        (item) => item.id === event.target.value
                      );

                      changeSelection(key, {
                        company_signatory_person_id: person?.id || null,
                        company_signatory_name: person?.full_name || null,
                        company_signatory_capacity:
                          person?.person_type || "Director",
                      });
                    }}
                    style={styles.input}
                  >
                    <option value="">Select a director / authorised person</option>
                    {signatories.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                        {person.person_type ? ` — ${person.person_type}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={styles.actions}>
                <span style={styles.helperText}>
                  {isIncluded
                    ? "This loan will be included in the export."
                    : "This loan will not be included in the export."}
                </span>

                <button
                  type="button"
                  style={{
                    ...styles.saveButton,
                    ...(isSaved ? styles.savedButton : {}),
                    ...(isSaving ? styles.saveButtonDisabled : {}),
                  }}
                  onClick={() => saveLine(line, index)}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : isSaved ? "Saved" : "Save loan"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={styles.input}
      />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: "12px",
  },
  summaryBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
  },
  summaryTitle: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#0f172a",
  },
  summaryText: {
    marginTop: "3px",
    fontSize: "12px",
    lineHeight: 1.4,
    color: "#475569",
  },
  summaryCount: {
    flex: "0 0 auto",
    padding: "5px 9px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    fontSize: "11px",
    fontWeight: 800,
    color: "#334155",
  },
  list: {
    display: "grid",
    gap: "10px",
  },
  card: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
  },
  cardSelected: {
    border: "1px solid #2563eb",
    boxShadow: "inset 4px 0 0 #2563eb",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    padding: "11px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  includeLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    cursor: "pointer",
  },
  checkbox: {
    width: "17px",
    height: "17px",
    flex: "0 0 auto",
  },
  accountCode: {
    display: "block",
    fontSize: "12px",
    color: "#0f172a",
  },
  accountName: {
    display: "block",
    marginTop: "2px",
    fontSize: "12px",
    color: "#475569",
  },
  balanceBlock: {
    textAlign: "right",
    flex: "0 0 auto",
  },
  balanceLabel: {
    display: "block",
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#64748b",
  },
  balanceValue: {
    display: "block",
    marginTop: "2px",
    fontSize: "13px",
    color: "#0f172a",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px 14px",
    padding: "14px",
  },
  field: {
    display: "grid",
    gap: "5px",
  },
  fieldWide: {
    display: "grid",
    gridColumn: "1 / -1",
    gap: "5px",
  },
  fieldLabel: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    minWidth: 0,
    height: "36px",
    border: "1px solid #94a3b8",
    borderRadius: "3px",
    padding: "7px 9px",
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "inherit",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    padding: "10px 14px",
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  helperText: {
    fontSize: "11px",
    color: "#64748b",
  },
  saveButton: {
    minWidth: "92px",
    border: "1px solid #0f172a",
    borderRadius: "3px",
    padding: "7px 13px",
    background: "#0f172a",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  savedButton: {
    borderColor: "#15803d",
    background: "#15803d",
  },
  saveButtonDisabled: {
    cursor: "wait",
    opacity: 0.65,
  },
  emptyState: {
    border: "1px solid #cbd5e1",
    padding: "18px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "12px",
  },
};
