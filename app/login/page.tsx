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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim()) {
      alert("Email is required.");
      return;
    }

    if (!password.trim()) {
      alert("Password is required.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      alert("Please enter your email address first.");
      return;
    }

    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert(error.message);
      setResetLoading(false);
      return;
    }

    alert("Password reset email sent.");
    setResetLoading(false);
  }

  return (
    <main style={styles.page}>
      <form
        style={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <h1 style={styles.title}>BizzIQ Login</h1>
        <p style={styles.subtitle}>Sign in to access your projects.</p>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>

        <button style={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        <button
          style={styles.linkButton}
          type="button"
          onClick={handleForgotPassword}
          disabled={resetLoading}
        >
          {resetLoading ? "Sending reset email..." : "Forgot password?"}
        </button>
      </form>
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
  linkButton: {
    width: "100%",
    background: "transparent",
    color: "#0b5cab",
    border: "none",
    padding: "14px 0 0 0",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
};