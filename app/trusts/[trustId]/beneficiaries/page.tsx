"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TrustShell from "../../_shell";
import {
  loadTrust,
  loadTrustParties,
  supabaseAny,
  TrustParty,
  TrustRecord,
  ui,
} from "../../_lib";

export default function BeneficiariesPage() {
  const params = useParams<{ trustId: string }>();
  const trustId = String(params.trustId);

  const [trust, setTrust] = useState<TrustRecord | null>(null);
  const [rows, setRows] = useState<TrustParty[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function refresh() {
    const result = await loadTrust(trustId);
    setTrust(result.trust);
    setRows(
      (await loadTrustParties(trustId, result.context.organisationId)).filter(
        (party) => party.role_beneficiary
      )
    );
  }

  useEffect(() => {
    refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Could not load beneficiaries.")
    );
  }, [trustId]);

  async function patch(party: TrustParty, patchData: Record<string, unknown>) {
    setError("");
    setMsg("");

    const { error: saveError } = await supabaseAny
      .from("pp_trust_parties")
      .update(patchData)
      .eq("id", party.id)
      .eq("trust_id", trustId);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMsg("Beneficiary settings saved.");
    await refresh();
  }

  if (!trust) {
    return (
      <div style={ui.page}>
        {error ? <div style={ui.error}>{error}</div> : "Loading…"}
      </div>
    );
  }

  return (
    <TrustShell trustId={trustId} trustName={trust.name}>
      {error ? <div style={ui.error}>{error}</div> : null}
      {msg ? <div style={ui.success}>{msg}</div> : null}

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Beneficiary rights</div>
        <div style={ui.panelBody}>
          Beneficiaries are captured once under <strong>People & Roles</strong>. This page controls how each beneficiary is used in the deed and registration pack.
        </div>

        {rows.length === 0 ? (
          <div style={ui.panelBody}>No beneficiaries captured.</div>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Beneficiary</th>
                <th style={ui.th}>Income</th>
                <th style={ui.th}>Income right</th>
                <th style={ui.th}>Capital</th>
                <th style={ui.th}>Capital right</th>
                <th style={ui.th}>Descendants</th>
                <th style={ui.th}>Named date</th>
                <th style={ui.th}>Benefits received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((party) => (
                <tr key={party.id}>
                  <td style={ui.td}>
                    <strong>{party.full_name}</strong>
                    <div>{party.id_number || party.registration_number || "—"}</div>
                  </td>
                  <td style={ui.td}>
                    <input
                      type="checkbox"
                      checked={Boolean(party.is_income_beneficiary)}
                      onChange={(event) =>
                        patch(party, {
                          is_income_beneficiary: event.target.checked,
                          income_right_type: event.target.checked
                            ? party.income_right_type || "discretionary"
                            : party.income_right_type,
                        })
                      }
                    />
                  </td>
                  <td style={ui.td}>
                    <select
                      style={{ ...ui.input, minWidth: 120 }}
                      value={party.income_right_type || "discretionary"}
                      disabled={!party.is_income_beneficiary}
                      onChange={(event) =>
                        patch(party, { income_right_type: event.target.value })
                      }
                    >
                      <option value="discretionary">Discretionary</option>
                      <option value="vested">Vested</option>
                    </select>
                  </td>
                  <td style={ui.td}>
                    <input
                      type="checkbox"
                      checked={Boolean(party.is_capital_beneficiary)}
                      onChange={(event) =>
                        patch(party, {
                          is_capital_beneficiary: event.target.checked,
                          capital_right_type: event.target.checked
                            ? party.capital_right_type || "discretionary"
                            : party.capital_right_type,
                        })
                      }
                    />
                  </td>
                  <td style={ui.td}>
                    <select
                      style={{ ...ui.input, minWidth: 120 }}
                      value={party.capital_right_type || "discretionary"}
                      disabled={!party.is_capital_beneficiary}
                      onChange={(event) =>
                        patch(party, { capital_right_type: event.target.value })
                      }
                    >
                      <option value="discretionary">Discretionary</option>
                      <option value="vested">Vested</option>
                    </select>
                  </td>
                  <td style={ui.td}>
                    <input
                      type="checkbox"
                      checked={Boolean(party.include_descendants)}
                      onChange={(event) =>
                        patch(party, { include_descendants: event.target.checked })
                      }
                    />
                  </td>
                  <td style={ui.td}>
                    <input
                      style={{ ...ui.input, minWidth: 125 }}
                      type="date"
                      value={party.beneficiary_named_date || ""}
                      onChange={(event) =>
                        patch(party, {
                          beneficiary_named_date: event.target.value || null,
                        })
                      }
                    />
                  </td>
                  <td style={ui.td}>
                    <input
                      type="checkbox"
                      checked={Boolean(party.has_received_benefits)}
                      onChange={(event) =>
                        patch(party, {
                          has_received_benefits: event.target.checked,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div style={ui.success}>
        <strong>Standard PP deed:</strong> discretionary rights are the default. If a beneficiary is marked as vested, PP will block final deed sign-off until alternate wording is implemented/reviewed.
      </div>
    </TrustShell>
  );
}
