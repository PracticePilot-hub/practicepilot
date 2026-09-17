"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TrustShell from "../../_shell";
import {
  loadTrust,
  loadTrustParties,
  partyRoles,
  supabaseAny,
  TrustParty,
  TrustRecord,
  ui,
} from "../../_lib";

const blank: any = {
  party_kind: "individual",
  first_names: "",
  surname: "",
  full_name: "",
  id_number: "",
  registration_number: "",
  email: "",
  mobile: "",
  phone: "",
  occupation: "",
  address_line1: "",
  address_line2: "",
  city: "",
  province: "Gauteng",
  postal_code: "",
  postal_line1: "",
  postal_line2: "",
  postal_city: "",
  postal_province: "Gauteng",
  postal_postal_code: "",
  representative_name: "",
  representative_first_names: "",
  representative_surname: "",
  representative_id_number: "",
  appointment_date: "",
  accreditation_body: "",
  accreditation_number: "",
  trust_administration_experience: "",
  role_founder: false,
  role_trustee: false,
  role_independent_trustee: false,
  role_beneficiary: false,
  role_representative: false,
  role_accountant: false,
  is_income_beneficiary: true,
  is_capital_beneficiary: true,
  include_descendants: true,
  income_right_type: "discretionary",
  capital_right_type: "discretionary",
  beneficiary_named_date: "",
  has_received_benefits: false,
  is_minor: false,
  guardian_name: "",
  guardian_id_number: "",
  j417_related_to_beneficiary_or_trustee: null,
  j417_all_beneficiaries_related: null,
  j417_direct_control: null,
  j417_convicted_dishonesty: null,
  j417_insolvent: null,
  j417_removed_as_trustee: null,
  j417_incapacitated: null,
  j417_understands_trust_law: null,
  j417_aware_fiduciary_duties: null,
  j417_accepts_civil_criminal_exposure: null,
  j417_accepts_master_removal: null,
  j417_yes_reason: "",
  j417_no_reason: "",
};

