"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

const supabaseAny = supabase as any;

type Basis = "basic" | "current" | "projected" | "custom";

type ClientOption = {
  id: string;
  client_name: string;
  registration_number: string | null;
};

type DirectorOption = {
  id: string;
  director_name: string;
  director_capacity: string | null;
  is_active: boolean | null;
};

type FirmSettings = {
  firm_name: string;
  trading_name: string;
  logo_url: string;
  address_lines: string;
  telephone: string;
  email: string;
  website: string;
  practitioner_name: string;
  practitioner_designation: string;
  footer_text: string;
  footer_logo_url: string;
};

type SavedWorkbench = {
  id: string;
  due_date: string | null;
  basic_assessment_year: number | null;
  basic_assessment_date: string | null;
  basic_taxable_income: number | null;
  basic_capital_gain_component: number | null;
  basic_uplift_percent: number | null;
  basic_amount: number | null;
  ytd_period_start: string | null;
  ytd_period_end: string | null;
  ytd_months: number | null;
  ytd_accounting_profit: number | null;
  projected_accounting_profit: number | null;
  non_deductible_expenses: number | null;
  donations: number | null;
  accounting_depreciation: number | null;
  tax_capital_allowances: number | null;
  other_tax_adjustments: number | null;
  current_taxable_income: number | null;
  projected_taxable_income: number | null;
  custom_taxable_income: number | null;
  recommended_basis: Basis | null;
  recommended_taxable_income: number | null;
  paye_credits: number | null;
  foreign_tax_credits: number | null;
  first_provisional_paid: number | null;
  other_tax_credits: number | null;
  estimated_full_year_tax: number | null;
  recommended_provisional_payment: number | null;
  adviser_note: string | null;
  status: string | null;
  client_approval_status: "pending" | "approved" | "query" | null;
  client_approved_by_name: string | null;
  client_approved_at: string | null;
  client_approval_method: string | null;
  client_approval_note: string | null;
  irp6_prepared_at: string | null;
  irp6_submitted_at: string | null;
  irp6_submission_reference: string | null;
  payment_status: "not_paid" | "paid" | null;
  payment_date: string | null;
  payment_reference: string | null;
};

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function money(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function num(value: string | number | null | undefined) {
  const parsed = Number(
    String(value ?? 0)
      .replace(/\s/g, "")
      .replace(/,/g, "")
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInputAmount(value: string | number | null | undefined) {
  const amount = num(value);
  const fixed = amount.toFixed(2);
  const [whole, decimals] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}.${decimals}`;
}

function stripInputAmount(value: string) {
  return value.replace(/\s/g, "");
}

function toInput(value: unknown) {
  if (value === null || value === undefined) return "0";
  return String(value);
}

export default function ProvisionalTaxWorkbenchPage() {
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("Select a client");
  const [clientRegistration, setClientRegistration] = useState("");
  const [directors, setDirectors] = useState<DirectorOption[]>([]);
  const [selectedDirectorId, setSelectedDirectorId] = useState("");
  const [authorisedPersonCapacity, setAuthorisedPersonCapacity] = useState("");
  const [firmSettings, setFirmSettings] = useState<FirmSettings>({
    firm_name: "",
    trading_name: "",
    logo_url: "",
    address_lines: "",
    telephone: "",
    email: "",
    website: "",
    practitioner_name: "",
    practitioner_designation: "",
    footer_text: "",
    footer_logo_url: "",
  });

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingWorkbench, setLoadingWorkbench] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [clientApprovalStatus, setClientApprovalStatus] = useState<
    "pending" | "approved" | "query"
  >("pending");
  const [approvedByName, setApprovedByName] = useState("");
  const [approvalMethod, setApprovalMethod] = useState("manual");
  const [approvalNote, setApprovalNote] = useState("");
  const [approvedAt, setApprovedAt] = useState("");
  const [showIrp6Preparation, setShowIrp6Preparation] = useState(false);
  const [payeCredits, setPayeCredits] = useState("0");
  const [foreignTaxCredits, setForeignTaxCredits] = useState("0");
  const [otherTaxCredits, setOtherTaxCredits] = useState("0");
  const [irp6PreparedAt, setIrp6PreparedAt] = useState("");
  const [irp6SubmittedAt, setIrp6SubmittedAt] = useState("");
  const [irp6SubmissionReference, setIrp6SubmissionReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"not_paid" | "paid">("not_paid");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [taxYear, setTaxYear] = useState("2027");
  const [dueDate, setDueDate] = useState("");

  const [basicAssessmentYear, setBasicAssessmentYear] = useState("");
  const [basicAssessmentDate, setBasicAssessmentDate] = useState("");
  const [basicTaxableIncome, setBasicTaxableIncome] = useState("0");
  const [basicCapitalGainComponent, setBasicCapitalGainComponent] = useState("0");
  const [basicUpliftPercent, setBasicUpliftPercent] = useState("0");

  const [ytdPeriodStart, setYtdPeriodStart] = useState("");
  const [ytdPeriodEnd, setYtdPeriodEnd] = useState("");
  const [ytdProfit, setYtdProfit] = useState("0");
  const [monthsElapsed, setMonthsElapsed] = useState("0");

  const [nonDeductible, setNonDeductible] = useState("0");
  const [donations, setDonations] = useState("0");
  const [accountingDepreciation, setAccountingDepreciation] = useState("0");
  const [taxAllowances, setTaxAllowances] = useState("0");
  const [otherAdjustments, setOtherAdjustments] = useState("0");

  const [customEstimate, setCustomEstimate] = useState("0");
  const [basis, setBasis] = useState<Basis>("basic");
  const [adviserNote, setAdviserNote] = useState("");

  const companyTaxRate = 0.27;

  const basicAmount = useMemo(() => {
    const assessed = num(basicTaxableIncome) - num(basicCapitalGainComponent);
    return assessed * (1 + num(basicUpliftPercent) / 100);
  }, [basicTaxableIncome, basicCapitalGainComponent, basicUpliftPercent]);

  const currentTaxable = useMemo(
    () =>
      num(ytdProfit) +
      num(nonDeductible) +
      num(donations) +
      num(accountingDepreciation) -
      num(taxAllowances) +
      num(otherAdjustments),
    [
      ytdProfit,
      nonDeductible,
      donations,
      accountingDepreciation,
      taxAllowances,
      otherAdjustments,
    ]
  );

  const projectedAccountingProfit = useMemo(() => {
    const months = Math.max(1, num(monthsElapsed));
    return (num(ytdProfit) / months) * 12;
  }, [ytdProfit, monthsElapsed]);

  const projectedTaxable = useMemo(
    () =>
      projectedAccountingProfit +
      num(nonDeductible) +
      num(donations) +
      num(accountingDepreciation) -
      num(taxAllowances) +
      num(otherAdjustments),
    [
      projectedAccountingProfit,
      nonDeductible,
      donations,
      accountingDepreciation,
      taxAllowances,
      otherAdjustments,
    ]
  );

  const basisValues: Record<Basis, number> = {
    basic: basicAmount,
    current: currentTaxable,
    projected: projectedTaxable,
    custom: num(customEstimate),
  };

  const recommendedTaxableIncome = basisValues[basis];
  const recommendedAnnualTax = recommendedTaxableIncome * companyTaxRate;
  const recommendedFirstProvisional = recommendedAnnualTax / 2;

  const irp6AmountPayable = Math.max(
    0,
    recommendedFirstProvisional -
      num(payeCredits) -
      num(foreignTaxCredits) -
      num(otherTaxCredits)
  );

  useEffect(() => {
    async function loadClients() {
      setLoadingClients(true);
      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabaseAny.auth.getUser();

        if (userError || !user) {
          throw new Error("Your PracticePilot login could not be confirmed.");
        }

        const { data: profile, error: profileError } = await supabaseAny
          .from("user_profiles")
          .select("organisation_id, access_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.access_enabled) {
          throw new Error("Your PracticePilot access is disabled.");
        }
        if (!profile?.organisation_id) {
          throw new Error("Your user profile is not linked to an organisation.");
        }

        const { data: brandingData, error: brandingError } = await supabaseAny
          .from("afs_firm_settings")
          .select(`
            firm_name,
            trading_name,
            logo_url,
            address_lines,
            telephone,
            email,
            website,
            practitioner_name,
            practitioner_designation,
            footer_text,
            footer_logo_url
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (brandingError) {
          console.warn("Could not load firm branding for Tax PDF:", brandingError);
        } else if (brandingData) {
          setFirmSettings({
            firm_name: brandingData.firm_name || "",
            trading_name: brandingData.trading_name || "",
            logo_url: brandingData.logo_url || "",
            address_lines: brandingData.address_lines || "",
            telephone: brandingData.telephone || "",
            email: brandingData.email || "",
            website: brandingData.website || "",
            practitioner_name: brandingData.practitioner_name || "",
            practitioner_designation: brandingData.practitioner_designation || "",
            footer_text: brandingData.footer_text || "",
            footer_logo_url: brandingData.footer_logo_url || "",
          });
        }

        const { data, error } = await supabaseAny
          .from("crm_clients")
          .select("id, client_name, registration_number")
          .eq("organisation_id", profile.organisation_id)
          .order("client_name", { ascending: true });

        if (error) throw error;

        const loaded = (data || []) as ClientOption[];
        setClients(loaded);

        const requestedClientId = searchParams.get("clientId");
        const requested =
          loaded.find((client) => client.id === requestedClientId) || null;

        if (requested) {
          setClientId(requested.id);
          setClientName(requested.client_name);
          setClientRegistration(requested.registration_number || "");
        } else {
          setClientId("");
          setClientName("Select a client");
          setClientRegistration("");
        }
      } catch (error) {
        console.error("Could not load provisional tax clients:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load provisional tax clients."
        );
      } finally {
        setLoadingClients(false);
      }
    }

    loadClients();
  }, [searchParams]);

  useEffect(() => {
    if (!clientId) {
      setDirectors([]);
      setSelectedDirectorId("");
      setAuthorisedPersonCapacity("");
      return;
    }

    async function loadDirectors() {
      try {
        const { data, error } = await supabaseAny
          .from("crm_client_directors")
          .select("id, director_name, director_capacity, is_active")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("director_name", { ascending: true });

        if (error) throw error;

        const loaded = (data || []) as DirectorOption[];
        setDirectors(loaded);

        const currentMatch = loaded.find(
          (director) =>
            director.director_name.trim().toLowerCase() ===
            approvedByName.trim().toLowerCase()
        );

        const initialDirector = currentMatch || loaded[0] || null;

        if (initialDirector) {
          setSelectedDirectorId(initialDirector.id);
          setApprovedByName((current) => current || initialDirector.director_name);
          setAuthorisedPersonCapacity(initialDirector.director_capacity || "Director");
        } else {
          setSelectedDirectorId("");
          setAuthorisedPersonCapacity("");
        }
      } catch (error) {
        console.warn("Could not load client directors for provisional tax:", error);
        setDirectors([]);
        setSelectedDirectorId("");
        setAuthorisedPersonCapacity("");
      }
    }

    loadDirectors();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;

    async function loadWorkbench() {
      setLoadingWorkbench(true);
      setMessage("");
      setErrorMessage("");

      try {
        const response = await fetch(
          `/api/tax/provisional-tax?clientId=${encodeURIComponent(
            clientId
          )}&taxYear=${encodeURIComponent(taxYear)}&period=first`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to load workbench.");
        }

        if (result.client) {
          setClientName(result.client.client_name || "Client");
          setClientRegistration(result.client.registration_number || "");
        }

        const wb = result.workbench as SavedWorkbench | null;
        if (!wb) {
          setDueDate("");
          setBasicAssessmentYear("");
          setBasicAssessmentDate("");
          setBasicTaxableIncome("0");
          setBasicCapitalGainComponent("0");
          setBasicUpliftPercent("0");
          setYtdPeriodStart("");
          setYtdPeriodEnd("");
          setMonthsElapsed("0");
          setYtdProfit("0");
          setNonDeductible("0");
          setDonations("0");
          setAccountingDepreciation("0");
          setTaxAllowances("0");
          setOtherAdjustments("0");
          setCustomEstimate("0");
          setBasis("basic");
          setAdviserNote("");
          setClientApprovalStatus("pending");
          setApprovalMethod("manual");
          setApprovalNote("");
          setApprovedAt("");
          setShowIrp6Preparation(false);
          setPayeCredits("0");
          setForeignTaxCredits("0");
          setOtherTaxCredits("0");
          setIrp6PreparedAt("");
          setIrp6SubmittedAt("");
          setIrp6SubmissionReference("");
          setPaymentStatus("not_paid");
          setPaymentDate("");
          setPaymentReference("");
          return;
        }

        setDueDate(wb.due_date || "");
        setBasicAssessmentYear(
          wb.basic_assessment_year ? String(wb.basic_assessment_year) : ""
        );
        setBasicAssessmentDate(wb.basic_assessment_date || "");
        setBasicTaxableIncome(toInput(wb.basic_taxable_income));
        setBasicCapitalGainComponent(toInput(wb.basic_capital_gain_component));
        setBasicUpliftPercent(toInput(wb.basic_uplift_percent));

        setYtdPeriodStart(wb.ytd_period_start || "");
        setYtdPeriodEnd(wb.ytd_period_end || "");
        setMonthsElapsed(toInput(wb.ytd_months));
        setYtdProfit(toInput(wb.ytd_accounting_profit));

        setNonDeductible(toInput(wb.non_deductible_expenses));
        setDonations(toInput(wb.donations));
        setAccountingDepreciation(toInput(wb.accounting_depreciation));
        setTaxAllowances(toInput(wb.tax_capital_allowances));
        setOtherAdjustments(toInput(wb.other_tax_adjustments));

        setCustomEstimate(toInput(wb.custom_taxable_income));
        setBasis((wb.recommended_basis || "projected") as Basis);
        setAdviserNote(wb.adviser_note || "");
        setClientApprovalStatus(wb.client_approval_status || "pending");
        if (wb.client_approved_by_name) {
          setApprovedByName(wb.client_approved_by_name);

          const matchedDirector = directors.find(
            (director) =>
              director.director_name.trim().toLowerCase() ===
              wb.client_approved_by_name!.trim().toLowerCase()
          );

          if (matchedDirector) {
            setSelectedDirectorId(matchedDirector.id);
            setAuthorisedPersonCapacity(
              matchedDirector.director_capacity || "Director"
            );
          }
        }
        setApprovalMethod(wb.client_approval_method || "manual");
        setApprovalNote(wb.client_approval_note || "");
        setApprovedAt(wb.client_approved_at || "");
        setPayeCredits(toInput(wb.paye_credits));
        setForeignTaxCredits(toInput(wb.foreign_tax_credits));
        setOtherTaxCredits(toInput(wb.other_tax_credits));
        setIrp6PreparedAt(wb.irp6_prepared_at || "");
        setIrp6SubmittedAt(wb.irp6_submitted_at || "");
        setIrp6SubmissionReference(wb.irp6_submission_reference || "");
        setPaymentStatus(wb.payment_status || "not_paid");
        setPaymentDate(wb.payment_date || "");
        setPaymentReference(wb.payment_reference || "");
      } catch (error) {
        console.error("Could not load provisional tax workbench:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load workbench."
        );
      } finally {
        setLoadingWorkbench(false);
      }
    }

    loadWorkbench();
  }, [clientId, taxYear]);

  async function saveWorkbench() {
    if (!clientId) {
      setErrorMessage("Please select a client first.");
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/tax/provisional-tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          taxYear: num(taxYear),
          provisionalPeriod: "first",
          dueDate,

          basicAssessmentYear: num(basicAssessmentYear),
          basicAssessmentDate,
          basicTaxableIncome: num(basicTaxableIncome),
          basicCapitalGainComponent: num(basicCapitalGainComponent),
          basicUpliftPercent: num(basicUpliftPercent),
          basicAmount,

          ytdPeriodStart,
          ytdPeriodEnd,
          ytdMonths: num(monthsElapsed),
          ytdAccountingProfit: num(ytdProfit),

          projectedAccountingProfit,
          nonDeductibleExpenses: num(nonDeductible),
          donations: num(donations),
          accountingDepreciation: num(accountingDepreciation),
          taxCapitalAllowances: num(taxAllowances),
          otherTaxAdjustments: num(otherAdjustments),

          currentTaxableIncome: currentTaxable,
          projectedTaxableIncome: projectedTaxable,
          customTaxableIncome: num(customEstimate),

          recommendedBasis: basis,
          recommendedTaxableIncome,

          payeCredits: num(payeCredits),
          foreignTaxCredits: num(foreignTaxCredits),
          firstProvisionalPaid: 0,
          otherTaxCredits: num(otherTaxCredits),

          estimatedFullYearTax: recommendedAnnualTax,
          recommendedProvisionalPayment: irp6AmountPayable,
          adviserNote,
          status:
            clientApprovalStatus === "approved"
              ? "approved"
              : clientApprovalStatus === "query"
                ? "draft"
                : "client_ready",
          clientApprovalStatus,
          clientApprovedByName: approvedByName || null,
          clientApprovedAt: approvedAt || null,
          clientApprovalMethod:
            clientApprovalStatus === "approved" ? approvalMethod : null,
          clientApprovalNote: approvalNote || null,

          irp6PreparedAt: irp6PreparedAt || null,
          irp6SubmittedAt: irp6SubmittedAt || null,
          irp6SubmissionReference: irp6SubmissionReference || null,
          paymentStatus,
          paymentDate: paymentDate || null,
          paymentReference: paymentReference || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to save workbench.");
      }

      setMessage("Workbench saved.");
    } catch (error) {
      console.error("Could not save provisional tax workbench:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save workbench."
      );
    } finally {
      setSaving(false);
    }
  }

  function changeClient(nextClientId: string) {
    const selected = clients.find((client) => client.id === nextClientId);
    setClientId(nextClientId);
    setClientName(selected?.client_name || "Client");
    setClientRegistration(selected?.registration_number || "");
  }

  function changeAuthorisedPerson(nextDirectorId: string) {
    setSelectedDirectorId(nextDirectorId);

    const selected = directors.find(
      (director) => director.id === nextDirectorId
    );

    if (selected) {
      setApprovedByName(selected.director_name);
      setAuthorisedPersonCapacity(selected.director_capacity || "Director");
    } else {
      setApprovedByName("");
      setAuthorisedPersonCapacity("");
    }
  }

  function generateClientSummary() {
    if (!clientId) {
      setErrorMessage("Please select a client first.");
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      const basisLabel =
        basis === "basic"
          ? "Basic Amount"
          : basis === "current"
            ? "Current Position"
            : basis === "projected"
              ? "Projected Position"
              : "Custom Estimate";

      const selectedAuthorisedPerson =
        directors.find((director) => director.id === selectedDirectorId) || null;

      const pdfAuthorisedPersonName =
        selectedAuthorisedPerson?.director_name || approvedByName || "";

      const pdfAuthorisedPersonCapacity =
        selectedAuthorisedPerson?.director_capacity ||
        authorisedPersonCapacity ||
        "Director";

      const payload = {
        clientName,
        registrationNumber: clientRegistration,
        taxYear,
        provisionalPeriod: "First Provisional",
        dueDate,
        basisLabel,
        basicTaxableIncome: basicAmount,
        basicPayment: basicAmount * companyTaxRate * 0.5,
        currentTaxableIncome: currentTaxable,
        currentPayment: currentTaxable * companyTaxRate * 0.5,
        projectedTaxableIncome: projectedTaxable,
        projectedPayment: projectedTaxable * companyTaxRate * 0.5,
        recommendedTaxableIncome,
        recommendedPayment: recommendedFirstProvisional,
        adviserNote,
        approvalStatus: clientApprovalStatus,
        approvedByName: pdfAuthorisedPersonName,
        approvedAt,
        authorisedPersonName: pdfAuthorisedPersonName,
        authorisedPersonCapacity: pdfAuthorisedPersonCapacity,
        firmSettings,
      };

      const safeClientName = clientName
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const pdfFilename = `${safeClientName} - ${taxYear} First Provisional Tax Recommendation.pdf`;

      const pdfUrl =
        `/api/tax/provisional-tax/client-summary/${encodeURIComponent(
          pdfFilename
        )}?payload=${encodeURIComponent(JSON.stringify(payload))}`;

      window.open(pdfUrl, "_blank", "noopener,noreferrer");

      setMessage("Client summary opened in a new tab.");
    } catch (error) {
      console.error("Could not open client summary PDF:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to open the client summary PDF."
      );
    }
  }

  async function updateApproval(
    nextStatus: "pending" | "approved" | "query"
  ) {
    if (!clientId) {
      setErrorMessage("Please select a client first.");
      return;
    }

    const selectedAuthorisedPerson =
      directors.find((director) => director.id === selectedDirectorId) || null;

    const approvalPersonName =
      selectedAuthorisedPerson?.director_name || approvedByName || "";

    if (nextStatus === "approved" && !approvalPersonName.trim()) {
      setErrorMessage("Please select the authorised person who approved the estimate.");
      return;
    }

    if (selectedAuthorisedPerson) {
      setApprovedByName(selectedAuthorisedPerson.director_name);
      setAuthorisedPersonCapacity(
        selectedAuthorisedPerson.director_capacity || "Director"
      );
    }

    const nextApprovedAt =
      nextStatus === "approved" ? new Date().toISOString() : "";

    setClientApprovalStatus(nextStatus);
    setApprovedAt(nextApprovedAt);
    setMessage(
      nextStatus === "approved"
        ? "Client approval recorded. Save the workbench to keep the audit trail."
        : nextStatus === "query"
          ? "Client query recorded. Revise the recommendation before approval."
          : "Client approval reset to pending."
    );
    setShowIrp6Preparation(false);
  }

  async function markIrp6Prepared() {
    const now = irp6PreparedAt || new Date().toISOString();
    setIrp6PreparedAt(now);
    setShowIrp6Preparation(true);
    setMessage("IRP6 preparation opened. Save the workbench to keep this status.");

    window.setTimeout(() => {
      document
        .getElementById("irp6-preparation-workspace")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function markIrp6Submitted() {
    if (!irp6SubmissionReference.trim()) {
      setErrorMessage("Enter the SARS submission reference before marking the IRP6 submitted.");
      return;
    }

    const now = new Date().toISOString();
    setIrp6SubmittedAt(now);
    setMessage("IRP6 marked as submitted. Save the workbench to keep the submission record.");
  }

  function markPaymentPaid() {
    if (!paymentDate) {
      setErrorMessage("Enter the payment date before marking payment as paid.");
      return;
    }

    setPaymentStatus("paid");
    setMessage("Payment marked as paid. Save the workbench to keep the payment record.");
  }

  const scenarioCards = [
    {
      key: "basic" as Basis,
      number: "01",
      title: "Basic Amount",
      source: "Latest assessed taxable income",
      taxableIncome: basicAmount,
      payment: basicAmount * companyTaxRate * 0.5,
    },
    {
      key: "current" as Basis,
      number: "02",
      title: "Current Position",
      source: "Actual year-to-date results",
      taxableIncome: currentTaxable,
      payment: currentTaxable * companyTaxRate * 0.5,
    },
    {
      key: "projected" as Basis,
      number: "03",
      title: "Projected Position",
      source: "Annualised / adjusted full-year estimate",
      taxableIncome: projectedTaxable,
      payment: projectedTaxable * companyTaxRate * 0.5,
    },
  ];

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/tax" style={crumbLink}>Tax</Link>
        <span>›</span>
        <span>Provisional Tax</span>
        <span>›</span>
        <span>IRP6 Workbench</span>
      </div>

      <section style={headingRow}>
        <div>
          <div style={titleLine}>
            <h1 style={title}>IRP6 Provisional Tax Workbench</h1>
            <span style={judgementBadge}>⚖ Adviser judgement</span>
          </div>
          <p style={subtitle}>
            Estimate, compare, advise and prepare a client-facing provisional tax recommendation.
          </p>
        </div>

        <div style={headingActions}>
          <button
            type="button"
            style={secondaryButton}
            onClick={saveWorkbench}
            disabled={saving || !clientId}
          >
            {saving ? "Saving..." : "Save Workbench"}
          </button>
          <button
            type="button"
            style={primaryButton}
            onClick={generateClientSummary}
            disabled={!clientId}
          >
            Open Client Summary PDF
          </button>
        </div>
      </section>

      {errorMessage ? <div style={errorBox}>{errorMessage}</div> : null}
      {message ? <div style={successBox}>{message}</div> : null}

      <section style={clientStrip}>
        <div style={clientIdentity}>
          <div style={entityBadge}>
            {clientName === "Select a client"
              ? "PP"
              : clientName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
          </div>

          <div style={{ minWidth: 0, width: "100%" }}>
            <div style={stripLabel}>Client</div>
            <select
              value={clientId}
              onChange={(event) => changeClient(event.target.value)}
              style={clientSelect}
              disabled={loadingClients}
            >
              <option value="">
                {loadingClients ? "Loading clients..." : "Select a client"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>
            <div style={clientMeta}>
              {clientRegistration || "No registration number captured"}
            </div>
          </div>
        </div>

        <div style={stripItem}>
          <div style={stripLabel}>Tax year</div>
          <input
            value={taxYear}
            onChange={(event) => setTaxYear(event.target.value)}
            style={stripInput}
          />
        </div>

        <div style={stripItem}>
          <div style={stripLabel}>Period</div>
          <div style={stripValue}>First Provisional</div>
        </div>

        <div style={stripItem}>
          <div style={stripLabel}>Due date</div>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            style={dateInput}
          />
        </div>
      </section>

      {loadingWorkbench ? (
        <div style={loadingBand}>Loading saved workbench...</div>
      ) : null}

      <section style={comparisonGrid}>
        {scenarioCards.map((card) => {
          const selected = basis === card.key;
          return (
            <article
              key={card.key}
              style={{
                ...scenarioCard,
                ...(selected ? selectedScenarioCard : {}),
              }}
            >
              <div style={scenarioHeader}>
                <div style={scenarioTitleLine}>
                  <span style={scenarioNumber}>{card.number}</span>
                  <span style={scenarioTitle}>{card.title}</span>
                </div>
                {selected && <span style={recommendedBadge}>Recommended</span>}
              </div>

              <div style={sourceText}>Source: {card.source}</div>

              <div style={scenarioFigures}>
                <div>
                  <div style={figureLabel}>Estimated taxable income</div>
                  <div style={figureValue}>{money(card.taxableIncome)}</div>
                </div>
                <div>
                  <div style={figureLabel}>Estimated 1st provisional</div>
                  <div style={figureValue}>{money(card.payment)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBasis(card.key)}
                style={selected ? selectedBasisButton : basisButton}
              >
                {selected ? "Selected ✓" : "Use this basis"}
              </button>
            </article>
          );
        })}

        <article
          style={{
            ...scenarioCard,
            ...(basis === "custom" ? selectedScenarioCard : {}),
          }}
        >
          <div style={scenarioHeader}>
            <div style={scenarioTitleLine}>
              <span style={scenarioNumber}>04</span>
              <span style={scenarioTitle}>Custom Estimate</span>
            </div>
            {basis === "custom" && (
              <span style={recommendedBadge}>Recommended</span>
            )}
          </div>

          <div style={sourceText}>Professional judgement / manual estimate</div>

          <label style={inputLabel}>
            Estimated taxable income
            <input
              value={formatInputAmount(customEstimate)}
              onChange={(event) =>
                setCustomEstimate(stripInputAmount(event.target.value))
              }
              onFocus={(event) => event.currentTarget.select()}
              style={moneyInput}
              inputMode="decimal"
            />
          </label>

          <div style={customPayment}>
            1st provisional:{" "}
            <strong>
              {money(num(customEstimate) * companyTaxRate * 0.5)}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => setBasis("custom")}
            style={basis === "custom" ? selectedBasisButton : basisButton}
          >
            {basis === "custom" ? "Selected ✓" : "Use this basis"}
          </button>
        </article>
      </section>

      <section style={workbenchGrid}>
        <article style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Tax Estimate Workbench</div>
              <div style={panelSubtext}>
                Review the three positions first, then capture only the adjustments that matter.
              </div>
            </div>
          </div>

          <div style={groupGrid}>
            <section style={groupPanel}>
              <div style={groupHeader}>
                <span style={groupNumber}>01</span>
                <div>
                  <div style={groupTitle}>Basic Amount</div>
                  <div style={groupSubtitle}>SARS assessed baseline</div>
                </div>
              </div>

              <CompactRow
                label="Assessment year"
                value={basicAssessmentYear}
                onChange={setBasicAssessmentYear}
              />
              <CompactDateRow
                label="Assessment date"
                value={basicAssessmentDate}
                onChange={setBasicAssessmentDate}
              />
              <CompactRow
                label="Assessed taxable income"
                value={basicTaxableIncome}
                onChange={setBasicTaxableIncome}
                moneyField
              />
              <CompactRow
                label="Capital gain component"
                value={basicCapitalGainComponent}
                onChange={setBasicCapitalGainComponent}
                moneyField
              />
              <CompactRow
                label="Uplift %"
                value={basicUpliftPercent}
                onChange={setBasicUpliftPercent}
              />

              <div style={groupResult}>
                <span>Basic amount</span>
                <strong>{money(basicAmount)}</strong>
              </div>
            </section>

            <section style={groupPanel}>
              <div style={groupHeader}>
                <span style={groupNumber}>02</span>
                <div>
                  <div style={groupTitle}>Current Position</div>
                  <div style={groupSubtitle}>Actual YTD result</div>
                </div>
              </div>

              <CompactDateRow
                label="YTD start"
                value={ytdPeriodStart}
                onChange={setYtdPeriodStart}
              />
              <CompactDateRow
                label="YTD end"
                value={ytdPeriodEnd}
                onChange={setYtdPeriodEnd}
              />
              <CompactRow
                label="Months elapsed"
                value={monthsElapsed}
                onChange={setMonthsElapsed}
              />
              <CompactRow
                label="Accounting profit"
                value={ytdProfit}
                onChange={setYtdProfit}
                moneyField
              />

              <div style={groupResult}>
                <span>Current taxable position</span>
                <strong>{money(currentTaxable)}</strong>
              </div>
            </section>

            <section style={{ ...groupPanel, ...projectionGroup }}>
              <div style={groupHeader}>
                <span style={groupNumber}>03</span>
                <div>
                  <div style={groupTitle}>Expected / Projected</div>
                  <div style={groupSubtitle}>Full-year estimate</div>
                </div>
              </div>

              <div style={projectionMetric}>
                <span>Annualised accounting profit</span>
                <strong>{money(projectedAccountingProfit)}</strong>
              </div>

              <div style={projectionMetric}>
                <span>Projected taxable income</span>
                <strong>{money(projectedTaxable)}</strong>
              </div>

              <div style={projectionNote}>
                Projection is driven by the YTD result plus the adjustments below.
              </div>

              <div style={groupResult}>
                <span>1st provisional</span>
                <strong>{money(projectedTaxable * companyTaxRate * 0.5)}</strong>
              </div>
            </section>
          </div>

          <div style={adjustmentsHeader}>
            <div>
              <div style={groupTitle}>Expected tax / year-end adjustments</div>
              <div style={groupSubtitle}>
                Capture only items needed to move from accounting profit to estimated taxable income.
              </div>
            </div>
          </div>

          <div style={adjustmentGrid}>
            <CompactAdjustment
              label="Non-deductible expenses"
              value={nonDeductible}
              onChange={setNonDeductible}
              sign="+"
            />
            <CompactAdjustment
              label="Donations"
              value={donations}
              onChange={setDonations}
              sign="+"
            />
            <CompactAdjustment
              label="Accounting depreciation"
              value={accountingDepreciation}
              onChange={setAccountingDepreciation}
              sign="+"
            />
            <CompactAdjustment
              label="Tax capital allowances"
              value={taxAllowances}
              onChange={setTaxAllowances}
              sign="−"
            />
            <CompactAdjustment
              label="Other tax adjustments"
              value={otherAdjustments}
              onChange={setOtherAdjustments}
              sign="+/−"
            />
          </div>

          <div style={condensedResults}>
            <div>
              <div style={resultLabel}>Basic</div>
              <div style={resultValue}>{money(basicAmount)}</div>
            </div>
            <div>
              <div style={resultLabel}>Current</div>
              <div style={resultValue}>{money(currentTaxable)}</div>
            </div>
            <div>
              <div style={resultLabel}>Projected</div>
              <div style={resultValue}>{money(projectedTaxable)}</div>
            </div>
          </div>

          <div style={infoNote}>
            Depreciation and other year-end entries may not yet be posted in the current TB. The workbench therefore separates the raw YTD position from the adviser&apos;s projected tax estimate.
          </div>
        </article>

        <aside style={advicePanel}>
          <div style={clientReady}>CLIENT READY</div>

          <div style={adviceLabel}>Recommended 1st Provisional Payment</div>
          <div style={adviceAmount}>{money(recommendedFirstProvisional)}</div>

          <div style={adviceRule} />

          <div style={adviceSummary}>
            Based on a recommended taxable income of{" "}
            <strong>{money(recommendedTaxableIncome)}</strong> using the selected{" "}
            {basis === "basic"
              ? "basic amount"
              : basis === "current"
              ? "current position"
              : basis === "projected"
              ? "projected position"
              : "custom estimate"}.
          </div>

          <label style={noteLabel}>
            Adviser note
            <textarea
              value={adviserNote}
              onChange={(event) => setAdviserNote(event.target.value)}
              style={noteArea}
            />
          </label>

          <div style={approvalPanel}>
            <div style={approvalHeader}>
              <div>
                <div style={approvalTitle}>Client approval</div>
                <div style={approvalSubtext}>
                  Record the client&apos;s approval before preparing the IRP6.
                </div>
              </div>
              <span style={approvalStatusStyle(clientApprovalStatus)}>
                {clientApprovalStatus === "approved"
                  ? "APPROVED"
                  : clientApprovalStatus === "query"
                    ? "QUERY"
                    : "PENDING"}
              </span>
            </div>

            <div style={approvalFields}>
              <label style={approvalFieldLabel}>
                Authorised person
                <select
                  value={selectedDirectorId}
                  onChange={(event) =>
                    changeAuthorisedPerson(event.target.value)
                  }
                  style={approvalInput}
                >
                  <option value="">Select director...</option>
                  {directors.map((director) => (
                    <option key={director.id} value={director.id}>
                      {director.director_name}
                      {director.director_capacity
                        ? ` — ${director.director_capacity}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label style={approvalFieldLabel}>
                Approval method
                <select
                  value={approvalMethod}
                  onChange={(event) => setApprovalMethod(event.target.value)}
                  style={approvalInput}
                >
                  <option value="manual">Manual record</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="portal">PP approval link</option>
                </select>
              </label>
            </div>

            {approvedByName ? (
              <div style={authorisedPersonSummary}>
                <strong>{approvedByName}</strong>
                <span>{authorisedPersonCapacity || "Director"}</span>
              </div>
            ) : null}

            <label style={approvalFieldLabel}>
              Approval / query note
              <input
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
                style={approvalInput}
                placeholder="Optional note"
              />
            </label>

            <div style={approvalActions}>
              <button
                type="button"
                style={approvalButton}
                onClick={() => updateApproval("approved")}
              >
                Mark Client Approved
              </button>
              <button
                type="button"
                style={queryButton}
                onClick={() => updateApproval("query")}
              >
                Client Has Query
              </button>
              {clientApprovalStatus !== "pending" ? (
                <button
                  type="button"
                  style={resetApprovalButton}
                  onClick={() => updateApproval("pending")}
                >
                  Reset
                </button>
              ) : null}
            </div>

            {approvedAt ? (
              <div style={approvalAudit}>
                Approved on{" "}
                {new Date(approvedAt).toLocaleString("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            ) : null}
          </div>

          <div style={adviceFooter}>
            <div>
              <div style={miniLabel}>Estimated full-year tax</div>
              <div style={miniValue}>{money(recommendedAnnualTax)}</div>
            </div>

            <button
              type="button"
              style={
                clientApprovalStatus === "approved"
                  ? primaryButton
                  : disabledPrepareButton
              }
              disabled={clientApprovalStatus !== "approved"}
              onClick={markIrp6Prepared}
            >
              {clientApprovalStatus === "approved"
                ? irp6PreparedAt
                  ? "Open IRP6 Preparation →"
                  : "Prepare IRP6 →"
                : "Awaiting Client Approval"}
            </button>
          </div>


        </aside>
      </section>

      {showIrp6Preparation && clientApprovalStatus === "approved" ? (
        <section
          id="irp6-preparation-workspace"
          style={prepareWorkspace}
        >

              <div style={prepareHeader}>
                <div>
                  <div style={prepareTitle}>IRP6 Submission Preparation</div>
                  <div style={prepareText}>
                    Final submission figures based on the client-approved recommendation.
                  </div>
                </div>
                <span style={prepareStatusPill(irp6SubmittedAt, paymentStatus)}>
                  {irp6SubmittedAt
                    ? paymentStatus === "paid"
                      ? "COMPLETE"
                      : "SUBMITTED"
                    : "PREPARING"}
                </span>
              </div>

              <div style={prepareGrid}>
                <div>
                  <div style={miniLabel}>Approved taxable income</div>
                  <div style={prepareValue}>{money(recommendedTaxableIncome)}</div>
                </div>
                <div>
                  <div style={miniLabel}>Full-year estimated tax</div>
                  <div style={prepareValue}>{money(recommendedAnnualTax)}</div>
                </div>
                <div>
                  <div style={miniLabel}>50% first provisional</div>
                  <div style={prepareValue}>{money(recommendedFirstProvisional)}</div>
                </div>
              </div>

              <div style={submissionSectionTitle}>Credits applicable to this period</div>

              <div style={submissionInputsGrid}>
                <label style={approvalFieldLabel}>
                  Employees&apos; tax / PAYE credits
                  <div style={compactInputWrap}>
                    <span style={compactPrefix}>R</span>
                    <input
                      value={formatInputAmount(payeCredits)}
                      onChange={(event) =>
                        setPayeCredits(stripInputAmount(event.target.value))
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      style={{ ...compactInput, borderLeft: 0 }}
                      inputMode="decimal"
                    />
                  </div>
                </label>

                <label style={approvalFieldLabel}>
                  Foreign tax credits
                  <div style={compactInputWrap}>
                    <span style={compactPrefix}>R</span>
                    <input
                      value={formatInputAmount(foreignTaxCredits)}
                      onChange={(event) =>
                        setForeignTaxCredits(stripInputAmount(event.target.value))
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      style={{ ...compactInput, borderLeft: 0 }}
                      inputMode="decimal"
                    />
                  </div>
                </label>

                <label style={approvalFieldLabel}>
                  Other tax credits
                  <div style={compactInputWrap}>
                    <span style={compactPrefix}>R</span>
                    <input
                      value={formatInputAmount(otherTaxCredits)}
                      onChange={(event) =>
                        setOtherTaxCredits(stripInputAmount(event.target.value))
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      style={{ ...compactInput, borderLeft: 0 }}
                      inputMode="decimal"
                    />
                  </div>
                </label>
              </div>

              <div style={submissionTotal}>
                <div>
                  <div style={miniLabel}>IRP6 amount payable</div>
                  <div style={submissionAmount}>{money(irp6AmountPayable)}</div>
                </div>
                <div>
                  <div style={miniLabel}>Payment due date</div>
                  <div style={prepareValue}>{dueDate || "Not set"}</div>
                </div>
              </div>

              <div style={submissionSectionTitle}>SARS submission</div>

              <div style={submissionInputsGrid}>
                <label style={approvalFieldLabel}>
                  SARS submission reference
                  <input
                    value={irp6SubmissionReference}
                    onChange={(event) =>
                      setIrp6SubmissionReference(event.target.value)
                    }
                    style={approvalInput}
                    placeholder="Capture after submission"
                  />
                </label>

                <div style={submissionActionCell}>
                  <div style={miniLabel}>Submission status</div>
                  <div style={submissionStatusText}>
                    {irp6SubmittedAt
                      ? `Submitted ${new Date(irp6SubmittedAt).toLocaleString("en-ZA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`
                      : "Not submitted"}
                  </div>
                </div>

                <div style={submissionActionCell}>
                  <button
                    type="button"
                    style={irp6SubmittedAt ? completedButton : primaryButton}
                    onClick={markIrp6Submitted}
                  >
                    {irp6SubmittedAt ? "IRP6 Submitted ✓" : "Mark IRP6 Submitted"}
                  </button>
                </div>
              </div>

              <div style={submissionSectionTitle}>Payment</div>

              <div style={submissionInputsGrid}>
                <label style={approvalFieldLabel}>
                  Payment date
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    style={approvalInput}
                  />
                </label>

                <label style={approvalFieldLabel}>
                  Payment reference
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    style={approvalInput}
                    placeholder="Optional bank / SARS reference"
                  />
                </label>

                <div style={submissionActionCell}>
                  <button
                    type="button"
                    style={paymentStatus === "paid" ? completedButton : primaryButton}
                    onClick={markPaymentPaid}
                  >
                    {paymentStatus === "paid" ? "Payment Recorded ✓" : "Mark Payment Paid"}
                  </button>
                </div>
              </div>

              <div style={prepareHint}>
                PracticePilot records the approved figures, submission and payment trail.
                SARS submission itself is still completed on eFiling.
              </div>
        </section>
      ) : null}
    </main>
  );
}


function prepareStatusPill(
  submittedAt: string,
  paymentStatus: "not_paid" | "paid"
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 7px",
    border: "1px solid",
    fontSize: 9,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (submittedAt && paymentStatus === "paid") {
    return {
      ...base,
      background: "#e8f4f0",
      borderColor: "#b9d8d2",
      color: "#2f6f67",
    };
  }

  if (submittedAt) {
    return {
      ...base,
      background: "#edf4ff",
      borderColor: "#c8d8f3",
      color: "#315f9b",
    };
  }

  return {
    ...base,
    background: "#f3f5f7",
    borderColor: "#d4dbe2",
    color: "#536171",
  };
}

function approvalStatusStyle(
  status: "pending" | "approved" | "query"
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 7px",
    border: "1px solid",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (status === "approved") {
    return {
      ...base,
      background: "#eaf6ee",
      borderColor: "#bddac7",
      color: "#287447",
    };
  }

  if (status === "query") {
    return {
      ...base,
      background: "#fff4df",
      borderColor: "#e8c887",
      color: "#915d0c",
    };
  }

  return {
    ...base,
    background: "#f3f5f7",
    borderColor: "#d4dbe2",
    color: "#536171",
  };
}


function CompactRow({
  label,
  value,
  onChange,
  moneyField = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  moneyField?: boolean;
}) {
  return (
    <div style={compactRow}>
      <span style={compactLabel}>{label}</span>
      <div style={compactInputWrap}>
        {moneyField ? <span style={compactPrefix}>R</span> : null}
        <input
          value={moneyField ? formatInputAmount(value) : value}
          onChange={(event) =>
            onChange(
              moneyField
                ? stripInputAmount(event.target.value)
                : event.target.value
            )
          }
          onFocus={(event) => {
            if (moneyField) event.currentTarget.select();
          }}
          style={{
            ...compactInput,
            ...(moneyField ? { borderLeft: 0 } : {}),
          }}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}

function CompactDateRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={compactRow}>
      <span style={compactLabel}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={compactDateInput}
      />
    </div>
  );
}

function CompactAdjustment({
  label,
  value,
  onChange,
  sign,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sign: string;
}) {
  return (
    <div style={adjustmentItem}>
      <div style={adjustmentTop}>
        <span style={adjustmentLabel}>{label}</span>
        <span style={adjustmentSign}>{sign}</span>
      </div>
      <div style={compactInputWrap}>
        <span style={compactPrefix}>R</span>
        <input
          value={formatInputAmount(value)}
          onChange={(event) =>
            onChange(stripInputAmount(event.target.value))
          }
          onFocus={(event) => event.currentTarget.select()}
          style={{ ...compactInput, borderLeft: 0 }}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}

function WorkbenchRow({
  label,
  note,
  value,
  onChange,
  sign,
  suffix,
}: {
  label: string;
  note: string;
  value: string;
  onChange: (value: string) => void;
  sign?: string;
  suffix?: string;
}) {
  return (
    <div style={workbenchRow}>
      <div>
        <div style={rowLabel}>{label}</div>
        <div style={rowNote}>{note}</div>
      </div>

      <div style={rowInputWrap}>
        {sign ? <span style={signBox}>{sign}</span> : <span />}
        <span style={randBox}>{suffix ? "" : "R"}</span>
        <input
          value={formatInputAmount(value)}
          onChange={(event) =>
            onChange(stripInputAmount(event.target.value))
          }
          onFocus={(event) => event.currentTarget.select()}
          style={rowMoneyInput}
          inputMode="decimal"
        />
        {suffix ? <span style={suffixBox}>{suffix}</span> : null}
      </div>
    </div>
  );
}

function DateRow({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={workbenchRow}>
      <div>
        <div style={rowLabel}>{label}</div>
        <div style={rowNote}>{note}</div>
      </div>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={dateRowInput}
      />
    </div>
  );
}

const navy = "#10233a";
const warm = "#f4f6f5";
const line = "#ddd8ce";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: warm,
  padding: "24px 28px 34px",
  color: navy,
};

const breadcrumb: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#56616f",
  fontSize: 11,
  marginBottom: 14,
};

const crumbLink: React.CSSProperties = {
  color: "#55708e",
  textDecoration: "none",
  fontWeight: 700,
};

const headingRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  marginBottom: 18,
};

const titleLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 850,
  letterSpacing: "-0.025em",
};

const judgementBadge: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #b9d8d2",
  background: "#eef6f4",
  color: "#2f6f67",
  fontSize: 11,
  fontWeight: 800,
};

const subtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#536171",
  fontSize: 14,
};

const headingActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const primaryButton: React.CSSProperties = {
  border: "1px solid #0b1a2c",
  background: navy,
  color: "#fff",
  padding: "9px 14px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  border: `1px solid ${line}`,
  background: "#fff",
  color: navy,
  padding: "9px 14px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: "10px 12px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontSize: 11,
  fontWeight: 700,
};

const successBox: React.CSSProperties = {
  marginBottom: 12,
  padding: "10px 12px",
  border: "1px solid #bddac7",
  background: "#eef8f1",
  color: "#287447",
  fontSize: 11,
  fontWeight: 800,
};

const loadingBand: React.CSSProperties = {
  marginBottom: 12,
  padding: "8px 12px",
  border: `1px solid ${line}`,
  background: "#fff",
  color: "#6b7280",
  fontSize: 10,
};

const clientStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.55fr .45fr .6fr .65fr",
  border: `1px solid ${line}`,
  background: "#fff",
  marginBottom: 14,
};

const clientIdentity: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
};

const entityBadge: React.CSSProperties = {
  width: 42,
  height: 42,
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  background: navy,
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
};

const clientSelect: React.CSSProperties = {
  width: "100%",
  minWidth: 260,
  border: 0,
  background: "transparent",
  color: navy,
  fontSize: 15,
  fontWeight: 850,
  outline: "none",
};

