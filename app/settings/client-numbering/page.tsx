"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type NumberSeries = {
  id: string;
  series_name: string;
  prefix: string;
  separator: string;
  number_width: number;
  next_number: number;
  auto_assign: boolean;
  is_active: boolean;
};

type TypeMapping = {
  id: string;
  legal_type: string;
  series_id: string;
};

function preview(series: NumberSeries) {
  return `${series.prefix}${series.separator}${String(series.next_number).padStart(
    series.number_width,
    "0"
  )}`;
}

export default function ClientNumberingSettingsPage() {
  const [series, setSeries] = useState<NumberSeries[]>([]);
  const [mappings, setMappings] = useState<TypeMapping[]>([]);
  const [legalTypes, setLegalTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [seriesName, setSeriesName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [separator, setSeparator] = useState("");
  const [numberWidth, setNumberWidth] = useState(4);
  const [nextNumber, setNextNumber] = useState(1);
  const [autoAssign, setAutoAssign] = useState(true);

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function apiFetch(init?: RequestInit) {
    const token = await getToken();

    return fetch("/api/settings/client-numbering", {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  }

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch();
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load client numbering.");
      }

      setSeries(data.series || []);
      setMappings(data.mappings || []);
      setLegalTypes(data.legalTypes || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load client numbering."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const draftPreview = useMemo(
    () =>
      `${prefix}${separator}${String(nextNumber || 1).padStart(
        numberWidth || 1,
        "0"
      )}`,
    [prefix, separator, nextNumber, numberWidth]
  );

  async function post(payload: Record<string, unknown>) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await apiFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not save client numbering.");
      }

      await load();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save client numbering."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createSeries() {
    const ok = await post({
      action: "create_series",
      seriesName,
      prefix,
      separator,
      numberWidth,
      nextNumber,
      autoAssign,
    });

    if (!ok) return;

    setSeriesName("");
    setPrefix("");
    setSeparator("");
    setNumberWidth(4);
    setNextNumber(1);
    setAutoAssign(true);
    setMessage("Numbering series created.");
  }

  async function updateSeries(row: NumberSeries) {
    const ok = await post({
      action: "update_series",
      seriesId: row.id,
      seriesName: row.series_name,
      prefix: row.prefix,
      separator: row.separator,
      numberWidth: row.number_width,
      nextNumber: row.next_number,
      autoAssign: row.auto_assign,
    });

    if (ok) setMessage("Numbering series updated.");
  }

  async function saveMapping(legalType: string, seriesId: string) {
    const ok = await post({
      action: "save_mapping",
      legalType,
      seriesId,
    });

    if (ok) setMessage("Type mapping updated.");
  }

  function updateLocalSeries(
    id: string,
    patch: Partial<NumberSeries>
  ) {
    setSeries((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function mappedSeriesId(legalType: string) {
    return (
      mappings.find((mapping) => mapping.legal_type === legalType)?.series_id ||
      ""
    );
  }

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h1 style={title}>Client Numbering</h1>
          <div style={subtitle}>
            Define how this practice assigns internal client codes. Numbering is
            allocated only when a CRM record becomes a Flying Client.
          </div>
        </div>
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}
      {message ? <div style={messageBox}>{message}</div> : null}

      <section style={panel}>
        <div style={panelHeading}>
          <div>
            <strong style={panelTitle}>Numbering series</strong>
            <div style={panelSubtitle}>
              Create one or more independent sequences. Legal types can share a
              series or each use their own.
            </div>
          </div>
        </div>

        <div style={newSeriesRow}>
          <label style={field}>
            <span style={label}>Series name</span>
            <input
              style={input}
              value={seriesName}
              onChange={(event) => setSeriesName(event.target.value)}
              placeholder="e.g. Entities"
            />
          </label>

          <label style={field}>
            <span style={label}>Prefix</span>
            <input
              style={input}
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="1 or A or PTY"
            />
          </label>

          <label style={field}>
            <span style={label}>Separator</span>
            <input
              style={input}
              value={separator}
              onChange={(event) => setSeparator(event.target.value)}
              placeholder="none, -, /"
            />
          </label>

          <label style={field}>
            <span style={label}>Digits</span>
            <input
              type="number"
              min={1}
              max={12}
              style={input}
              value={numberWidth}
              onChange={(event) => setNumberWidth(Number(event.target.value))}
            />
          </label>

          <label style={field}>
            <span style={label}>Next number</span>
            <input
              type="number"
              min={1}
              style={input}
              value={nextNumber}
              onChange={(event) => setNextNumber(Number(event.target.value))}
            />
          </label>

          <div style={previewCell}>
            <span style={label}>Preview</span>
            <strong>{draftPreview}</strong>
          </div>

          <label style={checkboxField}>
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(event) => setAutoAssign(event.target.checked)}
            />
            Auto assign
          </label>

          <button
            type="button"
            onClick={createSeries}
            disabled={saving || !seriesName.trim()}
            style={primaryButton}
          >
            Add series
          </button>
        </div>

        <div style={seriesHeader}>
          <span>Series</span>
          <span>Prefix</span>
          <span>Separator</span>
          <span>Digits</span>
          <span>Next number</span>
          <span>Preview</span>
          <span>Auto</span>
          <span />
        </div>

        {loading ? (
          <div style={empty}>Loading...</div>
        ) : series.length ? (
          series.map((row) => (
            <div key={row.id} style={seriesRow}>
              <input
                style={tableInput}
                value={row.series_name}
                onChange={(event) =>
                  updateLocalSeries(row.id, {
                    series_name: event.target.value,
                  })
                }
              />

              <input
                style={tableInput}
                value={row.prefix}
                onChange={(event) =>
                  updateLocalSeries(row.id, { prefix: event.target.value })
                }
              />

              <input
                style={tableInput}
                value={row.separator}
                onChange={(event) =>
                  updateLocalSeries(row.id, { separator: event.target.value })
                }
              />

              <input
                type="number"
                min={1}
                max={12}
                style={tableInput}
                value={row.number_width}
                onChange={(event) =>
                  updateLocalSeries(row.id, {
                    number_width: Number(event.target.value),
                  })
                }
              />

              <input
                type="number"
                min={1}
                style={tableInput}
                value={row.next_number}
                onChange={(event) =>
                  updateLocalSeries(row.id, {
                    next_number: Number(event.target.value),
                  })
                }
              />

              <strong style={previewValue}>{preview(row)}</strong>

              <label style={smallCheck}>
                <input
                  type="checkbox"
                  checked={row.auto_assign}
                  onChange={(event) =>
                    updateLocalSeries(row.id, {
                      auto_assign: event.target.checked,
                    })
                  }
                />
              </label>

              <div style={rowActions}>
                <button
                  type="button"
                  style={textButton}
                  onClick={() => updateSeries(row)}
                >
                  Save
                </button>

                <button
                  type="button"
                  style={dangerButton}
                  onClick={() =>
                    post({
                      action: "archive_series",
                      seriesId: row.id,
                    })
                  }
                >
                  Archive
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={empty}>
            No numbering series yet. Create the practice's first sequence above.
          </div>
        )}
      </section>

      <section style={panel}>
        <div style={panelHeading}>
          <div>
            <strong style={panelTitle}>Legal type mapping</strong>
            <div style={panelSubtitle}>
              Choose which numbering series each legal type uses. More than one
              legal type may use the same series.
            </div>
          </div>
        </div>

        <div style={mappingHeader}>
          <span>Legal / entity type</span>
          <span>Numbering series</span>
          <span>Example next code</span>
        </div>

        {legalTypes.map((legalType) => {
          const seriesId = mappedSeriesId(legalType);
          const mapped = series.find((row) => row.id === seriesId) || null;

          return (
            <div key={legalType} style={mappingRow}>
              <strong>{legalType}</strong>

              <select
                style={input}
                value={seriesId}
                onChange={(event) =>
                  saveMapping(legalType, event.target.value)
                }
              >
                <option value="">No automatic numbering</option>
                {series.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.series_name}
                  </option>
                ))}
              </select>

              <span style={mappingPreview}>
                {mapped ? preview(mapped) : "—"}
              </span>
            </div>
          );
        })}
      </section>

      <div style={note}>
        <strong>Allocation rule:</strong> In Airspace and On Radar records do
        not consume a client code. PracticePilot will allocate the next code
        when the record becomes a Flying Client. Former Clients keep their
        existing code.
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "18px 20px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const header: React.CSSProperties = {
  minHeight: "54px",
  display: "flex",
  alignItems: "center",
  marginBottom: "8px",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "10px",
};

const panel: React.CSSProperties = {
  marginBottom: "8px",
  border: "1px solid #d7dfe6",
  background: "#ffffff",
};

const panelHeading: React.CSSProperties = {
  minHeight: "46px",
  padding: "7px 10px",
  display: "flex",
  alignItems: "center",
  borderBottom: "1px solid #dfe5ea",
};

const panelTitle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
};

