"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type UserOption = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
};

type ServiceOption = {
  id: string;
  service_name: string;
  service_group: string | null;
  default_frequency: string | null;
  default_service_settings?: Record<string, unknown>;
};

type ServiceState = {
  selected: boolean;
  frequency: string;
  firstPeriodStart: string;
  firstPeriodEnd: string;
  settings: Record<string, unknown>;
};

type ClientApiData = {
  id: string;
  client_name: string;
  entity_type: string | null;
  client_code: string | null;
  status: string | null;
  year_end: string | null;
  trading_name: string | null;
  registration_number: string | null;
  registration_date: string | null;
  id_passport_number: string | null;
  date_of_birth: string | null;

  vat_number: string | null;
  paye_number: string | null;
  tax_number: string | null;
  uif_registration_number: string | null;
  customs_number: string | null;
  sdl_registered: boolean | null;
  wcc_reference_number: string | null;

  client_lead_user_id: string | null;
  manager_user_id: string | null;
  partner_user_id: string | null;

  crm_client_contacts?: Array<{
    contact_name: string | null;
    contact_position: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    is_primary: boolean | null;
  }>;

  crm_client_addresses?: Array<{
    address_type: string;
    line_1: string | null;
    line_2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
  }>;

  crm_client_services?: Array<{
    frequency: string | null;
    start_date: string | null;
    service_settings: Record<string, unknown> | null;
    is_active: boolean | null;
    crm_services:
      | {
          service_name: string;
        }
      | Array<{
          service_name: string;
        }>
      | null;
  }>;
};

type ClientFormProps = {
  mode: "create" | "edit";
  clientId?: string;
};

const BASE_SERVICES = [
  "Accounting",
  "VAT201",
  "Payroll",
  "Financial Statements",
  "Beneficial Ownership Declaration",
  "CIPC Annual Return",
  "Provisional Tax",
  "Income Tax",
  "EMP201",
  "EMP501",
  "Workmans Compensation",
];

function defaultFrequency(serviceName: string) {
  switch (serviceName) {
    case "Accounting":
    case "Payroll":
    case "EMP201":
      return "Monthly";
    case "VAT201":
      return "Bi-monthly";
    case "Provisional Tax":
    case "EMP501":
      return "Bi-annual";
    default:
      return "Annual";
  }
}

function getNestedServiceName(
  value:
    | { service_name: string }
    | Array<{ service_name: string }>
    | null
) {
  if (Array.isArray(value)) return value[0]?.service_name || "";
  return value?.service_name || "";
}

function calculatePeriodEnd(
  startDate: string,
  frequency: string,
  serviceName: string,
  settings: Record<string, unknown>
) {
  if (!startDate) return "";

  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "";

  const normalised = frequency.toLowerCase();
  const vatCategory = String(settings.vat_category || "").toUpperCase();
  const end = new Date(start);

  if (serviceName === "VAT201" && vatCategory === "C") {
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
  } else if (normalised.includes("bi-month") || serviceName === "VAT201") {
    end.setMonth(end.getMonth() + 2);
    end.setDate(0);
  } else if (normalised.includes("every 2") || normalised.includes("bi-week")) {
    end.setDate(end.getDate() + 13);
  } else if (normalised.includes("week")) {
    end.setDate(end.getDate() + 6);
  } else if (normalised.includes("bi-annual")) {
    end.setMonth(end.getMonth() + 6);
    end.setDate(end.getDate() - 1);
  } else if (normalised.includes("annual") || normalised.includes("year")) {
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
  } else {
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
  }

  return end.toISOString().slice(0, 10);
}

