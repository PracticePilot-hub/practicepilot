"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type UserProfile = {
  role: string;
  can_access_crm?: boolean | null;
  can_access_afs?: boolean | null;
  can_manage_practice_users?: boolean | null;
};

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_profiles")
          .select(
            "role,can_access_crm,can_access_afs,can_manage_practice_users"
          )
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

        setProfile(data as UserProfile);
      } catch (error) {
        console.error("SETTINGS PROFILE LOAD ERROR:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const globalAdmin = isGlobalAdmin(profile?.role || "");
  const clientManager = profile?.role === "Client Manager";

  const canManageUsers =
    globalAdmin ||
    clientManager ||
    Boolean(profile?.can_manage_practice_users);

  const hasCrm = globalAdmin || Boolean(profile?.can_access_crm);
  const hasAfs = globalAdmin || Boolean(profile?.can_access_afs);

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PracticePilot</p>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Manage the settings available for your PracticePilot access.
          </p>
        </div>

        <Link href="/dashboard" style={styles.secondaryButton}>
          Back to PilotHub
        </Link>
      </section>

      {loading ? (
        <section style={styles.loading}>Loading settings...</section>
      ) : (
        <section style={styles.grid}>
          {globalAdmin ? (
            <Link href="/settings/practice" style={styles.card}>
              <h2 style={styles.cardTitle}>Practice Details & Letterhead</h2>
              <p style={styles.cardText}>
                Practice identity, letterhead, authorised signatory and
                professional-body details used across PracticePilot.
              </p>
            </Link>
          ) : null}

          {canManageUsers ? (
            <Link href="/settings/team" style={styles.card}>
              <h2 style={styles.cardTitle}>My Team & Licences</h2>
              <p style={styles.cardText}>
                Manage staff, roles, module access, delegated team permissions
                and licence quantities.
              </p>
            </Link>
          ) : null}

          {hasAfs ? (
            <Link href="/afs/settings" style={styles.card}>
              <h2 style={styles.cardTitle}>AFS Settings</h2>
              <p style={styles.cardText}>
                AFS defaults, workflow, notifications, templates and entity
                types.
              </p>
            </Link>
          ) : null}

          {hasCrm ? (
            <Link href="/settings/services" style={styles.card}>
              <h2 style={styles.cardTitle}>Services & Colours</h2>
              <p style={styles.cardText}>
                CRM service names, task colours and default service settings.
              </p>
            </Link>
          ) : null}

          {hasCrm ? (
            <Link href="/settings/workflows" style={styles.card}>
              <h2 style={styles.cardTitle}>Workflows & Checklists</h2>
              <p style={styles.cardText}>
                Choose the work steps, dependencies, review checks and
                submission controls your practice wants to use.
              </p>
            </Link>
          ) : null}

          {hasCrm ? (
            <Link href="/settings/client-numbering" style={styles.card}>
              <h2 style={styles.cardTitle}>Client Numbering</h2>
              <p style={styles.cardText}>
                Configure practice numbering series, prefixes and legal-type
                allocation rules.
              </p>
            </Link>
          ) : null}

          {hasCrm && canManageUsers ? (
            <Link href="/settings/flightdeck" style={styles.card}>
              <h2 style={styles.cardTitle}>FlightDeck</h2>
              <p style={styles.cardText}>
                Set practice targets, staff capacity and commercial silo
                controls.
              </p>
            </Link>
          ) : null}

          {hasCrm && canManageUsers ? (
            <Link href="/settings/team-costing" style={styles.card}>
              <h2 style={styles.cardTitle}>Team Costing</h2>
              <p style={styles.cardText}>
                Set internal hourly cost rates and charge-out rates for practice
                staff.
              </p>
            </Link>
          ) : null}

          {hasCrm && canManageUsers ? (
            <Link href="/settings/email-sending" style={styles.card}>
              <h2 style={styles.cardTitle}>Email Sending</h2>
              <p style={styles.cardText}>
                Configure the practice mailbox PracticePilot uses for client
                communication.
              </p>
            </Link>
          ) : null}

          {hasCrm && canManageUsers ? (
            <Link href="/settings/crm-import" style={styles.card}>
              <h2 style={styles.cardTitle}>CRM Data Import</h2>
              <p style={styles.cardText}>
                Upload a PracticePilot CRM Master Import workbook to bulk add or
                update clients, groups, people and registrations.
              </p>
            </Link>
          ) : null}

          {globalAdmin ? (
            <div style={styles.cardMuted}>
              <h2 style={styles.cardTitle}>Task Rules</h2>
              <p style={styles.cardText}>
                VAT categories, payroll frequency, EMP501, provisional tax and
                annual CRM task rules.
              </p>
            </div>
          ) : null}

          {globalAdmin ? (
            <div style={styles.cardMuted}>
              <h2 style={styles.cardTitle}>Feature Toggles</h2>
              <p style={styles.cardText}>
                Practice-wide feature controls will live here as shared settings
                are consolidated.
              </p>
            </div>
          ) : null}

          {globalAdmin ? (
            <div style={styles.cardMuted}>
              <h2 style={styles.cardTitle}>Document Providers</h2>
              <p style={styles.cardText}>
                Configure Egnyte, Google Drive, Dropbox, OneDrive or manual
                document links.
              </p>
            </div>
          ) : null}

          {globalAdmin ? (
            <div style={styles.cardMuted}>
              <h2 style={styles.cardTitle}>Billing & Profitability</h2>
              <p style={styles.cardText}>
                PracticePilot administration area for commercial and
                profitability controls.
              </p>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
    padding: "18px 20px 32px",
    color: "#10233a",
  },

  header: {
    minHeight: "82px",
    padding: "14px 4px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center",
    borderTop: "3px solid #10233a",
    borderBottom: "1px solid #d8dee7",
  },

  eyebrow: {
    margin: 0,
    color: "#1758d5",
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  title: {
    margin: "4px 0 0",
    fontSize: "20px",
    lineHeight: 1,
    fontWeight: 950,
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "9px",
    maxWidth: "760px",
  },

  secondaryButton: {
    height: "32px",
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    color: "#10233a",
    textDecoration: "none",
    border: "1px solid #cbd5e1",
    fontSize: "8px",
    fontWeight: 900,
  },

  loading: {
    marginTop: "10px",
    background: "#ffffff",
    border: "1px solid #d8dee7",
    padding: "18px",
    fontSize: "9px",
  },

  grid: {
    marginTop: "10px",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },

  card: {
    minHeight: "92px",
    padding: "12px 14px",
    display: "grid",
    alignContent: "center",
    background: "#ffffff",
    border: "1px solid #d8dee7",
    borderTop: "3px solid #1758d5",
    textDecoration: "none",
    color: "#10233a",
  },

  cardMuted: {
    minHeight: "92px",
    padding: "12px 14px",
    display: "grid",
    alignContent: "center",
    background: "#f8fafc",
    border: "1px solid #d8dee7",
    color: "#10233a",
    opacity: 0.72,
  },

  cardTitle: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.15,
    fontWeight: 900,
  },

  cardText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "8.5px",
    lineHeight: 1.4,
  },
};
