"use client";

import { useEffect, useState } from "react";

type ClientSetup = {
  registered_name: string | null;
  registration_number: string | null;
  entity_type: string | null;
  country: string | null;
  currency: string | null;
  currency_symbol: string | null;
  legal_framework: string | null;
  nature_of_business: string | null;
  trading_name: string | null;
  financial_year_end: string | null;

  basis_of_preparation: string | null;
  type_of_engagement: string | null;
  report_required: string | null;
  industry: string | null;
  group_description: string | null;
  parent_entity: string | null;

  income_tax_number: string | null;
  vat_number: string | null;
  paye_number: string | null;
  sdl_number: string | null;
  uif_number: string | null;
  tax_loss_current_year: number | string | null;
  tax_loss_prior_year: number | string | null;
  tax_rate_current_year: number | string | null;
  tax_rate_prior_year: number | string | null;

  registered_office_line_1: string | null;
  registered_office_line_2: string | null;
  registered_office_city: string | null;
  registered_office_province: string | null;
  registered_office_postal_code: string | null;

  physical_address_line_1: string | null;
  physical_address_line_2: string | null;
  physical_address_city: string | null;
  physical_address_province: string | null;
  physical_address_postal_code: string | null;

  postal_address_line_1: string | null;
  postal_address_line_2: string | null;
  postal_address_city: string | null;
  postal_address_province: string | null;
  postal_address_postal_code: string | null;

  banker_name: string | null;
  account_holder: string | null;
  account_type: string | null;

  public_officer_name: string | null;
  public_officer_email: string | null;
  public_officer_cell: string | null;
  public_officer_income_tax_number: string | null;
  public_officer_id_number: string | null;

  secretary_name: string | null;
  secretary_address: string | null;

  number_of_directors: number | string | null;
  date_of_incorporation: string | null;
  date_business_commenced: string | null;
  signature_date: string | null;
  afs_approval_date: string | null;
  publish_date: string | null;

  practitioner_name: string | null;
  practitioner_designation: string | null;
  practice_name: string | null;
  member_firm: string | null;
  place_of_signature: string | null;

  authorised_ordinary_shares: string | null;
  authorised_ordinary_share_par_value: string | null;
  issued_ordinary_shares: string | null;
  issued_ordinary_share_par_value: string | null;
  share_capital_note: string | null;
  shareholder_note: string | null;

  current_period_heading: string | null;
  prior_period_heading: string | null;
};

type ClientPerson = {
  id: string;
  person_type: string;
  full_name: string;
  nationality: string | null;
  id_number: string | null;
  income_tax_number: string | null;
  appointment_date: string | null;
  resignation_date: string | null;
  email: string | null;
  cell: string | null;
};

type NewPerson = {
  person_type: string;
  full_name: string;
  nationality: string;
  id_number: string;
  income_tax_number: string;
  appointment_date: string;
  resignation_date: string;
  email: string;
  cell: string;
};

type Props = {
  engagementId: string;
  clientName: string;
  entityType: string | null;
  financialYearEnd: string;
  preparedBy: string | null;
  onSaved?: (payload: {
    setup: ClientSetup;
    engagement?: {
      client_name?: string | null;
      entity_type?: string | null;
      financial_year_end?: string | null;
      prepared_by?: string | null;
      status?: string | null;
    } | null;
    people?: ClientPerson[];
  }) => void;
};

