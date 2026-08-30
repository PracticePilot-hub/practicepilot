"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

type ServiceRow = {
  id: string;
  service_name: string;
  service_group: string | null;
  frequency: string | null;
  colour_hex: string | null;
  text_colour_hex: string | null;
  is_active: boolean | null;
};

const DEFAULT_SERVICE_COLOURS: Record<string, { background: string; text: string }> = {
  accounting: { background: "#0F98B2", text: "#FFFFFF" },
  "accounting system hosting": { background: "#1268B3", text: "#FFFFFF" },
  "ad hoc": { background: "#1268B3", text: "#FFFFFF" },
  admin: { background: "#6F8298", text: "#FFFFFF" },
  "client query": { background: "#7C3AED", text: "#FFFFFF" },
  "follow up": { background: "#F59E0B", text: "#10233A" },
  meeting: { background: "#A23B72", text: "#FFFFFF" },
  "sars query": { background: "#E3262E", text: "#FFFFFF" },
  "financial statements": { background: "#2457D6", text: "#FFFFFF" },
  "management reports": { background: "#1268B3", text: "#FFFFFF" },
  emp201: { background: "#FF7A16", text: "#FFFFFF" },
  emp501: { background: "#8A2BE2", text: "#FFFFFF" },
  payroll: { background: "#19A84B", text: "#FFFFFF" },
  uif: { background: "#1268B3", text: "#FFFFFF" },
  "workmans compensation": { background: "#28CFC5", text: "#10233A" },
  "beneficial ownership declaration": { background: "#7C3AED", text: "#FFFFFF" },
  "cipc annual return": { background: "#53657A", text: "#FFFFFF" },
  "secretarial - ad hoc": { background: "#1268B3", text: "#FFFFFF" },
  "income tax": { background: "#C49A00", text: "#FFFFFF" },
  "provisional tax": { background: "#D08C00", text: "#FFFFFF" },
  vat201: { background: "#1268B3", text: "#FFFFFF" },
};

function getServiceDefault(serviceName: string) {
  return (
    DEFAULT_SERVICE_COLOURS[serviceName.trim().toLowerCase()] || {
      background: "#0B5CAB",
      text: "#FFFFFF",
    }
  );
}

function normaliseHex(value: string, fallback: string) {
  const trimmed = (value || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }

  return fallback.toUpperCase();
}

