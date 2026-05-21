"use client";

import { useState } from "react";
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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleResetPassword() {
    if (!password.trim() || password.trim().length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: password.trim(),
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    alert("Password updated successfully. Please log in.");
    window.location.href = "/login";
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>
        <p style={styles.subtitle}>Enter your new password below.</p>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>New Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Confirm Password</label>
          <input
            style={styles.input}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
        </div>

        <button style={styles.primaryButton} onClick={handleResetPassword} disabled={saving}>
          {saving ? "Saving..." : "Reset Password"}
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
  },
  card: {
    width: "420px",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "32px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    border: "1px solid #e5eaf0",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    color: "#12304a",
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: "28px",
    fontSize: "15px",
    color: "#5b6775",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "18px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#34495e",
  },
  input: {
    height: "44px",
    borderRadius: "10px",
    border: "1px solid #d5dde6",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
  },
  primaryButton: {
    width: "100%",
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "8px",
  },
};