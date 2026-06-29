"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_access_crm?: boolean;
  can_access_accounting?: boolean;
  can_access_afs?: boolean;
  can_access_secretarial?: boolean;
  can_access_projects?: boolean;
  can_access_management_reports?: boolean;
  can_access_paia?: boolean;
};

type NavItem = {
  label: string;
  href: string;
  show: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/" || pathname.startsWith("/dashboard");
  if (href === "/afs") return pathname.startsWith("/afs");
  if (href === "/compliance/paia") return pathname.startsWith("/compliance/paia");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAdminRole(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function isInternalRole(role: string) {
  return role === "Super Admin" || role === "Admin" || role === "Staff";
}

function canAccessCubeChem(email: string) {
  const normalisedEmail = email.toLowerCase().trim();

  return (
    normalisedEmail === "ferdi_v@bizzacc.co.za" ||
    normalisedEmail === "christo.botha@cubechem.co.za"
  );
}

export default function TopNav() {
  const pathname = usePathname() || "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData.user;

        if (!authUser?.id) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .single();

        if (profileError || !profileData) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setProfile(profileData);
          setLoading(false);
        }
      } catch (error) {
        console.error("TOP NAV PROFILE ERROR:", error);

        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo<NavItem[]>(() => {
    const role = profile?.role || "";
    const email = profile?.email || "";
    const admin = isAdminRole(role);
    const internal = isInternalRole(role);
    const accessEnabled = Boolean(profile?.access_enabled);

    return [
      {
        label: "PilotHub",
        href: "/dashboard",
        show: accessEnabled && internal,
      },
      {
        label: "CRM",
        href: "/crm",
        show: accessEnabled && Boolean(profile?.can_access_crm),
      },
      {
        label: "Accounting",
        href: "/accounting-system",
        show: accessEnabled && Boolean(profile?.can_access_accounting),
      },
      {
        label: "Financial Statements",
        href: "/afs",
        show: accessEnabled && Boolean(profile?.can_access_afs),
      },
      {
        label: "PAIA Manuals",
        href: "/compliance/paia",
        show: accessEnabled && Boolean(profile?.can_access_paia),
      },
      {
        label: "Secretarial",
        href: "/secretarial",
        show: accessEnabled && Boolean(profile?.can_access_secretarial),
      },
      {
        label: "Projects",
        href: "/project-management",
        show: accessEnabled && Boolean(profile?.can_access_projects),
      },
      {
        label: "Management Reports",
        href: "/management-reports",
        show: accessEnabled && Boolean(profile?.can_access_management_reports),
      },
      {
        label: "Admin Clients",
        href: "/admin/clients",
        show: accessEnabled && admin,
      },
      {
        label: "Admin Users",
        href: "/admin/users",
        show: accessEnabled && admin,
      },
      {
        label: "CubeChem",
        href: "/cubechem",
        show: accessEnabled && canAccessCubeChem(email),
      },
    ];
  }, [profile]);

  const visibleNavItems = navItems.filter((item) => item.show);

  return (
    <header style={styles.shell}>
      <div style={styles.inner}>
        <Link href="/dashboard" style={styles.brand}>
          PracticePilot
        </Link>

        <nav style={styles.nav} aria-label="Main navigation">
          {loading
            ? null
            : visibleNavItems.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{ ...styles.navLink, ...(active ? styles.navLinkActive : {}) }}
                  >
                    {item.label}
                  </Link>
                );
              })}
        </nav>

        <Link href="/login" style={styles.logout}>
          Logout
        </Link>
      </div>
    </header>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    position: "sticky",
    top: 0,
    zIndex: 2000,
    width: "100%",
    background: "#ffffff",
    borderBottom: "1px solid #dbe3ef",
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
  },
  inner: {
    minHeight: "54px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "0 18px",
    boxSizing: "border-box",
    overflowX: "auto",
    whiteSpace: "nowrap",
  },
  brand: {
    color: "#0f172a",
    textDecoration: "none",
    fontSize: "20px",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    flex: "0 0 auto",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flex: "1 1 auto",
    minWidth: 0,
  },
  navLink: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    height: "54px",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    borderBottom: "3px solid transparent",
    paddingTop: "3px",
    boxSizing: "border-box",
    flex: "0 0 auto",
  },
  navLinkActive: {
    color: "#0f172a",
    borderBottomColor: "#2563eb",
    fontWeight: 900,
  },
  logout: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    textDecoration: "none",
    borderRadius: "9px",
    padding: "9px 14px",
    fontSize: "12px",
    fontWeight: 850,
    flex: "0 0 auto",
  },
};