const panelSubtitle: React.CSSProperties = {
  marginTop: "2px",
  color: "#74808a",
  fontSize: "9px",
};

const newSeriesRow: React.CSSProperties = {
  padding: "8px 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(150px, 1.3fr) 100px 90px 70px 100px 100px 90px 80px",
  gap: "7px",
  alignItems: "end",
  background: "#f8fafb",
  borderBottom: "1px solid #dfe5ea",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "3px",
};

const label: React.CSSProperties = {
  color: "#607180",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: "30px",
  padding: "4px 7px",
  boxSizing: "border-box",
  border: "1px solid #cfd8df",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const previewCell: React.CSSProperties = {
  minHeight: "30px",
  display: "grid",
  alignContent: "center",
  gap: "1px",
};

const previewValue: React.CSSProperties = {
  fontSize: "10px",
};

const checkboxField: React.CSSProperties = {
  minHeight: "30px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "9px",
  fontWeight: 800,
};

const primaryButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const seriesHeader: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "1.3fr 100px 90px 70px 100px 100px 60px 110px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 850,
};

const seriesRow: React.CSSProperties = {
  minHeight: "42px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns: "1.3fr 100px 90px 70px 100px 100px 60px 110px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e7ecef",
  fontSize: "9px",
};

const tableInput: React.CSSProperties = {
  ...input,
  minHeight: "28px",
};