const blankSetup: ClientSetup = {
  registered_name: "",
  registration_number: "",
  entity_type: "",
  country: "South Africa",
  currency: "Rand",
  currency_symbol: "R",
  legal_framework: "Companies Act of South Africa",
  nature_of_business: "",
  trading_name: "",
  financial_year_end: "",

  basis_of_preparation: "IFRS for SMEs",
  type_of_engagement: "Compilation",
  report_required: "Practitioner compilation report",
  industry: "",
  group_description: "",
  parent_entity: "",

  income_tax_number: "",
  vat_number: "",
  paye_number: "",
  sdl_number: "",
  uif_number: "",
  tax_loss_current_year: "",
  tax_loss_prior_year: "",
  tax_rate_current_year: 27,
  tax_rate_prior_year: 27,

  registered_office_line_1: "",
  registered_office_line_2: "",
  registered_office_city: "",
  registered_office_province: "",
  registered_office_postal_code: "",

  physical_address_line_1: "",
  physical_address_line_2: "",
  physical_address_city: "",
  physical_address_province: "",
  physical_address_postal_code: "",

  postal_address_line_1: "",
  postal_address_line_2: "",
  postal_address_city: "",
  postal_address_province: "",
  postal_address_postal_code: "",

  banker_name: "",
  account_holder: "",
  account_type: "",

  public_officer_name: "",
  public_officer_email: "",
  public_officer_cell: "",
  public_officer_income_tax_number: "",
  public_officer_id_number: "",

  secretary_name: "",
  secretary_address: "",

  number_of_directors: 0,
  date_of_incorporation: "",
  date_business_commenced: "",
  signature_date: "",
  afs_approval_date: "",
  publish_date: "",

  practitioner_name: "",
  practitioner_designation: "Professional Accountant (SA)",
  practice_name: "Bizzacc Menlyn (Pty) Ltd",
  member_firm: "",
  place_of_signature: "Pretoria",

  authorised_ordinary_shares: "",
  authorised_ordinary_share_par_value: "",
  issued_ordinary_shares: "",
  issued_ordinary_share_par_value: "",
  share_capital_note: "",
  shareholder_note: "",

  current_period_heading: "",
  prior_period_heading: "",
};

const blankPerson: NewPerson = {
  person_type: "Director",
  full_name: "",
  nationality: "South African",
  id_number: "",
  income_tax_number: "",
  appointment_date: "",
  resignation_date: "",
  email: "",
  cell: "",
};

