"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrustShell from "../../_shell";
import {
  loadTrust,
  loadTrustParties,
  supabaseAny,
  TrustParty,
  TrustRecord,
  ui,
} from "../../_lib";

export default function DeedSettingsPage() {
  const params = useParams<{ trustId: string }>();
  const trustId = String(params.trustId);

  const [trust, setTrust] = useState<TrustRecord | null>(null);
  const [parties, setParties] = useState<TrustParty[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function refresh() {
    const result = await loadTrust(trustId);
    setTrust(result.trust);
    setParties(await loadTrustParties(trustId, result.context.organisationId));
  }

  useEffect(() => {
    refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Could not load deed settings.")
    );
  }, [trustId]);

  const trustees = useMemo(
    () => parties.filter((party) => party.role_trustee || party.role_independent_trustee),
    [parties]
  );
  const beneficiaries = useMemo(
    () => parties.filter((party) => party.role_beneficiary),
    [parties]
  );

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

  async function save(confirm = false) {
    setError("");
    setMsg("");

    const payload = {
      document_signatory_count: Math.max(
        1,
        Number(currentTrust.document_signatory_count || 1)
      ),
      bank_signatory_count: Math.max(
        1,
        Number(currentTrust.bank_signatory_count || 1)
      ),
      mandatory_signatory_party_id:
        currentTrust.mandatory_signatory_party_id || null,
      fallback_beneficiary_rule:
        currentTrust.fallback_beneficiary_rule || "testate_intestate",
      final_distribution_age: Number(currentTrust.final_distribution_age || 25),
      deed_settings_confirmed: confirm
        ? true
        : Boolean(currentTrust.deed_settings_confirmed),
      deed_settings_confirmed_at: confirm
        ? new Date().toISOString()
        : currentTrust.deed_settings_confirmed_at || null,
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

    setMsg(confirm ? "Deed Settings reviewed and confirmed." : "Deed Settings saved.");
    await refresh();
  }

  const beneficiaryProblems = beneficiaries.filter(
    (beneficiary) =>
      !beneficiary.is_income_beneficiary && !beneficiary.is_capital_beneficiary
  );
  const vestedProblems = beneficiaries.filter(
    (beneficiary) =>
      (beneficiary.is_income_beneficiary && beneficiary.income_right_type === "vested") ||
      (beneficiary.is_capital_beneficiary && beneficiary.capital_right_type === "vested")
  );

  const ready =
    trustees.length >= 2 &&
    beneficiaries.length > 0 &&
    beneficiaryProblems.length === 0 &&
    vestedProblems.length === 0 &&
    Number(currentTrust.document_signatory_count || 1) <= trustees.length &&
    Number(currentTrust.bank_signatory_count || 1) <= trustees.length;

  return (
    <TrustShell trustId={trustId} trustName={currentTrust.name}>
      {error ? <div style={ui.error}>{error}</div> : null}
      {msg ? <div style={ui.success}>{msg}</div> : null}

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Standard PP deed defaults</div>
        <div style={ui.panelBody}>
          <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
            <div>✓ Independent trustee required</div>
            <div>✓ Minimum 2 trustees / maximum 5 trustees</div>
            <div>✓ Trustee security exemption</div>
            <div>✓ 14-day meeting notice and at least one meeting per year</div>
            <div>✓ Proxy and round-robin resolutions permitted</div>
            <div>✓ Comprehensive trustee powers retained</div>
            <div>✓ 25% threshold for large beneficiary distributions/loans</div>
            <div>✓ Full accounting, banking, beneficial ownership and tax clauses</div>
            <div>✓ Amendment and deregistration clauses retained</div>
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Signing rules</div>
        <div style={ui.panelBody}>
          <div style={ui.grid3}>
            <label style={ui.label}>
              Trustees required for contracts / deeds / other documents
              <input
                style={ui.input}
                type="number"
                min={1}
                max={Math.max(1, trustees.length)}
                value={Number(currentTrust.document_signatory_count || 1)}
                onChange={(event) =>
                  setField("document_signatory_count", Number(event.target.value || 1))
                }
              />
            </label>

            <label style={ui.label}>
              Trustees required to approve bank transactions
              <input
                style={ui.input}
                type="number"
                min={1}
                max={Math.max(1, trustees.length)}
                value={Number(currentTrust.bank_signatory_count || 1)}
                onChange={(event) =>
                  setField("bank_signatory_count", Number(event.target.value || 1))
                }
              />
            </label>

            <label style={ui.label}>
              Mandatory signatory (if applicable)
              <select
                style={ui.input}
                value={currentTrust.mandatory_signatory_party_id || ""}
                onChange={(event) =>
                  setField("mandatory_signatory_party_id", event.target.value || null)
                }
              >
                <option value="">No named mandatory signatory</option>
                {trustees.map((trustee) => (
                  <option key={trustee.id} value={trustee.id}>
                    {trustee.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Beneficiary fallback and termination</div>
        <div style={ui.panelBody}>
          <div style={ui.grid2}>
            <label style={ui.label}>
              If no named/class beneficiaries remain
              <select
                style={ui.input}
                value={currentTrust.fallback_beneficiary_rule || "testate_intestate"}
                onChange={(event) =>
                  setField("fallback_beneficiary_rule", event.target.value)
                }
              >
                <option value="testate_intestate">Testate and/or intestate heirs</option>
              </select>
            </label>

            <label style={ui.label}>
              Final distribution age
              <input
                style={ui.input}
                type="number"
                min={18}
                max={40}
                value={Number(currentTrust.final_distribution_age || 25)}
                onChange={(event) =>
                  setField("final_distribution_age", Number(event.target.value || 25))
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Review before deed generation</div>
        <div style={ui.panelBody}>
          <table style={ui.table}>
            <tbody>
              <tr><td style={ui.td}>Trust</td><td style={ui.td}><strong>{currentTrust.name}</strong></td></tr>
              <tr><td style={ui.td}>Master's office</td><td style={ui.td}>{currentTrust.masters_office || "—"}</td></tr>
              <tr><td style={ui.td}>Trustees</td><td style={ui.td}>{trustees.map((item) => item.full_name).join(", ") || "—"}</td></tr>
              <tr><td style={ui.td}>Beneficiaries</td><td style={ui.td}>{beneficiaries.map((item) => item.full_name).join(", ") || "—"}</td></tr>
              <tr><td style={ui.td}>Bank account</td><td style={ui.td}>{currentTrust.bank_account_status === "existing" ? `Existing account: ${currentTrust.bank_name || "bank not captured"}` : "Account will be opened after registration"}</td></tr>
              <tr><td style={ui.td}>Initial donation</td><td style={ui.td}>R{Number(currentTrust.initial_donation || 100).toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {beneficiaryProblems.length ? (
        <div style={ui.error}>
          These beneficiaries still need Income and/or Capital rights: {beneficiaryProblems.map((item) => item.full_name).join(", ")}.
        </div>
      ) : null}

      {vestedProblems.length ? (
        <div style={ui.error}>
          The standard PP deed is discretionary. Vested rights are currently selected for: {vestedProblems.map((item) => item.full_name).join(", ")}.
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={ui.secondary} onClick={() => save(false)}>
          Save settings
        </button>
        <button
          type="button"
          style={{ ...ui.primary, opacity: ready ? 1 : 0.45 }}
          disabled={!ready}
          onClick={() => save(true)}
        >
          Review complete — confirm deed settings
        </button>
      </div>
    </TrustShell>
  );
}
