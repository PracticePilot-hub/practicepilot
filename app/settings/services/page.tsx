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

    setServices(result.services || []);
    setLoading(false);
  }

  function updateLocalService(id: string, field: keyof ServiceRow, value: string) {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, [field]: value } : service
      )
    );
  }

  async function saveService(service: ServiceRow) {
    setSavingId(service.id);

    const response = await fetch("/api/settings/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: service.id,
        colour_hex: service.colour_hex || "#0b5cab",
        text_colour_hex: service.text_colour_hex || "#ffffff",
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
            Set the task colours used in CRM Tasks and PilotHub.
          </p>
        </div>

        <Link href="/settings" style={styles.secondaryButton}>
          Back to Settings
        </Link>
      </section>

      <section style={styles.card}>
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
          services.map((service) => (
            <div key={service.id} style={styles.tableRow}>
              <strong>{service.service_name}</strong>
              <span>{service.service_group || "-"}</span>
              <span>{service.frequency || "-"}</span>

              <input
                type="color"
                value={service.colour_hex || "#0b5cab"}
                onChange={(event) =>
                  updateLocalService(service.id, "colour_hex", event.target.value)
                }
                style={styles.colorInput}
              />

              <input
                type="color"
                value={service.text_colour_hex || "#ffffff"}
                onChange={(event) =>
                  updateLocalService(service.id, "text_colour_hex", event.target.value)
                }
                style={styles.colorInput}
              />

              <span
                style={{
                  ...styles.previewPill,
                  background: service.colour_hex || "#0b5cab",
                  color: service.text_colour_hex || "#ffffff",
                }}
              >
                {service.service_name}
              </span>

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
          ))}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f8fc",
    padding: "36px",
    color: "#0b2f4f",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "26px",
  },
  eyebrow: {
    margin: 0,
    color: "#00a6b4",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "34px",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#526173",
    fontSize: "15px",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#0b5cab",
    textDecoration: "none",
    border: "1px solid #dbe5ee",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 900,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 0.8fr 1.4fr 0.7fr",
    gap: "12px",
    padding: "14px 18px",
    background: "#f8fbfd",
    color: "#526173",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 0.8fr 1.4fr 0.7fr",
    gap: "12px",
    padding: "14px 18px",
    borderTop: "1px solid #eef3f7",
    alignItems: "center",
    fontSize: "14px",
  },
  colorInput: {
    width: "48px",
    height: "34px",
    border: "1px solid #dbe5ee",
    borderRadius: "8px",
    padding: "2px",
    background: "#ffffff",
  },
  previewPill: {
    justifySelf: "start",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "9px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#7b8794",
  },
};