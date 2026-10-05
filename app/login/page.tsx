// Path: app/login/page.tsx

"use client";

import Image from "next/image";

import Link from "next/link";

import { useState } from "react";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginPage() {

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);

  async function routeSignedInUser(

    userId: string,

    accessToken: string,

    cleanedEmail: string

  ) {

    try {

      const accessRes = await fetch("/api/cubechem/check-access", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

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

      // Continue to normal PracticePilot routing.

    }

    const { data: profile } = await supabase

      .from("user_profiles")

      .select("id,access_enabled")

      .eq("user_id", userId)

      .maybeSingle();

    if (profile?.id && profile.access_enabled !== false) {

      window.location.href = "/dashboard";

      return;

    }

    const portalRes = await fetch("/api/client-portal/me", {

      cache: "no-store",

      headers: { Authorization: `Bearer ${accessToken}` },

    });

    if (portalRes.ok) {

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (aal?.currentLevel === "aal2") {
        window.location.href = "/client-portal";
        return;
      }

      window.location.href = "/client-portal-mfa";
      return;

    }

    await supabase.auth.signOut();

    throw new Error(

      "This login does not currently have access to PracticePilot."

    );

  }

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

    try {

      const { data, error } = await supabase.auth.signInWithPassword({

        email: cleanedEmail,

        password: password.trim(),

      });

      if (error) throw error;

      if (!data.user || !data.session?.access_token) {

        throw new Error("Your login session could not be confirmed.");

      }

      await routeSignedInUser(

        data.user.id,

        data.session.access_token,

        cleanedEmail

      );

    } catch (error: any) {

      alert(error?.message || "Could not sign in.");

      setLoading(false);

    }

  }

  async function handleForgotPassword() {

    if (!email.trim()) {

      alert("Please enter your email address first.");

      return;

    }

    setResetLoading(true);

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

      setResetLoading(false);

    }

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

              void handleLogin();

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

              Sign in to access your PracticePilot workspace or Client Portal.

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

            <button

              style={styles.primaryButton}

              type="submit"

              disabled={loading}

            >

              {loading ? "Signing in..." : "Login"}

            </button>

            <button

              style={styles.linkButton}

              type="button"

              onClick={() => void handleForgotPassword()}

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