const clientMeta: React.CSSProperties = {
  marginTop: 4,
  color: "#6c7684",
  fontSize: 10,
};

const stripItem: React.CSSProperties = {
  borderLeft: `1px solid ${line}`,
  padding: 14,
};

const stripLabel: React.CSSProperties = {
  color: "#56616f",
  fontSize: 9,
  fontWeight: 800,
  textTransform: "uppercase",
};

const stripValue: React.CSSProperties = {
  marginTop: 7,
  fontSize: 13,
  fontWeight: 800,
};

const stripInput: React.CSSProperties = {
  width: "100%",
  marginTop: 5,
  border: 0,
  background: "transparent",
  color: navy,
  fontSize: 14,
  fontWeight: 850,
  outline: "none",
};

const dateInput: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  border: 0,
  background: "transparent",
  color: navy,
  fontSize: 12,
  fontWeight: 800,
  outline: "none",
};

const comparisonGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const scenarioCard: React.CSSProperties = {
  border: `1px solid ${line}`,
  background: "#fff",
  padding: 14,
};

const selectedScenarioCard: React.CSSProperties = {
  border: "1px solid #7fb3aa",
  boxShadow: "inset 0 0 0 1px #dcece8",
  background: "#f2f7f6",
};

const scenarioHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const scenarioTitleLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const scenarioNumber: React.CSSProperties = {
  width: 24,
  height: 24,
  border: "1px solid #cfd6dd",
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 9,
  fontWeight: 900,
};

const scenarioTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 850,
};

const recommendedBadge: React.CSSProperties = {
  background: "#e7f2ef",
  color: "#2f6f67",
  border: "1px solid #b9d8d2",
  padding: "3px 6px",
  fontSize: 9,
  fontWeight: 800,
};

const sourceText: React.CSSProperties = {
  marginTop: 10,
  color: "#536171",
  fontSize: 12,
};

const scenarioFigures: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const figureLabel: React.CSSProperties = {
  color: "#748092",
  fontSize: 11,
};

const figureValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 20,
  fontWeight: 900,
};

const basisButton: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "8px 10px",
  border: "1px solid #cfd6dd",
  background: "#fff",
  color: navy,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const selectedBasisButton: React.CSSProperties = {
  ...basisButton,
  background: navy,
  color: "#fff",
  borderColor: navy,
};

const inputLabel: React.CSSProperties = {
  display: "block",
  marginTop: 14,
  color: "#536171",
  fontSize: 9,
  fontWeight: 700,
};

const moneyInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 5,
  padding: "9px 10px",
  border: "1px solid #cfd6dd",
  background: "#fff",
  color: navy,
  fontSize: 14,
  fontWeight: 800,
  outline: "none",
};

const customPayment: React.CSSProperties = {
  marginTop: 10,
  color: "#4f5c6d",
  fontSize: 10,
};


const groupGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  padding: 14,
};

const groupPanel: React.CSSProperties = {
  border: "1px solid #ddd8ce",
  background: "#ffffff",
  padding: 12,
};

const projectionGroup: React.CSSProperties = {
  background: "#f2f7f6",
  borderColor: "#9fc9c2",
};

const groupHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
};

const groupNumber: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  border: "1px solid #cfd6dd",
  borderRadius: "50%",
  fontSize: 9,
  fontWeight: 900,
};

const groupTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: navy,
};

const groupSubtitle: React.CSSProperties = {
  marginTop: 2,
  color: "#536171",
  fontSize: 11,
  fontWeight: 650,
};

const compactRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 145px",
  gap: 8,
  alignItems: "center",
  padding: "6px 0",
  borderBottom: "1px solid #eeeae2",
};

const compactLabel: React.CSSProperties = {
  color: "#465563",
  fontSize: 11,
  fontWeight: 750,
};

const compactInputWrap: React.CSSProperties = {
  display: "flex",
  minWidth: 0,
};

const compactPrefix: React.CSSProperties = {
  width: 28,
  display: "grid",
  placeItems: "center",
  border: "1px solid #cfd6dd",
  background: "#fafafa",
  fontSize: 9,
  fontWeight: 900,
};

const compactInput: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #cfd6dd",
  padding: "6px 7px",
  textAlign: "right",
  color: navy,
  fontSize: 12,
  fontWeight: 800,
  outline: "none",
  background: "#fff",
};

const compactDateInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cfd6dd",
  padding: "6px 7px",
  color: navy,
  fontSize: 11,
  fontWeight: 800,
  outline: "none",
  background: "#fff",
};

const groupResult: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "end",
  marginTop: 10,
  paddingTop: 10,
  borderTop: "1px solid #d5e3df",
  color: "#536c67",
  fontSize: 9,
};

const projectionMetric: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "9px 0",
  borderBottom: "1px solid #dce9e6",
  fontSize: 9,
  color: "#62594d",
};

const projectionNote: React.CSSProperties = {
  marginTop: 10,
  color: "#4d645f",
  fontSize: 11,
  lineHeight: 1.45,
};

const adjustmentsHeader: React.CSSProperties = {
  padding: "11px 14px",
  background: "#f7f9f8",
  borderTop: "1px solid #ddd8ce",
  borderBottom: "1px solid #ddd8ce",
};

const adjustmentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 10,
  padding: 14,
};

const adjustmentItem: React.CSSProperties = {
  border: "1px solid #e2ddd4",
  background: "#fff",
  padding: 9,
};

const adjustmentTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 7,
};

const adjustmentLabel: React.CSSProperties = {
  color: navy,
  fontSize: 11,
  fontWeight: 800,
};

const adjustmentSign: React.CSSProperties = {
  color: "#2f6f67",
  fontSize: 10,
  fontWeight: 900,
};