export default function ClientSetupPanel({
  engagementId,
  clientName,
  entityType,
  financialYearEnd,
  preparedBy,
  onSaved,
}: Props) {
  const [setup, setSetup] = useState<ClientSetup>({
    ...blankSetup,
    registered_name: clientName,
    entity_type: entityType || "Company",
    practitioner_name: preparedBy || "",
    financial_year_end: financialYearEnd || "",
    current_period_heading: makeCurrentPeriodHeading(financialYearEnd),
    prior_period_heading: makePriorPeriodHeading(financialYearEnd),
  });

  const [people, setPeople] = useState<ClientPerson[]>([]);
  const [newPerson, setNewPerson] = useState<NewPerson>(blankPerson);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSetup() {
    setLoading(true);

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/client-setup`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load client setup.");
      }

      if (data.setup) {
        setSetup({
          ...blankSetup,
          ...data.setup,
          current_period_heading:
            data.setup.current_period_heading ||
            makeCurrentPeriodHeading(financialYearEnd),
          prior_period_heading:
            data.setup.prior_period_heading ||
            makePriorPeriodHeading(financialYearEnd),
        });
      } else {
        setSetup((current) => ({
          ...current,
          financial_year_end: financialYearEnd || "",
          current_period_heading: makeCurrentPeriodHeading(financialYearEnd),
          prior_period_heading: makePriorPeriodHeading(financialYearEnd),
        }));
      }

      setPeople(data.people || []);
    } catch (error: any) {
      alert(error.message || "Failed to load client setup.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSetup() {
    setSaving(true);

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/client-setup`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(setup),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save client setup.");
      }

      const savedYearEnd =
        data.engagement?.financial_year_end || setup.financial_year_end || financialYearEnd;

      const savedSetup = {
        ...blankSetup,
        ...data.setup,
        financial_year_end: savedYearEnd,
        current_period_heading:
          data.setup.current_period_heading ||
          makeCurrentPeriodHeading(savedYearEnd),
        prior_period_heading:
          data.setup.prior_period_heading ||
          makePriorPeriodHeading(savedYearEnd),
      };

      setSetup(savedSetup);
      onSaved?.({ setup: savedSetup, engagement: data.engagement || null, people });

      alert("Client setup saved.");
    } catch (error: any) {
      alert(error.message || "Failed to save client setup.");
    } finally {
      setSaving(false);
    }
  }

  async function addPerson() {
    if (!newPerson.full_name.trim()) {
      alert("Full name is required.");
      return;
    }

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/client-people`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPerson),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add person.");
      }

      setPeople((current) => [...current, data.person]);
      setNewPerson(blankPerson);
    } catch (error: any) {
      alert(error.message || "Failed to add person.");
    }
  }

  async function deletePerson(personId: string) {
    const confirmed = confirm("Delete this person from the AFS setup?");

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/client-people`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ personId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete person.");
      }

      setPeople((current) => current.filter((person) => person.id !== personId));
    } catch (error: any) {
      alert(error.message || "Failed to delete person.");
    }
  }

  function update(field: keyof ClientSetup, value: string | number) {
    setSetup((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "financial_year_end") {
        next.current_period_heading = makeCurrentPeriodHeading(String(value || ""));
        next.prior_period_heading = makePriorPeriodHeading(String(value || ""));
      }

      return next;
    });
  }

  function updatePerson(field: keyof NewPerson, value: string) {
    setNewPerson((current) => ({
      ...current,
      [field]: value,
    }));
  }

  useEffect(() => {
    loadSetup();
  }, [engagementId]);

  if (loading) {
    return <section style={styles.card}>Loading client setup...</section>;
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.actionBar}>
        <div>
          <h3 style={styles.pageTitle}>Client Setup</h3>
          <p style={styles.pageText}>
            Capture the core information used for the AFS, reports, minutes and
            finalisation documents.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={saveSetup} disabled={saving}>
          {saving ? "Saving..." : "Save client setup"}
        </button>
      </div>

      <SetupSection title="General Information">
        <Field label="Registered name">
          <input
            style={styles.input}
            value={setup.registered_name || ""}
            onChange={(e) => update("registered_name", e.target.value)}
          />
        </Field>

        <Field label="Registration number">
          <input
            style={styles.input}
            value={setup.registration_number || ""}
            onChange={(e) => update("registration_number", e.target.value)}
          />
        </Field>

        <Field label="Entity type">
          <select
            style={styles.input}
            value={setup.entity_type || ""}
            onChange={(e) => update("entity_type", e.target.value)}
          >
            <option value="Company">Company</option>
            <option value="Close Corporation">Close Corporation</option>
            <option value="Trust">Trust</option>
            <option value="Sole Proprietor">Sole Proprietor</option>
            <option value="Partnership">Partnership</option>
            <option value="Non-Profit Company">Non-Profit Company</option>
          </select>
        </Field>

        <Field label="Financial year end">
          <input
            style={styles.input}
            type="date"
            value={setup.financial_year_end || ""}
            onChange={(e) => update("financial_year_end", e.target.value)}
          />
        </Field>

        <Field label="Trading name">
          <input
            style={styles.input}
            value={setup.trading_name || ""}
            onChange={(e) => update("trading_name", e.target.value)}
          />
        </Field>

        <Field label="Country">
          <input
            style={styles.input}
            value={setup.country || ""}
            onChange={(e) => update("country", e.target.value)}
          />
        </Field>

        <Field label="Currency">
          <input
            style={styles.input}
            value={setup.currency || ""}
            onChange={(e) => update("currency", e.target.value)}
          />
        </Field>

        <Field label="Currency symbol">
          <input
            style={styles.input}
            value={setup.currency_symbol || ""}
            onChange={(e) => update("currency_symbol", e.target.value)}
          />
        </Field>

        <Field label="Legal framework">
          <input
            style={styles.input}
            value={setup.legal_framework || ""}
            onChange={(e) => update("legal_framework", e.target.value)}
          />
        </Field>

        <Field label="Nature of business">
          <input
            style={styles.input}
            value={setup.nature_of_business || ""}
            onChange={(e) => update("nature_of_business", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Engagement Settings">
        <Field label="Basis of preparation">
          <select
            style={styles.input}
            value={setup.basis_of_preparation || ""}
            onChange={(e) => update("basis_of_preparation", e.target.value)}
          >
            <option value="IFRS for SMEs">IFRS for SMEs</option>
            <option value="IFRS">IFRS</option>
            <option value="Modified cash basis">Modified cash basis</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field label="Type of engagement">
          <select
            style={styles.input}
            value={setup.type_of_engagement || ""}
            onChange={(e) => update("type_of_engagement", e.target.value)}
          >
            <option value="Compilation">Compilation</option>
            <option value="Independent Review">Independent Review</option>
            <option value="Audit">Audit</option>
            <option value="Accounting Officer">Accounting Officer</option>
          </select>
        </Field>

        <Field label="Report required">
          <select
            style={styles.input}
            value={setup.report_required || ""}
            onChange={(e) => update("report_required", e.target.value)}
          >
            <option value="Practitioner compilation report">
              Practitioner compilation report
            </option>
            <option value="Independent reviewer's report">
              Independent reviewer's report
            </option>
            <option value="Independent auditor's report">
              Independent auditor's report
            </option>
            <option value="Accounting officer's report">
              Accounting officer's report
            </option>
          </select>
        </Field>

        <Field label="Industry">
          <input
            style={styles.input}
            value={setup.industry || ""}
            onChange={(e) => update("industry", e.target.value)}
          />
        </Field>

        <Field label="Group description">
          <input
            style={styles.input}
            value={setup.group_description || ""}
            onChange={(e) => update("group_description", e.target.value)}
          />
        </Field>

        <Field label="Parent entity">
          <input
            style={styles.input}
            value={setup.parent_entity || ""}
            onChange={(e) => update("parent_entity", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Tax Information">
        <Field label="Income tax number">
          <input
            style={styles.input}
            value={setup.income_tax_number || ""}
            onChange={(e) => update("income_tax_number", e.target.value)}
          />
        </Field>

        <Field label="VAT number">
          <input
            style={styles.input}
            value={setup.vat_number || ""}
            onChange={(e) => update("vat_number", e.target.value)}
          />
        </Field>

        <Field label="PAYE number">
          <input
            style={styles.input}
            value={setup.paye_number || ""}
            onChange={(e) => update("paye_number", e.target.value)}
          />
        </Field>

        <Field label="SDL number">
          <input
            style={styles.input}
            value={setup.sdl_number || ""}
            onChange={(e) => update("sdl_number", e.target.value)}
          />
        </Field>

        <Field label="UIF number">
          <input
            style={styles.input}
            value={setup.uif_number || ""}
            onChange={(e) => update("uif_number", e.target.value)}
          />
        </Field>

        <Field label="Tax loss current year">
          <input
            style={styles.input}
            type="number"
            value={setup.tax_loss_current_year ?? ""}
            onChange={(e) => update("tax_loss_current_year", e.target.value)}
          />
        </Field>

        <Field label="Tax loss prior year">
          <input
            style={styles.input}
            type="number"
            value={setup.tax_loss_prior_year ?? ""}
            onChange={(e) => update("tax_loss_prior_year", e.target.value)}
          />
        </Field>

        <Field label="Tax rate current year">
          <input
            style={styles.input}
            type="number"
            value={setup.tax_rate_current_year ?? 27}
            onChange={(e) => update("tax_rate_current_year", e.target.value)}
          />
        </Field>

        <Field label="Tax rate prior year">
          <input
            style={styles.input}
            type="number"
            value={setup.tax_rate_prior_year ?? 27}
            onChange={(e) => update("tax_rate_prior_year", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Contact Information">
        <AddressBlock
          title="Registered office"
          prefix="registered_office"
          setup={setup}
          update={update}
        />

        <AddressBlock
          title="Physical address"
          prefix="physical_address"
          setup={setup}
          update={update}
        />

        <AddressBlock
          title="Postal address"
          prefix="postal_address"
          setup={setup}
          update={update}
        />

        <Field label="Banker">
          <input
            style={styles.input}
            value={setup.banker_name || ""}
            onChange={(e) => update("banker_name", e.target.value)}
          />
        </Field>

        <Field label="Account holder">
          <input
            style={styles.input}
            value={setup.account_holder || ""}
            onChange={(e) => update("account_holder", e.target.value)}
          />
        </Field>

        <Field label="Account type">
          <input
            style={styles.input}
            value={setup.account_type || ""}
            onChange={(e) => update("account_type", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Directors / Members / Trustees">
        <div style={styles.peopleArea}>
          <div style={styles.peopleForm}>
            <Field label="Type">
              <select
                style={styles.input}
                value={newPerson.person_type}
                onChange={(e) => updatePerson("person_type", e.target.value)}
              >
                <option value="Director">Director</option>
                <option value="Member">Member</option>
                <option value="Trustee">Trustee</option>
                <option value="Shareholder">Shareholder</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Full name">
              <input
                style={styles.input}
                value={newPerson.full_name}
                onChange={(e) => updatePerson("full_name", e.target.value)}
              />
            </Field>

            <Field label="Nationality">
              <input
                style={styles.input}
                value={newPerson.nationality}
                onChange={(e) => updatePerson("nationality", e.target.value)}
              />
            </Field>

            <Field label="ID number">
              <input
                style={styles.input}
                value={newPerson.id_number}
                onChange={(e) => updatePerson("id_number", e.target.value)}
              />
            </Field>

            <Field label="Income tax number">
              <input
                style={styles.input}
                value={newPerson.income_tax_number}
                onChange={(e) =>
                  updatePerson("income_tax_number", e.target.value)
                }
              />
            </Field>

            <Field label="Appointment date">
              <input
                style={styles.input}
                type="date"
                value={newPerson.appointment_date}
                onChange={(e) => updatePerson("appointment_date", e.target.value)}
              />
            </Field>

            <Field label="Resignation date">
              <input
                style={styles.input}
                type="date"
                value={newPerson.resignation_date}
                onChange={(e) => updatePerson("resignation_date", e.target.value)}
              />
            </Field>

            <Field label="Email">
              <input
                style={styles.input}
                value={newPerson.email}
                onChange={(e) => updatePerson("email", e.target.value)}
              />
            </Field>

            <Field label="Cell">
              <input
                style={styles.input}
                value={newPerson.cell}
                onChange={(e) => updatePerson("cell", e.target.value)}
              />
            </Field>

            <button type="button" style={styles.primaryButton} onClick={addPerson}>
              Add person
            </button>
          </div>

          {people.length === 0 ? (
            <p style={styles.emptyText}>No people added yet.</p>
          ) : (
            <table style={styles.peopleTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Nationality</th>
                  <th style={styles.th}>ID number</th>
                  <th style={styles.th}>Tax number</th>
                  <th style={styles.th}>Appointment</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td style={styles.td}>{person.person_type}</td>
                    <td style={styles.td}>{person.full_name}</td>
                    <td style={styles.td}>{person.nationality || ""}</td>
                    <td style={styles.td}>{person.id_number || ""}</td>
                    <td style={styles.td}>{person.income_tax_number || ""}</td>
                    <td style={styles.td}>{person.appointment_date || ""}</td>
                    <td style={styles.tdRight}>
                      <button
                        type="button"
                        style={styles.deleteButton}
                        onClick={() => deletePerson(person.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SetupSection>

      <SetupSection title="Public Officer and Secretary">
        <Field label="Public officer name">
          <input
            style={styles.input}
            value={setup.public_officer_name || ""}
            onChange={(e) => update("public_officer_name", e.target.value)}
          />
        </Field>

        <Field label="Public officer email">
          <input
            style={styles.input}
            value={setup.public_officer_email || ""}
            onChange={(e) => update("public_officer_email", e.target.value)}
          />
        </Field>

        <Field label="Public officer cell">
          <input
            style={styles.input}
            value={setup.public_officer_cell || ""}
            onChange={(e) => update("public_officer_cell", e.target.value)}
          />
        </Field>

        <Field label="Public officer income tax number">
          <input
            style={styles.input}
            value={setup.public_officer_income_tax_number || ""}
            onChange={(e) =>
              update("public_officer_income_tax_number", e.target.value)
            }
          />
        </Field>

        <Field label="Public officer ID number">
          <input
            style={styles.input}
            value={setup.public_officer_id_number || ""}
            onChange={(e) => update("public_officer_id_number", e.target.value)}
          />
        </Field>

        <Field label="Secretary name">
          <input
            style={styles.input}
            value={setup.secretary_name || ""}
            onChange={(e) => update("secretary_name", e.target.value)}
          />
        </Field>

        <Field label="Secretary address">
          <textarea
            style={{ ...styles.input, minHeight: 80 }}
            value={setup.secretary_address || ""}
            onChange={(e) => update("secretary_address", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Dates and Sign-offs">
        <Field label="Number of directors">
          <input
            style={styles.input}
            type="number"
            value={setup.number_of_directors ?? 0}
            onChange={(e) => update("number_of_directors", e.target.value)}
          />
        </Field>

        <Field label="Date of incorporation">
          <input
            style={styles.input}
            type="date"
            value={setup.date_of_incorporation || ""}
            onChange={(e) => update("date_of_incorporation", e.target.value)}
          />
        </Field>

        <Field label="Signature date">
          <input
            style={styles.input}
            type="date"
            value={setup.signature_date || ""}
            onChange={(e) => update("signature_date", e.target.value)}
          />
        </Field>

        <Field label="AFS approval date">
          <input
            style={styles.input}
            type="date"
            value={setup.afs_approval_date || ""}
            onChange={(e) => update("afs_approval_date", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Firm and Practitioner Details">
        <Field label="Practitioner name">
          <input
            style={styles.input}
            value={setup.practitioner_name || ""}
            onChange={(e) => update("practitioner_name", e.target.value)}
          />
        </Field>

        <Field label="Practitioner designation">
          <input
            style={styles.input}
            value={setup.practitioner_designation || ""}
            onChange={(e) => update("practitioner_designation", e.target.value)}
          />
        </Field>

        <Field label="Practice / firm name">
          <input
            style={styles.input}
            value={setup.practice_name || ""}
            onChange={(e) => update("practice_name", e.target.value)}
          />
        </Field>

        <Field label="Place of signature">
          <input
            style={styles.input}
            value={setup.place_of_signature || ""}
            onChange={(e) => update("place_of_signature", e.target.value)}
          />
        </Field>
      </SetupSection>

      <SetupSection title="Report Settings">
        <Field label="Current period heading">
          <input
            style={styles.input}
            value={setup.current_period_heading || ""}
            onChange={(e) => update("current_period_heading", e.target.value)}
          />
        </Field>

        <Field label="Prior period heading">
          <input
            style={styles.input}
            value={setup.prior_period_heading || ""}
            onChange={(e) => update("prior_period_heading", e.target.value)}
          />
        </Field>

        <Field label="Authorised ordinary shares">
          <input
            style={styles.input}
            value={setup.authorised_ordinary_shares || ""}
            onChange={(e) => update("authorised_ordinary_shares", e.target.value)}
            placeholder="Example: 1 000"
          />
        </Field>

        <Field label="Authorised ordinary share par value">
          <input
            style={styles.input}
            value={setup.authorised_ordinary_share_par_value || ""}
            onChange={(e) =>
              update("authorised_ordinary_share_par_value", e.target.value)
            }
            placeholder="Example: 1.00"
          />
        </Field>

        <Field label="Issued ordinary shares">
          <input
            style={styles.input}
            value={setup.issued_ordinary_shares || ""}
            onChange={(e) => update("issued_ordinary_shares", e.target.value)}
            placeholder="Example: 100"
          />
        </Field>

        <Field label="Issued ordinary share par value">
          <input
            style={styles.input}
            value={setup.issued_ordinary_share_par_value || ""}
            onChange={(e) =>
              update("issued_ordinary_share_par_value", e.target.value)
            }
            placeholder="Example: 1.00"
          />
        </Field>

        <Field label="Share capital note / wording override">
          <textarea
            style={styles.textarea}
            value={setup.share_capital_note || ""}
            onChange={(e) => update("share_capital_note", e.target.value)}
            placeholder="Leave blank to use the default wording."
          />
        </Field>

        <Field label="Shareholder / ownership wording override">
          <textarea
            style={styles.textarea}
            value={setup.shareholder_note || ""}
            onChange={(e) => update("shareholder_note", e.target.value)}
            placeholder="Leave blank to use the default wording."
          />
        </Field>
      </SetupSection>
    </section>
  );
}

function SetupSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(title === "General Information");

  return (
    <section style={styles.card}>
      <button
        type="button"
        style={styles.sectionToggle}
        onClick={() => setOpen((current) => !current)}
      >
        <h4 style={styles.sectionTitle}>{title}</h4>
        <span style={styles.toggleText}>{open ? "Hide" : "Show"}</span>
      </button>

      {open && <div style={styles.formGrid}>{children}</div>}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.label}>
      {label}
      {children}
    </label>
  );
}

function AddressBlock({
  title,
  prefix,
  setup,
  update,
}: {
  title: string;
  prefix: "registered_office" | "physical_address" | "postal_address";
  setup: ClientSetup;
  update: (field: keyof ClientSetup, value: string | number) => void;
}) {
  const line1 = `${prefix}_line_1` as keyof ClientSetup;
  const line2 = `${prefix}_line_2` as keyof ClientSetup;
  const city = `${prefix}_city` as keyof ClientSetup;
  const province = `${prefix}_province` as keyof ClientSetup;
  const postalCode = `${prefix}_postal_code` as keyof ClientSetup;

  return (
    <div style={styles.addressBox}>
      <strong style={styles.addressTitle}>{title}</strong>

      <input
        style={styles.input}
        value={String(setup[line1] || "")}
        onChange={(e) => update(line1, e.target.value)}
        placeholder="Address line 1"
      />

      <input
        style={styles.input}
        value={String(setup[line2] || "")}
        onChange={(e) => update(line2, e.target.value)}
        placeholder="Address line 2"
      />

      <input
        style={styles.input}
        value={String(setup[city] || "")}
        onChange={(e) => update(city, e.target.value)}
        placeholder="City"
      />

      <input
        style={styles.input}
        value={String(setup[province] || "")}
        onChange={(e) => update(province, e.target.value)}
        placeholder="Province"
      />

      <input
        style={styles.input}
        value={String(setup[postalCode] || "")}
        onChange={(e) => update(postalCode, e.target.value)}
        placeholder="Postal code"
      />
    </div>
  );
}

function makeCurrentPeriodHeading(financialYearEnd: string) {
  if (!financialYearEnd) return "";

  const date = new Date(financialYearEnd);
  if (Number.isNaN(date.getTime())) return "";

  return `Year ended ${formatDateLong(date)}`;
}

function makePriorPeriodHeading(financialYearEnd: string) {
  if (!financialYearEnd) return "";

  const date = new Date(financialYearEnd);
  if (Number.isNaN(date.getTime())) return "";

  date.setFullYear(date.getFullYear() - 1);

  return `Year ended ${formatDateLong(date)}`;
}

function formatDateLong(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: "14px",
  },
  actionBar: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  pageTitle: {
    margin: 0,
    fontSize: "19px",
  },
  pageText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  card: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },
  sectionToggle: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    textAlign: "left",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
  },
  toggleText: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#2563eb",
  },
  formGrid: {
    marginTop: "14px",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    alignItems: "start",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 11px",
    fontSize: "13px",
    outline: "none",
    color: "#111827",
    background: "white",
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "11px 15px",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  deleteButton: {
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "8px 10px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
  },
  addressBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    display: "grid",
    gap: "8px",
  },
  addressTitle: {
    fontSize: "13px",
    color: "#111827",
  },
  peopleArea: {
    gridColumn: "1 / -1",
    display: "grid",
    gap: "14px",
  },
  peopleForm: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    alignItems: "end",
  },
  peopleTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px",
    fontSize: "12px",
    color: "#64748b",
  },
  td: {
    borderBottom: "1px solid #f3f4f6",
    padding: "10px",
    fontSize: "13px",
  },
  tdRight: {
    borderBottom: "1px solid #f3f4f6",
    padding: "10px",
    fontSize: "13px",
    textAlign: "right",
  },
  emptyText: {
    color: "#64748b",
    fontSize: "14px",
  },
};