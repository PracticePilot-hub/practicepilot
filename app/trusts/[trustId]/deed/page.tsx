"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrustShell from "../../_shell";
import { buildDeedHtml, deedValidation, downloadHtml } from "../../_deed";
import {
  loadTrust,
  loadTrustParties,
  TrustParty,
  TrustRecord,
  ui,
} from "../../_lib";

export default function DeedPage() {
  const params = useParams<{ trustId: string }>();
  const trustId = String(params.trustId);

  const [trust, setTrust] = useState<TrustRecord | null>(null);
  const [parties, setParties] = useState<TrustParty[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await loadTrust(trustId);
        setTrust(result.trust);
        setParties(
          await loadTrustParties(trustId, result.context.organisationId)
        );
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not load Trust Deed."
        );
      }
    })();
  }, [trustId]);

  const html = useMemo(
    () => (trust ? buildDeedHtml(trust, parties) : ""),
    [trust, parties]
  );

  const validationIssues = useMemo(
    () => (trust ? deedValidation(trust, parties) : []),
    [trust, parties]
  );

  if (!trust) {
    return (
      <div style={ui.page}>
        {error ? <div style={ui.error}>{error}</div> : "Loading…"}
      </div>
    );
  }

  function printDeed() {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => popup.print(), 300);
  }

  return (
    <TrustShell trustId={trustId} trustName={trust.name}>
      {error ? <div style={ui.error}>{error}</div> : null}

      {validationIssues.length ? (
        <div style={ui.error}>
          <strong>Complete these items before signature:</strong>
          <ul style={{ margin: "7px 0 0 18px", padding: 0 }}>
            {validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={ui.success}>
          Full deed structure is populated from the Trust file. Review the final
          PDF before signature and lodgement.
        </div>
      )}

      <section style={ui.panel}>
        <div
          style={{
            ...ui.panelHeader,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>Full Trust Deed</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={ui.secondary}
              onClick={() =>
                downloadHtml(
                  `${trust.name.replaceAll(" ", "_")}_Trust_Deed.html`,
                  html
                )
              }
            >
              Download HTML
            </button>
            <button type="button" style={ui.primary} onClick={printDeed}>
              Print / Save PDF
            </button>
          </div>
        </div>

        <iframe
          title="Full Trust Deed"
          srcDoc={html}
          style={{
            width: "100%",
            height: "1100px",
            border: 0,
            background: "#ffffff",
          }}
        />
      </section>
    </TrustShell>
  );
}
