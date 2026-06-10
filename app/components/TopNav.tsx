"use client";

import { useEffect, useState } from "react";
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

  const isCubeChemOnlyUser =
    cubeChemAccess.allowed && !isInternalUser && userEmail === "christo.botha@cubechem.co.za";

  return (
    <div
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: "1px solid #ddd",
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "#ffffff",
        gap: 20,
      }}
    >
      <strong style={{ fontSize: 18 }}>PracticePilot</strong>

      {!isCubeChemOnlyUser && <a href="/dashboard">PilotHub</a>}

      {!isCubeChemOnlyUser && isInternalUser && <a href="/crm">CRM</a>}

      {!isCubeChemOnlyUser && (isInternalUser || profile?.can_access_accounting) && (
        <a href="#">Accounting</a>
      )}

      {!isCubeChemOnlyUser && isInternalUser && <a href="#">Financial Statements</a>}

      {!isCubeChemOnlyUser && isInternalUser && <a href="#">Secretarial</a>}

      {!isCubeChemOnlyUser && (isInternalUser || profile?.can_access_projects) && (
        <a href="/project-management">Projects</a>
      )}

      {!isCubeChemOnlyUser && isInternalUser && (
        <a href="/management-reports">Management Reports</a>
      )}

      {!isCubeChemOnlyUser && isInternalUser && <a href="/admin/clients">Admin Clients</a>}

      {!isCubeChemOnlyUser && isInternalUser && <a href="/admin/users">Admin Users</a>}

      {cubeChemAccess.allowed && <a href="/cubechem">CubeChem</a>}

      <button
        onClick={logout}
        style={{
          marginLeft: "auto",
          background: "#eef3f8",
          color: "#12304a",
          border: "1px solid #d5dde6",
          borderRadius: "10px",
          padding: "8px 14px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}