"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_access_accounting: boolean;
  can_access_projects: boolean;
  can_access_budgeting: boolean;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      alert("Could not load your user profile.");
      await supabase.auth.signOut();
      window.location.href = "/login";
      return;
    }

    if (!data.access_enabled) {
      alert("Your access has been blocked. Please contact PracticePilot support.");
      await supabase.auth.signOut();
      window.location.href = "/login";
      return;
    }

    setProfile(data);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Welcome, {profile?.full_name || profile?.email}</h1>
          <p style={styles.subtitle}>What do you want to do today?</p>
        </div>

       
      </div>

      <section style={styles.moduleGrid}>
        {profile?.can_access_accounting && (
          <a href="/accounting" style={styles.moduleCard}>
            <h2 style={styles.moduleTitle}>Accounting</h2>
            <p style={styles.moduleText}>Open the accounting module.</p>
          </a>
        )}

        {profile?.can_access_projects && (
          <a href="/project-management" style={styles.moduleCard}>
            <h2 style={styles.moduleTitle}>Project Management</h2>
            <p style={styles.moduleText}>
              Manage project quotes, billing phases, invoices and payments.
            </p>
          </a>
        )}

        {profile?.can_access_budgeting && (
          <a href="/budgeting" style={styles.moduleCard}>
            <h2 style={styles.moduleTitle}>Budgeting</h2>
            <p style={styles.moduleText}>Open the budgeting module.</p>
          </a>
        )}

        {!profile?.can_access_accounting &&
          !profile?.can_access_projects &&
          !profile?.can_access_budgeting && (
            <div style={styles.emptyState}>
              No modules are currently enabled for your user.
            </div>
          )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: "32px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
  },
  title: {
    fontSize: "34px",
    fontWeight: 700,
    margin: 0,
    color: "#12304a",
  },
  subtitle: {
    marginTop: "8px",
    color: "#5b6775",
    fontSize: "16px",
  },
  logoutButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #d5dde6",
    borderRadius: "10px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
  },
  moduleCard: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "26px",
    border: "1px solid #e5eaf0",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    textDecoration: "none",
    color: "#12304a",
  },
  moduleTitle: {
    fontSize: "22px",
    margin: "0 0 10px 0",
  },
  moduleText: {
    fontSize: "15px",
    margin: 0,
    color: "#5b6775",
    lineHeight: 1.5,
  },
  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "#7b8794",
    border: "1px dashed #c9d3df",
    borderRadius: "14px",
    background: "#ffffff",
  },
};