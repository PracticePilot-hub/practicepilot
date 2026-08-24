"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  can_access_proposals?: boolean;
};

type NavItem = {
  label: string;
  href: string;
  show: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname.startsWith("/dashboard");
  }

    if (href === "/afs") {
    return pathname.startsWith("/afs") && !pathname.startsWith("/afs/settings");
  }

  if (href === "/compliance/paia") {
    return pathname.startsWith("/compliance/paia");
  }

  if (href === "/billing") {
    return pathname.startsWith("/billing") || pathname.startsWith("/admin/paia-billing");
  }

  if (href === "/settings") {
    return pathname.startsWith("/settings") || pathname.startsWith("/afs/settings");
  }

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
  const [afsMenuOpen, setAfsMenuOpen] = useState(false);
  const [billingMenuOpen, setBillingMenuOpen] = useState(false);
  const [afsMenuPosition, setAfsMenuPosition] = useState<MenuPosition>({
    top: 54,
    left: 0,
  });
  const [billingMenuPosition, setBillingMenuPosition] = useState<MenuPosition>({
    top: 54,
    left: 0,
  });

  const afsButtonRef = useRef<HTMLButtonElement | null>(null);
  const afsMenuRef = useRef<HTMLDivElement | null>(null);
  const billingButtonRef = useRef<HTMLButtonElement | null>(null);
  const billingMenuRef = useRef<HTMLDivElement | null>(null);

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

  function calculateAfsMenuPosition() {
    const button = afsButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();

    setAfsMenuPosition({
      top: Math.round(rect.bottom + 2),
      left: Math.round(rect.left),
    });
  }

  function calculateBillingMenuPosition() {
    const button = billingButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();

    setBillingMenuPosition({
      top: Math.round(rect.bottom + 2),
      left: Math.round(rect.left),
    });
  }

  function toggleAfsMenu() {
    calculateAfsMenuPosition();
    setBillingMenuOpen(false);
    setAfsMenuOpen((current) => !current);
  }

  function toggleBillingMenu() {
    calculateBillingMenuPosition();
    setAfsMenuOpen(false);
    setBillingMenuOpen((current) => !current);
  }

  useEffect(() => {
    if (!afsMenuOpen) return;

    calculateAfsMenuPosition();

    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;

      if (afsButtonRef.current?.contains(target)) return;
      if (afsMenuRef.current?.contains(target)) return;

      setAfsMenuOpen(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAfsMenuOpen(false);
    }

    function onWindowChange() {
      calculateAfsMenuPosition();
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [afsMenuOpen]);

  useEffect(() => {
    if (!billingMenuOpen) return;

    calculateBillingMenuPosition();

    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;

      if (billingButtonRef.current?.contains(target)) return;
      if (billingMenuRef.current?.contains(target)) return;

      setBillingMenuOpen(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setBillingMenuOpen(false);
    }

    function onWindowChange() {
      calculateBillingMenuPosition();
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [billingMenuOpen]);

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
        show:
          accessEnabled &&
          (internal || Boolean(profile?.can_access_crm)),
      },
      {
        label: "CRM",
        href: "/crm",
        show: accessEnabled && Boolean(profile?.can_access_crm),
      },
      {
        label: "Proposals",
        href: "/proposals",
        show: accessEnabled && Boolean(profile?.can_access_proposals),
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
      {
        label: "Billing",
        href: "/billing",
        show:
          accessEnabled &&
          (admin || Boolean(profile?.can_access_paia)),
      },
      {
        label: "Settings",
        href: "/settings",
        show: accessEnabled,
      },
    ];
  }, [profile]);

  const visibleNavItems = navItems.filter((item) => item.show);

  const afsDropdownItems = [
    {
      label: "Dashboard",
      href: "/afs",
      description: "AFS engagements and working files",
      enabled: true,
    },
    {
      label: "Templates",
      href: "/afs/templates",
      description: "Coming soon",
      enabled: false,
    },
    {
      label: "Reports",
      href: "/afs/reports",
      description: "Coming soon",
      enabled: false,
    },
  ];

  const billingDropdownItems = [
      {
    label: "Billing Control",
    href: "/admin/billing",
    description: "QuickBooks invoices, due dates, payments and access",
    enabled: true,
  },
    {
      label: "PAIA Billing",
      href: "/admin/paia-billing",
      description: "Manage franchisee PAIA charges and invoice batches",
      enabled: true,
    },
    {
  label: "AFS Billing",
  href: "/admin/afs-billing",
  description: "Manage AFS charges and QuickBooks invoice links",
  enabled: true,
},
    {
      label: "CRM Billing",
      href: "/admin/crm-billing",
      description: "Coming soon",
      enabled: false,
    },
  ];


  // PUBLIC MARKETING ROUTE:
  // Never show the authenticated PracticePilot application navigation here.
  if (pathname === "/financial-statements") {
    return null;
  }

  return (
    <>
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

                  if (item.href === "/afs") {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          ...styles.navLink,
                          ...(active ? styles.navLinkActive : {}),
                        }}
                      >
                        {item.label}
                      </Link>
                    );
                  }

                  if (
                    item.href === "/billing" &&
                    isAdminRole(profile?.role || "")
                  ) {
                    return (
                      <button
                        key={item.href}
                        ref={billingButtonRef}
                        type="button"
                        onClick={toggleBillingMenu}
                        style={{
                          ...styles.navLinkButton,
                          ...(active ? styles.navLinkActive : {}),
                        }}
                        aria-haspopup="menu"
                        aria-expanded={billingMenuOpen}
                      >
                        <span>{item.label}</span>
                        <span style={styles.chevron}>⌄</span>
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        ...styles.navLink,
                        ...(active ? styles.navLinkActive : {}),
                      }}
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

      {afsMenuOpen ? (
        <div
          ref={afsMenuRef}
          style={{
            ...styles.afsDropdownMenu,
            top: afsMenuPosition.top,
            left: afsMenuPosition.left,
          }}
          role="menu"
        >
          {afsDropdownItems.map((dropdownItem) => {
            const dropdownActive = isActivePath(pathname, dropdownItem.href);

            if (!dropdownItem.enabled) {
              return (
                <div key={dropdownItem.href} style={styles.afsDropdownDisabled}>
                  <span style={styles.afsDropdownLabel}>
                    {dropdownItem.label}
                  </span>
                  <span style={styles.afsDropdownDescription}>
                    {dropdownItem.description}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={dropdownItem.href}
                href={dropdownItem.href}
                onClick={() => setAfsMenuOpen(false)}
                style={{
                  ...styles.afsDropdownItem,
                  ...(dropdownActive ? styles.afsDropdownItemActive : {}),
                }}
                role="menuitem"
              >
                <span style={styles.afsDropdownLabel}>
                  {dropdownItem.label}
                </span>
                <span style={styles.afsDropdownDescription}>
                  {dropdownItem.description}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {billingMenuOpen ? (
        <div
          ref={billingMenuRef}
          style={{
            ...styles.afsDropdownMenu,
            top: billingMenuPosition.top,
            left: billingMenuPosition.left,
          }}
          role="menu"
        >
          {billingDropdownItems.map((dropdownItem) => {
            const dropdownActive = isActivePath(
              pathname,
              dropdownItem.href
            );

            if (!dropdownItem.enabled) {
              return (
                <div
                  key={dropdownItem.href}
                  style={styles.afsDropdownDisabled}
                >
                  <span style={styles.afsDropdownLabel}>
                    {dropdownItem.label}
                  </span>
                  <span style={styles.afsDropdownDescription}>
                    {dropdownItem.description}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={dropdownItem.href}
                href={dropdownItem.href}
                onClick={() => setBillingMenuOpen(false)}
                style={{
                  ...styles.afsDropdownItem,
                  ...(dropdownActive
                    ? styles.afsDropdownItemActive
                    : {}),
                }}
                role="menuitem"
              >
                <span style={styles.afsDropdownLabel}>
                  {dropdownItem.label}
                </span>
                <span style={styles.afsDropdownDescription}>
                  {dropdownItem.description}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

    </>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    position: "sticky",
    top: 0,
    zIndex: 10000,
    width: "100%",
    background: "#ffffff",
    borderBottom: "1px solid #dbe3ef",
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
    overflow: "visible",
  },
  inner: {
    minHeight: "54px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "0 18px",
    boxSizing: "border-box",
    overflow: "visible",
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
    overflow: "visible",
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
  navLinkButton: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: "54px",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    border: 0,
    borderBottom: "3px solid transparent",
    padding: "3px 0 0",
    boxSizing: "border-box",
    flex: "0 0 auto",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  navLinkActive: {
    color: "#0f172a",
    boxShadow: "inset 0 -3px 0 #2563eb",
    fontWeight: 900,
  },
  chevron: {
    fontSize: 13,
    lineHeight: 1,
    transform: "translateY(-1px)",
  },
  afsDropdownMenu: {
    position: "fixed",
    zIndex: 2147483647,
    minWidth: 260,
    background: "#ffffff",
    border: "1px solid #94a3b8",
    boxShadow: "0 22px 55px rgba(15, 23, 42, 0.24)",
    padding: 6,
    overflow: "visible",
  },
  afsDropdownItem: {
    display: "grid",
    gap: 2,
    padding: "9px 10px",
    color: "#0f172a",
    textDecoration: "none",
    borderLeft: "3px solid transparent",
    background: "#ffffff",
  },
  afsDropdownItemActive: {
    background: "#eff6ff",
    borderLeftColor: "#2563eb",
  },
  afsDropdownDisabled: {
    display: "grid",
    gap: 2,
    padding: "9px 10px",
    color: "#94a3b8",
    borderLeft: "3px solid transparent",
    background: "#f8fafc",
    cursor: "not-allowed",
  },
  afsDropdownLabel: {
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  afsDropdownDescription: {
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.2,
    color: "#64748b",
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
