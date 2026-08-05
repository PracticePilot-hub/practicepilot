"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ServiceLine = {
  id: string;
  category: string;
  name: string;
  description: string;
  feeType: "Monthly" | "Annual" | "Once-off";
  scopeQuantity: number | "";
  scopeUnit: string;
  clientFacingNote: string;
};

const serviceLibrary: ServiceLine[] = [
  {
    id: "monthly-bookkeeping",
    category: "Accounting Services",
    name: "Monthly Bookkeeping",
    description:
      "Monthly processing and review of the accounting records, including bank and control account reconciliations.",
    feeType: "Monthly",
    scopeQuantity: 6,
    scopeUnit: "financial accounts",
    clientFacingNote:
      "Includes processing and reconciliation of up to 6 bank, money market or credit card accounts.",
  },
  {
    id: "debtors-creditors",
    category: "Accounting Services",
    name: "Debtors and Creditors Assistance",
    description:
      "Assistance with maintaining debtor and creditor accounts, allocations, reconciliations and routine account queries based on information supplied.",
    feeType: "Monthly",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "Debt collection, supplier payment approval and payment loading remain subject to separate client instructions and controls.",
  },
  {
    id: "afs",
    category: "Accounting Services",
    name: "Annual Financial Statements",
    description:
      "Preparation of annual financial statements in accordance with the applicable financial reporting framework. Any independent review or audit, should one become legally required or requested, is excluded and will be quoted separately.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "management-reporting",
    category: "Management Reporting",
    name: "Monthly Management Reporting",
    description:
      "Preparation of a monthly income statement, balance sheet, trial balance and basic management review to support informed decision-making.",
    feeType: "Monthly",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "vat-compliance",
    category: "Taxation Services",
    name: "Bi-Monthly VAT Compliance",
    description:
      "Preparation, review and submission of the bi-monthly VAT return based on the accounting information and supporting records supplied.",
    feeType: "Monthly",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "itr14",
    category: "Taxation Services",
    name: "Business Income Tax Return",
    description:
      "Preparation and submission of the annual corporate income tax return and review of the resulting assessment.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "irp6",
    category: "Taxation Services",
    name: "Business Provisional Tax Returns",
    description:
      "Preparation and submission of the first and second provisional tax returns.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "tax-compliance",
    category: "Taxation Services",
    name: "Routine Tax Compliance and SARS Query Management",
    description:
      "General tax compliance assistance and routine liaison with SARS. Formal audits, objections and disputes are excluded unless separately agreed.",
    feeType: "Monthly",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "monthly-payroll",
    category: "Payroll Services",
    name: "Monthly Payroll",
    description:
      "Processing of monthly payroll, statutory deductions, payslips and standard payroll reports, including routine new employee and termination processing.",
    feeType: "Monthly",
    scopeQuantity: 10,
    scopeUnit: "employees",
    clientFacingNote:
      "Includes payroll for up to 10 employees. Leave administration and non-routine HR matters are excluded unless separately agreed.",
  },
  {
    id: "emp201",
    category: "Payroll Services",
    name: "Monthly EMP201 Submission",
    description:
      "Preparation and submission of the monthly PAYE, UIF and SDL declaration.",
    feeType: "Monthly",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "uif-declaration",
    category: "Payroll Services",
    name: "UIF Declaration to the Department of Employment and Labour",
    description:
      "Preparation and submission of the monthly UIF declaration to the Department of Employment and Labour.",
    feeType: "Monthly",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "emp501",
    category: "Payroll Services",
    name: "EMP501 Reconciliations",
    description:
      "Preparation and submission of the interim and annual employer reconciliations and employee tax certificates.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "payroll-software",
    category: "Software and Subscriptions",
    name: "Payroll Software Subscription",
    description:
      "Monthly payroll software subscription required for processing the agreed payroll service.",
    feeType: "Monthly",
    scopeQuantity: 10,
    scopeUnit: "employees",
    clientFacingNote:
      "Included for the agreed payroll of up to 10 employees.",
  },
  {
    id: "cipc-ar",
    category: "Compliance Services",
    name: "CIPC Annual Return",
    description:
      "Preparation and submission of the annual return to the Companies and Intellectual Property Commission.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "CIPC statutory filing fees are excluded from the monthly professional fee.",
  },
  {
    id: "beneficial-ownership",
    category: "Compliance Services",
    name: "Beneficial Ownership Declaration",
    description:
      "Preparation and submission of the entity’s beneficial ownership declaration and supporting information.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "workmans",
    category: "Compliance Services",
    name: "Compensation Fund Return of Earnings",
    description:
      "Preparation and submission of the annual Return of Earnings, where applicable.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "Compensation Fund assessment amounts are excluded from the monthly professional fee.",
  },
  {
    id: "letter-good-standing",
    category: "Compliance Services",
    name: "Letter of Good Standing",
    description:
      "Annual application for the Compensation Fund Letter of Good Standing, subject to the employer account being compliant and all assessments being paid.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "paia",
    category: "Compliance Services",
    name: "PAIA Manual and Information Officer Registration",
    description:
      "Preparation of the PAIA manual and registration of the Information Officer, including the initial compliance setup.",
    feeType: "Annual",
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
];

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

        const existingByCode = new Map<string, any>(
          existingServices.map((service: any) => [
            String(service.service_code || service.id),
            service,
          ])
        );

        const existingByName = new Map<string, any>(
          existingServices.map((service: any) => [
            String(service.service_name || "").toLowerCase(),
            service,
          ])
        );

        const merged = serviceLibrary.map((libraryService) => {
          const existing =
            existingByCode.get(libraryService.id) ||
            existingByName.get(libraryService.name.toLowerCase());

          if (!existing) return libraryService;

          return {
            ...libraryService,
            category: existing.category || libraryService.category,
            name: existing.service_name || libraryService.name,
            description: existing.description || libraryService.description,
            feeType: existing.fee_type || libraryService.feeType,
            scopeQuantity:
              existing.scope_quantity === null ||
              existing.scope_quantity === undefined
                ? libraryService.scopeQuantity
                : Number(existing.scope_quantity),
            scopeUnit: existing.scope_unit || libraryService.scopeUnit,
            clientFacingNote:
              existing.client_facing_note || libraryService.clientFacingNote,
          };
        });

        setServices(merged);

        const selected = new Set<string>();
        for (const existing of existingServices) {
          const code = existing.service_code;
          const byCode = serviceLibrary.find((item) => item.id === code);
          const byName = serviceLibrary.find(
            (item) =>
              item.name.toLowerCase() ===
              String(existing.service_name || "").toLowerCase()
          );
          if (byCode) selected.add(byCode.id);
          else if (byName) selected.add(byName.id);
        }

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

  function selectRecommendedServices() {
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
              This draft was created before the extra services were added. Use
              the button below to select the complete recommended scope.
            </p>
          </div>

          <button
            type="button"
            onClick={selectRecommendedServices}
            style={styles.secondaryButton}
          >
            Select all recommended services
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
