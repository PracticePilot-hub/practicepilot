"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TrustShell from "../../_shell";
import { loadTrust, supabaseAny, TrustRecord, ui } from "../../_lib";

const physicalFields: Array<{ key: keyof TrustRecord; label: string }> = [
  { key: "physical_line1", label: "Line 1" },
  { key: "physical_line2", label: "Line 2" },
  { key: "physical_city", label: "City" },
  { key: "physical_province", label: "Province" },
  { key: "physical_postal_code", label: "Postal code" },
];

const postalFields: Array<{ key: keyof TrustRecord; label: string }> = [
  { key: "postal_line1", label: "Line 1" },
  { key: "postal_line2", label: "Line 2" },
  { key: "postal_city", label: "City" },
  { key: "postal_province", label: "Province" },
  { key: "postal_postal_code", label: "Postal code" },
];

export default function DetailsPage() {
  const params = useParams<{ trustId: string }>();
  const trustId = String(params.trustId);

  const [trust, setTrust] = useState<TrustRecord | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadTrust(trustId)
      .then((result) => setTrust(result.trust))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load trust details.")
      );
  }, [trustId]);

  if (!trust) {
    return (
      <div style={ui.page}>
        {error ? <div style={ui.error}>{error}</div> : "Loading…"}
      </div>
    );
  }

  const currentTrust = trust;

  function setField(key: keyof TrustRecord, value: unknown) {
    setTrust((previous) =>
      previous ? ({ ...previous, [key]: value } as TrustRecord) : previous
    );
  }

  function copyPhysicalToPostal() {
    setTrust((previous) =>
      previous
        ? {
            ...previous,
            postal_line1: previous.physical_line1,
            postal_line2: previous.physical_line2,
            postal_city: previous.physical_city,
            postal_province: previous.physical_province,
            postal_postal_code: previous.physical_postal_code,
          }
        : previous
    );
  }

  async function save() {
    setError("");
    setMsg("");

    const payload = {
      name: currentTrust.name,
      trust_type: currentTrust.trust_type,
      masters_office: currentTrust.masters_office,
      registration_number: currentTrust.registration_number || null,
      registration_date: currentTrust.registration_date || null,
      tax_number: currentTrust.tax_number || null,
      tax_residency_country: currentTrust.tax_residency_country || "South Africa",
      it3t_trust_type: currentTrust.it3t_trust_type || "inter_vivos",
      tax_return_trust_type:
        currentTrust.tax_return_trust_type || "inter_vivos_trust",
      urn_number: currentTrust.urn_number || null,
      is_trading_trust: Boolean(currentTrust.is_trading_trust),
      deed_revision: Number(currentTrust.deed_revision || 0),
      initial_donation: Number(currentTrust.initial_donation || 100),
      donation_form: currentTrust.donation_form || "cash",
      initial_donation_received: Boolean(currentTrust.initial_donation_received),
      bank_account_status:
        currentTrust.bank_account_status || "to_open_after_registration",
      bank_name: currentTrust.bank_name || null,
      bank_branch_name: currentTrust.bank_branch_name || null,
      bank_branch_code: currentTrust.bank_branch_code || null,
      bank_account_number:
        currentTrust.bank_account_status === "existing"
          ? currentTrust.bank_account_number || null
          : null,
      physical_line1: currentTrust.physical_line1,
      physical_line2: currentTrust.physical_line2,
      physical_city: currentTrust.physical_city,
      physical_province: currentTrust.physical_province,
      physical_postal_code: currentTrust.physical_postal_code,
      postal_line1: currentTrust.postal_line1,
      postal_line2: currentTrust.postal_line2,
      postal_city: currentTrust.postal_city,
      postal_province: currentTrust.postal_province,
      postal_postal_code: currentTrust.postal_postal_code,
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = await supabaseAny
      .from("pp_trusts")
      .update(payload)
      .eq("id", trustId)
      .eq("organisation_id", currentTrust.organisation_id);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMsg("Trust details saved.");
  }

  const bankStatus =
    currentTrust.bank_account_status || "to_open_after_registration";

  return (
    <TrustShell trustId={trustId} trustName={currentTrust.name}>
      {error ? <div style={ui.error}>{error}</div> : null}
      {msg ? <div style={ui.success}>{msg}</div> : null}

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Trust and statutory details</div>
        <div style={ui.panelBody}>
          <div style={ui.grid3}>
            <label style={ui.label}>Trust name<input style={ui.input} value={currentTrust.name || ""} onChange={(e) => setField("name", e.target.value)} /></label>
            <label style={ui.label}>Trust type<input style={ui.input} value={currentTrust.trust_type || "Inter Vivos Family Trust"} onChange={(e) => setField("trust_type", e.target.value)} /></label>
            <label style={ui.label}>Master's office<input style={ui.input} value={currentTrust.masters_office || ""} onChange={(e) => setField("masters_office", e.target.value)} /></label>
            <label style={ui.label}>Registration number<input style={ui.input} value={currentTrust.registration_number || ""} onChange={(e) => setField("registration_number", e.target.value)} /></label>
            <label style={ui.label}>Registration date<input style={ui.input} type="date" value={currentTrust.registration_date || ""} onChange={(e) => setField("registration_date", e.target.value)} /></label>
            <label style={ui.label}>Income tax number<input style={ui.input} value={currentTrust.tax_number || ""} onChange={(e) => setField("tax_number", e.target.value)} /></label>
            <label style={ui.label}>Tax residency<input style={ui.input} value={currentTrust.tax_residency_country || "South Africa"} onChange={(e) => setField("tax_residency_country", e.target.value)} /></label>
            <label style={ui.label}>IT3(t) trust type<select style={ui.input} value={currentTrust.it3t_trust_type || "inter_vivos"} onChange={(e) => setField("it3t_trust_type", e.target.value)}><option value="inter_vivos">Inter vivos</option></select></label>
            <label style={ui.label}>Tax return trust type<select style={ui.input} value={currentTrust.tax_return_trust_type || "inter_vivos_trust"} onChange={(e) => setField("tax_return_trust_type", e.target.value)}><option value="inter_vivos_trust">Inter vivos Trust</option></select></label>
            <label style={ui.label}>URN number<input style={ui.input} value={currentTrust.urn_number || ""} onChange={(e) => setField("urn_number", e.target.value)} placeholder="If available" /></label>
            <label style={ui.label}>Deed revision<input style={ui.input} type="number" min={0} value={Number(currentTrust.deed_revision || 0)} onChange={(e) => setField("deed_revision", Number(e.target.value || 0))} /></label>
            <label style={{ ...ui.label, alignContent: "end" }}><span>Trading trust for SARS?</span><span><input type="checkbox" checked={Boolean(currentTrust.is_trading_trust)} onChange={(e) => setField("is_trading_trust", e.target.checked)} /> Yes</span></label>
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Initial donation</div>
        <div style={ui.panelBody}>
          <div style={ui.grid3}>
            <label style={ui.label}>Form of donation<select style={ui.input} value={currentTrust.donation_form || "cash"} onChange={(e) => setField("donation_form", e.target.value)}><option value="cash">Amount / cash</option></select></label>
            <label style={ui.label}>Value (R)<input style={ui.input} type="number" value={Number(currentTrust.initial_donation || 100)} onChange={(e) => setField("initial_donation", Number(e.target.value || 0))} /></label>
            <label style={{ ...ui.label, alignContent: "end" }}><span>Received by trustees?</span><span><input type="checkbox" checked={Boolean(currentTrust.initial_donation_received)} onChange={(e) => setField("initial_donation_received", e.target.checked)} /> Yes</span></label>
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Bank account for registration</div>
        <div style={ui.panelBody}>
          <div style={ui.grid2}>
            <label style={ui.label}>
              Bank account status
              <select style={ui.input} value={bankStatus} onChange={(e) => setField("bank_account_status", e.target.value)}>
                <option value="to_open_after_registration">Account will be opened after registration</option>
                <option value="existing">Existing trust bank account</option>
              </select>
            </label>
            <label style={ui.label}>Bank name<input style={ui.input} value={currentTrust.bank_name || ""} onChange={(e) => setField("bank_name", e.target.value)} placeholder="e.g. First National Bank" /></label>
            <label style={ui.label}>Branch name<input style={ui.input} value={currentTrust.bank_branch_name || ""} onChange={(e) => setField("bank_branch_name", e.target.value)} placeholder="Optional / intended branch" /></label>
            <label style={ui.label}>Branch code<input style={ui.input} value={currentTrust.bank_branch_code || ""} onChange={(e) => setField("bank_branch_code", e.target.value)} placeholder="Optional" /></label>
            {bankStatus === "existing" ? (
              <label style={ui.label}>Account number<input style={ui.input} value={currentTrust.bank_account_number || ""} onChange={(e) => setField("bank_account_number", e.target.value)} /></label>
            ) : (
              <div style={ui.success}>Registration pack wording: <strong>Account will be opened after registration</strong>.</div>
            )}
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Addresses</div>
        <div style={ui.panelBody}>
          <div style={ui.grid2}>
            <div>
              <strong>Physical</strong>
              {physicalFields.map((field) => (
                <label key={field.key} style={{ ...ui.label, marginTop: 8 }}>{field.label}<input style={ui.input} value={String((currentTrust[field.key] as string | null) ?? "")} onChange={(e) => setField(field.key, e.target.value)} /></label>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><strong>Postal</strong><button type="button" style={ui.secondary} onClick={copyPhysicalToPostal}>Copy physical</button></div>
              {postalFields.map((field) => (
                <label key={field.key} style={{ ...ui.label, marginTop: 8 }}>{field.label}<input style={ui.input} value={String((currentTrust[field.key] as string | null) ?? "")} onChange={(e) => setField(field.key, e.target.value)} /></label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <button type="button" style={ui.primary} onClick={save}>Save details</button>
    </TrustShell>
  );
}