export default function ClientForm({ mode, clientId }: ClientFormProps) {
  const router = useRouter();

  const [activeSection, setActiveSection] = useState("core");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);

  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [status, setStatus] = useState("Active");
  const [yearEnd, setYearEnd] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [idPassportNumber, setIdPassportNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [vatNumber, setVatNumber] = useState("");
  const [payeNumber, setPayeNumber] = useState("");
  const [uifNumber, setUifNumber] = useState("");
  const [incomeTaxNumber, setIncomeTaxNumber] = useState("");
  const [customsNumber, setCustomsNumber] = useState("");
  const [wccRefNr, setWccRefNr] = useState("");
  const [sdlRegistered, setSdlRegistered] = useState(false);

  const [primaryContact, setPrimaryContact] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [cellphone, setCellphone] = useState("");

  const [physical1, setPhysical1] = useState("");
  const [physical2, setPhysical2] = useState("");
  const [physicalCity, setPhysicalCity] = useState("");
  const [physicalProvince, setPhysicalProvince] = useState("");
  const [physicalPostalCode, setPhysicalPostalCode] = useState("");

  const [postal1, setPostal1] = useState("");
  const [postal2, setPostal2] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [postalProvince, setPostalProvince] = useState("");
  const [postalPostalCode, setPostalPostalCode] = useState("");

  const [clientLeadUserId, setClientLeadUserId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [partnerUserId, setPartnerUserId] = useState("");

  const [services, setServices] = useState<Record<string, ServiceState>>({});

  const isIndividual = clientType === "Individual";

  const visibleServices = useMemo(() => {
    const names = new Set(BASE_SERVICES);
    serviceOptions.forEach((service) => names.add(service.service_name));

    return Array.from(names).filter((name) =>
      BASE_SERVICES.includes(name)
    );
  }, [serviceOptions]);

  useEffect(() => {
    loadForm();
  }, [clientId]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function apiFetch(url: string, init?: RequestInit) {
    const token = await getAccessToken();

    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  function initialiseServiceStates(options: ServiceOption[]) {
    const state: Record<string, ServiceState> = {};

    for (const serviceName of BASE_SERVICES) {
      const option = options.find(
        (item) => item.service_name === serviceName
      );

      state[serviceName] = {
        selected: false,
        frequency:
          option?.default_frequency || defaultFrequency(serviceName),
        firstPeriodStart: "",
        firstPeriodEnd: "",
        settings: {
          ...(option?.default_service_settings || {}),
        },
      };
    }

    return state;
  }

  async function loadForm() {
    try {
      setLoading(true);
      setErrorMessage("");

      const url =
        mode === "edit" && clientId
          ? `/api/clients?id=${encodeURIComponent(clientId)}`
          : "/api/clients";

      const response = await apiFetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load client form.");
      }

      const loadedUsers = (data.users || []) as UserOption[];
      const loadedServices = (data.services || []) as ServiceOption[];

      setUsers(loadedUsers);
      setServiceOptions(loadedServices);

      const serviceState = initialiseServiceStates(loadedServices);

      if (mode === "edit" && data.client) {
        populateClient(data.client as ClientApiData, serviceState);
      } else {
        setServices(serviceState);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load client form."
      );
    } finally {
      setLoading(false);
    }
  }

  function populateClient(
    client: ClientApiData,
    serviceState: Record<string, ServiceState>
  ) {
    setClientName(client.client_name || "");
    setClientType(client.entity_type || "");
    setInternalCode(client.client_code || "");
    setStatus(client.status || "Active");
    setYearEnd(client.year_end || "");
    setTradingName(client.trading_name || "");
    setRegistrationNumber(client.registration_number || "");
    setRegistrationDate(client.registration_date || "");
    setIdPassportNumber(client.id_passport_number || "");
    setDateOfBirth(client.date_of_birth || "");

    setVatNumber(client.vat_number || "");
    setPayeNumber(client.paye_number || "");
    setIncomeTaxNumber(client.tax_number || "");
    setUifNumber(client.uif_registration_number || "");
    setCustomsNumber(client.customs_number || "");
    setSdlRegistered(Boolean(client.sdl_registered));
    setWccRefNr(client.wcc_reference_number || "");

    setClientLeadUserId(client.client_lead_user_id || "");
    setManagerUserId(client.manager_user_id || "");
    setPartnerUserId(client.partner_user_id || "");

    const contact =
      client.crm_client_contacts?.find((item) => item.is_primary) ||
      client.crm_client_contacts?.[0];

    setPrimaryContact(contact?.contact_name || "");
    setContactPosition(contact?.contact_position || "");
    setEmail(contact?.email || "");
    setTelephone(contact?.phone || "");
    setCellphone(contact?.mobile || "");

    const physical = client.crm_client_addresses?.find(
      (item) => item.address_type === "Physical"
    );
    const postal = client.crm_client_addresses?.find(
      (item) => item.address_type === "Postal"
    );

    setPhysical1(physical?.line_1 || "");
    setPhysical2(physical?.line_2 || "");
    setPhysicalCity(physical?.city || "");
    setPhysicalProvince(physical?.province || "");
    setPhysicalPostalCode(physical?.postal_code || "");

    setPostal1(postal?.line_1 || "");
    setPostal2(postal?.line_2 || "");
    setPostalCity(postal?.city || "");
    setPostalProvince(postal?.province || "");
    setPostalPostalCode(postal?.postal_code || "");

    for (const clientService of client.crm_client_services || []) {
      const name = getNestedServiceName(clientService.crm_services);

      if (!name || !serviceState[name]) continue;

      const settings = clientService.service_settings || {};

      serviceState[name] = {
        selected: Boolean(clientService.is_active),
        frequency:
          clientService.frequency ||
          String(settings.frequency || defaultFrequency(name)),
        firstPeriodStart:
          String(settings.first_period_start || clientService.start_date || ""),
        firstPeriodEnd: String(settings.first_period_end || ""),
        settings,
      };
    }

    setServices({ ...serviceState });
  }

  function updateService(
    serviceName: string,
    patch: Partial<ServiceState>
  ) {
    setServices((current) => ({
      ...current,
      [serviceName]: {
        ...(current[serviceName] || {
          selected: false,
          frequency: defaultFrequency(serviceName),
          firstPeriodStart: "",
          firstPeriodEnd: "",
          settings: {},
        }),
        ...patch,
      },
    }));
  }

  function updateServiceSetting(
    serviceName: string,
    key: string,
    value: unknown
  ) {
    const current = services[serviceName];

    updateService(serviceName, {
      settings: {
        ...(current?.settings || {}),
        [key]: value,
      },
    });
  }

  function copyPhysicalToPostal() {
    setPostal1(physical1);
    setPostal2(physical2);
    setPostalCity(physicalCity);
    setPostalProvince(physicalProvince);
    setPostalPostalCode(physicalPostalCode);
  }

  function validate() {
    if (!clientName.trim()) {
      return "Client name is required.";
    }

    if (!clientType) {
      return "Client type is required.";
    }

    for (const [serviceName, service] of Object.entries(services)) {
      if (!service.selected) continue;

      if (!service.firstPeriodStart) {
        return `${serviceName}: first period start is required.`;
      }


      if (serviceName === "VAT201" && !service.settings.vat_category) {
        return "VAT201: select the VAT category.";
      }
    }

    return "";
  }

  async function handleSave() {
    if (saving) return;

    const validationError = validate();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const payload = {
        clientId: mode === "edit" ? clientId : undefined,
        clientName,
        clientType,
        internalCode,
        status,
        yearEnd,
        tradingName,
        registrationNumber,
        registrationDate,
        idPassportNumber,
        dateOfBirth,

        vatNumber,
        payeNumber,
        uifNumber,
        incomeTaxNumber,
        customsNumber,
        wccRefNr,
        sdlRegistered,

        primaryContact,
        contactPosition,
        email,
        telephone,
        cellphone,

        physicalAddressLine1: physical1,
        physicalAddressLine2: physical2,
        physicalCity,
        physicalProvince,
        physicalPostalCode,

        postalAddressLine1: postal1,
        postalAddressLine2: postal2,
        postalCity,
        postalProvince,
        postalPostalCode,

        clientLeadUserId,
        managerUserId,
        partnerUserId,

        services: Object.entries(services).map(
          ([serviceName, service]) => ({
            serviceName,
            selected: service.selected,
            frequency: service.frequency,
            firstPeriodStart: service.firstPeriodStart || null,
            firstPeriodEnd:
              calculatePeriodEnd(
                service.firstPeriodStart,
                service.frequency,
                serviceName,
                service.settings
              ) || null,
            settings: service.settings,
          })
        ),
      };

      const response = await apiFetch("/api/clients", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Client could not be saved.");
      }

      void apiFetch("/api/crm/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: data.clientId }),
      }).catch((taskError) => {
        console.error("Task generation failed:", taskError);
      });

      router.push("/crm");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Client could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={pageStyle}>Loading client form...</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={workingFileBar}>
        <button
          type="button"
          onClick={() => router.push("/crm")}
          style={backButton}
        >
          ← Back to CRM
        </button>

        <div style={workingFileLabel}>CRM WORKING FILE</div>
        <div style={workingFileDivider}>|</div>
        <div style={workingFileClient}>
          {clientName.trim() || (mode === "create" ? "New Client" : "Client")}
        </div>
        <div style={workingFileDivider}>|</div>
        <div style={workingFileMeta}>
          {mode === "create" ? "Client setup" : "Edit client master"}
        </div>

        <div style={statusBadge}>
          {status || "Active"}
        </div>
      </div>

      <div style={pageHeadingBar}>
        <div>
          <div style={pageHeadingKicker}>Client Setup</div>
          <div style={pageHeadingSubtext}>
            Capture client details, services, first periods and internal responsibility.
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...topSaveButton,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Save client setup"
              : "Save changes"}
        </button>
      </div>

      <div style={contentHeading}>
        <div>
          <h1 style={titleStyle}>
            {mode === "create" ? "Add Client" : "Edit Client"}
          </h1>
          <p style={contentSubtitle}>
            Maintain the client master record used across CRM, compliance and recurring work.
          </p>
        </div>
      </div>

      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      <SectionHeader
        title="Core Details"
        open={activeSection === "core"}
        onClick={() =>
          setActiveSection(activeSection === "core" ? "" : "core")
        }
      />

      {activeSection === "core" && (
        <SectionBody>
          <div style={grid4}>
            <Field label="Client Name *">
              <input
                style={inputStyle}
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />
            </Field>

            <Field label="Client Type *">
              <select
                style={inputStyle}
                value={clientType}
                onChange={(event) => setClientType(event.target.value)}
              >
                <option value="">Select...</option>
                <option value="PTY LTD">PTY LTD</option>
                <option value="Close Corporation">Close Corporation</option>
                <option value="Individual">Individual</option>
                <option value="Trust">Trust</option>
                <option value="Non-Profit Company">Non-Profit Company</option>
                <option value="Partnership">Partnership</option>
                <option value="Sole Proprietor">Sole Proprietor</option>
              </select>
            </Field>

            <Field label="Internal Code">
              <input
                style={inputStyle}
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value)}
              />
            </Field>

            <Field label="Status">
              <select
                style={inputStyle}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Prospective">Prospective</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <div style={grid4}>
            <Field label="Trading Name">
              <input
                style={inputStyle}
                value={tradingName}
                onChange={(event) => setTradingName(event.target.value)}
              />
            </Field>

            <Field
              label={
                isIndividual
                  ? "ID / Passport Number"
                  : "Registration Number"
              }
            >
              <input
                style={inputStyle}
                value={
                  isIndividual ? idPassportNumber : registrationNumber
                }
                onChange={(event) =>
                  isIndividual
                    ? setIdPassportNumber(event.target.value)
                    : setRegistrationNumber(event.target.value)
                }
              />
            </Field>

            <Field
              label={
                isIndividual ? "Date of Birth" : "Registration Date"
              }
            >
              <input
                type="date"
                style={inputStyle}
                value={isIndividual ? dateOfBirth : registrationDate}
                onChange={(event) =>
                  isIndividual
                    ? setDateOfBirth(event.target.value)
                    : setRegistrationDate(event.target.value)
                }
              />
            </Field>

            <Field label="Financial Year End">
              <select
                style={inputStyle}
                value={yearEnd}
                onChange={(event) => setYearEnd(event.target.value)}
              >
                <option value="">Select...</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </SectionBody>
      )}

      <SectionHeader
        title="Services and First Periods"
        open={activeSection === "services"}
        onClick={() =>
          setActiveSection(activeSection === "services" ? "" : "services")
        }
      />

      {activeSection === "services" && (
        <SectionBody>
          <div style={serviceIntro}>
            Tick only the services currently performed for this client. The
            first period may be backdated. It becomes the starting point for
            task generation.
          </div>

          <div style={serviceTableHeader}>
            <div>Service</div>
            <div>Frequency / Category</div>
            <div>First Period</div>
          </div>

          {visibleServices.map((serviceName) => {
            const service = services[serviceName] || {
              selected: false,
              frequency: defaultFrequency(serviceName),
              firstPeriodStart: "",
              firstPeriodEnd: "",
              settings: {},
            };

            return (
              <div key={serviceName} style={serviceRow}>
                <label style={serviceCheckLabel}>
                  <input
                    type="checkbox"
                    checked={service.selected}
                    onChange={(event) =>
                      updateService(serviceName, {
                        selected: event.target.checked,
                      })
                    }
                  />
                  <span>{serviceName}</span>
                </label>

                <ServiceFrequency
                  serviceName={serviceName}
                  service={service}
                  onFrequency={(value) =>
                    updateService(serviceName, { frequency: value })
                  }
                  onSetting={(key, value) =>
                    updateServiceSetting(serviceName, key, value)
                  }
                />

                <div>
                  <input
                    type="date"
                    style={inputStyle}
                    disabled={!service.selected}
                    value={service.firstPeriodStart}
                    onChange={(event) =>
                      updateService(serviceName, {
                        firstPeriodStart: event.target.value,
                        firstPeriodEnd: calculatePeriodEnd(
                          event.target.value,
                          service.frequency,
                          serviceName,
                          service.settings
                        ),
                      })
                    }
                  />
                  {service.selected && service.firstPeriodStart && (
                    <div style={periodHint}>
                      Period ends {calculatePeriodEnd(
                        service.firstPeriodStart,
                        service.frequency,
                        serviceName,
                        service.settings
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div style={subHeading}>Registration Numbers</div>

          <div style={grid4}>
            <Field label="VAT Number">
              <input
                style={inputStyle}
                value={vatNumber}
                onChange={(event) => setVatNumber(event.target.value)}
              />
            </Field>

            <Field label="PAYE Number">
              <input
                style={inputStyle}
                value={payeNumber}
                onChange={(event) => setPayeNumber(event.target.value)}
              />
            </Field>

            <Field label="UIF Number">
              <input
                style={inputStyle}
                value={uifNumber}
                onChange={(event) => setUifNumber(event.target.value)}
              />
            </Field>

            <Field label="Income Tax Number">
              <input
                style={inputStyle}
                value={incomeTaxNumber}
                onChange={(event) =>
                  setIncomeTaxNumber(event.target.value)
                }
              />
            </Field>

            <Field label="Customs Number">
              <input
                style={inputStyle}
                value={customsNumber}
                onChange={(event) => setCustomsNumber(event.target.value)}
              />
            </Field>

            <Field label="WCC / COIDA Reference">
              <input
                style={inputStyle}
                value={wccRefNr}
                onChange={(event) => setWccRefNr(event.target.value)}
              />
            </Field>

            <label style={checkboxField}>
              <input
                type="checkbox"
                checked={sdlRegistered}
                onChange={(event) =>
                  setSdlRegistered(event.target.checked)
                }
              />
              SDL Registered
            </label>
          </div>
        </SectionBody>
      )}

      <SectionHeader
        title="Contacts and Addresses"
        open={activeSection === "contact"}
        onClick={() =>
          setActiveSection(activeSection === "contact" ? "" : "contact")
        }
      />

      {activeSection === "contact" && (
        <SectionBody>
          <div style={grid5}>
            <Field label="Primary Contact">
              <input
                style={inputStyle}
                value={primaryContact}
                onChange={(event) =>
                  setPrimaryContact(event.target.value)
                }
              />
            </Field>

            <Field label="Position">
              <input
                style={inputStyle}
                value={contactPosition}
                onChange={(event) =>
                  setContactPosition(event.target.value)
                }
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                style={inputStyle}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field label="Telephone">
              <input
                style={inputStyle}
                value={telephone}
                onChange={(event) => setTelephone(event.target.value)}
              />
            </Field>

            <Field label="Cellphone">
              <input
                style={inputStyle}
                value={cellphone}
                onChange={(event) => setCellphone(event.target.value)}
              />
            </Field>
          </div>

          <div style={subHeading}>Physical Address</div>

          <div style={grid5}>
            <input
              style={inputStyle}
              placeholder="Line 1"
              value={physical1}
              onChange={(event) => setPhysical1(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Line 2 / Suburb"
              value={physical2}
              onChange={(event) => setPhysical2(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="City"
              value={physicalCity}
              onChange={(event) => setPhysicalCity(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Province"
              value={physicalProvince}
              onChange={(event) =>
                setPhysicalProvince(event.target.value)
              }
            />
            <input
              style={inputStyle}
              placeholder="Postal Code"
              value={physicalPostalCode}
              onChange={(event) =>
                setPhysicalPostalCode(event.target.value)
              }
            />
          </div>

          <div style={subHeadingRow}>
            <div style={{ ...subHeading, margin: 0, flex: 1 }}>Postal Address</div>
            <button
              type="button"
              onClick={copyPhysicalToPostal}
              style={copyButton}
            >
              Copy Physical to Postal
            </button>
          </div>

          <div style={grid5}>
            <input
              style={inputStyle}
              placeholder="Line 1"
              value={postal1}
              onChange={(event) => setPostal1(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Line 2 / Suburb"
              value={postal2}
              onChange={(event) => setPostal2(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="City"
              value={postalCity}
              onChange={(event) => setPostalCity(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Province"
              value={postalProvince}
              onChange={(event) =>
                setPostalProvince(event.target.value)
              }
            />
            <input
              style={inputStyle}
              placeholder="Postal Code"
              value={postalPostalCode}
              onChange={(event) =>
                setPostalPostalCode(event.target.value)
              }
            />
          </div>
        </SectionBody>
      )}

      <SectionHeader
        title="Internal Responsibility"
        open={activeSection === "internal"}
        onClick={() =>
          setActiveSection(activeSection === "internal" ? "" : "internal")
        }
      />

      {activeSection === "internal" && (
        <SectionBody>
          <div style={grid3}>
            <UserSelect
              label="Client Lead"
              value={clientLeadUserId}
              setValue={setClientLeadUserId}
              users={users}
            />

            <UserSelect
              label="Manager"
              value={managerUserId}
              setValue={setManagerUserId}
              users={users}
            />

            <UserSelect
              label="Partner"
              value={partnerUserId}
              setValue={setPartnerUserId}
              users={users}
            />
          </div>
        </SectionBody>
      )}

      <div style={footerBar}>
        <button
          type="button"
          onClick={() => router.push("/crm")}
          style={secondaryButton}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...primaryButton,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Save Client and Create Tasks"
              : "Save Changes and Update Tasks"}
        </button>
      </div>
    </div>
  );
}

function ServiceFrequency({
  serviceName,
  service,
  onFrequency,
  onSetting,
}: {
  serviceName: string;
  service: ServiceState;
  onFrequency: (value: string) => void;
  onSetting: (key: string, value: unknown) => void;
}) {
  if (serviceName === "VAT201") {
    return (
      <select
        style={inputStyle}
        disabled={!service.selected}
        value={String(service.settings.vat_category || "")}
        onChange={(event) => {
          const category = event.target.value;
          onSetting("vat_category", category);
          onFrequency(category === "C" ? "Monthly" : "Bi-monthly");
        }}
      >
        <option value="">Select VAT Category...</option>
        <option value="A">Category A</option>
        <option value="B">Category B</option>
        <option value="C">Category C</option>
      </select>
    );
  }

  if (serviceName === "Accounting") {
    return (
      <select
        style={inputStyle}
        disabled={!service.selected}
        value={service.frequency}
        onChange={(event) => onFrequency(event.target.value)}
      >
        <option value="Monthly">Monthly</option>
        <option value="Bi-monthly">Bi-monthly</option>
        <option value="Yearly / Ad Hoc">Yearly / Ad Hoc</option>
      </select>
    );
  }

  if (serviceName === "Payroll") {
    return (
      <select
        style={inputStyle}
        disabled={!service.selected}
        value={service.frequency}
        onChange={(event) => onFrequency(event.target.value)}
      >
        <option value="Monthly">Monthly</option>
        <option value="Weekly">Weekly</option>
        <option value="Every 2 weeks">Every 2 weeks</option>
      </select>
    );
  }

  return (
    <input
      style={inputStyle}
      disabled
      value={service.frequency}
      onChange={() => undefined}
    />
  );
}

function SectionHeader({
  title,
  open,
  onClick,
}: {
  title: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" style={sectionHeader} onClick={onClick}>
      <span>{title}</span>
      <span>{open ? "−" : "+"}</span>
    </button>
  );
}

function SectionBody({ children }: { children: ReactNode }) {
  return <section style={sectionBody}>{children}</section>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function UserSelect({
  label,
  value,
  setValue,
  users,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  users: UserOption[];
}) {
  return (
    <Field label={label}>
      <select
        style={inputStyle}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name || user.email}
          </option>
        ))}
      </select>
    </Field>
  );
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "0 10px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const titleBar: React.CSSProperties = {
  display: "none",
};

const eyebrow: React.CSSProperties = {
  display: "none",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "24px",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  color: "#111827",
};

const errorBox: React.CSSProperties = {
  padding: "12px 14px",
  marginBottom: "14px",
  border: "1px solid #dc2626",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 700,
};

const sectionHeader: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "11px 12px",
  marginTop: "10px",
  border: "1px solid #d2d9e2",
  borderRadius: 0,
  background: "#f7f8fa",
  color: "#111827",
  fontSize: "16px",
  fontWeight: 500,
  cursor: "pointer",
};

const sectionBody: React.CSSProperties = {
  padding: "14px 12px 16px",
  border: "1px solid #d2d9e2",
  borderTop: "none",
  background: "#ffffff",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#2f4055",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "38px",
  padding: "8px 9px",
  border: "1px solid #cfd7e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#111827",
  fontSize: "14px",
  boxSizing: "border-box",
  fontWeight: 600,
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
};

const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "12px",
};

const grid5: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "12px",
};

const serviceIntro: React.CSSProperties = {
  padding: "10px 12px",
  marginBottom: "10px",
  borderLeft: "4px solid #008c99",
  background: "#edf8fa",
  fontSize: "13px",
  color: "#405568",
};

const serviceTableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1.25fr",
  gap: "8px",
  padding: "9px 10px",
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
};

const serviceRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1.25fr",
  gap: "8px",
  alignItems: "center",
  padding: "8px 10px",
  border: "1px solid #d5e0e8",
  borderTop: "none",
};

const serviceCheckLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 800,
  fontSize: "13px",
};

const subHeading: React.CSSProperties = {
  margin: "18px 0 10px",
  paddingBottom: "6px",
  borderBottom: "1px solid #a9bac8",
  fontWeight: 900,
  fontSize: "14px",
};

const checkboxField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "38px",
  fontWeight: 800,
  fontSize: "13px",
};

const periodHint: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "11px",
  color: "#5a6d7d",
};

const subHeadingRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "18px 0 10px",
};

const copyButton: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #7891a5",
  borderRadius: 0,
  background: "#ffffff",
  color: "#0b2f4f",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const footerBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px",
  paddingTop: "14px",
  borderTop: "1px solid #a9bac8",
};

const primaryButton: React.CSSProperties = {
  padding: "11px 18px",
  border: "1px solid #111827",
  borderRadius: 0,
  background: "#111827",
  color: "#ffffff",
  fontWeight: 800,
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  border: "1px solid #cfd7e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};


const workingFileBar: React.CSSProperties = {
  minHeight: "42px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 10px",
  margin: "8px 0 8px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
  fontSize: "12px",
};

const backButton: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #cfd7e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const workingFileLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  color: "#1d4ed8",
};

const workingFileDivider: React.CSSProperties = {
  color: "#94a3b8",
};

const workingFileClient: React.CSSProperties = {
  fontWeight: 800,
  color: "#111827",
};

const workingFileMeta: React.CSSProperties = {
  color: "#526173",
};

const statusBadge: React.CSSProperties = {
  marginLeft: "auto",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#e8eefc",
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: 800,
};

const pageHeadingBar: React.CSSProperties = {
  minHeight: "52px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "8px 12px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const pageHeadingKicker: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 800,
  color: "#111827",
};

const pageHeadingSubtext: React.CSSProperties = {
  marginTop: "2px",
  fontSize: "12px",
  color: "#64748b",
};

const topSaveButton: React.CSSProperties = {
  padding: "10px 16px",
  border: "1px solid #0f172a",
  borderRadius: 0,
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 800,
};

const contentHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 12px",
  marginTop: "8px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const contentSubtitle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "13px",
  color: "#64748b",
};
