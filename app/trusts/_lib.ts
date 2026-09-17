"use client";

import { supabase } from "../lib/supabase";

export const supabaseAny = supabase as any;

export type TrustContext = {
  userId: string;
  organisationId: string;
  email: string;
  role: string;
};

export type TrustRecord = {
  id: string;
  organisation_id: string;
  name: string;
  trust_type: string;
  masters_office: string | null;
  status: string;
  registration_number: string | null;
  registration_date: string | null;
  tax_number: string | null;
  initial_donation: number | null;
  donation_form: string | null;
  initial_donation_received: boolean | null;
  tax_residency_country: string | null;
  it3t_trust_type: string | null;
  tax_return_trust_type: string | null;
  urn_number: string | null;
  is_trading_trust: boolean | null;
  deed_revision: number | null;
  document_signatory_count: number | null;
  bank_signatory_count: number | null;
  mandatory_signatory_party_id: string | null;
  fallback_beneficiary_rule: string | null;
  final_distribution_age: number | null;
  deed_settings_confirmed: boolean | null;
  deed_settings_confirmed_at: string | null;
  bank_account_status: "to_open_after_registration" | "existing" | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_branch_code: string | null;
  bank_account_number: string | null;
  physical_line1: string | null;
  physical_line2: string | null;
  physical_city: string | null;
  physical_province: string | null;
  physical_postal_code: string | null;
  postal_line1: string | null;
  postal_line2: string | null;
  postal_city: string | null;
  postal_province: string | null;
  postal_postal_code: string | null;
  created_at: string;
  updated_at: string;
};

export type TrustParty = {
  id: string;
  trust_id: string;
  organisation_id: string;
  party_kind: "individual" | "entity";
  first_names: string | null;
  surname: string | null;
  full_name: string;
  id_number: string | null;
  registration_number: string | null;
  email: string | null;
  mobile: string | null;
  occupation: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  representative_name: string | null;
  representative_first_names: string | null;
  representative_surname: string | null;
  representative_id_number: string | null;
  appointment_date: string | null;
  phone: string | null;
  postal_line1: string | null;
  postal_line2: string | null;
  postal_city: string | null;
  postal_province: string | null;
  postal_postal_code: string | null;
  accreditation_body: string | null;
  accreditation_number: string | null;
  trust_administration_experience: string | null;
  j417_related_to_beneficiary_or_trustee: boolean | null;
  j417_all_beneficiaries_related: boolean | null;
  j417_direct_control: boolean | null;
  j417_convicted_dishonesty: boolean | null;
  j417_insolvent: boolean | null;
  j417_removed_as_trustee: boolean | null;
  j417_incapacitated: boolean | null;
  j417_understands_trust_law: boolean | null;
  j417_aware_fiduciary_duties: boolean | null;
  j417_accepts_civil_criminal_exposure: boolean | null;
  j417_accepts_master_removal: boolean | null;
  j417_yes_reason: string | null;
  j417_no_reason: string | null;
  role_founder: boolean;
  role_trustee: boolean;
  role_independent_trustee: boolean;
  role_beneficiary: boolean;
  role_representative: boolean;
  role_accountant: boolean;
  is_income_beneficiary: boolean;
  is_capital_beneficiary: boolean;
  include_descendants: boolean;
  income_right_type: "discretionary" | "vested" | null;
  capital_right_type: "discretionary" | "vested" | null;
  beneficiary_named_date: string | null;
  has_received_benefits: boolean | null;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_id_number: string | null;
  created_at: string;
};

