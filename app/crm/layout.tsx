"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
  { label: "Client Database", href: "/crm" },
  { label: "New Client", href: "/crm/new-client" },
  { label: "Tasks", href: "/crm/tasks" },
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
      </aside>

      <main style={content}>{children}</main>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "calc(100vh - 60px)",
  display: "grid",
  gridTemplateColumns: "198px minmax(0, 1fr)",
  background: "#eef2f5",
};

const sidebar: React.CSSProperties = {
  minHeight: "100%",
  background: "#0f1f33",
  color: "#ffffff",
  borderRight: "1px solid #07111f",
};

const sidebarTitle: React.CSSProperties = {
  padding: "15px 10px 10px",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.16em",
};

const nav: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "0 8px 12px",
};

const navLink: React.CSSProperties = {
  display: "block",
  padding: "10px 8px",
  borderRadius: 0,
  color: "#e5edf5",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
  border: "1px solid transparent",
};

const activeNavLink: React.CSSProperties = {
  background: "#ffffff",
  color: "#0f1f33",
  border: "1px solid #d8dee7",
};

const content: React.CSSProperties = {
  minWidth: 0,
  background: "#eef2f5",
};
