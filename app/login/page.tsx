"use client";

import Image from "next/image";
import Link from "next/link";
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

    const cleanedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password: password.trim(),
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    try {
      const accessRes = await fetch("/api/cubechem/check-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: cleanedEmail }),
      });

      const accessData = await accessRes.json();

      if (
        accessRes.ok &&
        accessData.allowed &&
        cleanedEmail === "christo.botha@cubechem.co.za"
      ) {
        window.location.href = "/cubechem";
        return;
      }
    } catch {
      // If CubeChem check fails, normal users still continue to dashboard.
    }

    window.location.href = "/dashboard";
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      alert("Please enter your email address first.");
      return;
    }

    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

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
      <section style={styles.shell}>
        <div style={styles.visualPanel}>
          <Image
            src="/brand/practicepilot-login-side.png"
            alt="PracticePilot"
            fill
            style={styles.visualImage}
            priority
          />
        </div>

        <div style={styles.formPanel}>
          <Link href="/" style={styles.backLink}>
            ← Back to website
          </Link>

          <form
            style={styles.card}
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <Image
              src="/brand/practicepilot-horizontal-logo.png"
              alt="PracticePilot"
              width={230}
              height={72}
              style={styles.logo}
              priority
            />

            <h1 style={styles.title}>Welcome back</h1>
            <p style={styles.subtitle}>
              Sign in to access your PracticePilot workspace.
            </p>

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
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F3F8FC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "36px",
  },
  shell: {
    width: "1120px",
    minHeight: "720px",
    background: "#ffffff",
    borderRadius: "28px",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "0.95fr 1.05fr",
    boxShadow: "0 24px 70px rgba(11,47,79,0.16)",
    border: "1px solid #D5DDE6",
  },
  visualPanel: {
    position: "relative",
    background: "#0B2F4F",
    minHeight: "720px",
  },
  visualImage: {
    objectFit: "cover",
  },
  formPanel: {
    position: "relative",
    padding: "58px 72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  backLink: {
    position: "absolute",
    top: "28px",
    right: "34px",
    color: "#0B5CAB",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 800,
  },
  card: {
    width: "100%",
    maxWidth: "430px",
  },
  logo: {
    objectFit: "contain",
    marginBottom: "34px",
  },
  title: {
    margin: 0,
    fontSize: "38px",
    color: "#0B2F4F",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    marginTop: "10px",
    marginBottom: "32px",
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#5B6775",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "18px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#0B2F4F",
  },
  input: {
    height: "48px",
    borderRadius: "12px",
    border: "1px solid #D5DDE6",
    padding: "0 14px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
    color: "#0B2F4F",
  },
  primaryButton: {
    width: "100%",
    background: "#0B5CAB",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "14px 18px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "8px",
  },
  linkButton: {
    width: "100%",
    background: "transparent",
    color: "#0B5CAB",
    border: "none",
    padding: "16px 0 0 0",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
};