const condensedResults: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  background: "#f1f7f5",
  borderTop: "1px solid #c7dfda",
  borderBottom: "1px solid #c7dfda",
};

const workbenchGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.55fr) minmax(340px, .75fr)",
  gap: 14,
};

const panel: React.CSSProperties = {
  border: `1px solid ${line}`,
  background: "#fff",
};

const panelHeader: React.CSSProperties = {
  padding: 14,
  borderBottom: `1px solid ${line}`,
};

const panelTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const panelSubtext: React.CSSProperties = {
  marginTop: 4,
  color: "#6f7a88",
  fontSize: 12,
};

const inputSection: React.CSSProperties = {
  padding: "3px 14px",
};

const sectionDivider: React.CSSProperties = {
  padding: "10px 14px",
  background: "#f7f9f8",
  borderTop: `1px solid ${line}`,
  borderBottom: `1px solid ${line}`,
  color: "#405a54",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const workbenchRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 240px",
  alignItems: "center",
  gap: 16,
  padding: "9px 0",
  borderBottom: "1px solid #ece8df",
};

const rowLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 850,
};

const rowNote: React.CSSProperties = {
  marginTop: 2,
  color: "#59656f",
  fontSize: 9,
};

const rowInputWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px 28px minmax(0, 1fr) auto",
  alignItems: "stretch",
};

