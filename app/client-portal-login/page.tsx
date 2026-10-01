"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

export default function ClientPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.access_token) {
          const response = await fetch("/api/client-portal/me", {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            window.location.replace("/client-portal");
            return;
          }
        }
      } catch {
        // Stay on login page.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError) throw signInError;

      if (!data.session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch("/api/client-portal/me", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        await supabase.auth.signOut();

        throw new Error(
          result?.error ||
            "This login does not have active Client Portal access."
        );
      }

      window.location.replace("/client-portal");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign in to the Client Portal."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>PracticePilot</div>
          <p style={styles.text}>Checking your Client Portal access...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>PracticePilot</div>

        <h1 style={styles.title}>Client Portal Login</h1>
        <p style={styles.text}>
          Sign in using the password you created when activating your portal.
        </p>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void signIn();
              }}
              style={styles.input}
              autoComplete="email"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void signIn();
              }}
              style={styles.input}
              autoComplete="current-password"
            />
          </label>

          <button
            type="button"
            onClick={() => void signIn()}
            disabled={loading}
            style={loading ? styles.buttonDisabled : styles.button}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <a href="/reset-password" style={styles.forgotLink}>
            Forgot your password?
          </a>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24,
    display: "grid",
    placeItems: "center",
    background: "#eef3f7",
    color: "#10233a",
  },
  card: {
    width: "100%",
    maxWidth: 450,
    padding: 28,
    border: "1px solid #d3dce6",
    background: "#ffffff",
  },
  brand: {
    marginBottom: 24,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  title: {
    margin: "0 0 8px",
    fontSize: 25,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  text: {
    margin: "0 0 22px",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },
  error: {
    marginBottom: 14,
    padding: "10px 11px",
    border: "1px solid #e5aaaa",
    background: "#fff1f1",
    color: "#9d2929",
    fontSize: 10,
    fontWeight: 800,
  },
  form: {
    display: "grid",
    gap: 13,
  },
  field: {
    display: "grid",
    gap: 5,
  },
  label: {
    color: "#526577",
    fontSize: 9,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    height: 40,
    boxSizing: "border-box",
    padding: "0 11px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 12,
    outline: "none",
  },
  button: {
    height: 40,
    marginTop: 4,
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 950,
    cursor: "pointer",
  },
  buttonDisabled: {
    height: 40,
    marginTop: 4,
    border: "1px solid #cbd5e1",
    background: "#e9edf2",
    color: "#8996a4",
    fontSize: 10,
    fontWeight: 950,
    cursor: "not-allowed",
  },
  forgotLink: {
    justifySelf: "start",
    color: "#1768d2",
    fontSize: 9,
    fontWeight: 850,
    textDecoration: "none",
  },
};
