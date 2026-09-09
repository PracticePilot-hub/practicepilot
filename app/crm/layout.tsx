"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

const navItems = [
  { label: "My Day", href: "/crm", icon: "day" as IconName },
  { label: "My Work", href: "/crm/tasks", icon: "work" as IconName },
  { label: "Clients", href: "/crm/clients", icon: "clients" as IconName },
  { label: "New Client", href: "/crm/new-client", icon: "newClient" as IconName },
  { label: "Secretarial", href: "/crm/secretarial", icon: "secretarial" as IconName },
];

type ClientSummary = {
  client_name: string;
  status: string | null;
};

type IconName = string;

function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<string, ReactNode> = {
    day: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="1" />
        <path d="M8 3v4M16 3v4M4 10h16" />
        <path d="M8 14h3M8 17h5" />
      </>
    ),
    work: (
      <>
        <path d="M5 7h14v13H5z" />
        <path d="M9 7V4h6v3M5 11h14" />
        <path d="m9 15 2 2 4-4" />
      </>
    ),
    clients: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c.5-4 2.2-6 5-6 2.8 0 4.5 2 5 6" />
        <path d="M14 15c3 0 5 1.7 5.5 5" />
      </>
    ),
    newClient: (
      <>
        <circle cx="9" cy="9" r="3" />
        <path d="M3 20c.6-4 2.6-6 6-6 2 0 3.5.7 4.5 2" />
        <path d="M17 12v8M13 16h8" />
      </>
    ),
    clientWork: (
      <>
        <path d="M5 7h14v13H5z" />
        <path d="M9 7V4h6v3M5 11h14" />
        <path d="M8 15h3M13 15h3M8 18h8" />
      </>
    ),
    overview: (
      <>
        <path d="M4 13h6V4H4z" />
        <path d="M14 20h6v-9h-6z" />
        <path d="M14 4h6v3h-6z" />
        <path d="M4 17h6v3H4z" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
      </>
    ),
    services: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 3.1h5l.3-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z" />
      </>
    ),
    tasking: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="1" />
        <path d="M8 3v4M16 3v4M4 10h16" />
        <path d="m8 15 2 2 5-5" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2" />
        <path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6" />
        <path d="M15 15c3 0 4.7 1.7 5 5" />
      </>
    ),
    registrations: (
      <>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4M9 12h6M9 16h6" />
      </>
    ),
    secretarial: (
      <>
        <path d="M4 20h16M6 20V9l6-5 6 5v11" />
        <path d="M9 13h6M9 16h6" />
      </>
    ),
    documents: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    ),
    activity: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    core: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    contacts: (
      <>
        <path d="M5 4h14v16H5z" />
        <circle cx="10" cy="10" r="2" />
        <path d="M7 16c.4-2 1.4-3 3-3s2.6 1 3 3M15 9h2M15 13h2" />
      </>
    ),
    responsibility: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c.5-4 2.2-6 5-6 2.5 0 4.2 1.5 5 4" />
        <path d="M14 15h6M17 12v6" />
      </>
    ),
  };

  return <svg {...common}>{icons[name]}</svg>;
}

