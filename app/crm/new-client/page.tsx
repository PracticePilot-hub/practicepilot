"use client";

import { useState, ReactNode } from "react";

export default function NewClientPage() {
  const [active, setActive] = useState("core");

  // CORE
  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [status, setStatus] = useState("Active");
  const [yearEnd, setYearEnd] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");

  // SERVICES
  const [accounting, setAccounting] = useState("None");
  const [vat, setVat] = useState("None");
  const [payroll, setPayroll] = useState("None");
  const [wccRefNr, setWccRefNr] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [payeNumber, setPayeNumber] = useState("");
  const [uifNumber, setUifNumber] = useState("");
  const [incomeTaxNumber, setIncomeTaxNumber] = useState("");

  const [financials, setFinancials] = useState(false);
  const [bo, setBo] = useState(false);
  const [ar, setAr] = useState(false);
  const [provisional, setProvisional] = useState(false);
  const [incomeTax, setIncomeTax] = useState(false);
  const [emp201, setEmp201] = useState(false);
  const [emp501, setEmp501] = useState(false);
  const [workmans, setWorkmans] = useState(false);
  const [customsNumber, setCustomsNumber] = useState("");
  const [sdlRegistered, setSdlRegistered] = useState(false);
  

  // CONTACT
  const [primaryContact, setPrimaryContact] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [cellphone, setCellphone] = useState("");

  // ADDRESS
  const [physical1, setPhysical1] = useState("");
  const [physical2, setPhysical2] = useState("");
  const [physicalSuburb, setPhysicalSuburb] = useState("");
  const [physicalCity, setPhysicalCity] = useState("");
  const [physicalProvince, setPhysicalProvince] = useState("");

  const [postal1, setPostal1] = useState("");
  const [postal2, setPostal2] = useState("");
  const [postalSuburb, setPostalSuburb] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [postalProvince, setPostalProvince] = useState("");

  // INTERNAL
  const [clientLead, setClientLead] = useState("");
  const [manager, setManager] = useState("");
  const [partner, setPartner] = useState("");

  function toggle(section: string) {
    setActive(active === section ? "" : section);
  }

  async function handleSave() {
    const payload = {
      clientName,
      clientType,
      internalCode,
      status,
      yearEnd,
      tradingName,
      registrationNumber,
      registrationDate,

      accounting,
      vat,
      payroll,
      vatNumber,
      payeNumber,
      uifNumber,
      incomeTaxNumber,
      financials,
      bo,
      ar,
      provisionalTax: provisional,
      incomeTax,
      emp201,
      emp501,
      workmans,
      customsNumber,
      wccRefNr,
      sdlRegistered,
     
      primaryContact,
      email,
      telephone,
      cellphone,

      physicalAddressLine1: physical1,
      physicalAddressLine2: physical2,
      physicalSuburb,
      physicalCity,
      physicalProvince,

      postalAddressLine1: postal1,
      postalAddressLine2: postal2,
      postalSuburb,
      postalCity,
      postalProvince,

      clientLead,
      manager,
      partner,
    };

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.success) alert("Saved");
    else alert(data.error || "Save failed");
  }

  return (
    <div style={{ padding: 30 }}>
      <h2>Add Client</h2>

      <Header title="Core Details" open={active === "core"} onClick={() => toggle("core")} />

      {active === "core" && (
        <Box>
          <div style={grid5}>
            <Field label="Client Name">
              <input style={input} value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </Field>

            <Field label="Client Type">
              <select style={input} value={clientType} onChange={(e) => setClientType(e.target.value)}>
                <option value="">Select...</option>
                <option>PTY LTD</option>
                <option>Individual</option>
                <option>Trust</option>
              </select>
            </Field>

            <Field label="Internal Code">
              <input style={input} value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />
            </Field>

            <Field label="Status">
              <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </Field>

            <Field label="Year End">
              <select style={input} value={yearEnd} onChange={(e) => setYearEnd(e.target.value)}>
                <option value="">Select...</option>
                {months.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={grid3}>
            <Field label="Trading Name">
              <input style={input} value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
            </Field>

            <Field label="Registration Number">
              <input style={input} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </Field>

            <Field label="Registration Date">
              <input type="date" style={input} value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} />
            </Field>
          </div>
        </Box>
      )}

      <Header title="Service Details" open={active === "services"} onClick={() => toggle("services")} />

      {active === "services" && (
        <Box>
          <div style={grid3}>
            <Select label="Accounting" value={accounting} set={setAccounting} options={["None", "Monthly", "Weekly", "Bi-Monthly", "Bi-Weekly"]} />
            <Select label="VAT" value={vat} set={setVat} options={["None", "Category A", "Category B", "Category C"]} />
            <Select label="Payroll" value={payroll} set={setPayroll} options={["None", "Monthly", "Weekly", "Bi-Weekly"]} />
          </div>

          <div style={grid4}>
            <Field label="VAT Number">
              <input style={input} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
            </Field>

            <Field label="PAYE Number">
              <input style={input} value={payeNumber} onChange={(e) => setPayeNumber(e.target.value)} />
            </Field>

            <Field label="UIF Number">
              <input style={input} value={uifNumber} onChange={(e) => setUifNumber(e.target.value)} />
            </Field>

            <Field label="Income Tax Number">
              <input style={input} value={incomeTaxNumber} onChange={(e) => setIncomeTaxNumber(e.target.value)} />
            </Field>

              <Field label="Customs Number">
                <input style={input} value={customsNumber} onChange={(e) => setCustomsNumber(e.target.value)}  />
              </Field>

               <Field label="WCC Ref Nr">
  <input
    style={input}
    value={wccRefNr}
    onChange={(e) => setWccRefNr(e.target.value)}
  />
</Field>
               
          </div>

          <div style={grid3}>
            <Check label="Financial Statements" val={financials} set={setFinancials} />
            <Check label="Beneficial Ownership" val={bo} set={setBo} />
            <Check label="CIPC Annual Return" val={ar} set={setAr} />
            <Check label="Provisional Tax" val={provisional} set={setProvisional} />
            <Check label="Income Tax" val={incomeTax} set={setIncomeTax} />
            <Check label="EMP201" val={emp201} set={setEmp201} />
            <Check label="EMP501" val={emp501} set={setEmp501} />
            <Check label="Workmans Comp" val={workmans} set={setWorkmans} />
             
            <label style={{ display: "flex", alignItems: "center", gap: 1 }}>
               <input type="checkbox" checked={sdlRegistered} onChange={(e) => setSdlRegistered(e.target.checked)}
               />SDL Registered
                </label>

          </div>  
        </Box>
      )}

      <Header title="Contacts & Addresses" open={active === "contact"} onClick={() => toggle("contact")} />

      {active === "contact" && (
        <Box>
          <div style={grid4}>
            <Field label="Primary Contact">
              <input style={input} value={primaryContact} onChange={(e) => setPrimaryContact(e.target.value)} />
            </Field>

            <Field label="Email">
              <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <Field label="Telephone">
              <input style={input} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Field>

            <Field label="Cellphone">
              <input style={input} value={cellphone} onChange={(e) => setCellphone(e.target.value)} />
            </Field>
          </div>

          <h4>Physical Address</h4>
          <div style={grid3}>
            <input style={input} placeholder="Line 1" value={physical1} onChange={(e) => setPhysical1(e.target.value)} />
            <input style={input} placeholder="Line 2" value={physical2} onChange={(e) => setPhysical2(e.target.value)} />
            <input style={input} placeholder="Suburb" value={physicalSuburb} onChange={(e) => setPhysicalSuburb(e.target.value)} />
            <input style={input} placeholder="City" value={physicalCity} onChange={(e) => setPhysicalCity(e.target.value)} />
            <input style={input} placeholder="Province" value={physicalProvince} onChange={(e) => setPhysicalProvince(e.target.value)} />
          </div>

          <h4>Postal Address</h4>
          <div style={grid3}>
            <input style={input} placeholder="Line 1" value={postal1} onChange={(e) => setPostal1(e.target.value)} />
            <input style={input} placeholder="Line 2" value={postal2} onChange={(e) => setPostal2(e.target.value)} />
            <input style={input} placeholder="Suburb" value={postalSuburb} onChange={(e) => setPostalSuburb(e.target.value)} />
            <input style={input} placeholder="City" value={postalCity} onChange={(e) => setPostalCity(e.target.value)} />
            <input style={input} placeholder="Province" value={postalProvince} onChange={(e) => setPostalProvince(e.target.value)} />
          </div>
        </Box>
      )}

      <Header title="Internal" open={active === "internal"} onClick={() => toggle("internal")} />

      {active === "internal" && (
        <Box>
          <div style={grid3}>
            <input style={input} placeholder="Client Lead" value={clientLead} onChange={(e) => setClientLead(e.target.value)} />
            <input style={input} placeholder="Manager" value={manager} onChange={(e) => setManager(e.target.value)} />
            <input style={input} placeholder="Partner" value={partner} onChange={(e) => setPartner(e.target.value)} />
          </div>
        </Box>
      )}

      <button style={saveBtn} onClick={handleSave}>
        Save Client
      </button>
    </div>
  );
}

/* COMPONENTS */

function Header({ title, open, onClick }: { title: string; open: boolean; onClick: () => void }) {
  return (
    <div style={header} onClick={onClick}>
      <span>{title}</span>
      <button type="button">{open ? "Hide" : "Show"}</button>
    </div>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div style={box}>{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );
}

function Select({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select style={input} value={value} onChange={(e) => set(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}

function Check({
  label,
  val,
  set,
}: {
  label: string;
  val: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <label>
      <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

/* STYLES */

const header = {
  border: "2px solid #111827",
  padding: 14,
  marginTop: 20,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};

const box = {
  border: "2px solid #111827",
  padding: 16,
  marginTop: 10,
};

const input = {
  width: "100%",
  padding: 10,
  border: "1px solid #111827",
  borderRadius: 6,
  fontSize: 15,
};

const grid3 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const grid4 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const grid5 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const saveBtn = {
  marginTop: 20,
  padding: "12px 24px",
  background: "#000",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 15,
};

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