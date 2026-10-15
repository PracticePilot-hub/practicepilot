"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { proposalServiceCatalogue, type ProposalService } from "../../serviceCatalogue";

type ServiceLine = Omit<ProposalService, "includedInPackage" | "amount">;

const serviceLibrary: ServiceLine[] = proposalServiceCatalogue.map(
  ({ includedInPackage: _included, amount: _amount, ...service }) => ({ ...service })
);

export default function EditProposalPage() {
  const params = useParams<{ id: string }>();
  const proposalId = String(params?.id || "");
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageMonthlyFee, setPackageMonthlyFee] = useState(0);
  const [services, setServices] = useState<ServiceLine[]>(serviceLibrary);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedServices = useMemo(
    () => services.filter((service) => selectedIds.includes(service.id)),
    [selectedIds, services]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProposal() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/proposals/${proposalId}`, {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load proposal.");
        }

        if (cancelled) return;

        const proposal = result.proposal;
        const existingServices = Array.isArray(result.services)
          ? result.services
          : [];

        setCompanyName(
          proposal.prospect_company_name || proposal.client_name || ""
        );
        setContactName(
          proposal.prospect_contact_name || proposal.contact_name || ""
        );
        setContactEmail(
          proposal.prospect_contact_email || proposal.contact_email || ""
        );
        setContactNumber(proposal.prospect_contact_number || "");
        setValidUntil(proposal.valid_until || "");
        setPackageName(proposal.package_name || "Custom Package");
        setPackageDescription(proposal.package_description || "");
        setPackageMonthlyFee(
          Number(proposal.package_monthly_fee || proposal.monthly_fee || 0)
        );

        // Match saved services to catalogue entries without discarding legacy or
        // practice-specific lines that are not part of the current catalogue.
        const savedCode = (item: any) =>
          String(item.service_code ?? item.id ?? "").trim();
        const savedName = (item: any) =>
          String(item.service_name ?? item.name ?? "").trim().toLowerCase();

        const matchedSaved = new Set<number>();
        const selected = new Set<string>();

        const merged: ServiceLine[] = serviceLibrary.map((libraryService) => {
          const matchIndex = existingServices.findIndex(
            (existing: any, index: number) =>
              !matchedSaved.has(index) &&
              (savedCode(existing) === libraryService.id ||
                savedName(existing) === libraryService.name.toLowerCase())
          );

          if (matchIndex === -1) return libraryService;

          matchedSaved.add(matchIndex);
          selected.add(libraryService.id);
          const existing = existingServices[matchIndex];

          return {
            ...libraryService,
            category: existing.category ?? libraryService.category,
            name: existing.service_name ?? existing.name ?? libraryService.name,
            description: existing.description ?? libraryService.description,
            feeType: existing.fee_type ?? existing.feeType ?? libraryService.feeType,
            scopeQuantity:
              existing.scope_quantity === null
                ? ""
                : existing.scope_quantity === undefined
                  ? libraryService.scopeQuantity
                  : Number(existing.scope_quantity),
            scopeUnit: existing.scope_unit ?? libraryService.scopeUnit,
            clientFacingNote:
              existing.client_facing_note ?? libraryService.clientFacingNote,
          };
        });

        // Keep any previously saved service not currently in the catalogue.
        // Otherwise editing and saving can permanently remove its selection.
        existingServices.forEach((existing: any, index: number) => {
          if (matchedSaved.has(index)) return;
          const id = savedCode(existing) || `legacy-service-${index}`;
          const safeId = merged.some((service) => service.id === id)
            ? `legacy-service-${index}`
            : id;
          const rawFeeType = existing.fee_type ?? existing.feeType;
          const feeType: ServiceLine["feeType"] =
            rawFeeType === "Annual" || rawFeeType === "Once-off"
              ? rawFeeType
              : "Monthly";

          merged.push({
            id: safeId,
            category: String(existing.category ?? "Other Services"),
            name: String(existing.service_name ?? existing.name ?? safeId),
            description: String(existing.description ?? ""),
            feeType,
            scopeQuantity:
              existing.scope_quantity == null
                ? ""
                : Number(existing.scope_quantity),
            scopeUnit: String(existing.scope_unit ?? ""),
            clientFacingNote: String(existing.client_facing_note ?? ""),
          });
          selected.add(safeId);
        });

        setServices(merged);
        setSelectedIds(Array.from(selected));
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || "Unable to load proposal.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (proposalId) loadProposal();

    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  function toggleService(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((serviceId) => serviceId !== id)
        : [...current, id]
    );
  }

  function selectAllServices() {
    setSelectedIds(serviceLibrary.map((service) => service.id));
  }

  function updateService<K extends keyof ServiceLine>(
    id: string,
    field: K,
    value: ServiceLine[K]
  ) {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, [field]: value } : service
      )
    );
  }

  async function saveChanges() {
    try {
      setSaving(true);
      setError("");

      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "edit",
          clientName: companyName,
          contactName,
          contactEmail,
          contactNumber,
          validUntil,
          packageCode: "custom",
          packageName,
          packageDescription,
          packageMonthlyFee,
          services: selectedServices,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to update proposal.");
      }

      router.push(`/proposals/${proposalId}`);
      router.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to update proposal.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading proposal...</main>;
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PROPOSALS</p>
          <h1 style={styles.title}>Edit proposal</h1>
          <p style={styles.subtitle}>
            Update the prospect, package, scope and included services.
          </p>
        </div>

        <Link href={`/proposals/${proposalId}`} style={styles.backLink}>
          Cancel
        </Link>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <section style={styles.panel}>
        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Company or client name</span>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Contact person</span>
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Contact email</span>
            <input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Contact number</span>
            <input
              value={contactNumber}
              onChange={(event) => setContactNumber(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Valid until</span>
            <input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Package name</span>
            <input
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.fieldWide}>
            <span style={styles.label}>Package description</span>
            <input
              value={packageDescription}
              onChange={(event) => setPackageDescription(event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Monthly fee excl. VAT</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={packageMonthlyFee}
              onChange={(event) =>
                setPackageMonthlyFee(Number(event.target.value))
              }
              style={styles.input}
            />
          </label>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.servicesHeading}>
          <div>
            <h2 style={styles.panelTitle}>Services included</h2>
            <p style={styles.panelText}>
              Select the services to include in this proposal. Existing saved
              services and their descriptions are retained.
            </p>
          </div>

          <button
            type="button"
            onClick={selectAllServices}
            style={styles.secondaryButton}
          >
            Select all services
          </button>
        </div>

        {services.map((service) => {
          const selected = selectedIds.includes(service.id);

          return (
            <div key={service.id} style={styles.serviceBlock}>
              <div style={styles.serviceRow}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleService(service.id)}
                />

                <div>
                  <strong>{service.name}</strong>
                  <div style={styles.category}>{service.category}</div>
                </div>

                <div style={styles.scopeGrid}>
                  <input
                    type="number"
                    min="0"
                    value={service.scopeQuantity}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "scopeQuantity",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                      )
                    }
                    disabled={!selected}
                    placeholder="Qty"
                    style={styles.compactInput}
                  />
                  <input
                    value={service.scopeUnit}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "scopeUnit",
                        event.target.value
                      )
                    }
                    disabled={!selected}
                    placeholder="Scope unit"
                    style={styles.compactInput}
                  />
                </div>
              </div>

              {selected ? (
                <div style={styles.serviceDetails}>
                  <textarea
                    value={service.description}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "description",
                        event.target.value
                      )
                    }
                    rows={3}
                    style={styles.textarea}
                  />
                  <input
                    value={service.clientFacingNote}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "clientFacingNote",
                        event.target.value
                      )
                    }
                    placeholder="Optional client-facing scope note"
                    style={styles.input}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <div style={styles.actionBar}>
        <Link href={`/proposals/${proposalId}`} style={styles.cancelButton}>
          Cancel
        </Link>
        <button
          type="button"
          onClick={saveChanges}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    padding: 28,
    background: "#f8fafc",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 20,
  },
  eyebrow: {
    margin: "0 0 5px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "#2563eb",
  },
  title: {
    margin: 0,
    fontSize: 30,
  },
  subtitle: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
  },
  panel: {
    marginBottom: 16,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    padding: 18,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  fieldWide: {
    display: "grid",
    gap: 6,
    gridColumn: "1 / -1",
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    height: 40,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    fontSize: 13,
    color: "#0f172a",
    background: "#ffffff",
  },
  servicesHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    padding: 16,
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
  },
  panelText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },
  secondaryButton: {
    minHeight: 36,
    padding: "0 12px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
  },
  serviceBlock: {
    borderBottom: "1px solid #e2e8f0",
  },
  serviceRow: {
    display: "grid",
    gridTemplateColumns: "28px minmax(260px, 1fr) 320px",
    gap: 12,
    alignItems: "center",
    minHeight: 58,
    padding: "0 14px",
  },
  category: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
  },
  scopeGrid: {
    display: "grid",
    gridTemplateColumns: "80px minmax(0, 1fr)",
    gap: 7,
  },
  compactInput: {
    width: "100%",
    height: 34,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    padding: "0 8px",
    fontSize: 12,
  },
  serviceDetails: {
    display: "grid",
    gap: 8,
    margin: "0 14px 14px 42px",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    padding: 10,
    fontFamily: "inherit",
    fontSize: 12,
    lineHeight: 1.45,
  },
  actionBar: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
  },
  cancelButton: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0 14px",
    border: "1px solid #94a3b8",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 800,
  },
  saveButton: {
    minHeight: 40,
    padding: "0 16px",
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  errorBox: {
    marginBottom: 14,
    padding: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 750,
  },
};
