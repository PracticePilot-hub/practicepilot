"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Organisation = {
  id: string;
  name: string;
  status: string | null;
  access_enabled: boolean | null;
};

type Licence = {
  id?: string;
  organisation_id: string;
  module_key: string;
  licence_limit: number;
  is_enabled: boolean;
};

const modules = [
  ["crm", "CRM"],
  ["accounting", "Accounting"],
  ["afs", "Financial Statements"],
  ["assets", "Assets"],
  ["secretarial", "Secretarial"],
  ["projects", "Projects"],
  ["management_reports", "Management Reports"],
  ["paia", "PAIA Manuals"],
  ["proposals", "Proposals"],
] as const;

export default function PracticeLicencesPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [licences, setLicences] = useState<Licence[]>([]);
  const [organisationId, setOrganisationId] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function authHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("Not authenticated.");

    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/practice-licences", {
        headers,
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load licences.");

      setOrganisations(data.organisations || []);
      setLicences(data.licences || []);
      setOrganisationId((current) => current || data.organisations?.[0]?.id || "");
    } catch (err: any) {
      setError(err?.message || "Could not load licences.");
    } finally {
      setLoading(false);
    }
  }

  const selectedOrganisation = useMemo(
    () => organisations.find((item) => item.id === organisationId) || null,
    [organisations, organisationId]
  );

  function currentLicence(moduleKey: string): Licence {
    return (
      licences.find(
        (item) =>
          item.organisation_id === organisationId &&
          item.module_key === moduleKey
      ) || {
        organisation_id: organisationId,
        module_key: moduleKey,
        licence_limit: 0,
        is_enabled: false,
      }
    );
  }

  function updateLocal(moduleKey: string, patch: Partial<Licence>) {
    setLicences((current) => {
      const index = current.findIndex(
        (item) =>
          item.organisation_id === organisationId &&
          item.module_key === moduleKey
      );

      if (index === -1) {
        return [
          ...current,
          {
            organisation_id: organisationId,
            module_key: moduleKey,
            licence_limit: 0,
            is_enabled: false,
            ...patch,
          },
        ];
      }

      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      );
    });
  }

  async function saveLicence(moduleKey: string) {
    const licence = currentLicence(moduleKey);
    const key = `${organisationId}:${moduleKey}`;
    setSavingKey(key);
    setError("");
    setNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/practice-licences", {
        method: "POST",
        headers,
        body: JSON.stringify({
          organisationId,
          moduleKey,
          licenceLimit: Number(licence.licence_limit || 0),
          isEnabled: licence.is_enabled,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save licence.");

      setLicences((current) => [
        ...current.filter(
          (item) =>
            !(
              item.organisation_id === organisationId &&
              item.module_key === moduleKey
            )
        ),
        data.licence,
      ]);

      setNotice(`${modules.find((item) => item[0] === moduleKey)?.[1] || moduleKey} licence saved.`);
    } catch (err: any) {
      setError(err?.message || "Could not save licence.");
    } finally {
      setSavingKey("");
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading practice licences...</main>;
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.kicker}>PracticePilot Admin</div>
          <h1 style={styles.title}>Practice Licences</h1>
          <p style={styles.subtitle}>
            Set the module licence limits purchased by each practice.
          </p>
        </div>

        <Link href="/admin/clients" style={styles.secondaryButton}>
          Back to Admin Clients
        </Link>
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Practice</h2>
            <p style={styles.panelSubtitle}>Choose the practice to configure.</p>
          </div>

          <select
            style={styles.practiceSelect}
            value={organisationId}
            onChange={(event) => setOrganisationId(event.target.value)}
          >
            {organisations.map((organisation) => (
              <option key={organisation.id} value={organisation.id}>
                {organisation.name}
              </option>
            ))}
          </select>
        </div>

        {selectedOrganisation ? (
          <div style={styles.practiceMeta}>
            <strong>{selectedOrganisation.name}</strong>
            <span>
              {selectedOrganisation.access_enabled === false ? "Access blocked" : "Active"}
            </span>
          </div>
        ) : null}
      </section>

      <section style={styles.panel}>
        <div style={styles.tableHeader}>
          <span>Module</span>
          <span>Enabled</span>
          <span>Licence limit</span>
          <span />
        </div>

        {modules.map(([moduleKey, label]) => {
          const licence = currentLicence(moduleKey);
          const key = `${organisationId}:${moduleKey}`;

          return (
            <div key={moduleKey} style={styles.tableRow}>
              <strong style={styles.moduleName}>{label}</strong>

              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={licence.is_enabled}
                  onChange={(event) =>
                    updateLocal(moduleKey, { is_enabled: event.target.checked })
                  }
                />
                {licence.is_enabled ? "Enabled" : "Disabled"}
              </label>

              <input
                type="number"
                min="0"
                step="1"
                style={styles.limitInput}
                value={licence.licence_limit}
                onChange={(event) =>
                  updateLocal(moduleKey, {
                    licence_limit: Math.max(0, Number(event.target.value || 0)),
                  })
                }
              />

              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => saveLicence(moduleKey)}
                disabled={!organisationId || savingKey === key}
              >
                {savingKey === key ? "Saving..." : "Save"}
              </button>
            </div>
          );
        })}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px",
    background: "#eef2f5",
    color: "#10233a",
  },
  header: {
    minHeight: "104px",
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    background: "#ffffff",
    border: "1px solid #d7dfde",
    marginBottom: "10px",
  },
  kicker: { color: "#5d6f7b", fontSize: "11px", fontWeight: 850 },
  title: { margin: "4px 0 0", fontSize: "24px", fontWeight: 900 },
  subtitle: { margin: "5px 0 0", color: "#6b7882", fontSize: "11px" },
  panel: {
    background: "#ffffff",
    border: "1px solid #d7dfde",
    marginBottom: "10px",
  },
  panelHeader: {
    minHeight: "66px",
    padding: "11px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    borderBottom: "1px solid #e5eae9",
  },
  panelTitle: { margin: 0, fontSize: "14px", fontWeight: 900 },
  panelSubtitle: { margin: "3px 0 0", color: "#74808a", fontSize: "9px" },
  practiceSelect: {
    minWidth: "320px",
    minHeight: "36px",
    padding: "0 9px",
    border: "1px solid #cfd8df",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "10px",
  },
  practiceMeta: {
    minHeight: "48px",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#52616b",
    fontSize: "10px",
  },
  tableHeader: {
    minHeight: "36px",
    padding: "0 14px",
    display: "grid",
    gridTemplateColumns: "minmax(240px,1fr) 160px 140px 80px",
    gap: "12px",
    alignItems: "center",
    background: "#10233a",
    color: "#ffffff",
    fontSize: "9px",
    fontWeight: 850,
  },
  tableRow: {
    minHeight: "56px",
    padding: "8px 14px",
    display: "grid",
    gridTemplateColumns: "minmax(240px,1fr) 160px 140px 80px",
    gap: "12px",
    alignItems: "center",
    borderBottom: "1px solid #e7eceb",
  },
  moduleName: { fontSize: "11px", fontWeight: 900 },
  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "10px",
    fontWeight: 800,
  },
  limitInput: {
    width: "100px",
    minHeight: "34px",
    padding: "0 8px",
    border: "1px solid #cfd8df",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "10px",
  },
  primaryButton: {
    minHeight: "34px",
    padding: "0 11px",
    border: "1px solid #10233a",
    background: "#10233a",
    color: "#ffffff",
    fontSize: "9px",
    fontWeight: 850,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: "36px",
    padding: "0 13px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cfd8df",
    background: "#ffffff",
    color: "#10233a",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 850,
  },
  error: {
    marginBottom: "10px",
    padding: "10px 12px",
    border: "1px solid #efc2ba",
    background: "#fff3f1",
    color: "#9c3527",
    fontSize: "11px",
  },
  notice: {
    marginBottom: "10px",
    padding: "10px 12px",
    border: "1px solid #b7d7c1",
    background: "#edf7f0",
    color: "#2f7047",
    fontSize: "11px",
  },
};
