"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";

type PackageOption = {
  code: string;
  name: string;
  monthlyFee: number;
  description: string;
};

type ServiceLine = {
  id: string;
  category: string;
  name: string;
  description: string;
  includedInPackage: boolean;
  feeType: "Monthly" | "Annual" | "Once-off";
  amount: number;
  scopeQuantity: number | "";
  scopeUnit: string;
  clientFacingNote: string;
};

const packageOptions: PackageOption[] = [
  {
    code: "baseline",
    name: "Baseline Package",
    monthlyFee: 1000,
    description: "Core compliance support for a small and uncomplicated entity.",
  },
  {
    code: "starter",
    name: "Starter Package",
    monthlyFee: 1350,
    description: "Essential accounting and compliance support for a growing business.",
  },
  {
    code: "momentum",
    name: "Momentum Package",
    monthlyFee: 2173.91,
    description: "Broader accounting, payroll and compliance support.",
  },
  {
    code: "accelerator",
    name: "Accelerator Package",
    monthlyFee: 4173.91,
    description: "Comprehensive accounting and compliance support with regular oversight.",
  },
  {
    code: "custom",
    name: "Custom Package",
    monthlyFee: 0,
    description: "A tailored package based on the client’s exact requirements.",
  },
];

const initialServices: ServiceLine[] = [
  {
    id: "monthly-bookkeeping",
    category: "Accounting Services",
    name: "Monthly Bookkeeping",
    description:
      "Monthly processing and review of the accounting records, including bank and control account reconciliations.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 6,
    scopeUnit: "financial accounts",
    clientFacingNote:
      "Includes processing and reconciliation of up to 6 bank, money market or credit card accounts.",
  },
  {
    id: "vat-compliance",
    category: "Taxation Services",
    name: "Bi-Monthly VAT Compliance",
    description:
      "Preparation, review and submission of the bi-monthly VAT return based on the accounting information and supporting records supplied.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "afs",
    category: "Accounting Services",
    name: "Annual Financial Statements",
    description:
      "Preparation of annual financial statements in accordance with the applicable financial reporting framework. Any independent review or audit, should one become legally required or requested, is excluded and will be quoted separately.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "cipc-ar",
    category: "Compliance Services",
    name: "CIPC Annual Return",
    description:
      "Preparation and submission of the annual return to the Companies and Intellectual Property Commission.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "beneficial-ownership",
    category: "Compliance Services",
    name: "Beneficial Ownership Declaration",
    description:
      "Preparation and submission of the entity’s beneficial ownership declaration and supporting information.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "debtors-creditors",
    category: "Accounting Services",
    name: "Debtors and Creditors Assistance",
    description:
      "Assistance with maintaining debtor and creditor accounts, allocations, reconciliations and routine account queries based on information supplied.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "Debt collection, supplier payment approval and payment loading remain subject to separate client instructions and controls.",
  },
  {
    id: "uif-declaration",
    category: "Payroll Services",
    name: "UIF Declaration to the Department of Employment and Labour",
    description:
      "Preparation and submission of the monthly UIF declaration to the Department of Employment and Labour.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "letter-good-standing",
    category: "Compliance Services",
    name: "Letter of Good Standing",
    description:
      "Annual application for the Compensation Fund Letter of Good Standing, subject to the employer account being compliant and all assessments being paid.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "Compensation Fund assessment amounts are excluded from the monthly professional fee.",
  },
  {
    id: "paia",
    category: "Compliance Services",
    name: "PAIA Manual and Information Officer Registration",
    description:
      "Preparation of the PAIA manual and registration of the Information Officer, including the initial compliance setup.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
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
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 10,
    scopeUnit: "employees",
    clientFacingNote:
      "Included for the agreed payroll of up to 10 employees.",
  },
  {
    id: "tax-compliance",
    category: "Taxation Services",
    name: "Routine Tax Compliance and SARS Query Management",
    description:
      "General tax compliance assistance and routine liaison with SARS. Formal audits, objections and disputes are excluded unless separately agreed.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
];

export default function NewProposalPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [validDays, setValidDays] = useState(14);

  const [packageCode, setPackageCode] = useState("custom");
  const [customPackageName, setCustomPackageName] = useState(
    "Custom Finance and Compliance Package"
  );
  const [customMonthlyFee, setCustomMonthlyFee] = useState(12500);

  const [selectedIds, setSelectedIds] = useState<string[]>([
    "monthly-bookkeeping",
    "vat-compliance",
    "monthly-payroll",
    "emp201",
    "emp501",
    "afs",
    "itr14",
    "irp6",
    "cipc-ar",
    "beneficial-ownership",
    "workmans",
    "management-reporting",
    "debtors-creditors",
    "uif-declaration",
    "letter-good-standing",
    "paia",
    "payroll-software",
    "tax-compliance",
  ]);
  const [services, setServices] = useState<ServiceLine[]>(initialServices);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedPackage = useMemo(
    () =>
      packageOptions.find((option) => option.code === packageCode) ||
      packageOptions[packageOptions.length - 1],
    [packageCode]
  );

  const packageName =
    packageCode === "custom" ? customPackageName : selectedPackage.name;

  const packageMonthlyFee =
    packageCode === "custom" ? customMonthlyFee : selectedPackage.monthlyFee;

  const selectedServices = useMemo(
    () => services.filter((service) => selectedIds.includes(service.id)),
    [selectedIds, services]
  );

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
      }),
    []
  );

  function toggleService(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((serviceId) => serviceId !== id)
        : [...current, id]
    );
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

  async function saveDraft() {
    try {
      setSaving(true);
      setSaveError("");

      if (!companyName.trim()) {
        throw new Error("Please enter the prospective client’s company name.");
      }

      if (!packageName.trim()) {
        throw new Error("Please enter a package name.");
      }

      if (packageMonthlyFee <= 0) {
        throw new Error("Please enter the monthly package fee.");
      }

      if (selectedServices.length === 0) {
        throw new Error("Please select at least one service.");
      }

      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: null,
          clientName: companyName.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactNumber: contactNumber.trim(),
          validDays,
          packageCode,
          packageName: packageName.trim(),
          packageDescription: selectedPackage.description,
          packageMonthlyFee,
          services: selectedServices,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save proposal.");
      }

      router.push(`/proposals/${result.proposal_id}`);
    } catch (error: any) {
      setSaveError(error?.message || "Unable to save proposal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PROPOSALS</p>
          <h1 style={styles.title}>Create proposal</h1>
          <p style={styles.subtitle}>
            Capture the prospect, choose the package and define what is included.
          </p>
        </div>

        <Link href="/proposals" style={styles.backLink}>
          Back to proposals
        </Link>
      </section>

      <section style={styles.layout}>
        <div style={styles.mainColumn}>
          <section style={styles.panel}>
            <div style={styles.panelHeading}>
              <span style={styles.stepNumber}>1</span>
              <div>
                <h2 style={styles.panelTitle}>Prospective client</h2>
                <p style={styles.panelText}>
                  The prospect only becomes a CRM client after accepting the proposal.
                </p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Company or client name</span>
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Prospective client legal name"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Contact person</span>
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Primary contact"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Contact email</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="name@client.co.za"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Contact number</span>
                <input
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  placeholder="Telephone or mobile number"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Proposal valid for</span>
                <select
                  value={validDays}
                  onChange={(event) => setValidDays(Number(event.target.value))}
                  style={styles.input}
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </label>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeading}>
              <span style={styles.stepNumber}>2</span>
              <div>
                <h2 style={styles.panelTitle}>Package and fee</h2>
                <p style={styles.panelText}>
                  The package carries one monthly fee. Selected services are included.
                </p>
              </div>
            </div>

            <div style={styles.packageGrid}>
              {packageOptions.map((option) => {
                const active = option.code === packageCode;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setPackageCode(option.code)}
                    style={{
                      ...styles.packageButton,
                      ...(active ? styles.packageButtonActive : {}),
                    }}
                  >
                    <strong>{option.name}</strong>
                    <span>{money.format(option.monthlyFee)} excl. VAT</span>
                  </button>
                );
              })}
            </div>

            {packageCode === "custom" ? (
              <div style={styles.customPackageGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Custom package name</span>
                  <input
                    value={customPackageName}
                    onChange={(event) => setCustomPackageName(event.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Monthly fee excl. VAT</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customMonthlyFee}
                    onChange={(event) =>
                      setCustomMonthlyFee(Number(event.target.value))
                    }
                    style={styles.input}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeading}>
              <span style={styles.stepNumber}>3</span>
              <div>
                <h2 style={styles.panelTitle}>Services included</h2>
                <p style={styles.panelText}>
                  Select only the services that must appear in this proposal.
                </p>
              </div>
            </div>

            <div style={styles.serviceHeader}>
              <span />
              <span>Service</span>
              <span>Scope</span>
              <span>Proposal display</span>
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
                      aria-label={`Select ${service.name}`}
                    />

                    <div>
                      <strong style={styles.serviceName}>{service.name}</strong>
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
                        style={styles.scopeQuantity}
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
                        placeholder="employees, accounts..."
                        style={styles.scopeUnit}
                      />
                    </div>

                    <strong style={styles.includedText}>
                      {selected ? "Included" : "Not selected"}
                    </strong>
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
                        style={styles.descriptionInput}
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
                        placeholder="Optional scope note shown to the client"
                        style={styles.noteInput}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        </div>

        <aside style={styles.summary}>
          <h2 style={styles.summaryTitle}>Proposal summary</h2>

          <div style={styles.summaryDetail}>
            <span>Prospect</span>
            <strong>{companyName || "Not entered"}</strong>
          </div>

          <div style={styles.summaryDetail}>
            <span>Package</span>
            <strong>{packageName}</strong>
          </div>

          <div style={styles.summaryDetail}>
            <span>Selected services</span>
            <strong>{selectedServices.length}</strong>
          </div>

          <div style={styles.totalRow}>
            <span>Monthly fee excl. VAT</span>
            <strong>{money.format(packageMonthlyFee)}</strong>
          </div>

          <div style={styles.totalRow}>
            <span>VAT</span>
            <strong>{money.format(packageMonthlyFee * 0.15)}</strong>
          </div>

          <div style={styles.grandTotalRow}>
            <span>Monthly incl. VAT</span>
            <strong>{money.format(packageMonthlyFee * 1.15)}</strong>
          </div>

          <button
            type="button"
            style={{
              ...styles.saveButton,
              ...(saving ? styles.saveButtonDisabled : {}),
            }}
            onClick={saveDraft}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save draft"}
          </button>

          {saveError ? <p style={styles.saveError}>{saveError}</p> : null}
        </aside>
      </section>
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
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 22,
  },
  eyebrow: {
    margin: "0 0 5px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.14em",
    color: "#2563eb",
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#64748b",
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 315px",
    gap: 18,
    alignItems: "start",
  },
  mainColumn: {
    display: "grid",
    gap: 16,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
  },
  panelHeading: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "16px 18px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
  },
  stepNumber: {
    display: "inline-flex",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
  },
  panelText: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#64748b",
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
  label: {
    fontSize: 12,
    fontWeight: 850,
    color: "#334155",
  },
  input: {
    width: "100%",
    height: 40,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: 13,
    outline: "none",
  },
  packageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
    padding: 18,
  },
  packageButton: {
    display: "grid",
    gap: 6,
    minHeight: 78,
    padding: 12,
    textAlign: "left",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
  },
  packageButtonActive: {
    borderColor: "#2563eb",
    background: "#eff6ff",
    boxShadow: "inset 0 -3px 0 #2563eb",
  },
  customPackageGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 220px",
    gap: 14,
    padding: "0 18px 18px",
  },
  serviceHeader: {
    display: "grid",
    gridTemplateColumns: "28px minmax(230px, 1fr) 300px 120px",
    gap: 12,
    alignItems: "center",
    minHeight: 38,
    padding: "0 14px",
    background: "#f1f5f9",
    borderBottom: "1px solid #dbe3ef",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#475569",
  },
  serviceBlock: {
    borderBottom: "1px solid #e2e8f0",
  },
  serviceRow: {
    display: "grid",
    gridTemplateColumns: "28px minmax(230px, 1fr) 300px 120px",
    gap: 12,
    alignItems: "center",
    minHeight: 60,
    padding: "0 14px",
  },
  serviceName: {
    display: "block",
    fontSize: 13,
  },
  category: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
  },
  scopeGrid: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: 6,
  },
  scopeQuantity: {
    width: "100%",
    height: 34,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    padding: "0 8px",
    fontSize: 12,
  },
  scopeUnit: {
    width: "100%",
    height: 34,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    padding: "0 8px",
    fontSize: 12,
  },
  includedText: {
    textAlign: "right",
    fontSize: 12,
    color: "#166534",
  },
  serviceDetails: {
    display: "grid",
    gap: 8,
    margin: "0 14px 14px 42px",
  },
  descriptionInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: 10,
    fontSize: 12,
    lineHeight: 1.45,
    resize: "vertical",
    fontFamily: "inherit",
  },
  noteInput: {
    width: "100%",
    height: 36,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    fontSize: 12,
  },
  summary: {
    position: "sticky",
    top: 72,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    padding: 16,
  },
  summaryTitle: {
    margin: "0 0 14px",
    fontSize: 16,
    fontWeight: 900,
  },
  summaryDetail: {
    display: "grid",
    gap: 3,
    padding: "10px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    color: "#64748b",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "11px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
  },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "13px 0",
    borderBottom: "2px solid #0f172a",
    fontSize: 14,
  },
  saveButton: {
    width: "100%",
    minHeight: 42,
    marginTop: 16,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  saveButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  saveError: {
    margin: "10px 0 0",
    fontSize: 11,
    lineHeight: 1.45,
    color: "#b91c1c",
    fontWeight: 750,
  },
};
