"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

const navItems = [
  { label: "PilotHub", href: "/dashboard" },
  { label: "CRM", href: "/crm" },
  { label: "Accounting", href: "/accounting-system" },
  { label: "Financial Statements", href: "/afs" },
  { label: "PAIA Manuals", href: "/compliance/paia" },
  { label: "Secretarial", href: "/secretarial" },
  { label: "Projects", href: "/project-management" },
  { label: "Management Reports", href: "/management-reports" },
  { label: "Admin Clients", href: "/admin/clients" },
  { label: "Admin Users", href: "/admin/users" },
  { label: "CubeChem", href: "/cubechem" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/" || pathname.startsWith("/dashboard");
  if (href === "/afs") return pathname.startsWith("/afs");
  if (href === "/compliance/paia") return pathname.startsWith("/compliance/paia");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TopNav() {
  const pathname = usePathname() || "";

  return (
    <header style={styles.shell}>
      <div style={styles.inner}>
        <Link href="/dashboard" style={styles.brand}>PracticePilot</Link>

        <nav style={styles.nav} aria-label="Main navigation">
          {navItems.map((item) => {
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

        <Link href="/login" style={styles.logout}>Logout</Link>
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
