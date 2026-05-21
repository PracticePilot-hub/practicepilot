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

export default function TopNav() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const hideNav = pathname === "/login" || pathname === "/reset-password";

  useEffect(() => {
    if (!hideNav) {
      loadProfile();
    }
  }, [hideNav]);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      return;
    }

    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setProfile(data || null);
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

      <a href="/dashboard">Dashboard</a>

      {isInternalUser && <a href="/crm">CRM</a>}

      {(isInternalUser || profile?.can_access_accounting) && (
        <a href="#">Accounting</a>
      )}

      {isInternalUser && <a href="#">Financial Statements</a>}

      {isInternalUser && <a href="#">Secretarial</a>}

      {(isInternalUser || profile?.can_access_projects) && (
        <a href="/project-management">Projects</a>
      )}

      {isInternalUser && (
        <a href="/management-reports">Management Reports</a>
      )}

      {isInternalUser && <a href="/admin/clients">Admin Clients</a>}

      {isInternalUser && <a href="/admin/users">Admin Users</a>}

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