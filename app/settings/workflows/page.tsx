"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PP, ppPage, ppPanel, ppPrimaryButton, ppSecondaryButton, ppInput } from "../../components/ppTheme";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type StepRow = {
  id?: string;
  item_order: number;
  label: string;
  item_type: "manual" | "dependency" | "review" | "submission";
  is_active: boolean;
  is_required: boolean;
  allow_not_applicable: boolean;
  dependency_service_code: string | null;
  dependency_rule: string | null;
};

type ServiceWorkflow = {
  service_name: string;
  service_group: string | null;
  frequency: string | null;
  source: "system" | "practice";
  is_enabled: boolean;
  steps: StepRow[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default function WorkflowSettingsPage() {
  const [services, setServices] = useState<ServiceWorkflow[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [draft, setDraft] = useState<ServiceWorkflow | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function authFetch(url: string, init: RequestInit = {}) {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("You are not signed in.");

    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.headers || {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const text = await response.text();
    let json: any = {};

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`PracticePilot received an invalid response (${response.status}).`);
      }
    }

    if (!response.ok) throw new Error(json.error || "Request failed.");
    return json;
  }

  async function load(preferredName?: string) {
    try {
      setLoading(true);
      setMessage("");

      const result = await authFetch("/api/settings/workflows");
      const loaded = (result.services || []) as ServiceWorkflow[];

      setServices(loaded);
      setCanManage(Boolean(result.can_manage));

      const nextName =
        preferredName ||
        selectedName ||
        loaded.find((item) => item.steps.length > 0)?.service_name ||
        loaded[0]?.service_name ||
        "";

      setSelectedName(nextName);
      setDraft(clone(loaded.find((item) => item.service_name === nextName) || null));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load workflow settings.");
    } finally {
      setLoading(false);
    }
  }

  function chooseService(name: string) {
    setSelectedName(name);
    setMessage("");
    setDraft(clone(services.find((item) => item.service_name === name) || null));
  }

  function patchStep(index: number, patch: Partial<StepRow>) {
    setDraft((current) => {
      if (!current) return current;
      const next = clone(current);
      next.steps[index] = { ...next.steps[index], ...patch };
      return next;
    });
  }

  function moveStep(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.steps.length) return current;

      const next = clone(current);
      const [row] = next.steps.splice(index, 1);
      next.steps.splice(target, 0, row);
      next.steps = next.steps.map((step, i) => ({ ...step, item_order: i + 1 }));
      return next;
    });
  }

  function addStep() {
    setDraft((current) => {
      if (!current) return current;
      const next = clone(current);
      next.steps.push({
        item_order: next.steps.length + 1,
        label: "New checklist step",
        item_type: "manual",
        is_active: true,
        is_required: true,
        allow_not_applicable: true,
        dependency_service_code: null,
        dependency_rule: null,
      });
      return next;
    });
  }

  function removeStep(index: number) {
    setDraft((current) => {
      if (!current) return current;
      const next = clone(current);
      next.steps.splice(index, 1);
      next.steps = next.steps.map((step, i) => ({ ...step, item_order: i + 1 }));
      return next;
    });
  }

  async function save() {
    if (!draft) return;

    try {
      setSaving(true);
      setMessage("");

      await authFetch("/api/settings/workflows", {
        method: "PATCH",
        body: JSON.stringify({
          action: "save",
          service_name: draft.service_name,
          is_enabled: draft.is_enabled,
          steps: draft.steps,
        }),
      });

      setMessage("Practice workflow saved. New work items will use this template.");
      await load(draft.service_name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save workflow.");
    } finally {
      setSaving(false);
    }
  }

  async function resetToPP() {
    if (!draft) return;

    try {
      setSaving(true);
      setMessage("");

      await authFetch("/api/settings/workflows", {
        method: "PATCH",
        body: JSON.stringify({
          action: "reset",
          service_name: draft.service_name,
        }),
      });

      setMessage("Reset to PracticePilot standard.");
      await load(draft.service_name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset workflow.");
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceWorkflow[]>();

    for (const service of services) {
      const group = service.service_group || "Other";
      const current = map.get(group) || [];
      current.push(service);
      map.set(group, current);
    }

    return Array.from(map.entries());
  }, [services]);

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.kicker}>CRM Settings</div>
          <h1 style={styles.title}>Workflows & Checklists</h1>
          <p style={styles.subtitle}>
            Decide how much control your practice wants for each service. PracticePilot standards
            are available out of the box; your practice can simplify or strengthen them.
          </p>
        </div>

        <Link href="/settings" style={styles.backButton}>
          Back to Settings
        </Link>
      </section>

      <div style={styles.infoStrip}>
        <strong>Important:</strong>
        <span>
          Changes apply to new work items. Existing work keeps the checklist it was created with,
          so a live job never changes underneath the person working on it.
        </span>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      {loading ? (
        <div style={styles.loading}>Loading practice workflows...</div>
      ) : (
        <section style={styles.workspace}>
          <aside style={styles.serviceRail}>
            <div style={styles.railHeader}>
              <strong>Services</strong>
              <span>{services.length}</span>
            </div>

            {grouped.map(([group, rows]) => (
              <div key={group}>
                <div style={styles.groupLabel}>{group}</div>

                {rows.map((service) => {
                  const selected = service.service_name === selectedName;

                  return (
                    <button
                      key={service.service_name}
                      type="button"
                      onClick={() => chooseService(service.service_name)}
                      style={{
                        ...styles.serviceButton,
                        ...(selected ? styles.serviceButtonActive : {}),
                      }}
                    >
                      <span>{service.service_name}</span>
                      <small>
                        {service.source === "practice" ? "Practice" : "PP standard"}
                      </small>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          <section style={styles.editor}>
            {!draft ? (
              <div style={styles.empty}>Choose a service.</div>
            ) : (
              <>
                <div style={styles.editorHeader}>
                  <div>
                    <div style={styles.serviceGroup}>
                      {draft.service_group || "Service"} · {draft.frequency || "Flexible"}
                    </div>
                    <h2 style={styles.serviceTitle}>{draft.service_name}</h2>
                    <div style={styles.sourceLine}>
                      Current source:{" "}
                      <strong>
                        {draft.source === "practice"
                          ? "Your practice template"
                          : "PracticePilot standard"}
                      </strong>
                    </div>
                  </div>

                  <label style={styles.workflowToggle}>
                    <input
                      type="checkbox"
                      checked={draft.is_enabled}
                      disabled={!canManage}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, is_enabled: event.target.checked }
                            : current
                        )
                      }
                    />
                    Use checklist for this service
                  </label>
                </div>

                <div style={styles.columnHeader}>
                  <span>Step</span>
                  <span>Type</span>
                  <span>Required</span>
                  <span>N/A allowed</span>
                  <span>Active</span>
                  <span>Order</span>
                  <span />
                </div>

                {draft.steps.length ? (
                  draft.steps.map((step, index) => (
                    <div key={`${step.id || "new"}-${index}`} style={styles.stepRow}>
                      <div>
                        <input
                          value={step.label}
                          disabled={!canManage}
                          onChange={(event) =>
                            patchStep(index, { label: event.target.value })
                          }
                          style={styles.textInput}
                        />

                        {step.item_type === "dependency" ? (
                          <div style={styles.dependencyRow}>
                            <span>Depends on</span>
                            <select
                              value={step.dependency_service_code || ""}
                              disabled={!canManage}
                              onChange={(event) =>
                                patchStep(index, {
                                  dependency_service_code: event.target.value || null,
                                })
                              }
                              style={styles.compactSelect}
                            >
                              <option value="">Choose service</option>
                              {services
                                .filter((service) => service.service_name !== draft.service_name)
                                .map((service) => (
                                  <option
                                    key={service.service_name}
                                    value={service.service_name}
                                  >
                                    {service.service_name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}
                      </div>

                      <select
                        value={step.item_type}
                        disabled={!canManage}
                        onChange={(event) =>
                          patchStep(index, {
                            item_type: event.target.value as StepRow["item_type"],
                            dependency_service_code:
                              event.target.value === "dependency"
                                ? step.dependency_service_code
                                : null,
                            dependency_rule:
                              event.target.value === "dependency"
                                ? step.dependency_rule ||
                                  "covered_period_all_completed"
                                : null,
                          })
                        }
                        style={styles.select}
                      >
                        <option value="manual">Manual</option>
                        <option value="dependency">Linked</option>
                        <option value="review">Review</option>
                        <option value="submission">Submission</option>
                      </select>

                      <label style={styles.checkCell}>
                        <input
                          type="checkbox"
                          checked={step.is_required}
                          disabled={!canManage}
                          onChange={(event) =>
                            patchStep(index, { is_required: event.target.checked })
                          }
                        />
                      </label>

                      <label style={styles.checkCell}>
                        <input
                          type="checkbox"
                          checked={step.allow_not_applicable}
                          disabled={!canManage || step.item_type === "dependency"}
                          onChange={(event) =>
                            patchStep(index, {
                              allow_not_applicable: event.target.checked,
                            })
                          }
                        />
                      </label>

                      <label style={styles.checkCell}>
                        <input
                          type="checkbox"
                          checked={step.is_active}
                          disabled={!canManage}
                          onChange={(event) =>
                            patchStep(index, { is_active: event.target.checked })
                          }
                        />
                      </label>

                      <div style={styles.orderButtons}>
                        <button
                          type="button"
                          disabled={!canManage || index === 0}
                          onClick={() => moveStep(index, -1)}
                          style={styles.iconButton}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={!canManage || index === draft.steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                          style={styles.iconButton}
                        >
                          ↓
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => removeStep(index)}
                        style={styles.removeButton}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={styles.empty}>
                    No checklist steps. This service can run as a simple work item.
                  </div>
                )}

                <div style={styles.editorFooter}>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={addStep}
                    style={styles.secondaryAction}
                  >
                    + Add step
                  </button>

                  <div style={styles.footerActions}>
                    <button
                      type="button"
                      disabled={!canManage || saving}
                      onClick={resetToPP}
                      style={styles.secondaryAction}
                    >
                      Use PP standard
                    </button>

                    <button
                      type="button"
                      disabled={!canManage || saving}
                      onClick={save}
                      style={styles.primaryAction}
                    >
                      {saving ? "Saving..." : "Save practice workflow"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    ...ppPage,
    padding: "22px",
  },
  header: {
    ...ppPanel,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    padding: "16px 16px 15px",
    marginBottom: 10,
    borderTop: `3px solid ${PP.color.navy900}`,
  },
  kicker: {
    color: PP.color.blue600,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 27,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.025em",
  },
  subtitle: {
    margin: "7px 0 0",
    maxWidth: 820,
    color: PP.color.textMuted,
    fontSize: 12,
    lineHeight: 1.45,
  },
  backButton: {
    ...ppSecondaryButton,
  },
  infoStrip: {
    display: "flex",
    gap: 8,
    padding: "9px 11px",
    border: `1px solid ${PP.color.border}`,
    borderLeft: `4px solid ${PP.color.blue600}`,
    background: PP.color.blue050,
    color: PP.color.textMuted,
    fontSize: 10,
    marginBottom: 10,
  },
  message: {
    ...ppPanel,
    padding: "9px 11px",
    fontSize: 10,
    marginBottom: 10,
  },
  loading: {
    ...ppPanel,
    padding: 22,
    color: PP.color.textMuted,
    fontSize: 11,
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
  },
  serviceRail: {
    background: PP.color.navy800,
    color: "#ffffff",
    border: `1px solid ${PP.color.navy800}`,
    minHeight: 600,
  },
  railHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 13px",
    borderBottom: "1px solid rgba(255,255,255,0.14)",
    fontSize: 11,
  },
  groupLabel: {
    padding: "10px 13px 5px",
    color: "#A8BBCB",
    fontSize: 8,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  serviceButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    border: 0,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    background: "transparent",
    color: "#DCE7F0",
    padding: "8px 13px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 10,
  },
  serviceButtonActive: {
    background: PP.color.blue600,
    color: "#FFFFFF",
  },
  editor: {
    ...ppPanel,
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    padding: "14px 15px",
    borderBottom: `1px solid ${PP.color.border}`,
  },
  serviceGroup: {
    color: PP.color.textMuted,
    fontSize: 9,
    fontWeight: 800,
  },
  serviceTitle: {
    margin: "3px 0",
    fontSize: 19,
    fontWeight: 900,
  },
  sourceLine: {
    color: PP.color.textSoft,
    fontSize: 9,
  },
  workflowToggle: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10,
    fontWeight: 850,
  },
  columnHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 120px 70px 85px 60px 68px 70px",
    gap: 8,
    padding: "8px 11px",
    background: PP.color.navy900,
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.02em",
  },
  stepRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 120px 70px 85px 60px 68px 70px",
    gap: 8,
    alignItems: "center",
    padding: "8px 11px",
    borderTop: `1px solid ${PP.color.divider}`,
  },
  textInput: {
    ...ppInput,
    width: "100%",
    boxSizing: "border-box",
    padding: "0 9px",
  },
  select: {
    ...ppInput,
    width: "100%",
    fontSize: 10,
  },
  dependencyRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginTop: 5,
    color: PP.color.textMuted,
    fontSize: 8,
  },
  compactSelect: {
    ...ppInput,
    minHeight: 27,
    background: PP.color.panelSoft,
    fontSize: 9,
  },
  checkCell: {
    display: "flex",
    justifyContent: "center",
  },
  orderButtons: {
    display: "flex",
    justifyContent: "center",
    gap: 3,
  },
  iconButton: {
    width: 27,
    height: 27,
    border: `1px solid ${PP.color.borderStrong}`,
    background: PP.color.panel,
    color: PP.color.text,
    cursor: "pointer",
  },
  removeButton: {
    minHeight: 28,
    border: `1px solid #E7B8B2`,
    background: PP.color.red050,
    color: PP.color.red700,
    fontSize: 9,
    fontWeight: 850,
    cursor: "pointer",
  },
  empty: {
    padding: 22,
    color: PP.color.textSoft,
    fontSize: 10,
  },
  editorFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: 11,
    borderTop: `1px solid ${PP.color.border}`,
    background: PP.color.panelSoft,
  },
  footerActions: {
    display: "flex",
    gap: 7,
  },
  secondaryAction: {
    ...ppSecondaryButton,
    minHeight: 32,
    fontSize: 10,
  },
  primaryAction: {
    ...ppPrimaryButton,
    minHeight: 32,
    fontSize: 10,
  },
};
