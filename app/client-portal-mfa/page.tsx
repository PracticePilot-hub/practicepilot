"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

type Step = "loading" | "setup" | "verify" | "done";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
};

function qrImageSource(value: string) {
  const qr = String(value || "").trim();

  if (!qr) return "";
  if (qr.startsWith("data:image/")) return qr;

  if (qr.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
  }

  return qr;
}

export default function ClientPortalMfaPage() {
  const [step, setStep] = useState<Step>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");

  const qrSrc = useMemo(() => qrImageSource(qrCode), [qrCode]);

  useEffect(() => {
    void initialise();
  }, []);

  async function initialise() {
    setStep("loading");
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (aal?.currentLevel === "aal2") {
        window.location.href = "/client-portal";
        return;
      }

      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) throw factorsError;

      const allTotp = [
        ...((factorsData?.totp || []) as TotpFactor[]),
        ...((factorsData?.all || []) as TotpFactor[]).filter(
          (factor) => factor.factor_type === "totp"
        ),
      ];

      const seen = new Set<string>();
      const totp = allTotp.filter((factor) => {
        if (!factor.id || seen.has(factor.id)) return false;
        seen.add(factor.id);
        return true;
      });

      const verified =
        totp.find((factor) => factor.status === "verified") || null;

      if (verified) {
        setFactorId(verified.id);
        setStep("verify");
        return;
      }

      for (const factor of totp) {
        try {
          await supabase.auth.mfa.unenroll({
            factorId: factor.id,
          });
        } catch {
          // Ignore abandoned-factor cleanup errors.
        }
      }

      const { data: enrolled, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "PracticePilot Client Portal",
        });

      if (enrollError) throw enrollError;

      if (!enrolled?.id || !enrolled?.totp?.qr_code) {
        throw new Error(
          "PracticePilot could not create your authenticator setup."
        );
      }

      setFactorId(enrolled.id);
      setQrCode(enrolled.totp.qr_code || "");
      setSecret(enrolled.totp.secret || "");
      setStep("setup");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not initialise two-factor authentication."
      );
      setStep("setup");
    }
  }

  async function verifyCode() {
    const cleaned = code.replace(/\s+/g, "").trim();

    if (!/^\d{6}$/.test(cleaned)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    if (!factorId) {
      setError("The authenticator factor could not be confirmed.");
      return;
    }

    setLoadingAction(true);
    setError("");

    try {
      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: cleaned,
        });

      if (verifyError) throw verifyError;

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (aal?.currentLevel !== "aal2") {
        throw new Error(
          "Two-factor authentication was verified, but the secure session was not upgraded."
        );
      }

      setStep("done");

      window.setTimeout(() => {
        window.location.href = "/client-portal";
      }, 500);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The verification code could not be confirmed."
      );
    } finally {
      setLoadingAction(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>PracticePilot</div>

        {step === "loading" ? (
          <>
            <h1 style={styles.title}>Securing your Client Portal</h1>
            <p style={styles.subtitle}>
              Checking your two-factor authentication settings...
            </p>
          </>
        ) : null}

        {step === "setup" ? (
          <>
            <div style={styles.secureBadge}>MANDATORY SECURITY STEP</div>
            <h1 style={styles.title}>Set up two-factor authentication</h1>
            <p style={styles.subtitle}>
              Scan this QR code with an authenticator app, then enter the
              6-digit code it gives you.
            </p>

            <div style={styles.appNote}>
              Works with Microsoft Authenticator, Google Authenticator,
              1Password, Authy and other TOTP authenticator apps.
            </div>

            {qrSrc ? (
              <div style={styles.qrWrap}>
                <img
                  src={qrSrc}
                  alt="PracticePilot authenticator QR code"
                  style={styles.qr}
                />
              </div>
            ) : null}

            {secret ? (
              <div style={styles.secretBox}>
                <span style={styles.secretLabel}>
                  Cannot scan the QR code?
                </span>
                <span style={styles.secretValue}>{secret}</span>
              </div>
            ) : null}

            <label style={styles.field}>
              <span style={styles.label}>6-digit verification code</span>
              <input
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value.replace(/[^\d]/g, "").slice(0, 6)
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                style={styles.codeInput}
              />
            </label>

            {error ? <div style={styles.error}>{error}</div> : null}

            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={loadingAction}
              style={styles.primaryButton}
            >
              {loadingAction
                ? "Verifying..."
                : "Secure my Client Portal"}
            </button>
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <div style={styles.secureBadge}>TWO-FACTOR AUTHENTICATION</div>
            <h1 style={styles.title}>Enter your authenticator code</h1>
            <p style={styles.subtitle}>
              Open your authenticator app and enter the current 6-digit code
              for PracticePilot.
            </p>

            <label style={styles.field}>
              <span style={styles.label}>6-digit verification code</span>
              <input
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value.replace(/[^\d]/g, "").slice(0, 6)
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                style={styles.codeInput}
              />
            </label>

            {error ? <div style={styles.error}>{error}</div> : null}

            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={loadingAction}
              style={styles.primaryButton}
            >
              {loadingAction ? "Verifying..." : "Verify and continue"}
            </button>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <div style={styles.successIcon}>✓</div>
            <h1 style={styles.title}>Account secured</h1>
            <p style={styles.subtitle}>
              Two-factor authentication has been verified. Opening your Client
              Portal...
            </p>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => void signOut()}
          style={styles.signOutButton}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "36px 20px",
    display: "grid",
    placeItems: "center",
    background: "#eef3f8",
    color: "#10233a",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    padding: "32px",
    boxSizing: "border-box",
    border: "1px solid #d7e0e9",
    borderRadius: 12,
    background: "#ffffff",
    boxShadow: "0 20px 55px rgba(15,35,58,0.12)",
  },
  brand: {
    marginBottom: 22,
    color: "#10233a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  secureBadge: {
    display: "inline-flex",
    marginBottom: 10,
    padding: "5px 8px",
    border: "1px solid #bdd4ed",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1768d2",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: "0.06em",
  },
  title: {
    margin: 0,
    color: "#10233a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#627386",
    fontSize: 12,
    lineHeight: 1.65,
  },
  appNote: {
    marginTop: 16,
    padding: "10px 12px",
    border: "1px solid #dce5ee",
    borderRadius: 7,
    background: "#f8fafc",
    color: "#586a7e",
    fontSize: 9.5,
    lineHeight: 1.5,
  },
  qrWrap: {
    margin: "20px auto 16px",
    width: 220,
    height: 220,
    padding: 10,
    display: "grid",
    placeItems: "center",
    border: "1px solid #d6e0ea",
    borderRadius: 10,
    background: "#ffffff",
  },
  qr: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  secretBox: {
    marginBottom: 16,
    padding: "10px 12px",
    display: "grid",
    gap: 5,
    border: "1px solid #dce5ee",
    borderRadius: 7,
    background: "#f8fafc",
  },
  secretLabel: {
    color: "#6c7b8b",
    fontSize: 8.5,
    fontWeight: 800,
  },
  secretValue: {
    color: "#10233a",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  field: {
    marginTop: 16,
    display: "grid",
    gap: 7,
  },
  label: {
    color: "#10233a",
    fontSize: 10,
    fontWeight: 900,
  },
  codeInput: {
    height: 52,
    padding: "0 14px",
    border: "1px solid #bfcddd",
    borderRadius: 7,
    background: "#ffffff",
    color: "#10233a",
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "0.28em",
    textAlign: "center",
    outline: "none",
  },
  error: {
    marginTop: 12,
    padding: "10px 12px",
    border: "1px solid #e8aaaa",
    borderRadius: 6,
    background: "#fff2f2",
    color: "#9e2c2c",
    fontSize: 9.5,
    fontWeight: 800,
  },
  primaryButton: {
    width: "100%",
    height: 44,
    marginTop: 16,
    border: "1px solid #1768d2",
    borderRadius: 7,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: 950,
    cursor: "pointer",
  },
  signOutButton: {
    width: "100%",
    marginTop: 13,
    padding: "8px 0 0",
    border: "none",
    background: "transparent",
    color: "#6b7b8d",
    fontSize: 9.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  successIcon: {
    width: 52,
    height: 52,
    marginBottom: 14,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#e9f8ef",
    color: "#1b8d54",
    fontSize: 24,
    fontWeight: 950,
  },
};