const signBox: React.CSSProperties = {
  border: "1px solid #cfd6dd",
  borderRight: 0,
  display: "grid",
  placeItems: "center",
  background: "#fafafa",
  fontSize: 10,
  fontWeight: 900,
};

const randBox: React.CSSProperties = {
  border: "1px solid #cfd6dd",
  borderRight: 0,
  display: "grid",
  placeItems: "center",
  background: "#fafafa",
  fontSize: 10,
  fontWeight: 900,
};

const suffixBox: React.CSSProperties = {
  border: "1px solid #cfd6dd",
  borderLeft: 0,
  display: "grid",
  placeItems: "center",
  padding: "0 8px",
  background: "#fafafa",
  fontSize: 10,
  fontWeight: 900,
};

const rowMoneyInput: React.CSSProperties = {
  minWidth: 0,
  border: "1px solid #cfd6dd",
  padding: "7px 8px",
  textAlign: "right",
  fontSize: 11,
  fontWeight: 800,
  color: navy,
  outline: "none",
};

const dateRowInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cfd6dd",
  padding: "7px 8px",
  color: navy,
  fontSize: 11,
  fontWeight: 800,
  outline: "none",
};

const resultBand: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 0,
  background: "#f1f7f5",
  borderTop: "1px solid #c7dfda",
  borderBottom: "1px solid #c7dfda",
};

const resultLabel: React.CSSProperties = {
  padding: "10px 12px 0",
  color: "#405a54",
  fontSize: 9,
  textTransform: "uppercase",
  fontWeight: 800,
};

const resultValue: React.CSSProperties = {
  padding: "4px 12px 10px",
  fontSize: 17,
  fontWeight: 900,
};

const infoNote: React.CSSProperties = {
  padding: "11px 14px",
  color: "#6d7580",
  fontSize: 11,
  lineHeight: 1.45,
};

const advicePanel: React.CSSProperties = {
  border: "1px solid #b9d8d2",
  background: "#f2f7f6",
  padding: 18,
  alignSelf: "start",
};


const approvalPanel: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 15,
  borderTop: "1px solid #d4e4e0",
};

const approvalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const approvalTitle: React.CSSProperties = {
  color: navy,
  fontSize: 14,
  fontWeight: 900,
};

const approvalSubtext: React.CSSProperties = {
  marginTop: 3,
  color: "#4f615c",
  fontSize: 11,
  lineHeight: 1.4,
};

const approvalFields: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const approvalFieldLabel: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  color: "#40534e",
  fontSize: 11,
  fontWeight: 800,
};

const approvalInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 5,
  border: "1px solid #cbd8d4",
  background: "#ffffff",
  padding: "8px 9px",
  color: navy,
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
};

const authorisedPersonSummary: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 8,
  padding: "8px 9px",
  border: "1px solid #cbd8d4",
  background: "#f7faf9",
  color: "#10233a",
  fontSize: 11,
};

const approvalActions: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  marginTop: 11,
};

const approvalButton: React.CSSProperties = {
  border: "1px solid #287447",
  background: "#287447",
  color: "#ffffff",
  padding: "8px 10px",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const queryButton: React.CSSProperties = {
  border: "1px solid #d3aa59",
  background: "#fff8e9",
  color: "#7d5511",
  padding: "8px 10px",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const resetApprovalButton: React.CSSProperties = {
  border: "1px solid #cfd6dd",
  background: "#ffffff",
  color: "#536171",
  padding: "8px 10px",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
};

const approvalAudit: React.CSSProperties = {
  marginTop: 9,
  color: "#55706a",
  fontSize: 10,
  fontWeight: 700,
};

const disabledPrepareButton: React.CSSProperties = {
  ...primaryButton,
  background: "#d9dedc",
  borderColor: "#d9dedc",
  color: "#7d8783",
  cursor: "not-allowed",
};

const prepareHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
};

const submissionSectionTitle: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid #cadbd7",
  color: navy,
  fontSize: 12,
  fontWeight: 900,
};

const submissionInputsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  alignItems: "end",
};

const submissionTotal: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 13,
  padding: "12px 0 2px",
};

const submissionAmount: React.CSSProperties = {
  marginTop: 3,
  color: navy,
  fontSize: 23,
  fontWeight: 900,
};

const submissionActionCell: React.CSSProperties = {
  minWidth: 0,
};

const submissionStatusText: React.CSSProperties = {
  marginTop: 5,
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  color: "#40534e",
  fontSize: 10,
  fontWeight: 750,
};

const completedButton: React.CSSProperties = {
  ...primaryButton,
  marginTop: 5,
  background: "#2f6f67",
  borderColor: "#2f6f67",
};

const prepareHint: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 10,
  borderTop: "1px solid #cadbd7",
  color: "#465a55",
  fontSize: 10,
  fontWeight: 650,
  lineHeight: 1.45,
};

const prepareWorkspace: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #9fc9c2",
  background: "#f2f7f6",
  padding: 18,
};

const preparePanel: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #9fc9c2",
  background: "#f2f7f6",
  padding: 12,
};

const prepareTitle: React.CSSProperties = {
  color: navy,
  fontSize: 13,
  fontWeight: 900,
};

const prepareText: React.CSSProperties = {
  marginTop: 4,
  color: "#40534e",
  fontSize: 11,
  fontWeight: 650,
  lineHeight: 1.45,
};

const prepareGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
  marginTop: 11,
};

const prepareValue: React.CSSProperties = {
  marginTop: 3,
  color: navy,
  fontSize: 14,
  fontWeight: 900,
};

const clientReady: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 7px",
  background: "#eaf6ee",
  color: "#287447",
  border: "1px solid #bddac7",
  fontSize: 10,
  fontWeight: 900,
};

const adviceLabel: React.CSSProperties = {
  marginTop: 16,
  color: "#5e6875",
  fontSize: 12,
  fontWeight: 800,
};

const adviceAmount: React.CSSProperties = {
  marginTop: 5,
  fontSize: 42,
  fontWeight: 900,
  letterSpacing: "-0.03em",
};

const adviceRule: React.CSSProperties = {
  height: 1,
  background: "#7fb3aa",
  margin: "12px 0",
};

const adviceSummary: React.CSSProperties = {
  color: "#495667",
  fontSize: 13,
  lineHeight: 1.55,
};

const noteLabel: React.CSSProperties = {
  display: "block",
  marginTop: 16,
  color: "#5b6572",
  fontSize: 11,
  fontWeight: 800,
};

const noteArea: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  boxSizing: "border-box",
  marginTop: 6,
  resize: "vertical",
  border: "1px solid #d7d2c8",
  background: "#fff",
  color: navy,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.5,
  outline: "none",
};

const adviceFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: 14,
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid #d4e4e0",
};

const miniLabel: React.CSSProperties = {
  color: "#465563",
  fontSize: 10,
  fontWeight: 800,
};

const miniValue: React.CSSProperties = {
  marginTop: 3,
  fontSize: 16,
  fontWeight: 900,
};
