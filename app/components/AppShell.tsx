"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TopNav from "./TopNav";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();

  const [authCheckLoading, setAuthCheckLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [billingCheckLoading, setBillingCheckLoading] = useState(true);
  const [billingSuspended, setBillingSuspended] = useState(false);
  const [billingSuspensionReason, setBillingSuspensionReason] =
    useState<string | null>(null);

  const initialBillingCheckComplete = useRef(false);
  const billingCheckInFlight = useRef(false);

  /*
   * PUBLIC ROUTES
   *
   * /mandate/[token] is deliberately public:
   * - no TopNav
   * - no account/billing check
   * - no PracticePilot login required
   */
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
   * AUTH BOUNDARY
   *
   * Every non-public PracticePilot route requires a real Supabase session.
   * If the user is logged out and manually browses to /crm, /afs, /settings, etc,
   * they are redirected to /login.
   */
  useEffect(() => {
    let alive = true;

    async function checkAuth() {
      if (isPublicPage || isDocumentExport) {
        if (!alive) return;
        setIsAuthenticated(false);
        setAuthCheckLoading(false);
        return;
      }

      if (!supabase) {
        if (!alive) return;
        setIsAuthenticated(false);
        setAuthCheckLoading(false);
        router.replace("/login");
        return;
      }

      setAuthCheckLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!alive) return;

        if (!session?.access_token) {
          setIsAuthenticated(false);

          const next =
            pathname && pathname !== "/login"
              ? `?next=${encodeURIComponent(pathname)}`
              : "";

          router.replace(`/login${next}`);
          return;
        }

        setIsAuthenticated(true);
      } finally {
        if (alive) {
          setAuthCheckLoading(false);
        }
      }
    }

    void checkAuth();

    if (!supabase) {
      return () => {
        alive = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);

        if (!isPublicPage && !isDocumentExport) {
          router.replace("/login");
        }
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        setIsAuthenticated(Boolean(session?.access_token));
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [pathname, isPublicPage, isDocumentExport, router]);

  const loadBillingState = useCallback(
    async (showFullPageLoader: boolean) => {
      if (billingCheckInFlight.current) return;

      if (
        !supabase ||
        isPublicPage ||
        isDocumentExport ||
        !isAuthenticated
      ) {
        setBillingSuspended(false);
        setBillingSuspensionReason(null);
        setBillingCheckLoading(false);
        initialBillingCheckComplete.current = true;
        return;
      }

      billingCheckInFlight.current = true;

      if (showFullPageLoader && !initialBillingCheckComplete.current) {
        setBillingCheckLoading(true);
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";

        if (!token) {
          setBillingSuspended(false);
          setBillingSuspensionReason(null);
          return;
        }

        const response = await fetch("/api/billing/access", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await response.json();

        if (!response.ok && response.status !== 403) {
          throw new Error(json.error || "Could not check billing access.");
        }

        setBillingSuspended(Boolean(json.billing_access_suspended));
        setBillingSuspensionReason(
          json.billing_suspension_reason || null
        );
      } catch (error) {
        console.error("APP SHELL BILLING CHECK ERROR:", error);
      } finally {
        initialBillingCheckComplete.current = true;
        billingCheckInFlight.current = false;
        setBillingCheckLoading(false);
      }
    },
    [isPublicPage, isDocumentExport, isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    void loadBillingState(!initialBillingCheckComplete.current);
  }, [isAuthenticated, loadBillingState]);

  useEffect(() => {
    if (
      !supabase ||
      isPublicPage ||
      isDocumentExport ||
      !isAuthenticated
    ) {
      return;
    }

    const handleFocus = () => {
      void loadBillingState(false);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    isPublicPage,
    isDocumentExport,
    isAuthenticated,
    loadBillingState,
  ]);

  const shouldBlockPaidModules =
    billingSuspended &&
    !isBillingAllowedPath &&
    !isPublicPage &&
    !isDocumentExport;

  /*
   * Public pages render cleanly and immediately.
   * The mandate therefore has NO PracticePilot TopNav.
   */
  if (isPublicPage || isDocumentExport) {
    return <>{children}</>;
  }

  /*
   * Never flash a private page before the session check is complete.
   */
  if (authCheckLoading || !isAuthenticated) {
    return (
      <main style={s.loadingPage}>
        <div style={s.loadingText}>Checking sign-in...</div>
      </main>
    );
  }

  return (
    <>
      <TopNav />

      {billingCheckLoading &&
      !initialBillingCheckComplete.current ? (
        <main style={s.loadingPage}>
          <div style={s.loadingText}>Checking account access...</div>
        </main>
      ) : shouldBlockPaidModules ? (
        <main style={s.blockedPage}>
          <section style={s.blockedPanel}>
            <div style={s.blockedEyebrow}>Account billing</div>

            <h1 style={s.blockedTitle}>
              PracticePilot access temporarily suspended
            </h1>

            <p style={s.blockedText}>
              Your organisation has an overdue PracticePilot invoice.
              Access to paid PracticePilot modules has been temporarily
              suspended until the outstanding billing is resolved.
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
              You can still open Billing to review your account and invoice
              information.
            </p>

            <div style={s.actions}>
              <Link href="/billing" style={s.primaryAction}>
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
    fontSize: 14,
    fontWeight: 700,
    color: "#64748b",
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
    letterSpacing: "0",
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
