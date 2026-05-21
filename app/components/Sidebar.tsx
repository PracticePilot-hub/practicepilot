"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const baseStyle = {
    textDecoration: "none",
    color: "#333",
    padding: "6px 10px",
    borderRadius: 6,
    display: "block",
  };

  return (
    <div
      style={{
        width: collapsed ? 60 : 120,
        height: "100vh",
        borderRight: "1px solid #ddd",
        padding: "10px 8px",
        boxSizing: "border-box",
      }}
    >
      {/* Collapse Button */}
      <div style={{ marginBottom: 10 }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            cursor: "pointer",
            border: "1px solid #ccc",
            background: "#f5f5f5",
            borderRadius: 6,
            padding: "2px 6px",
          }}
        >
          {collapsed ? ">>>" : "<<<"}
        </button>
      </div>

      {!collapsed && (
        <>
          <h4
            style={{
              marginBottom: 10,
              fontSize: 12,
              color: "#888",
              textTransform: "uppercase",
            }}
          >
            CRM
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            
            {/* HOME */}
            <Link
              href="/crm"
              style={{
                ...baseStyle,
                background: pathname === "/crm" ? "#dcdcdc" : "transparent",
              }}
            >
              Home
            </Link>

            {/* NEW CLIENT */}
            <Link
              href="/crm/new-client"
              style={{
                ...baseStyle,
                background: pathname === "/crm/new-client" ? "#dcdcdc" : "transparent",
              }}
            >
              New Client
            </Link>

            {/* EDIT CLIENT */}
            <Link
              href="/crm/edit-client"
              style={{
                ...baseStyle,
                background: pathname === "/crm/edit-client" ? "#dcdcdc" : "transparent",
              }}
            >
              Edit Client
            </Link>

          </div>
        </>
      )}
    </div>
  );
}