export async function getTrustContext(): Promise<TrustContext> {
  const {
    data: { user },
    error: userError,
  } = await supabaseAny.auth.getUser();

  if (userError || !user) {
    throw new Error("Your PracticePilot login could not be confirmed.");
  }

  const { data: profile, error: profileError } = await supabaseAny
    .from("user_profiles")
    .select("access_enabled, can_access_trusts, organisation_id, trusts_organisation_id, role, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.access_enabled) throw new Error("Your PracticePilot access is disabled.");
  const trustOrganisationId = profile?.trusts_organisation_id || profile?.organisation_id || null;

  if (!profile?.can_access_trusts || !trustOrganisationId) {
    throw new Error("Trusts has not been enabled for this login.");
  }

  return {
    userId: user.id,
    organisationId: trustOrganisationId,
    email: profile.email || user.email || "",
    role: profile.role || "",
  };
}

export async function loadTrust(trustId: string) {
  const context = await getTrustContext();
  const { data, error } = await supabaseAny
    .from("pp_trusts")
    .select("*")
    .eq("id", trustId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Trust not found or you do not have access to it.");
  return { context, trust: data as TrustRecord };
}

export async function loadTrustParties(trustId: string, organisationId: string) {
  const { data, error } = await supabaseAny
    .from("pp_trust_parties")
    .select("*")
    .eq("trust_id", trustId)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as TrustParty[];
}

export function partyRoles(party: TrustParty) {
  const roles: string[] = [];
  if (party.role_founder) roles.push("Founder");
  if (party.role_trustee) roles.push("Trustee");
  if (party.role_independent_trustee) roles.push("Independent Trustee");
  if (party.role_beneficiary) roles.push("Beneficiary");
  if (party.role_accountant) roles.push("Accountant");
  if (party.role_representative) roles.push("Representative");
  return roles;
}

export const ui = {
  page: { minHeight: "100vh", padding: "28px 30px 40px", background: "#f3f6f6", color: "#10233a" } as React.CSSProperties,
  hero: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 18 } as React.CSSProperties,
  eyebrow: { color: "#3f6b66", fontWeight: 850, fontSize: 13, marginBottom: 5 } as React.CSSProperties,
  h1: { margin: 0, fontSize: 32, lineHeight: 1.12, letterSpacing: "-0.025em", color: "#10233a" } as React.CSSProperties,
  sub: { margin: "7px 0 0", fontSize: 14, color: "#61707d", lineHeight: 1.45 } as React.CSSProperties,
  primary: { display: "inline-flex", alignItems: "center", minHeight: 38, padding: "0 14px", border: "1px solid #10233a", background: "#10233a", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 850, cursor: "pointer" } as React.CSSProperties,
  secondary: { display: "inline-flex", alignItems: "center", minHeight: 38, padding: "0 14px", border: "1px solid #cbd6d5", background: "#fff", color: "#10233a", textDecoration: "none", fontSize: 12, fontWeight: 850, cursor: "pointer" } as React.CSSProperties,
  panel: { border: "1px solid #d7e0df", background: "#fff", marginBottom: 16 } as React.CSSProperties,
  panelHeader: { padding: "13px 15px", borderBottom: "1px solid #e4eae9", fontWeight: 900, fontSize: 16 } as React.CSSProperties,
  panelBody: { padding: 15 } as React.CSSProperties,
  grid2: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 } as React.CSSProperties,
  grid3: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 } as React.CSSProperties,
  label: { display: "grid", gap: 5, color: "#465966", fontSize: 12, fontWeight: 800 } as React.CSSProperties,
  input: { width: "100%", boxSizing: "border-box", minHeight: 39, padding: "0 10px", border: "1px solid #cbd6d5", background: "#fff", color: "#10233a", fontSize: 13, outline: "none" } as React.CSSProperties,
  textarea: { width: "100%", boxSizing: "border-box", minHeight: 92, padding: 10, border: "1px solid #cbd6d5", background: "#fff", color: "#10233a", fontSize: 13, outline: "none", resize: "vertical" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 } as React.CSSProperties,
  th: { textAlign: "left", padding: "9px 10px", background: "#f5f8f8", borderBottom: "1px solid #dfe7e6", color: "#465966", fontWeight: 900 } as React.CSSProperties,
  td: { padding: "10px", borderBottom: "1px solid #e7eceb", verticalAlign: "top" } as React.CSSProperties,
  error: { marginBottom: 14, padding: "11px 13px", border: "1px solid #e4a0a0", background: "#fff3f3", color: "#9f2d2d", fontSize: 12, fontWeight: 750 } as React.CSSProperties,
  success: { marginBottom: 14, padding: "11px 13px", border: "1px solid #b9d4cf", background: "#f2f8f7", color: "#315f59", fontSize: 12, fontWeight: 750 } as React.CSSProperties,
};
