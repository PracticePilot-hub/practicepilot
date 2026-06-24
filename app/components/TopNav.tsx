"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;

  can_access_accounting: boolean;
  can_access_projects: boolean;
  can_access_budgeting: boolean;

  can_access_crm?: boolean;
  can_access_afs?: boolean;
  can_access_secretarial?: boolean;
  can_access_management_reports?: boolean;
  can_access_paia?: boolean;
};

type CubeChemAccess = {
  allowed: boolean;
  accessLevel: string | null;
};

export default function TopNav() {
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [cubeChemAccess, setCubeChemAccess] = useState<CubeChemAccess>({
    allowed: false,
    accessLevel: null,
  });

  const hideNav = pathname === "/login" || pathname === "/reset-password";

  useEffect(() => {
    if (!hideNav) {
      loadProfileAndAccess();
    }
  }, [hideNav]);

  async function loadProfileAndAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setProfile(null);
      setUserEmail("");
      setCubeChemAccess({ allowed: false, accessLevel: null });
      return;
    }

    const email = user.email.toLowerCase();
    setUserEmail(email);

    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    setProfile(data || null);

    try {
      const accessRes = await fetch("/api/cubechem/check-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const accessData = await accessRes.json();

      setCubeChemAccess({
        allowed: Boolean(accessData.allowed),
        accessLevel: accessData.accessLevel || null,
      });
    } catch {
      setCubeChemAccess({ allowed: false, accessLevel: null });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (hideNav) {
    return null;
  }

  const isInternalUser =
    profile?.role === "Super Admin" ||
    profile?.role === "Admin" ||
    profile?.role === "Staff";

  const isAdminUser =
    profile?.role === "Super Admin" || profile?.role === "Admin";

  const isCubeChemOnlyUser =
    cubeChemAccess.allowed &&
    !isInternalUser &&
    userEmail === "christo.botha@cubechem.co.za";

  const canUseCrm = isAdminUser || Boolean(profile?.can_access_crm);
  const canUseAccounting =
    isAdminUser || Boolean(profile?.can_access_accounting);
  const canUseAfs = isAdminUser || Boolean(profile?.can_access_afs);
  const canUseSecretarial =
    isAdminUser || Boolean(profile?.can_access_secretarial);
  const canUseProjects =
    isAdminUser || Boolean(profile?.can_access_projects);
  const canUseManagementReports =
    isAdminUser || Boolean(profile?.can_access_management_reports);
  const canUsePaia = isAdminUser || Boolean(profile?.can_access_paia);

  const navLinkStyle: CSSProperties = {
    color: "#102a43",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.1,
    padding: "8px 9px",
    borderRadius: 8,
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        minHeight: 58,
        display: "flex",
        alignItems: "center",
        padding: "8px 18px",
        borderBottom: "1px solid #d8e3ef",
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "#ffffff",
        gap: 12,
      }}
    >
      <strong
        style={{
          fontSize: 18,
          color: "#071d33",
          whiteSpace: "nowrap",
          marginRight: 4,
        }}
      >
        PracticePilot
      </strong>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
          flex: 1,
        }}
      >
        {!isCubeChemOnlyUser && (
          <a style={navLinkStyle} href="/dashboard">
            PilotHub
          </a>
        )}

        {!isCubeChemOnlyUser && canUseCrm && (
          <a style={navLinkStyle} href="/crm">
            CRM
          </a>
        )}

        {!isCubeChemOnlyUser && canUseAccounting && (
          <a style={navLinkStyle} href="#">
            Accounting
          </a>
        )}

        {!isCubeChemOnlyUser && canUseAfs && (
          <a style={navLinkStyle} href="#">
            Financial Statements
          </a>
        )}

        {!isCubeChemOnlyUser && canUseSecretarial && (
          <a style={navLinkStyle} href="#">
            Secretarial
          </a>
        )}

        {!isCubeChemOnlyUser && canUseProjects && (
          <a style={navLinkStyle} href="/project-management">
            Projects
          </a>
        )}

        {!isCubeChemOnlyUser && canUseManagementReports && (
          <a style={navLinkStyle} href="/management-reports">
            Management Reports
          </a>
        )}

        {!isCubeChemOnlyUser && canUsePaia && (
          <a style={navLinkStyle} href="/compliance/paia">
            PAIA Manuals
          </a>
        )}

        {!isCubeChemOnlyUser && isAdminUser && (
          <a style={navLinkStyle} href="/admin/clients">
            Admin Clients
          </a>
        )}

        {!isCubeChemOnlyUser && isAdminUser && (
          <a style={navLinkStyle} href="/admin/users">
            Admin Users
          </a>
        )}

        {cubeChemAccess.allowed && (
          <a style={navLinkStyle} href="/cubechem">
            CubeChem
          </a>
        )}
      </nav>

      <button
        onClick={logout}
        style={{
          marginLeft: "auto",
          background: "#eef3f8",
          color: "#12304a",
          border: "1px solid #d5dde6",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Logout
      </button>
    </div>
  );
}