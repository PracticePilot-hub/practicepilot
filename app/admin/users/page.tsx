"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const roleOptions = ["Super Admin", "Admin", "Staff"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Staff");

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const response = await fetch("/api/users");
    const data = await response.json();

    if (!response.ok) {
      setWarning(data.error || "Could not load PracticePilot users.");
    } else {
      setUsers(data.users || []);
    }

    setLoading(false);
  }

  async function createUser() {
    setSaving(true);
    setNotice("");
    setWarning("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create user.");

      setFullName("");
      setEmail("");
      setPassword("");
      setRole("Staff");

      if (data.warning) {
        setWarning(`User created, but welcome email failed: ${data.warning}`);
      } else {
        setNotice("PracticePilot user created.");
      }

      await loadUsers();
    } catch (error: any) {
      setWarning(error?.message || "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.kicker}>PracticePilot Admin</div>
          <h1 style={styles.title}>PracticePilot Team</h1>
          <p style={styles.subtitle}>
            Internal PracticePilot users only. Practice staff are managed by each practice.
          </p>
        </div>
      </section>

      {notice ? <div style={styles.notice}>{notice}</div> : null}
      {warning ? <div style={styles.warning}>{warning}</div> : null}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Add PP User</h2>
        </div>

        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span>Full name</span>
            <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Email</span>
            <input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Temporary password</span>
            <input type="password" style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Role</span>
            <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.primaryButton} onClick={createUser} disabled={saving}>
            {saving ? "Saving..." : "Add PP User"}
          </button>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Internal users</h2>
            <div style={styles.smallMuted}>Only PracticePilot staff appear here.</div>
          </div>
          <strong>{users.length}</strong>
        </div>

        <div style={styles.tableHeader}>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Access</span>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : users.length ? (
          users.map((user) => (
            <div key={user.id} style={styles.tableRow}>
              <strong>{user.full_name || "—"}</strong>
              <span>{user.email}</span>
              <span>{user.role}</span>
              <span style={user.access_enabled ? styles.enabled : styles.blocked}>
                {user.access_enabled ? "Enabled" : "Blocked"}
              </span>
            </div>
          ))
        ) : (
          <div style={styles.empty}>No internal users found.</div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", padding: "18px", background: "#eef2f5", color: "#10233a" },
  header: { padding: "18px 20px", background: "#ffffff", border: "1px solid #d7dfde", marginBottom: "10px" },
  kicker: { color: "#5d6f7b", fontSize: "11px", fontWeight: 850 },
  title: { margin: "4px 0 0", fontSize: "24px", fontWeight: 900 },
  subtitle: { margin: "5px 0 0", color: "#6b7882", fontSize: "11px" },
  notice: { marginBottom: "10px", padding: "10px 12px", border: "1px solid #b7d7c1", background: "#edf7f0", color: "#2f7047", fontSize: "11px" },
  warning: { marginBottom: "10px", padding: "10px 12px", border: "1px solid #efc2ba", background: "#fff3f1", color: "#9c3527", fontSize: "11px" },
  panel: { background: "#ffffff", border: "1px solid #d7dfde", marginBottom: "10px" },
  panelHeader: { minHeight: "58px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5eae9" },
  panelTitle: { margin: 0, fontSize: "14px", fontWeight: 900 },
  smallMuted: { marginTop: "3px", color: "#78858e", fontSize: "9px" },
  formGrid: { padding: "14px", display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "10px" },
  field: { display: "grid", gap: "5px", color: "#5f6d76", fontSize: "9px", fontWeight: 800 },
  input: { minHeight: "36px", width: "100%", padding: "0 9px", boxSizing: "border-box", border: "1px solid #cfd8df", background: "#ffffff", color: "#10233a", fontSize: "10px" },
  actions: { padding: "0 14px 14px", display: "flex", justifyContent: "flex-end" },
  primaryButton: { minHeight: "36px", padding: "0 13px", border: "1px solid #10233a", background: "#10233a", color: "#ffffff", fontSize: "10px", fontWeight: 850, cursor: "pointer" },
  tableHeader: { minHeight: "34px", padding: "0 14px", display: "grid", gridTemplateColumns: "1fr 1.3fr 140px 100px", gap: "12px", alignItems: "center", background: "#10233a", color: "#ffffff", fontSize: "9px", fontWeight: 850 },
  tableRow: { minHeight: "56px", padding: "8px 14px", display: "grid", gridTemplateColumns: "1fr 1.3fr 140px 100px", gap: "12px", alignItems: "center", borderBottom: "1px solid #e7eceb", fontSize: "10px" },
  enabled: { width: "fit-content", padding: "4px 7px", border: "1px solid #b7d7c1", background: "#edf7f0", color: "#2f7047", fontSize: "8px", fontWeight: 850 },
  blocked: { width: "fit-content", padding: "4px 7px", border: "1px solid #efc2ba", background: "#fff3f1", color: "#9c3527", fontSize: "8px", fontWeight: 850 },
  empty: { padding: "20px 14px", color: "#78858e", fontSize: "10px" },
};