export default function ServicesSettingsPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    setLoading(true);

    const response = await fetch("/api/settings/services");
    const result = await response.json();

    if (!result.success) {
      alert(result.error || "Could not load services.");
      setLoading(false);
      return;
    }

    const rawServices = (result.services || []) as ServiceRow[];

    const accounting = rawServices.find(
      (service) => service.service_name.trim().toLowerCase() === "accounting"
    );

    const accountingColour = normaliseHex(
      accounting?.colour_hex || "",
      getServiceDefault("Accounting").background
    );

    const loadedServices = rawServices.map((service) => {
      const defaults = getServiceDefault(service.service_name);
      const serviceName = service.service_name.trim().toLowerCase();

      let background = service.colour_hex || defaults.background;
      let text = service.text_colour_hex || defaults.text;

      // One-time cleanup of the original PP duplicate:
      // Meeting was accidentally created with the same colour as Accounting.
      // If that duplicate still exists, show the proper Meeting default instead.
      if (
        serviceName === "meeting" &&
        normaliseHex(background, defaults.background) === accountingColour
      ) {
        background = defaults.background;
        text = defaults.text;
      }

      return {
        ...service,
        colour_hex: normaliseHex(background, defaults.background),
        text_colour_hex: normaliseHex(text, defaults.text),
      };
    });

    setServices(loadedServices);
    setLoading(false);
  }

  function updateLocalService(id: string, field: keyof ServiceRow, value: string) {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, [field]: value } : service
      )
    );
  }

  function handleHexBlur(
    service: ServiceRow,
    field: "colour_hex" | "text_colour_hex",
    fallback: string
  ) {
    const normalised = normaliseHex(service[field] || "", fallback);
    updateLocalService(service.id, field, normalised);
  }

  function resetServiceToDefault(service: ServiceRow) {
    const defaults = getServiceDefault(service.service_name);

    setServices((current) =>
      current.map((item) =>
        item.id === service.id
          ? {
              ...item,
              colour_hex: defaults.background,
              text_colour_hex: defaults.text,
            }
          : item
      )
    );
  }

  async function saveService(service: ServiceRow) {
    const defaults = getServiceDefault(service.service_name);
    const background = normaliseHex(
      service.colour_hex || "",
      defaults.background
    );
    const text = normaliseHex(
      service.text_colour_hex || "",
      defaults.text
    );

    setSavingId(service.id);

    const response = await fetch("/api/settings/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: service.id,
        colour_hex: background,
        text_colour_hex: text,
      }),
    });

    const result = await response.json();
    setSavingId(null);

    if (!result.success) {
      alert(result.error || "Could not save service colours.");
      return;
    }

    await loadServices();
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Settings</p>
          <h1 style={styles.title}>Services & Colours</h1>
          <p style={styles.subtitle}>
            Control the colours used for services across CRM, My Day and the calendar.
          </p>
        </div>

        <Link href="/settings" style={styles.secondaryButton}>
          Back to Settings
        </Link>
      </section>

      <section style={styles.tableShell}>
        <div style={styles.tableHeader}>
          <span>Service</span>
          <span>Group</span>
          <span>Frequency</span>
          <span>Background</span>
          <span>Text</span>
          <span>Preview</span>
          <span>Action</span>
        </div>

        {loading && <div style={styles.emptyState}>Loading services...</div>}

        {!loading && services.length === 0 && (
          <div style={styles.emptyState}>No services found.</div>
        )}

        {!loading &&
          services.map((service) => {
            const defaults = getServiceDefault(service.service_name);
            const background = normaliseHex(
              service.colour_hex || "",
              defaults.background
            );
            const textColour = normaliseHex(
              service.text_colour_hex || "",
              defaults.text
            );

            return (
              <div key={service.id} style={styles.tableRow}>
                <strong style={styles.serviceName}>{service.service_name}</strong>

                <span style={styles.standardText}>
                  {service.service_group || "-"}
                </span>

                <span style={styles.standardText}>
                  {service.frequency || "-"}
                </span>

                <div style={styles.colourControl}>
                  <input
                    type="color"
                    value={background.toLowerCase()}
                    onChange={(event) =>
                      updateLocalService(
                        service.id,
                        "colour_hex",
                        event.target.value.toUpperCase()
                      )
                    }
                    style={styles.colorInput}
                    aria-label={`${service.service_name} background colour`}
                  />

                  <input
                    type="text"
                    value={service.colour_hex || background}
                    onChange={(event) =>
                      updateLocalService(
                        service.id,
                        "colour_hex",
                        event.target.value
                      )
                    }
                    onBlur={() =>
                      handleHexBlur(
                        service,
                        "colour_hex",
                        defaults.background
                      )
                    }
                    style={styles.hexInput}
                    maxLength={7}
                    spellCheck={false}
                    aria-label={`${service.service_name} background hex code`}
                  />
                </div>

                <div style={styles.colourControl}>
                  <input
                    type="color"
                    value={textColour.toLowerCase()}
                    onChange={(event) =>
                      updateLocalService(
                        service.id,
                        "text_colour_hex",
                        event.target.value.toUpperCase()
                      )
                    }
                    style={styles.colorInput}
                    aria-label={`${service.service_name} text colour`}
                  />

                  <input
                    type="text"
                    value={service.text_colour_hex || textColour}
                    onChange={(event) =>
                      updateLocalService(
                        service.id,
                        "text_colour_hex",
                        event.target.value
                      )
                    }
                    onBlur={() =>
                      handleHexBlur(
                        service,
                        "text_colour_hex",
                        defaults.text
                      )
                    }
                    style={styles.hexInput}
                    maxLength={7}
                    spellCheck={false}
                    aria-label={`${service.service_name} text hex code`}
                  />
                </div>

                <span
                  style={{
                    ...styles.previewBadge,
                    background,
                    color: textColour,
                  }}
                >
                  {service.service_name}
                </span>

                <div style={styles.actionGroup}>
                  <button
                    type="button"
                    style={styles.resetButton}
                    onClick={() => resetServiceToDefault(service)}
                    disabled={savingId === service.id}
                  >
                    Default
                  </button>

                  <button
                    style={{
                      ...styles.primaryButton,
                      opacity: savingId === service.id ? 0.6 : 1,
                    }}
                    onClick={() => saveService(service)}
                    disabled={savingId === service.id}
                  >
                    {savingId === service.id ? "Saving..." : "Save"}
                  </button>
                </div>
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
    background: "#f6f5f1",
    padding: "30px",
    color: "#10233a",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "22px",
  },

  eyebrow: {
    margin: 0,
    color: "#5d6c67",
    fontSize: "13px",
    fontWeight: 800,
  },

  title: {
    margin: "4px 0 0",
    fontSize: "32px",
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "-0.025em",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#5c6976",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  secondaryButton: {
    background: "#ffffff",
    color: "#10233a",
    textDecoration: "none",
    border: "1px solid #cfd6dc",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 800,
  },

  tableShell: {
    background: "#ffffff",
    border: "1px solid #d8d7d1",
    overflow: "hidden",
  },

  tableHeader: {
    display: "grid",
    gridTemplateColumns:
      "1.35fr 0.9fr 0.7fr 1.25fr 1.25fr 1.25fr 0.85fr",
    gap: "16px",
    padding: "13px 16px",
    background: "#f0f2f1",
    color: "#465663",
    fontSize: "12px",
    fontWeight: 800,
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns:
      "1.35fr 0.9fr 0.7fr 1.25fr 1.25fr 1.25fr 0.85fr",
    gap: "16px",
    padding: "12px 16px",
    borderTop: "1px solid #e7e5df",
    alignItems: "center",
    fontSize: "13px",
  },

  serviceName: {
    color: "#16314e",
    fontWeight: 850,
  },

  standardText: {
    color: "#3f5262",
  },

  colourControl: {
    display: "grid",
    gridTemplateColumns: "42px minmax(84px, 1fr)",
    gap: "8px",
    alignItems: "center",
  },

  colorInput: {
    width: "42px",
    height: "32px",
    border: "1px solid #cfd6dc",
    padding: "2px",
    background: "#ffffff",
    cursor: "pointer",
  },

  hexInput: {
    width: "100%",
    minWidth: 0,
    height: "32px",
    boxSizing: "border-box",
    border: "1px solid #cfd6dc",
    background: "#ffffff",
    color: "#10233a",
    padding: "0 8px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    fontWeight: 700,
    outline: "none",
  },

  previewBadge: {
    justifySelf: "start",
    display: "inline-flex",
    alignItems: "center",
    minHeight: "28px",
    padding: "0 10px",
    fontSize: "11px",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  actionGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "6px",
  },

  resetButton: {
    background: "#ffffff",
    color: "#40515d",
    border: "1px solid #cfd6dc",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  primaryButton: {
    background: "#10233a",
    color: "#ffffff",
    border: "1px solid #10233a",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },

  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#66737d",
    fontSize: "14px",
  },
};
