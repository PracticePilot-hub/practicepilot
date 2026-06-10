"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

export default function SettingsPage() {
  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PracticePilot</p>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Manage the practice setup, task rules, colours, users, document providers and feature toggles.
          </p>
        </div>

        <Link href="/dashboard" style={styles.secondaryButton}>
          Back to PilotHub
        </Link>
      </section>

      <section style={styles.grid}>
        <Link href="/settings/services" style={styles.card}>
          <h2 style={styles.cardTitle}>Services & Colours</h2>
          <p style={styles.cardText}>
            Manage task colours, service names and default service settings.
          </p>
        </Link>

        <div style={styles.cardMuted}>
          <h2 style={styles.cardTitle}>Task Rules</h2>
          <p style={styles.cardText}>
            VAT categories, payroll frequency, EMP501, provisional tax and annual task rules.
          </p>
        </div>

        <div style={styles.cardMuted}>
          <h2 style={styles.cardTitle}>Users & Roles</h2>
          <p style={styles.cardText}>
            Staff access, reviewer roles, admin rights and owner-only billing visibility.
          </p>
        </div>

        <div style={styles.cardMuted}>
          <h2 style={styles.cardTitle}>Feature Toggles</h2>
          <p style={styles.cardText}>
            Turn time tracking, document links, review workflow, diary and profitability on or off.
          </p>
        </div>

        <div style={styles.cardMuted}>
          <h2 style={styles.cardTitle}>Document Providers</h2>
          <p style={styles.cardText}>
            Configure Egnyte, Google Drive, Dropbox, OneDrive or manual document links.
          </p>
        </div>

        <div style={styles.cardMuted}>
          <h2 style={styles.cardTitle}>Billing & Profitability</h2>
          <p style={styles.cardText}>
            Owner/admin-only area for retainers, employee cost rates and profitability reports.
          </p>
        </div>
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
    maxWidth: "760px",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    padding: "22px",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
    textDecoration: "none",
    color: "#0b2f4f",
  },
  cardMuted: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    padding: "22px",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
    opacity: 0.75,
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
  },
  cardText: {
    margin: 0,
    color: "#526173",
    fontSize: "14px",
    lineHeight: 1.45,
  },
};