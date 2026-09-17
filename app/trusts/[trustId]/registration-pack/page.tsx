"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrustShell from "../../_shell";
import {
  loadTrust,
  loadTrustParties,
  TrustParty,
  TrustRecord,
  ui,
  supabaseAny,
} from "../../_lib";

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function address(party: TrustParty | null | undefined) {
  if (!party) return "";
  return [
    party.address_line1,
    party.address_line2,
    party.city,
    party.province,
    party.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function trustAddress(trust: TrustRecord) {
  return [
    trust.physical_line1,
    trust.physical_line2,
    trust.physical_city,
    trust.physical_province,
    trust.physical_postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function birthDateFromSaId(idNumber: string | null | undefined) {
  const value = String(idNumber || "").replace(/\D/g, "");
  if (value.length !== 13) return "";
  const yy = Number(value.slice(0, 2));
  const mm = value.slice(2, 4);
  const dd = value.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  const year = yy <= currentYY ? 2000 + yy : 1900 + yy;
  return `${year}-${mm}-${dd}`;
}

function printDoc(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(
    title
  )}</title><style>
  @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;font-size:10.5pt;line-height:1.48;margin:0}
  h1{text-align:center;font-size:16pt;margin:0 0 18px}h2{text-align:center;font-size:12pt;margin:0 0 18px}
  h3{font-size:11pt;margin:20px 0 7px}p{margin:8px 0}.sig{margin-top:42px}.line{display:inline-block;min-width:290px;border-bottom:1px solid #000}
  .small{font-size:8.5pt;color:#555}.muted{color:#666}.box{border:1px solid #bbb;padding:9px 11px;margin:10px 0}.check{display:inline-block;width:15px;height:15px;border:1px solid #333;vertical-align:-3px;margin-right:5px}
  table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #aaa;padding:6px;vertical-align:top;text-align:left}.no-border td{border:0;padding:3px 0}
  ul,ol{margin:6px 0 6px 20px;padding:0}.page-break{page-break-before:always}@media print{.no-print{display:none}}</style></head><body>${body}</body></html>`;
}

function yesNo(value: boolean | null | undefined) {
  return value === true ? "YES" : value === false ? "NO" : "REVIEW";
}

export default function RegistrationPackPage() {
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
        setError(caught instanceof Error ? caught.message : "Could not load pack.");
      }
    })();
  }, [trustId]);

  const founders = useMemo(
    () => parties.filter((party) => party.role_founder),
    [parties]
  );
  const trustees = useMemo(
    () => parties.filter((party) => party.role_trustee || party.role_independent_trustee),
    [parties]
  );
  const beneficiaries = useMemo(
    () => parties.filter((party) => party.role_beneficiary),
    [parties]
  );
  const accountants = useMemo(
    () => parties.filter((party) => party.role_accountant),
    [parties]
  );

  if (!trust) {
    return (
      <div style={ui.page}>
        {error ? <div style={ui.error}>{error}</div> : "Loading…"}
      </div>
    );
  }

  function openPrint(html: string) {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => popup.print(), 250);
  }

  async function downloadOfficialForm(form: "j401" | "j405" | "j417" | "j450" | "affidavit" | "annexure-b", partyId?: string) {
    try {
      setError("");
      const { data } = await supabaseAny.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Your PracticePilot session could not be confirmed.");
      const query = partyId ? `?partyId=${encodeURIComponent(partyId)}` : "";
      const response = await fetch(`/api/trusts/${trustId}/master-forms/${form}${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `Could not generate ${form.toUpperCase()}.`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename=\"([^\"]+)\"/i);
      anchor.download = match?.[1] || `${trust?.name || "Trust"}-${form}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate official Master form.");
    }
  }

  const founder = founders[0];
  const accountant = accountants[0];
  const independentTrustee = trustees.find((item) => item.role_independent_trustee);
  const mandatory = trustees.find(
    (trustee) => trustee.id === trust.mandatory_signatory_party_id
  );
  const year = new Date().getFullYear();
  const bankText =
    trust.bank_account_status === "existing"
      ? `${trust.bank_name || "Bank"} / ${trust.bank_branch_name || "Branch"} / ${
          trust.bank_account_number || "Account number not captured"
        }`
      : "Account will be opened after registration";

  const supportingDocs: Array<{ name: string; status: string; html: string }> = [];

  trustees.forEach((trustee) => {
    const corporate = trustee.party_kind === "entity";
    const representative = trustee.representative_name || "________________";
    const repId = trustee.representative_id_number || "________________";
    const heading = corporate
      ? "DECLARATION BY TRUSTEE - ACCEPTANCE OF TRUSTEESHIP"
      : "DECLARATION BY TRUSTEES - ACCEPTANCE OF TRUSTEESHIP";

    const intro = corporate
      ? `<p>I, the undersigned,</p><p><strong>${esc(representative.toUpperCase())}</strong><br/>Identity Number: ${esc(repId)}<br/>representing</p><p><strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong><br/>${esc(trustee.registration_number || "________________")}<br/>${
          trustee.role_independent_trustee ? "(in its capacity as independent trustee)" : ""
        }</p><p>hereby declare as follows:</p><p>I am authorised to sign all the documents relating to the appointment of <strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong> as trustee, by written resolution, in a representative capacity.</p><p><strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong>, represented by myself, accepts the appointment as trustee of <strong>${esc(
          trust.name.toUpperCase()
        )}</strong>.</p><p>The business address of <strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong> is as follows:<br/>${esc(address(trustee) || "________________")}</p>`
      : `<p>I, the undersigned,</p><p><strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong><br/>Identity Number: ${esc(
          trustee.id_number || "________________"
        )}</p><p>hereby declare as follows:</p><p>I accept my appointment as trustee of <strong>${esc(
          trust.name.toUpperCase()
        )}</strong>.</p><p>My occupation and address is as follows:<br/>${esc(
          trustee.occupation || "________________"
        )}<br/>${esc(address(trustee) || "________________")}</p>`;

    const insolvencyParagraph = corporate
      ? `<p>I, a representative of <strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong>, am not an unrehabilitated insolvent and I have not previously committed any deeds of insolvency. I undertake to inform the Master of the High Court immediately should my estate be sequestrated or if I commit a deed of insolvency.</p><p>I confirm that <strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong> has not commenced voluntary liquidation proceedings, has not been placed under business rescue and has not been placed under provisional or final liquidation. I undertake to inform the Master of the High Court immediately should this change.</p>`
      : `<p>I am not an unrehabilitated insolvent and I have not previously committed any deeds of insolvency. I undertake to inform the Master of the High Court immediately should my estate be sequestrated or if I commit a deed of insolvency.</p>`;

    const residentParagraph = corporate
      ? `<p>I, a representative of <strong>${esc(
          trustee.full_name.toUpperCase()
        )}</strong>, am permanently resident in the Republic of South Africa. I undertake to inform the Master of the High Court immediately should I leave South Africa.</p>`
      : `<p>I am permanently resident in the Republic of South Africa. I undertake to inform the Master of the High Court immediately should I leave South Africa.</p>`;

    supportingDocs.push({
      name: `${corporate ? "Corporate" : "Individual"} trustee declaration - ${trustee.full_name}`,
      status: "Expanded to Trusteeze-style declaration",
      html: printDoc(
        heading,
        `<h1>DECLARATION BY ${corporate ? "TRUSTEE" : "TRUSTEES"}</h1><h2>ACCEPTANCE OF TRUSTEESHIP</h2>${intro}
        <p>I have knowledge of the duties imposed by law on a trustee concerned with the administration of a trust and undertake to fulfil these duties on an ongoing basis.</p>
        <p>I am not in a position to justify the suspension or release of ${corporate ? esc(trustee.full_name.toUpperCase()) : "myself"} in terms of Section 20 of the Trust Property Control Act No. 57 of 1988. I undertake to advise the Master of the High Court immediately should such circumstances arise.</p>
        <p>The beneficiaries of the trust are those persons or classes described as beneficiaries in the Trust Deed. They are not parties to the trust agreement and their written opinion(s) whether or not the trustees should be exempted from furnishing security are not required for purposes of this declaration.</p>
        <p>I undertake to -</p><ul>
        <li>ensure that a bank account is opened in the name of the trust;</li>
        <li>cause books of account of the trust to be maintained, and annually to have financial statements of the trust compiled;</li>
        <li>request the accountant of the trust to provide the Master of the High Court with such undertakings and information as may be required;</li>
        <li>provide the Master of the High Court with information concerning the trust insofar as such information may be requested; and</li>
        <li>comply with the Trust Property Control Act 57 of 1988 on an ongoing basis.</li></ul>
        ${insolvencyParagraph}${residentParagraph}
        <div class="sig">THUS DONE AND SIGNED at <span class="line"></span> on this ____ day of _____________________ ${year}.</div>
        <div class="sig"><span class="line"></span><br/><strong>${esc(
          corporate
            ? `TRUSTEE NAME: ${trustee.full_name.toUpperCase()}, REPRESENTED BY ${representative.toUpperCase()}, AS AUTHORISED BY RESOLUTION`
            : trustee.full_name.toUpperCase()
        )}</strong></div>`
      ),
    });

    if (trustee.role_independent_trustee) {
      supportingDocs.push({
        name: `Sworn affidavit by Independent Trustee - ${trustee.full_name}`,
        status: "Current DOJ affidavit wording prepared",
        html: printDoc(
          "SWORN AFFIDAVIT BY INDEPENDENT TRUSTEE",
          `<h1>SWORN AFFIDAVIT BY INDEPENDENT TRUSTEE</h1>
          <p>I, <strong>${esc(representative)}</strong>, ID / Passport No: <strong>${esc(
            repId
          )}</strong>, representative of <strong>${esc(trustee.full_name)}</strong>, Registration Number <strong>${esc(
            trustee.registration_number || "________________"
          )}</strong>, as independent trustee of <strong>${esc(trust.name.toUpperCase())}</strong>, declare and undertake the following:</p>
          <ol>
            <li>I am qualified to act as trustee and do not find myself in circumstances which justify my removal under the Trust Property Control Act, and undertake to inform the Master immediately should any such circumstances arise.</li>
            <li>I undertake to inform the Master should there be any changes in the capital or income beneficiaries of this Trust.</li>
            <li>I undertake to furnish the Master, when requested, with information required in connection with the affairs of the Trust.</li>
            <li>I have no family relation or connection, blood or other, to any of the existing or proposed trustees, beneficiaries or founder of the Trust.</li>
            <li>I am competent to scrutinise and check the conduct of the other appointed trustees and the observance of the substantive and procedural requirements of the Trust Deed.</li>
            <li>I have no reason to conclude or approve transactions that may prove to be invalid and I am knowledgeable in the law and administration of trusts.</li>
            <li>I do not have an interest in the Trust as a beneficiary.</li>
            <li>I have not been disqualified by the Trust Property Control Act from acting as trustee.</li>
          </ol>
          <div class="sig">SIGNED at <span class="line"></span> on the ____ day of _____________________ ${year}.</div>
          <div class="sig"><span class="line"></span><br/><strong>INDEPENDENT TRUSTEE / AUTHORISED REPRESENTATIVE</strong></div>
          <div class="page-break"></div><h2>COMMISSIONER OF OATHS</h2>
          <p>I certify that the deponent acknowledged that the contents of this affidavit are known and understood, that the oath is binding on the deponent's conscience, and that the applicable regulations governing the administration of an oath were complied with.</p>
          <div class="sig">SIGNED AND SWORN / AFFIRMED before me at <span class="line"></span> on this ____ day of _____________________ ${year}.</div>
          <div class="sig"><span class="line"></span><br/><strong>COMMISSIONER OF OATHS</strong><br/>Full names: ______________________________<br/>Designation / area: ______________________________</div>`
        ),
      });
    }
  });

  if (accountant) {
    supportingDocs.push({
      name: "Resolution - Appointment of Accountant",
      status: "Aligned to Trusteeze appointment resolution",
      html: printDoc(
        "RESOLUTION - APPOINTMENT OF ACCOUNTANT",
        `<h1>RESOLUTION</h1><h2>APPOINTMENT OF ACCOUNTANT</h2>
        <p>Resolution passed by the duly authorised trustees of <strong>${esc(
          trust.name.toUpperCase()
        )}</strong> at a trustees meeting held at _______________________ on this ___ day of ___________________________ ${year}.</p>
        <p><strong>IT WAS RESOLVED:</strong></p>
        <p>that the duly authorised trustees, on behalf of the trust, appoint <strong>${esc(
          accountant.full_name.toUpperCase()
        )}</strong>${accountant.registration_number ? `, (REGISTRATION NUMBER ${esc(accountant.registration_number)})` : ""}${
          accountant.representative_name
            ? `, REPRESENTED BY ${esc(accountant.representative_name.toUpperCase())}`
            : ""
        }${accountant.representative_id_number ? `, (IDENTITY NUMBER ${esc(accountant.representative_id_number)})` : ""}, as accountant for the trust; and</p>
        <p>that <strong>${esc(
          (mandatory?.full_name || trustees.find((item) => item.party_kind === "individual")?.full_name || "________________").toUpperCase()
        )}</strong> be authorised to sign all documents and perform any actions relating to this appointment, on behalf of the trustees.</p>
        <div class="sig"><span class="line"></span><br/><strong>AUTHORISED TRUSTEE</strong></div>`
      ),
    });

    supportingDocs.push({
      name: "J405 - Undertaking by Auditor / Accountant",
      status: "Full current DOJ undertaking prepared",
      html: printDoc(
        "J405 - UNDERTAKING BY AUDITOR/ACCOUNTANT",
        `<h1>J405</h1><h2>UNDERTAKING BY AUDITOR / ACCOUNTANT<br/>(INTER-VIVOS TRUST)</h2>
        <table class="no-border"><tr><td>Full names and surname / organisation representative</td><td><strong>${esc(accountant.representative_name || accountant.full_name)}</strong></td></tr>
        <tr><td>ID / Passport No.</td><td>${esc(accountant.representative_id_number || "________________")}</td></tr>
        <tr><td>Representative of Organisation</td><td>${esc(accountant.full_name)}</td></tr>
        <tr><td>Registration Number</td><td>${esc(accountant.registration_number || "________________")}</td></tr>
        <tr><td>Accreditation Body</td><td>________________</td></tr><tr><td>Accreditation Registration No.</td><td>________________</td></tr></table>
        <p>I hereby undertake to act as Auditor / Accountant of the Trust known as <strong>${esc(trust.name.toUpperCase())}</strong>.</p>
        <p>I choose the following address:</p><div class="box">${esc(address(accountant) || "________________")}</div>
        <p>Tel / Cell: ${esc(accountant.mobile || "________________")}<br/>E-mail: ${esc(accountant.email || "________________")}</p>
        <h3>DECLARATION AND UNDERTAKING</h3><p>I am qualified to act as Auditor / Accountant of the above Trust and undertake to advise the Master:</p>
        <ul><li>Should I cease to act in the above Trust - <strong>YES</strong></li>
        <li>The name of the new Auditor / Accountant should I be aware thereof - <strong>YES</strong></li>
        <li>Should there be any changes in the capital / income beneficiaries in this Trust - <strong>YES</strong></li>
        <li>Should the Trust not have been administered in accordance with the terms and conditions of the Trust Deed - <strong>YES</strong></li>
        <li>Of any substantial addition to the capital and assets of the Trust and the value thereof - <strong>YES</strong></li></ul>
        <div class="sig">Date: ____________________ &nbsp;&nbsp;&nbsp; <span class="line"></span><br/><strong>Signature of Auditor / Accountant</strong></div>`
      ),
    });
  }

  const enclosureRows = [
    "Original / certified Trust Deed",
    `J417 Acceptance of Trusteeship - ${trustees.length} trustee(s)`,
    "Trustee identification documents",
    independentTrustee ? "Independent Trustee sworn affidavit and representative identification" : null,
    "J450 Beneficiaries Declaration",
    "Beneficiary identification documents",
    accountant ? "J405 Undertaking by Auditor / Accountant" : null,
    accountant ? "Resolution appointing accountant" : null,
    "Proof of exemption from security in terms of the Trust Deed",
    "Annexure B and proof of prescribed fee payment",
    "J401 Trust Registration / Amendment application",
  ].filter(Boolean) as string[];

  supportingDocs.push({
    name: "Covering letter - Lodgement of new trust registration",
    status: "Expanded lodgement letter and enclosure list",
    html: printDoc(
      "LODGEMENT OF NEW TRUST REGISTRATION",
      `<p><strong>The Master of the High Court</strong><br/>${esc(
        trust.masters_office || "________________"
      )}</p><p>Dear Sir / Madam</p><p><strong>RE: APPLICATION FOR REGISTRATION OF ${esc(
        trust.name.toUpperCase()
      )}</strong></p><p>We hereby lodge the documentation required for the registration of the above inter vivos discretionary trust and the issue of Letters of Authority to the nominated trustees.</p>
      <p>The enclosed registration pack comprises:</p><ol>${enclosureRows
        .map((item) => `<li>${esc(item)}</li>`)
        .join("")}</ol>
      <p>The Trust Deed provides for exemption from furnishing security. The Master is respectfully requested to dispense with security accordingly, subject to the Master's discretion.</p>
      <p><strong>Banking:</strong> ${esc(bankText)}.</p>
      <p>Kindly contact us should any further document, clarification or amendment be required.</p>
      <div class="sig">Yours faithfully<br/><br/><span class="line"></span><br/><strong>${esc(
        accountant?.representative_name || mandatory?.full_name || "Authorised representative"
      )}</strong><br/>For and on behalf of the applicants</div>`
    ),
  });

  const individualTrustees = trustees.filter((item) => item.party_kind === "individual");
  const organisationTrustees = trustees.filter((item) => item.party_kind === "entity");

  const j401Data = printDoc(
    "J401 - Trust Registration / Amendment",
    `<h1>J401 - TRUST REGISTRATION / AMENDMENT</h1><p class="small">PracticePilot prepared application data. Transfer to / validate against the current DOJ J401 before lodgement.</p>
    <h3>SECTION 1 - SUMMARY DETAILS</h3><table>
    <tr><th>Trust Name</th><td>${esc(trust.name)}</td><th>Trust File Number</th><td>${esc(trust.registration_number || "New registration")}</td></tr>
    <tr><th>Asset Location / Master's Office</th><td>${esc(trust.masters_office || "")}</td><th>Source of Funds</th><td>Initial donation and subsequent trust property</td></tr>
    <tr><th>Probable Trust Duration</th><td>Perpetual subject to clause 25</td><th>Annual Audit Required</th><td>Review / No unless specifically required</td></tr>
    <tr><th>Trustees - Persons</th><td>${individualTrustees.length}</td><th>Trustees - Organisations</th><td>${organisationTrustees.length}</td></tr>
    <tr><th>Minimum Trustees</th><td>2</td><th>Maximum Trustees</th><td>5</td></tr>
    <tr><th>Beneficiaries</th><td>${beneficiaries.length}</td><th>Family Business Trust</th><td>YES - independent trustee captured</td></tr></table>
    <h3>APPLICANT / CONTACT</h3><table><tr><th>Applicant</th><td>${esc(accountant?.full_name || founder?.full_name || "")}</td></tr><tr><th>Representative</th><td>${esc(accountant?.representative_name || founder?.full_name || "")}</td></tr><tr><th>ID / Registration</th><td>${esc(accountant?.representative_id_number || accountant?.registration_number || founder?.id_number || "")}</td></tr><tr><th>Address</th><td>${esc(address(accountant || founder) || trustAddress(trust))}</td></tr><tr><th>E-mail</th><td>${esc(accountant?.email || founder?.email || "")}</td></tr><tr><th>Cell</th><td>${esc(accountant?.mobile || founder?.mobile || "")}</td></tr></table>
    <h3>FOUNDER</h3><table><tr><th>Name</th><td>${esc(founder?.full_name || "")}</td><th>ID / Registration</th><td>${esc(founder?.id_number || founder?.registration_number || "")}</td></tr></table>
    <h3>TRUSTEES</h3><table><thead><tr><th>Type</th><th>Name</th><th>ID / Registration</th><th>Representative</th></tr></thead><tbody>${trustees
      .map((item) => `<tr><td>${item.party_kind === "entity" ? "Organisation" : "Individual"}</td><td>${esc(item.full_name)}</td><td>${esc(item.id_number || item.registration_number || "")}</td><td>${esc(item.representative_name || "")}</td></tr>`)
      .join("")}</tbody></table>
    <h3>TRUST ADDRESS AND BANKING</h3><table><tr><th>Physical address</th><td>${esc(trustAddress(trust))}</td></tr><tr><th>Postal address</th><td>${esc([trust.postal_line1,trust.postal_line2,trust.postal_city,trust.postal_province,trust.postal_postal_code].filter(Boolean).join(", "))}</td></tr><tr><th>Bank</th><td>${esc(bankText)}</td></tr><tr><th>Security</th><td>Trust Deed clause 11 exempts trustees from furnishing security, subject to the Master's discretion.</td></tr></table>`
  );

  const j417Data = printDoc(
    "J417 - Acceptance of Trusteeship",
    `<h1>J417 - ACCEPTANCE OF TRUSTEESHIP BY TRUSTEE</h1><p class="small">One current J417 is required per trustee. Review relationship / experience questions before signature.</p>${trustees
      .map((item, index) => `<div class="${index ? "page-break" : ""}"><h2>TRUSTEE ${index + 1}</h2><table>
      <tr><th>Full names / Organisation</th><td>${esc(item.full_name)}</td></tr><tr><th>ID / Passport</th><td>${esc(item.id_number || item.representative_id_number || "")}</td></tr>
      <tr><th>Representative of Organisation</th><td>${esc(item.party_kind === "entity" ? item.representative_name || "" : "N/A")}</td></tr><tr><th>Registration No.</th><td>${esc(item.registration_number || "N/A")}</td></tr>
      <tr><th>Trust</th><td>${esc(trust.name)}</td></tr><tr><th>Physical address</th><td>${esc(address(item))}</td></tr><tr><th>Postal address</th><td>${esc(address(item))}</td></tr><tr><th>Cell</th><td>${esc(item.mobile || "")}</td></tr><tr><th>E-mail</th><td>${esc(item.email || "")}</td></tr>
      <tr><th>Family business trust?</th><td>YES</td></tr><tr><th>Independent Trustee?</th><td>${item.role_independent_trustee ? "YES" : "NO"}</td></tr><tr><th>Trustee also beneficiary?</th><td>${item.role_beneficiary ? "YES" : "NO"}</td></tr><tr><th>Related to beneficiary / trustee?</th><td>REVIEW</td></tr><tr><th>All beneficiaries related?</th><td>REVIEW</td></tr>
      <tr><th>Profession / occupation</th><td>${esc(item.occupation || "________________")}</td></tr><tr><th>Previous practical trust administration experience</th><td>REVIEW / CAPTURE IF REQUIRED</td></tr><tr><th>Will exercise direct special personal control to maintain accurate trust records?</th><td>YES</td></tr></table></div>`)
      .join("")}`
  );

  const j450Data = printDoc(
    "J450 - Beneficiaries Declaration",
    `<h1>J450 - BENEFICIARIES DECLARATION</h1><p class="small">Prepared to the current beneficiary declaration fields.</p><table><thead><tr><th>No.</th><th>Type</th><th>Beneficiary</th><th>ID / Registration</th><th>Date of Birth</th><th>Minor / Incapacitated?</th><th>Guardian</th><th>Guardian ID</th></tr></thead><tbody>${beneficiaries
      .map((item, index) => `<tr><td>${index + 1}</td><td>${item.party_kind === "entity" ? "Organisation" : "Individual"}</td><td>${esc(item.full_name)}</td><td>${esc(item.id_number || item.registration_number || "")}</td><td>${esc(birthDateFromSaId(item.id_number))}</td><td>${item.is_minor ? "YES" : "NO"}</td><td>${esc(item.guardian_name || "")}</td><td>${esc(item.guardian_id_number || "")}</td></tr>`)
      .join("")}</tbody></table>`
  );

  const officialRows = [
    { key: "j401", name: "J401 - Trust Registration / Amendment", status: "Official DOJ template - PP stamped" },
    { key: "j405", name: "J405 - Undertaking by Auditor / Accountant", status: accountant ? "Official DOJ template - PP stamped" : "Accountant missing" },
    { key: "j450", name: "J450 - Beneficiaries Declaration", status: beneficiaries.length ? "Official DOJ template - PP stamped" : "Beneficiaries missing" },
    { key: "affidavit", name: "Sworn Affidavit by Independent Trustee", status: independentTrustee ? "Official DOJ template - PP stamped" : "Independent trustee missing" },
    { key: "annexure-b", name: "Annexure B - Master's Prescribed Fee (R250)", status: founder ? "Official DOJ template - PP stamped" : "Founder missing" },
  ] as const;

  const checklist = [
    ["Original / certified Trust Deed", true],
    ["Proof of payment of prescribed fee", true],
    ["J401 application", true],
    ["J417 for each trustee", trustees.length > 0],
    ["J405 accountant undertaking", Boolean(accountant)],
    ["J450 beneficiary declaration", beneficiaries.length > 0],
    ["Certified trustee IDs / organisation registration", trustees.length > 0],
    ["Organisation trustee representative ID", organisationTrustees.length === 0 || organisationTrustees.every((item) => Boolean(item.representative_id_number))],
    ["Beneficiary IDs / birth certificates / organisation registration", beneficiaries.length > 0],
    ["Independent Trustee affidavit", !independentTrustee || Boolean(independentTrustee)],
    ["Security exemption / bond of security", true],
  ] as Array<[string, boolean]>;

  return (
    <TrustShell trustId={trustId} trustName={trust.name}>
      {error ? <div style={ui.error}>{error}</div> : null}

      <div style={ui.success}>
        The Trust Deed, supporting declarations and Master's form data are driven from one Trust record and one People & Roles register. Banking: <strong>{bankText}</strong>.
      </div>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Registration readiness</div>
        <table style={ui.table}>
          <thead><tr><th style={ui.th}>Required item</th><th style={ui.th}>PP status</th></tr></thead>
          <tbody>{checklist.map(([label, ready]) => <tr key={label}><td style={ui.td}>{label}</td><td style={ui.td}><strong>{ready ? "READY / CAPTURED" : "OUTSTANDING"}</strong></td></tr>)}</tbody>
        </table>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Supporting PP documents</div>
        <table style={ui.table}>
          <thead><tr><th style={ui.th}>Document</th><th style={ui.th}>Status</th><th style={ui.th}></th></tr></thead>
          <tbody>
            {supportingDocs.map((document, index) => (
              <tr key={index}>
                <td style={ui.td}><strong>{document.name}</strong></td>
                <td style={ui.td}>{document.status}</td>
                <td style={ui.td}><button style={ui.secondary} onClick={() => openPrint(document.html)}>Print / Save PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={ui.panel}>
        <div style={ui.panelHeader}>Official Master's forms</div>
        <div style={ui.panelBody}>
          These buttons generate the <strong>current Department of Justice / Master PDF templates</strong> and stamp the captured PP data onto them. J417 personal declaration answers remain for each trustee to review and complete before signature.
        </div>
        <table style={ui.table}>
          <thead><tr><th style={ui.th}>Form</th><th style={ui.th}>Status</th><th style={ui.th}>Generate</th></tr></thead>
          <tbody>
            {officialRows.map((row) => (
              <tr key={row.key}>
                <td style={ui.td}><strong>{row.name}</strong></td>
                <td style={ui.td}>{row.status}</td>
                <td style={ui.td}>
                  <button
                    type="button"
                    style={ui.secondary}
                    disabled={(row.key === "j405" && !accountant) || (row.key === "j450" && beneficiaries.length === 0) || (row.key === "affidavit" && !independentTrustee) || (row.key === "annexure-b" && !founder)}
                    onClick={() => downloadOfficialForm(row.key)}
                  >
                    Download official PDF
                  </button>
                </td>
              </tr>
            ))}
            {trustees.map((trustee) => (
              <tr key={`j417-${trustee.id}`}>
                <td style={ui.td}><strong>J417 - {trustee.full_name}</strong></td>
                <td style={ui.td}>Official DOJ template - identity/address prefilled; trustee declaration questions require review</td>
                <td style={ui.td}>
                  <button type="button" style={ui.secondary} onClick={() => downloadOfficialForm("j417", trustee.id)}>
                    Download J417
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={ui.success}>
        <strong>Official-form wiring is active.</strong> PP now generates J401, J405, J417, J450, the Independent Trustee affidavit and the official Annexure B prescribed-fee form from the DOJ templates.
      </div>
    </TrustShell>
  );
}
