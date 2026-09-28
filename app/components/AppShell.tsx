"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TopNav from "./TopNav";
import { supabase } from "@/app/lib/supabase";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();

  const [authResolved, setAuthResolved] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [billingSuspended, setBillingSuspended] = useState(false);
  const [billingSuspensionReason, setBillingSuspensionReason] =
    useState<string | null>(null);

  const publicPages = [
    "/",
    "/login",
    "/reset-password",
    "/financial-statements",
  ];

  const isPublicMandate = pathname.startsWith("/mandate/");
  const isPublicPage =
    publicPages.includes(pathname) || isPublicMandate;

  const isDocumentExport =
    /^\/proposals\/[^/]+\/export\/?$/.test(pathname) ||
    pathname.includes("/print-studio/export") ||
    pathname.includes("/reference");

  const isBillingAllowedPath =
    pathname === "/billing" ||
    pathname.startsWith("/billing/") ||
    pathname.startsWith("/legal/");

  /*
   * AUTH RESOLUTION
   *
   * Important:
   * - app/lib/supabase.ts owns the single browser Supabase client.
   * - AppShell does not subscribe to auth events.
   * - We resolve once per route change.
   * - One short second read protects hard refreshes while browser storage restores.
   *
   * This avoids overlapping auth callbacks/state updates during React rendering.
   */
  useEffect(() => {
    let cancelled = false;

    if (isPublicPage || isDocumentExport) {
      setAuthResolved(true);
      return;
    }

    // AppShell persists across client-side navigation.
    // Once the browser session is confirmed, do not put the whole app
    // back into a loading state every time pathname changes.
    if (authResolved && isAuthenticated) {
      return;
    }

    async function resolveSession() {
      try {
        const first = await supabase.auth.getSession();

        if (cancelled) return;

        if (first.data.session?.access_token) {
          setIsAuthenticated(true);
          setAuthResolved(true);
          return;
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 250);
        });

        if (cancelled) return;

        const second = await supabase.auth.getSession();

        if (cancelled) return;

        if (second.data.session?.access_token) {
          setIsAuthenticated(true);
          setAuthResolved(true);
          return;
        }

        setIsAuthenticated(false);
        setAuthResolved(true);

        const next =
          pathname && pathname !== "/login"
            ? `?next=${encodeURIComponent(pathname)}`
            : "";

        router.replace(`/login${next}`);
      } catch (error) {
        console.error("APP SHELL AUTH CHECK ERROR:", error);

        if (!cancelled) {
          setIsAuthenticated(false);
          setAuthResolved(true);
          router.replace("/login");
        }
      }
    }

    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [
    pathname,
    isPublicPage,
    isDocumentExport,
    router,
    authResolved,
    isAuthenticated,
  ]);

  /*
   * BILLING ACCESS
   *
   * Billing is deliberately non-blocking while the check runs.
   * If the check fails temporarily, the app remains usable.
   */
  useEffect(() => {
    let cancelled = false;

    if (
      !authResolved ||
      !isAuthenticated ||
      isPublicPage ||
      isDocumentExport
    ) {
      setBillingSuspended(false);
      setBillingSuspensionReason(null);
      return;
    }

    async function loadBillingState() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token || "";

        if (cancelled || !token) return;

        const response = await fetch("/api/billing/access", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const contentType =
          response.headers.get("content-type") || "";

        const json = contentType.includes("application/json")
          ? await response.json()
          : null;

        if (!response.ok && response.status !== 403) {
          throw new Error(
            json?.error || "Could not check billing access."
          );
        }

        if (cancelled) return;

        setBillingSuspended(
          Boolean(json?.billing_access_suspended)
        );

        setBillingSuspensionReason(
          json?.billing_suspension_reason || null
        );
      } catch (error) {
        console.error(
          "APP SHELL BILLING CHECK ERROR:",
          error
        );

        if (!cancelled) {
          setBillingSuspended(false);
          setBillingSuspensionReason(null);
        }
      }
    }

    void loadBillingState();

    const handleFocus = () => {
      void loadBillingState();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    authResolved,
    isAuthenticated,
    isPublicPage,
    isDocumentExport,
  ]);

  const shouldBlockPaidModules =
    billingSuspended &&
    !isBillingAllowedPath &&
    !isPublicPage &&
    !isDocumentExport;

  if (isPublicPage || isDocumentExport) {
    return <>{children}</>;
  }

  if (!authResolved) {
    return (
      <main style={s.loadingPage}>
        <div style={s.loadingText}>
          Loading PracticePilot...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={s.loadingPage}>
        <div style={s.loadingText}>
          Redirecting to login...
        </div>
      </main>
    );
  }

  return (
    <>
      <TopNav />

      {shouldBlockPaidModules ? (
        <main style={s.blockedPage}>
          <section style={s.blockedPanel}>
            <div style={s.blockedEyebrow}>
              Account billing
            </div>

            <h1 style={s.blockedTitle}>
              PracticePilot access temporarily suspended
            </h1>

            <p style={s.blockedText}>
              Your organisation has an overdue PracticePilot
              invoice. Access to paid PracticePilot modules has
              been temporarily suspended until the outstanding
              billing is resolved.
            </p>

            {billingSuspensionReason ? (
              <div style={s.reasonBox}>
                <strong>Reason</strong>
                <div style={s.reasonText}>
                  {billingSuspensionReason}
                </div>
              </div>
            ) : null}

            <p style={s.blockedText}>
              You can still open Billing to review your account
              and invoice information.
            </p>

            <div style={s.actions}>
              <Link
                href="/billing"
                style={s.primaryAction}
              >
                Open Billing
              </Link>

              <a
                href="mailto:billing@practicepilot.co.za"
                style={s.secondaryAction}
              >
                Contact PracticePilot Billing
              </a>
            </div>
          </section>
        </main>
      ) : (
        children
      )}
    </>
  );
}

const s: Record<string, CSSProperties> = {
  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f7fb",
    padding: 24,
  },

  loadingText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#526174",
    fontFamily:
      "'Aptos', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },

  blockedPage: {
    minHeight: "calc(100vh - 54px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    background: "#f3f7fb",
    padding: "48px 20px",
    color: "#0f172a",
    fontFamily:
      "'Aptos', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },

  blockedPanel: {
    width: "100%",
    maxWidth: 760,
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderLeft: "6px solid #b42318",
    padding: "28px 30px",
  },

  blockedEyebrow: {
    fontSize: 14,
    fontWeight: 700,
    color: "#b42318",
  },

  blockedTitle: {
    margin: "8px 0 12px",
    fontSize: 28,
    lineHeight: 1.15,
    fontWeight: 900,
    color: "#0f172a",
  },

  blockedText: {
    margin: "0 0 16px",
    fontSize: 14,
    lineHeight: 1.65,
    color: "#475569",
  },

  reasonBox: {
    margin: "18px 0",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    padding: "12px 14px",
    color: "#991b1b",
    fontSize: 13,
  },

  reasonText: {
    marginTop: 4,
    lineHeight: 1.5,
  },

  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 22,
  },

  primaryAction: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "0 14px",
    background: "#1769e0",
    border: "1px solid #1769e0",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },

  secondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "0 14px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
};
