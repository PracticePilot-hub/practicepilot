// Path: app/portal-auth/page.tsx

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SupportedOtpType = "invite" | "magiclink" | "recovery";

export default function PortalAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState(
    "Opening your secure PracticePilot link..."
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function verifyLink() {
      try {
        const tokenHash = String(
          searchParams.get("token_hash") || ""
        ).trim();

        const rawType = String(
          searchParams.get("type") || ""
        ).trim();

        const next = String(
          searchParams.get("next") || "/login"
        ).trim();

        if (!tokenHash) {
          throw new Error("This secure link is missing its token.");
        }

        if (
          rawType !== "invite" &&
          rawType !== "magiclink" &&
          rawType !== "recovery"
        ) {
          throw new Error("This secure link has an invalid type.");
        }

        const { data, error: verifyError } =
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: rawType as SupportedOtpType,
          });

        if (verifyError) throw verifyError;

        if (!data.session?.user) {
          throw new Error(
            "PracticePilot could not establish your secure session."
          );
        }

        if (cancelled) return;

        setMessage("Secure link confirmed. Redirecting...");
        router.replace(next.startsWith("/") ? next : "/login");
      } catch (caught) {
        if (cancelled) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "This secure link could not be verified."
        );
      }
    }

    void verifyLink();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>PracticePilot</div>

        {error ? (
          <>
            <h1 style={styles.title}>Secure link could not be opened</h1>
            <div style={styles.error}>{error}</div>
            <p style={styles.text}>
              This secure link may have expired or already been used.
              If you have already activated your account, use the normal
              PracticePilot login page.
            </p>

            <div style={styles.actions}>
              <a href="/login" style={styles.button}>
                Go to Login
              </a>
              <a href="/reset-password" style={styles.secondaryButton}>
                Reset password
              </a>
            </div>
          </>
        ) : (
          <>
            <h1 style={styles.title}>PracticePilot</h1>
            <p style={styles.text}>{message}</p>
          </>
        )}
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
    background: "#EEF3F7",
    color: "#10233A",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    padding: 28,
    border: "1px solid #D3DCE6",
    background: "#ffffff",
  },
  brand: {
    marginBottom: 24,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  title: {
    margin: "0 0 10px",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  text: {
    margin: "0 0 18px",
    color: "#64748B",
    fontSize: 12,
    lineHeight: 1.6,
  },
  error: {
    marginBottom: 12,
    padding: "10px 11px",
    border: "1px solid #E5AAAA",
    background: "#FFF1F1",
    color: "#9D2929",
    fontSize: 10,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 38,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #0B5CAB",
    borderRadius: 8,
    background: "#0B5CAB",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 900,
  },
  secondaryButton: {
    minHeight: 38,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0B2F4F",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 900,
  },
};