function boolValue(value: any): "" | "yes" | "no" {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function fromBoolSelect(value: string): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export default function PeoplePage() {
  const params = useParams<{ trustId: string }>();
  const trustId = String(params.trustId);
  const [trust, setTrust] = useState<TrustRecord | null>(null);
  const [ctx, setCtx] = useState<any>(null);
  const [rows, setRows] = useState<TrustParty[]>([]);
  const [form, setForm] = useState<any>({ ...blank });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function refresh() {
    const r = await loadTrust(trustId);
    setTrust(r.trust);
    setCtx(r.context);
    setRows(await loadTrustParties(trustId, r.context.organisationId));
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [trustId]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  function resetForm() {
    setEditingId(null);
    setForm({ ...blank });
  }

  function editParty(p: any) {
    setError("");
    setMsg("");
    setEditingId(p.id);
    setForm({
      ...blank,
      ...p,
      first_names: p.first_names || "",
      surname: p.surname || "",
      full_name: p.full_name || "",
      id_number: p.id_number || "",
      registration_number: p.registration_number || "",
      email: p.email || "",
      mobile: p.mobile || "",
      phone: p.phone || "",
      occupation: p.occupation || "",
      address_line1: p.address_line1 || "",
      address_line2: p.address_line2 || "",
      city: p.city || "",
      province: p.province || "Gauteng",
      postal_code: p.postal_code || "",
      postal_line1: p.postal_line1 || "",
      postal_line2: p.postal_line2 || "",
      postal_city: p.postal_city || "",
      postal_province: p.postal_province || "Gauteng",
      postal_postal_code: p.postal_postal_code || "",
      representative_name: p.representative_name || "",
      representative_first_names: p.representative_first_names || "",
      representative_surname: p.representative_surname || "",
      representative_id_number: p.representative_id_number || "",
      appointment_date: p.appointment_date || "",
      accreditation_body: p.accreditation_body || "",
      accreditation_number: p.accreditation_number || "",
      trust_administration_experience: p.trust_administration_experience || "",
      beneficiary_named_date: p.beneficiary_named_date || "",
      guardian_name: p.guardian_name || "",
      guardian_id_number: p.guardian_id_number || "",
      j417_yes_reason: p.j417_yes_reason || "",
      j417_no_reason: p.j417_no_reason || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setError("");
    setMsg("");

    if (form.party_kind === "individual" && !String(form.first_names).trim()) {
      return setError("First names are required.");
    }
    if (form.party_kind === "individual" && !String(form.surname).trim()) {
      return setError("Surname is required.");
    }
    if (form.party_kind === "entity" && !String(form.full_name).trim()) {
      return setError("Entity name is required.");
    }

    const full =
      form.party_kind === "entity"
        ? String(form.full_name).trim()
        : `${String(form.first_names).trim()} ${String(form.surname).trim()}`.trim();

    const representativeName =
      form.party_kind === "entity"
        ? `${String(form.representative_first_names || "").trim()} ${String(
            form.representative_surname || ""
          ).trim()}`.trim() || String(form.representative_name || "").trim()
        : "";

    const payload = {
      ...form,
      full_name: full,
      representative_name: representativeName || null,
      appointment_date: form.appointment_date || null,
      beneficiary_named_date: form.beneficiary_named_date || null,
      accreditation_body: form.accreditation_body || null,
      accreditation_number: form.accreditation_number || null,
      trust_administration_experience: form.trust_administration_experience || null,
      j417_yes_reason: form.j417_yes_reason || null,
      j417_no_reason: form.j417_no_reason || null,
    };

    let result: any;
    if (editingId) {
      result = await supabaseAny
        .from("pp_trust_parties")
        .update(payload)
        .eq("id", editingId)
        .eq("trust_id", trustId)
        .eq("organisation_id", ctx.organisationId);
    } else {
      result = await supabaseAny.from("pp_trust_parties").insert({
        ...payload,
        trust_id: trustId,
        organisation_id: ctx.organisationId,
        created_by_user_id: ctx.userId,
      });
    }

    if (result.error) return setError(result.error.message);

    setMsg(editingId ? "Person / entity updated." : "Person / entity added.");
    resetForm();
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this person/entity from the trust file?")) return;
    const { error } = await supabaseAny
      .from("pp_trust_parties")
      .delete()
      .eq("id", id)
      .eq("trust_id", trustId);
    if (error) setError(error.message);
    else refresh();
  }

  if (!trust) {
    return <div style={ui.page}>{error ? <div style={ui.error}>{error}</div> : "Loading…"}</div>;
  }

  const isTrustee = Boolean(form.role_trustee || form.role_independent_trustee);
  const isAccountant = Boolean(form.role_accountant);
  const isBeneficiary = Boolean(form.role_beneficiary);

  const yesNo = (key: string, label: string) => (
    <label style={ui.label}>
      {label}
      <select
        style={ui.input}
        value={boolValue(form[key])}
        onChange={(e) => set(key, fromBoolSelect(e.target.value))}
      >
        <option value="">Not answered</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );

  return (
    <TrustShell trustId={trustId} trustName={trust.name}>
      {error ? <div style={ui.error}>{error}</div> : null}
      {msg ? <div style={ui.success}>{msg}</div> : null}

      <section style={ui.panel}>
        <div style={ui.panelHeader}>
          {editingId ? "Edit person / entity" : "Add person or entity once — then assign all roles"}
        </div>
        <div style={ui.panelBody}>
          <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
            <label>
              <input
                type="radio"
                checked={form.party_kind === "individual"}
                onChange={() => set("party_kind", "individual")}
              />{" "}
              Individual
            </label>
            <label>
              <input
                type="radio"
                checked={form.party_kind === "entity"}
                onChange={() => set("party_kind", "entity")}
              />{" "}
              Legal entity
            </label>
          </div>

          <div style={ui.grid3}>
            {form.party_kind === "individual" ? (
              <>
                <label style={ui.label}>
                  First names
                  <input style={ui.input} value={form.first_names} onChange={(e) => set("first_names", e.target.value)} />
                </label>
                <label style={ui.label}>
                  Surname
                  <input style={ui.input} value={form.surname} onChange={(e) => set("surname", e.target.value)} />
                </label>
                <label style={ui.label}>
                  ID number
                  <input style={ui.input} value={form.id_number} onChange={(e) => set("id_number", e.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label style={ui.label}>
                  Entity name
                  <input style={ui.input} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
                </label>
                <label style={ui.label}>
                  Registration number
                  <input style={ui.input} value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} />
                </label>
                <label style={ui.label}>
                  Representative first names
                  <input
                    style={ui.input}
                    value={form.representative_first_names}
                    onChange={(e) => set("representative_first_names", e.target.value)}
                  />
                </label>
                <label style={ui.label}>
                  Representative surname
                  <input
                    style={ui.input}
                    value={form.representative_surname}
                    onChange={(e) => set("representative_surname", e.target.value)}
                  />
                </label>
                <label style={ui.label}>
                  Representative ID
                  <input
                    style={ui.input}
                    value={form.representative_id_number}
                    onChange={(e) => set("representative_id_number", e.target.value)}
                  />
                </label>
              </>
            )}

            <label style={ui.label}>
              Email
              <input style={ui.input} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label style={ui.label}>
              Mobile
              <input style={ui.input} value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
            </label>
            <label style={ui.label}>
              Telephone
              <input style={ui.input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label style={ui.label}>
              Occupation / capacity
              <input style={ui.input} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
            </label>
            <label style={ui.label}>
              Appointment date
              <input
                type="date"
                style={ui.input}
                value={form.appointment_date}
                onChange={(e) => set("appointment_date", e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #dfe7e6" }}>
            <strong>Physical address</strong>
            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <label style={ui.label}>Address line 1<input style={ui.input} value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} /></label>
              <label style={ui.label}>Address line 2<input style={ui.input} value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} /></label>
              <label style={ui.label}>City / Town<input style={ui.input} value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
              <label style={ui.label}>Province<input style={ui.input} value={form.province} onChange={(e) => set("province", e.target.value)} /></label>
              <label style={ui.label}>Postal code<input style={ui.input} value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></label>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <strong>Postal address</strong>
            <button
              type="button"
              style={{ ...ui.secondary, marginLeft: 12 }}
              onClick={() =>
                setForm((f: any) => ({
                  ...f,
                  postal_line1: f.address_line1,
                  postal_line2: f.address_line2,
                  postal_city: f.city,
                  postal_province: f.province,
                  postal_postal_code: f.postal_code,
                }))
              }
            >
              Copy physical
            </button>
            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <label style={ui.label}>Address line 1<input style={ui.input} value={form.postal_line1} onChange={(e) => set("postal_line1", e.target.value)} /></label>
              <label style={ui.label}>Address line 2<input style={ui.input} value={form.postal_line2} onChange={(e) => set("postal_line2", e.target.value)} /></label>
              <label style={ui.label}>City / Town<input style={ui.input} value={form.postal_city} onChange={(e) => set("postal_city", e.target.value)} /></label>
              <label style={ui.label}>Province<input style={ui.input} value={form.postal_province} onChange={(e) => set("postal_province", e.target.value)} /></label>
              <label style={ui.label}>Postal code<input style={ui.input} value={form.postal_postal_code} onChange={(e) => set("postal_postal_code", e.target.value)} /></label>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e4eae9" }}>
            <strong>Roles</strong>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 9 }}>
              {[
                ["role_founder", "Founder"],
                ["role_trustee", "Trustee"],
                ["role_independent_trustee", "Independent Trustee"],
                ["role_beneficiary", "Beneficiary"],
                ["role_accountant", "Accountant"],
                ["role_representative", "Representative"],
              ].map(([k, l]) => (
                <label key={k}>
                  <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => set(k, e.target.checked)} /> {l}
                </label>
              ))}
            </div>
          </div>

          {isAccountant ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #dfe7e6" }}>
              <strong>Accountant / auditor professional details</strong>
              <div style={{ ...ui.grid3, marginTop: 10 }}>
                <label style={ui.label}>
                  Accreditation body
                  <input style={ui.input} placeholder="e.g. SAIPA" value={form.accreditation_body} onChange={(e) => set("accreditation_body", e.target.value)} />
                </label>
                <label style={ui.label}>
                  Accreditation / membership number
                  <input style={ui.input} value={form.accreditation_number} onChange={(e) => set("accreditation_number", e.target.value)} />
                </label>
              </div>
            </div>
          ) : null}

          {isBeneficiary ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #dfe7e6" }}>
              <strong>Beneficiary rights</strong>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
                <label><input type="checkbox" checked={Boolean(form.is_income_beneficiary)} onChange={(e) => set("is_income_beneficiary", e.target.checked)} /> Income beneficiary</label>
                <label><input type="checkbox" checked={Boolean(form.is_capital_beneficiary)} onChange={(e) => set("is_capital_beneficiary", e.target.checked)} /> Capital beneficiary</label>
                <label><input type="checkbox" checked={Boolean(form.include_descendants)} onChange={(e) => set("include_descendants", e.target.checked)} /> Include descendants</label>
              </div>
            </div>
          ) : null}

          {isTrustee ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #dfe7e6" }}>
              <strong>J417 trustee information</strong>
              <p style={{ margin: "6px 0 12px", color: "#5f6d76", fontSize: 12 }}>
                These answers feed the official J417. Leave a statutory declaration unanswered until the trustee has personally confirmed it.
              </p>
              <div style={ui.grid3}>
                {yesNo("j417_related_to_beneficiary_or_trustee", "Related to any beneficiary or trustee?")}
                {yesNo("j417_all_beneficiaries_related", "Are all beneficiaries related to one another?")}
                {yesNo("j417_direct_control", "Will exercise direct personal control over trust records?")}
                <label style={ui.label}>
                  Previous trust administration experience
                  <textarea style={{ ...ui.input, minHeight: 76 }} value={form.trust_administration_experience} onChange={(e) => set("trust_administration_experience", e.target.value)} />
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <strong>J417 page 2 — trustee's personal declaration</strong>
                <div style={{ ...ui.grid3, marginTop: 10 }}>
                  {yesNo("j417_convicted_dishonesty", "Convicted of dishonesty / prison without fine option?")}
                  {yesNo("j417_insolvent", "Ever declared insolvent?")}
                  {yesNo("j417_removed_as_trustee", "Ever removed from office as trustee?")}
                  {yesNo("j417_incapacitated", "Ever declared mentally ill / incapacitated?")}
                  {yesNo("j417_understands_trust_law", "Understands the law of trust?")}
                  {yesNo("j417_aware_fiduciary_duties", "Aware of fiduciary duties and responsibilities?")}
                  {yesNo("j417_accepts_civil_criminal_exposure", "Acknowledges civil and criminal exposure?")}
                  {yesNo("j417_accepts_master_removal", "Acknowledges Master's removal powers?")}
                </div>
                <div style={{ ...ui.grid3, marginTop: 10 }}>
                  <label style={ui.label}>Reason if any of the first four answers is YES<textarea style={{ ...ui.input, minHeight: 70 }} value={form.j417_yes_reason} onChange={(e) => set("j417_yes_reason", e.target.value)} /></label>
                  <label style={ui.label}>Reason if any of the later answers is NO<textarea style={{ ...ui.input, minHeight: 70 }} value={form.j417_no_reason} onChange={(e) => set("j417_no_reason", e.target.value)} /></label>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button style={ui.primary} onClick={save}>{editingId ? "Save changes" : "Add to trust"}</button>
            {editingId ? <button style={ui.secondary} onClick={resetForm}>Cancel edit</button> : null}
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>People & roles</div>
        {rows.length === 0 ? (
          <div style={ui.panelBody}>No people captured yet.</div>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Name</th>
                <th style={ui.th}>ID / Registration</th>
                <th style={ui.th}>Roles</th>
                <th style={ui.th}>Contact</th>
                <th style={ui.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={ui.td}>
                    <strong>{p.full_name}</strong>
                    <div style={{ color: "#6b7780", marginTop: 3 }}>{p.party_kind}</div>
                  </td>
                  <td style={ui.td}>{p.id_number || p.registration_number || "—"}</td>
                  <td style={ui.td}>{partyRoles(p).join(" · ") || "—"}</td>
                  <td style={ui.td}>{p.email || p.mobile || "—"}</td>
                  <td style={ui.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => editParty(p)} style={ui.secondary}>Edit</button>
                      <button onClick={() => remove(p.id)} style={ui.secondary}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </TrustShell>
  );
}
