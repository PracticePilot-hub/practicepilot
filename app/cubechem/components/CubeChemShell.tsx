"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

type CubeChemShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    heading: "Price Management",
    items: [
      {
        label: "Supplier Uploads",
        href: "/cubechem",
        exact: true,
      },
      {
        label: "Price Review",
        href: "/cubechem/price-review",
      },
      {
        label: "Price Lists",
        href: "/cubechem/price-lists",
      },
    ],
  },
  {
    heading: "Orders",
    items: [
      {
        label: "HQ Supplier Order",
        href: "/cubechem/hq-order",
      },
    ],
  },
  {
    heading: "Partners",
    items: [
      {
        label: "Agents & Alliance Partners",
        href: "/cubechem/partners",
      },
    ],
  },
];

export default function CubeChemShell({
  title,
  description,
  children,
}: CubeChemShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(item: NavItem) {
    if (item.exact) {
      return pathname === item.href;
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <main style={pageStyle}>
      <aside style={sidebarStyle}>
        <div style={brandBlockStyle}>
          <div style={brandEyebrowStyle}>PracticePilot</div>
          <div style={brandTitleStyle}>CubeChem</div>
          <div style={brandTextStyle}>
            Pricing, supplier orders and partner management
          </div>
        </div>

        <nav style={navStyle}>
          {navGroups.map((group) => (
            <div key={group.heading} style={navGroupStyle}>
              <div style={navHeadingStyle}>{group.heading}</div>

              <div style={navItemsStyle}>
                {group.items.map((item) => {
                  const active = isActive(item);

                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => router.push(item.href)}
                      style={{
                        ...navButtonStyle,
                        ...(active ? navButtonActiveStyle : {}),
                      }}
                    >
                      <span
                        style={{
                          ...navIndicatorStyle,
                          opacity: active ? 1 : 0,
                        }}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <section style={workspaceStyle}>
        <header style={workspaceHeaderStyle}>
          <div>
            <h1 style={titleStyle}>{title}</h1>
            {description ? (
              <p style={descriptionStyle}>{description}</p>
            ) : null}
          </div>
        </header>

        <div style={contentStyle}>{children}</div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#eaf0f7",
  display: "grid",
  gridTemplateColumns: "250px minmax(0, 1fr)",
};

const sidebarStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0f1f33",
  color: "#ffffff",
  borderRight: "1px solid #1e334d",
  position: "sticky",
  top: 0,
  alignSelf: "start",
  display: "flex",
  flexDirection: "column",
};

const brandBlockStyle: React.CSSProperties = {
  padding: "24px 20px 20px",
  borderBottom: "1px solid #263a52",
};

const brandEyebrowStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#8fa5bd",
};

const brandTitleStyle: React.CSSProperties = {
  marginTop: "5px",
  fontSize: "25px",
  fontWeight: 900,
  letterSpacing: "-0.02em",
};

const brandTextStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "#b8c5d3",
  fontSize: "12px",
  lineHeight: 1.5,
};

const navStyle: React.CSSProperties = {
  padding: "18px 0 28px",
};

const navGroupStyle: React.CSSProperties = {
  marginBottom: "22px",
};

const navHeadingStyle: React.CSSProperties = {
  padding: "0 20px 8px",
  color: "#8297ad",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const navItemsStyle: React.CSSProperties = {
  display: "grid",
  gap: "2px",
};

const navButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "42px",
  border: "none",
  borderRadius: 0,
  background: "transparent",
  color: "#d9e2ec",
  display: "grid",
  gridTemplateColumns: "4px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
  padding: "0 20px 0 0",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 750,
  cursor: "pointer",
};

const navButtonActiveStyle: React.CSSProperties = {
  background: "#182c45",
  color: "#ffffff",
};

const navIndicatorStyle: React.CSSProperties = {
  width: "4px",
  height: "42px",
  background: "#2f80ed",
};

const workspaceStyle: React.CSSProperties = {
  minWidth: 0,
};

const workspaceHeaderStyle: React.CSSProperties = {
  background: "#ffffff",
  borderBottom: "1px solid #cbd5e1",
  padding: "22px 28px 18px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "25px",
  fontWeight: 900,
  letterSpacing: "-0.02em",
};

const descriptionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.5,
};

const contentStyle: React.CSSProperties = {
  padding: "22px 28px 36px",
};