function getClientId(pathname: string, searchParams: URLSearchParams) {
  const match = pathname.match(/^\/crm\/client\/([^/]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  if (pathname === "/crm/edit-client") {
    return searchParams.get("id") || "";
  }

  return "";
}

export default function CRMLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clientId = useMemo(
    () => getClientId(pathname, searchParams),
    [pathname, searchParams]
  );

  const isNewClient = pathname === "/crm/new-client";
  const showClientPanel = Boolean(clientId) || isNewClient;

  const [clientSummary, setClientSummary] = useState<ClientSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!clientId) {
      setClientSummary(null);
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from("crm_clients")
        .select("client_name, status")
        .eq("id", clientId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Could not load client navigation summary:", error);
        return;
      }

      if (data) {
        setClientSummary(data as ClientSummary);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function isActive(href: string) {
    if (href === "/crm") return pathname === "/crm";
    return pathname.startsWith(href);
  }

  const tab = searchParams.get("tab") || "overview";
  const editSection = searchParams.get("section") || "services";
  const newSection = searchParams.get("section") || "core";

  const existingClientItems = clientId
    ? [
        {
          label: "Overview",
          icon: "overview" as IconName,
          href: `/crm/client/${clientId}?tab=overview`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "overview",
        },
        {
          label: "Client Profile",
          icon: "profile" as IconName,
          href: `/crm/client/${clientId}?tab=profile`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "profile",
        },
        {
          label: "Services",
          icon: "services" as IconName,
          href: `/crm/client/${clientId}?tab=services`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "services",
        },
        {
          label: "Work",
          icon: "clientWork" as IconName,
          href: `/crm/client/${clientId}?tab=work`,
          active:
            pathname.startsWith(`/crm/client/${clientId}/work/`) ||
            (pathname.startsWith(`/crm/client/${clientId}`) && tab === "work"),
        },
        {
          label: "People",
          icon: "people" as IconName,
          href: `/crm/client/${clientId}?tab=people`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "people",
        },
        {
          label: "Registrations",
          icon: "registrations" as IconName,
          href: `/crm/client/${clientId}?tab=registrations`,
          active:
            (pathname.startsWith(`/crm/client/${clientId}`) &&
              tab === "registrations") ||
            (pathname === "/crm/edit-client" && editSection === "statutory"),
        },
        {
          label: "Secretarial",
          icon: "secretarial" as IconName,
          href: `/crm/client/${clientId}?tab=secretarial`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "secretarial",
        },
        {
          label: "Documents",
          icon: "documents" as IconName,
          href: `/crm/client/${clientId}?tab=documents`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "documents",
        },
        {
          label: "Activity",
          icon: "activity" as IconName,
          href: `/crm/client/${clientId}?tab=activity`,
          active: pathname.startsWith(`/crm/client/${clientId}`) && tab === "activity",
        },
        {
          label: "Tasking Setup",
          icon: "tasking" as IconName,
          href: `/crm/edit-client?id=${clientId}&section=services`,
          active: pathname === "/crm/edit-client" && editSection === "services",
          setup: true,
        },
      ]
    : [];

  const newClientItems = [
    { label: "Core Details", icon: "core" as IconName, section: "core" },
    { label: "Services", icon: "services" as IconName, section: "services" },
    { label: "Tax & Registrations", icon: "registrations" as IconName, section: "statutory" },
    { label: "Contacts & Addresses", icon: "contacts" as IconName, section: "contacts" },
    { label: "Responsibility", icon: "responsibility" as IconName, section: "responsibility" },
    { label: "Tasking Setup", icon: "tasking" as IconName, section: "tasking", setup: true },
  ];

  return (
    <div
      style={{
        ...shell,
        gridTemplateColumns: showClientPanel
          ? "154px 182px minmax(0, 1fr)"
          : "154px minmax(0, 1fr)",
      }}
    >
      <aside style={sidebar}>
        <div style={sidebarTitle}>CRM</div>

        <nav style={nav}>
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onMouseDown={(event) => event.preventDefault()}
                style={{
                  ...navLink,
                  ...(active ? activeNavLink : {}),
                }}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={sidebarFooter}>
          <div style={sidebarFooterLabel}>PracticePilot</div>
          <div style={sidebarFooterText}>Work first. Data second.</div>
        </div>
      </aside>

      {showClientPanel ? (
        <aside style={clientSidebar}>
          <div style={clientHeader}>
            <div style={clientHeaderEyebrow}>
              {isNewClient ? "Client onboarding" : "Client working file"}
            </div>
            <div style={clientHeaderName}>
              {isNewClient
                ? "New Client"
                : clientSummary?.client_name || "Client"}
            </div>

            <div style={clientStatusLine}>
              <span style={clientStatusDot} />
              {isNewClient ? "New setup" : clientSummary?.status || "Active"}
            </div>
          </div>

          <nav style={clientNav}>
            {isNewClient
              ? newClientItems.map((item, index) => (
                  <div
                    key={`${item.section}-${item.label}`}
                    style={item.setup ? clientSetupDivider : undefined}
                  >
                  <Link
                    key={`${item.section}-${item.label}`}
                    href={`/crm/new-client?section=${item.section}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseUp={(event) => event.currentTarget.blur()}
                    style={{
                      ...clientNavLink,
                      ...(newSection === item.section ? clientNavLinkActive : {}),
                    }}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                  </div>
                ))
              : existingClientItems.map((item) => (
                  <div
                    key={item.label}
                    style={item.setup ? clientSetupDivider : undefined}
                  >
                  <Link
                    key={item.label}
                    href={item.href}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseUp={(event) => event.currentTarget.blur()}
                    style={{
                      ...clientNavLink,
                      ...(item.active ? clientNavLinkActive : {}),
                    }}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                  </div>
                ))}
          </nav>

          {!isNewClient && clientId ? (
            <div style={clientSidebarFoot}>
              <Link
                href={`/crm/edit-client?id=${clientId}&section=core`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseUp={(event) => event.currentTarget.blur()}
                style={editMasterLink}
              >
                Edit client master data →
              </Link>
            </div>
          ) : (
            <div style={clientSidebarFoot}>
              Complete the setup from top to bottom. Tasking previews before anything is generated.
            </div>
          )}
        </aside>
      ) : null}

      <main style={content}>{children}</main>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "calc(100vh - 60px)",
  display: "grid",
  background: "#eef2f5",
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
  padding: "15px 12px 8px",
  color: "#93a7ba",
  fontSize: "10px",
  fontWeight: 750,
  letterSpacing: 0,
};

const nav: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  padding: "0 7px 14px",
};

const navLink: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr)",
  alignItems: "center",
  gap: "7px",
  padding: "9px 8px",
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderStyle: "solid",
  borderColor: "transparent",
  outline: "none",
  boxShadow: "none",
  borderRadius: 0,
  color: "#dbe6ef",
  textDecoration: "none",
  fontSize: "10.5px",
  fontWeight: 800,
};

const activeNavLink: React.CSSProperties = {
  color: "#ffffff",
  background: "#1856a0",
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: "3px",
  borderStyle: "solid",
  borderColor: "#69aaff",
  boxShadow: "none",
};

const sidebarFooter: React.CSSProperties = {
  marginTop: "auto",
  padding: "16px",
  borderTop: "1px solid #26384d",
};

const sidebarFooterLabel: React.CSSProperties = {
  color: "#9caabd",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: 0,
};

const sidebarFooterText: React.CSSProperties = {
  marginTop: "4px",
  color: "#d9e2eb",
  fontSize: "10px",
};

const clientSidebar: React.CSSProperties = {
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#15314d",
  color: "#ffffff",
  borderRight: "1px solid #0b2034",
};

const clientHeader: React.CSSProperties = {
  padding: "15px 12px 13px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
};

const clientHeaderEyebrow: React.CSSProperties = {
  color: "#93a7ba",
  fontSize: "10px",
  fontWeight: 750,
  letterSpacing: 0,
};

const clientHeaderName: React.CSSProperties = {
  marginTop: "6px",
  color: "#ffffff",
  fontSize: "12.5px",
  fontWeight: 900,
  lineHeight: 1.25,
};

const clientStatusLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  marginTop: "8px",
  color: "#c5d3df",
  fontSize: "10px",
  fontWeight: 800,
};

const clientStatusDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#68bb7e",
};

const clientNav: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  padding: "9px 7px",
};

const clientNavLink: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0,1fr)",
  alignItems: "center",
  gap: "7px",
  padding: "9px 8px",
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderStyle: "solid",
  borderColor: "transparent",
  outline: "none",
  boxShadow: "none",
  borderRadius: 0,
  color: "#dbe6ef",
  textDecoration: "none",
  fontSize: "10.5px",
  fontWeight: 800,
};

const clientNavLinkActive: React.CSSProperties = {
  color: "#ffffff",
  background: "#1856a0",
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: "3px",
  borderStyle: "solid",
  borderColor: "#69aaff",
  boxShadow: "none",
};

const clientSetupDivider: React.CSSProperties = {
  marginTop: "10px",
  paddingTop: "9px",
  borderTop: "1px solid rgba(255,255,255,0.10)",
};

const clientSidebarFoot: React.CSSProperties = {
  marginTop: "auto",
  padding: "14px 16px",
  borderTop: "1px solid rgba(255,255,255,0.10)",
  color: "#91a5b8",
  fontSize: "9px",
  lineHeight: 1.45,
};

const editMasterLink: React.CSSProperties = {
  outline: "none",
  color: "#dce8f3",
  textDecoration: "none",
  fontWeight: 800,
};

const content: React.CSSProperties = {
  minWidth: 0,
  minHeight: "100%",
  background: "#eef2f5",
};
