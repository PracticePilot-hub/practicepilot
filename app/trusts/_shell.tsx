"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ui } from "./_lib";

export default function TrustShell({
  trustId,
  trustName,
  children,
}: {
  trustId: string;
  trustName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const items = [
    ["Overview", `/trusts/${trustId}`],
    ["Trust Details", `/trusts/${trustId}/details`],
    ["People & Roles", `/trusts/${trustId}/people`],
    ["Beneficiaries", `/trusts/${trustId}/beneficiaries`],
    ["Deed Settings", `/trusts/${trustId}/deed-settings`],
    ["Trust Deed", `/trusts/${trustId}/deed`],
    ["Registration Pack", `/trusts/${trustId}/registration-pack`],
  ];

  return (
    <div style={ui.page}>
      <div style={ui.hero}>
        <div>
          <div style={ui.eyebrow}>Trusts</div>
          <h1 style={ui.h1}>{trustName}</h1>
          <p style={ui.sub}>New trust registration working file</p>
        </div>
        <Link href="/trusts" style={ui.secondary}>← All trusts</Link>
      </div>

      <div style={{ display: "flex", border: "1px solid #d7e0df", background: "#fff", marginBottom: 16, overflowX: "auto" }}>
        {items.map(([label, href]) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{ padding: "11px 13px", textDecoration: "none", color: active ? "#fff" : "#10233a", background: active ? "#10233a" : "#fff", borderRight: "1px solid #e4eae9", fontSize: 12, fontWeight: 850, whiteSpace: "nowrap" }}>
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
