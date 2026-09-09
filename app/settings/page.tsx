"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { PP, ppPage, ppPanel, ppSecondaryButton } from "../components/ppTheme";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type UserProfile = {
  role: string;
  organisation_id?: string | null;
  can_access_crm?: boolean | null;
  can_access_afs?: boolean | null;
  can_manage_practice_users?: boolean | null;
  is_practice_owner?: boolean | null;
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
            "role,organisation_id,can_access_crm,can_access_afs,can_manage_practice_users,is_practice_owner"
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

    loadProfile();
  }, []);

  const globalAdmin = isGlobalAdmin(profile?.role || "");
  const clientManager = profile?.role === "Client Manager";
  const canManageUsers =
    globalAdmin ||
    clientManager ||
    Boolean(profile?.can_manage_practice_users) ||
    Boolean(profile?.is_practice_owner);

  const hasCrm = globalAdmin || Boolean(profile?.can_access_crm);
  const hasAfs = globalAdmin || Boolean(profile?.can_access_afs);
  const isPracticeUser = Boolean(profile?.organisation_id);

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PracticePilot</p>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Manage shared practice settings and only the module settings available to your practice.
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
          <Link href="/settings/practice" style={styles.card}>
            <h2 style={styles.cardTitle}>Practice Details & Letterhead</h2>
            <p style={styles.cardText}>
              Practice identity, letterhead, authorised signatory and professional-body details used across PracticePilot.
            </p>
          </Link>

          {canManageUsers ? (
            <Link href="/settings/team" style={styles.card}>
              <h2 style={styles.cardTitle}>
                {isPracticeUser ? "My Team & Licences" : "PracticePilot Team"}
              </h2>
              <p style={styles.cardText}>
                {isPracticeUser
                  ? "Manage staff, roles, module access, delegated team permissions and licence quantities."
                  : "Manage PracticePilot internal team access separately from client practices."}
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
                Choose the work steps, dependencies, review checks and submission controls your practice wants to use.
              </p>
            </Link>
          ) : null}

          {hasAfs ? (
            <Link href="/afs/settings" style={styles.card}>
              <h2 style={styles.cardTitle}>AFS Settings</h2>
              <p style={styles.cardText}>
                AFS defaults, workflow, notifications, templates and entity types.
              </p>
            </Link>
          ) : null}

          {hasCrm ? (
            <div style={styles.cardMuted}>
              <h2 style={styles.cardTitle}>Task Rules</h2>
              <p style={styles.cardText}>
                VAT categories, payroll frequency, EMP501, provisional tax and annual CRM task rules.
              </p>
            </div>
          ) : null}

          <div style={styles.cardMuted}>
            <h2 style={styles.cardTitle}>Feature Toggles</h2>
            <p style={styles.cardText}>
              Practice-wide feature controls will live here as shared settings are consolidated.
            </p>
          </div>

          <div style={styles.cardMuted}>
            <h2 style={styles.cardTitle}>Document Providers</h2>
            <p style={styles.cardText}>
              Configure Egnyte, Google Drive, Dropbox, OneDrive or manual document links.
            </p>
          </div>

          {canManageUsers ? (
            <div style={styles.cardMuted}>
              <h2 style={styles.cardTitle}>Billing & Profitability</h2>
              <p style={styles.cardText}>
                Owner/admin-only area for retainers, employee cost rates and profitability reports.
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
    ...ppPage,
    padding: "24px 26px 30px",
  },
  header: {
    ...ppPanel,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    padding: "18px 18px 17px",
    marginBottom: 12,
    borderTop: `3px solid ${PP.color.navy900}`,
  },
  eyebrow: {
    margin: 0,
    color: PP.color.blue600,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: "4px 0 0",
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.025em",
    color: PP.color.text,
  },
  subtitle: {
    margin: "7px 0 0",
    color: PP.color.textMuted,
    fontSize: 12,
    maxWidth: 760,
    lineHeight: 1.45,
  },
  secondaryButton: {
    ...ppSecondaryButton,
    minHeight: 38,
    padding: "0 15px",
  },
  loading: {
    ...ppPanel,
    padding: "18px",
    color: PP.color.textMuted,
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  card: {
    ...ppPanel,
    display: "block",
    minHeight: 112,
    padding: "16px 17px",
    textDecoration: "none",
    color: PP.color.text,
    borderTop: `3px solid ${PP.color.blue600}`,
  },
  cardMuted: {
    ...ppPanel,
    minHeight: 112,
    padding: "16px 17px",
    background: PP.color.panelSoft,
    borderTop: `3px solid ${PP.color.borderStrong}`,
  },
  cardTitle: {
    margin: "0 0 7px",
    fontSize: 17,
    lineHeight: 1.2,
    fontWeight: 850,
    color: PP.color.text,
  },
  cardText: {
    margin: 0,
    color: PP.color.textMuted,
    fontSize: 12,
    lineHeight: 1.45,
  },
};
