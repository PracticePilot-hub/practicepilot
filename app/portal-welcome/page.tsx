"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function PortalWelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExistingUser = searchParams.get("existing") === "1";

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveInviteSession() {
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          setHasSession(true);
          setReady(true);
          return;
        }

        // Supabase may finish exchanging the invite link just after mount.
        await new Promise((resolve) =>
          window.setTimeout(resolve, 400)
        );

        const {
          data: { session: secondSession },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        setHasSession(Boolean(secondSession?.user));
        setReady(true);
      } catch (caught) {
        if (cancelled) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Could not open the portal invitation."
        );
        setReady(true);
      }
    }

    void resolveInviteSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (session?.user) {
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function activatePortal() {
    setError("");

    if (!isExistingUser) {
      if (password.length < 8) {
        setError("Choose a password of at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("The passwords do not match.");
        return;
      }
    }

    setSaving(true);

    try {
      if (!isExistingUser) {
        const { error: updateError } =
          await supabase.auth.updateUser({
            password,
          });

        if (updateError) throw updateError;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your portal session could not be confirmed."
        );
      }

      const response = await fetch("/api/client-portal/activate", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not activate the client portal."
        );
      }

      setComplete(true);

      window.setTimeout(() => {
        router.replace("/client-portal");
      }, 700);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not activate the client portal."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <main style={styles.loading}>Opening your PracticePilot portal...</main>;
  }

  if (!hasSession) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>PracticePilot</div>
          <h1 style={styles.title}>Invitation link could not be opened</h1>
          <p style={styles.text}>
            This invitation may have expired or already been used. Please
            ask your accounting team to resend your Client Portal invitation.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>PracticePilot</div>

        <h1 style={styles.title}>
          {complete
            ? "Your Client Portal is ready"
            : "Welcome to your Client Portal"}
        </h1>

        <p style={styles.text}>
          {complete
            ? "Taking you to your portal..."
            : isExistingUser
              ? "Your existing PracticePilot login has been linked to this Client Portal. Continue to finish activation."
              : "Create your password to finish activating your secure PracticePilot Client Portal."}
        </p>

        {error ? <div style={styles.error}>{error}</div> : null}

        {!complete ? (
          <div style={styles.form}>
            {!isExistingUser ? (
              <>
                <label style={styles.field}>
                  <span style={styles.label}>Create password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={styles.input}
                    autoComplete="new-password"
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Confirm password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    style={styles.input}
                    autoComplete="new-password"
                  />
                </label>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => void activatePortal()}
              disabled={saving}
              style={saving ? styles.buttonDisabled : styles.button}
            >
              {saving
                ? "Activating..."
                : isExistingUser
                  ? "Continue to Client Portal"
                  : "Activate Client Portal"}
            </button>
          </div>
        ) : null}
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
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#eef3f7",
    color: "#526577",
    fontSize: 13,
    fontWeight: 800,
  },
  card: {
    width: "100%",
    maxWidth: 480,
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
};