const smallCheck: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const rowActions: React.CSSProperties = {
  display: "flex",
  gap: "7px",
};

const textButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#1856a0",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  ...textButton,
  color: "#9f2d2d",
};

const mappingHeader: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "1.1fr 1.2fr 180px",
  gap: "8px",
  alignItems: "center",
  background: "#f5f7f9",
  borderBottom: "1px solid #dfe5ea",
  color: "#607180",
  fontSize: "8px",
  fontWeight: 850,
};

const mappingRow: React.CSSProperties = {
  minHeight: "42px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns: "1.1fr 1.2fr 180px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e7ecef",
  fontSize: "9px",
};

const mappingPreview: React.CSSProperties = {
  color: "#1856a0",
  fontWeight: 900,
};

const note: React.CSSProperties = {
  padding: "9px 10px",
  borderLeft: "3px solid #1856a0",
  background: "#f3f7fb",
  color: "#526273",
  fontSize: "9px",
  lineHeight: 1.45,
};

const errorBox: React.CSSProperties = {
  marginBottom: "8px",
  padding: "8px 10px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontSize: "9px",
  fontWeight: 800,
};

const messageBox: React.CSSProperties = {
  marginBottom: "8px",
  padding: "8px 10px",
  border: "1px solid #b9d6c1",
  background: "#eef8f1",
  color: "#31734b",
  fontSize: "9px",
  fontWeight: 800,
};

const empty: React.CSSProperties = {
  padding: "16px 10px",
  color: "#74808a",
  fontSize: "9px",
};
