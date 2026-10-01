// Path: app/reset-password/page.tsx

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const updateMode = searchParams.get("mode") === "update";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(updateMode);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!updateMode) return;

    let cancelled = false;

    async function confirmRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      setHasRecoverySession(Boolean(session?.user));
      setCheckingSession(false);
    }

    void confirmRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (session?.user) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [updateMode]);

  async function requestPasswordReset() {
    if (!email.trim()) {
      alert("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Could not send reset email.");
      }

      alert(
        json.message ||
          "If that email address has a PracticePilot login, a password reset email has been sent."
      );
    } catch (error: any) {
      alert(error?.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNewPassword() {
    if (!hasRecoverySession) {
      alert(
        "This password reset link is no longer valid. Please request a fresh reset email."
      );
      return;
    }

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      alert("Password updated successfully.");

      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error: any) {
      alert(error?.message || "Could not update password.");
      setLoading(false);
    }
  }

  if (updateMode && checkingSession) {
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
            <div style={styles.card}>
              <Image
                src="/brand/practicepilot-horizontal-logo.png"
                alt="PracticePilot"
                width={230}
                height={72}
                style={styles.logo}
                priority
              />
              <h1 style={styles.title}>Reset password</h1>
              <p style={styles.subtitle}>Checking your secure reset link...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const canSetPassword = updateMode && hasRecoverySession;

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
          <Link href="/login" style={styles.backLink}>
            ← Back to login
          </Link>

          <div style={styles.card}>
            <Image
              src="/brand/practicepilot-horizontal-logo.png"
              alt="PracticePilot"
              width={230}
              height={72}
              style={styles.logo}
              priority
            />

            {canSetPassword ? (
              <>
                <h1 style={styles.title}>Create new password</h1>
                <p style={styles.subtitle}>
                  Enter your new PracticePilot password below.
                </p>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    autoComplete="new-password"
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
                    autoComplete="new-password"
                  />
                </div>

                <button
                  style={styles.primaryButton}
                  type="button"
                  onClick={() => void saveNewPassword()}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save new password"}
                </button>
              </>
            ) : (
              <>
                <h1 style={styles.title}>Reset password</h1>

                <p style={styles.subtitle}>
                  Enter the email address linked to your PracticePilot login.
                  We will send you a secure reset link.
                </p>

                {updateMode ? (
                  <div style={styles.errorBox}>
                    That reset link is no longer valid. Request a fresh one
                    below.
                  </div>
                ) : null}

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

                <button
                  style={styles.primaryButton}
                  type="button"
                  onClick={() => void requestPasswordReset()}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send reset email"}
                </button>
              </>
            )}
          </div>
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
  errorBox: {
    marginBottom: "18px",
    padding: "12px 14px",
    border: "1px solid #E5AAAA",
    borderRadius: "10px",
    background: "#FFF1F1",
    color: "#9D2929",
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 700,
  },
};
