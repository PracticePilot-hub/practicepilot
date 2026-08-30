"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
  { label: "My Day", href: "/crm" },
  { label: "My Work", href: "/crm/tasks" },
  { label: "Clients", href: "/crm/clients" },
  { label: "New Client", href: "/crm/new-client" },
  { label: "Secretarial", href: "/crm/secretarial" },
];

export default function CRMLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/crm") return pathname === "/crm";
    return pathname.startsWith(href);
  }

  return (
    <div style={shell}>
      <aside style={sidebar}>
        <div style={sidebarTitle}>CRM</div>

        <nav style={nav}>
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...navLink,
                  ...(active ? activeNavLink : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={sidebarFooter}>
          <div style={sidebarFooterLabel}>PRACTICEPILOT</div>
          <div style={sidebarFooterText}>
            Work first. Data second.
          </div>
        </div>
      </aside>

      <main style={content}>{children}</main>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "calc(100vh - 60px)",
  display: "grid",
  gridTemplateColumns: "198px minmax(0, 1fr)",
  background: "#f7f5f0",
};

const sidebar: React.CSSProperties = {
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#10233a",
  color: "#ffffff",
  borderRight: "1px solid #08172a",
};

const sidebarTitle: React.CSSProperties = {
  padding: "18px 16px 11px",
  color: "#9caabd",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.16em",
};

const nav: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "0 9px 14px",
};

const navLink: React.CSSProperties = {
  display: "block",
  padding: "10px 10px",
  borderRadius: 0,
  color: "#dfe7ef",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 800,
  border: "1px solid transparent",
};

const activeNavLink: React.CSSProperties = {
  background: "#ffffff",
  color: "#10233a",
  borderColor: "#d8dee7",
};

const sidebarFooter: React.CSSProperties = {
  marginTop: "auto",
  padding: "16px",
  borderTop: "1px solid #26384d",
};

const sidebarFooterLabel: React.CSSProperties = {
  color: "#9caabd",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.12em",
};

const sidebarFooterText: React.CSSProperties = {
  marginTop: "4px",
  color: "#d9e2eb",
  fontSize: "10px",
};

const content: React.CSSProperties = {
  minWidth: 0,
  background: "#f7f5f0",
};
