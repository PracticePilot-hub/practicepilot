// Path: app/api/paia/manuals/[manualId]/export/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

type AnyRow = Record<string, any>;

const COVER_TEMPLATE_URL = "/Compliance/PAIA-Cover-page.png";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing server Supabase key.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as any;
}

function esc(value: any) {
  if (value === null || value === undefined || value === "") return "—";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escBlank(value: any) {
  if (value === null || value === undefined || value === "") return "";
  return esc(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function selected<T extends AnyRow>(rows: T[]) {
  return rows.filter((row) => row.is_selected !== false);
}

function categoryLabel(key: string) {
  const labels: Record<string, string> = {
    administration: "Administration and company records",
    human_resources: "Human resources records",
    operations: "Operational records",
    finances: "Finance and accounting records",
    information_technology: "Information technology records",
    statutory: "Statutory records",
    general: "General / Custom records",
    other: "Other records",
  };

  return labels[key] || key.replace(/_/g, " ");
}

function personTypeLabel(key: string) {
  const labels: Record<string, string> = {
    natural_person: "Natural persons",
    juristic_person: "Juristic persons",
    special_information: "Special personal information",
  };

  return labels[key] || key.replace(/_/g, " ");
}

function groupBy<T extends AnyRow>(rows: T[], field: string) {
  return rows.reduce((acc: Record<string, T[]>, row) => {
    const key = row[field] || "other";
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
}

async function getRows(
  supabase: any,
  table: string,
  manualId: string,
  orderBy: string | null = "sort_order"
) {
  let query = supabase.from(table).select("*").eq("manual_id", manualId);

  if (orderBy) {
    query = query.order(orderBy, { ascending: true });
  }

  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data || [];
}

function rowsTable(headers: string[], rows: string[][]) {
  return `
    <table class="records-table">
      <thead>
        <tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `
                    <tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>
                  `
                )
                .join("")
            : `
              <tr>
                <td colspan="${headers.length}">No records selected.</td>
              </tr>
            `
        }
      </tbody>
    </table>
  `;
}

function list(items: string[]) {
  if (!items.length) {
    return `<p class="muted">No items selected.</p>`;
  }

  return `<ul class="plain-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function availableOn(row: AnyRow) {
  const options: string[] = [];

  if (row.available_on_website) options.push("Website");
  if (row.available_on_request) options.push("Request");

  return options.length ? options.join(" / ") : "—";
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: manualRows, error: manualError } = await supabase
      .from("paia_manuals")
      .select("*")
      .eq("id", manualId)
      .limit(1);

    if (manualError) {
      return NextResponse.json({ error: manualError.message }, { status: 500 });
    }

    const manual = Array.isArray(manualRows) ? manualRows[0] : null;

    if (!manual) {
      return new NextResponse("PAIA manual not found.", { status: 404 });
    }

    const [
      records,
      legislation,
      purposes,
      dataSubjects,
      informationCategories,
      recipients,
      crossBorder,
      securityMeasures,
      signatories,
    ] = await Promise.all([
      getRows(supabase, "paia_manual_records", manualId),
      getRows(supabase, "paia_manual_legislation", manualId),
      getRows(supabase, "paia_manual_processing_purposes", manualId),
      getRows(supabase, "paia_manual_data_subjects", manualId),
      getRows(supabase, "paia_manual_personal_information_categories", manualId),
      getRows(supabase, "paia_manual_recipients", manualId),
      getRows(supabase, "paia_manual_cross_border", manualId, null),
      getRows(supabase, "paia_manual_security_measures", manualId),
      getRows(supabase, "paia_manual_signatories", manualId),
    ]);

    const selectedRecords = selected(records);
    const publicRecords = selectedRecords.filter(
      (row: AnyRow) => row.available_on_website === true
    );
    const selectedLegislation = selected(legislation);
    const selectedPurposes = selected(purposes);
    const selectedDataSubjects = selected(dataSubjects);
    const selectedInformationCategories = selected(informationCategories);
    const selectedRecipients = selected(recipients);
    const selectedCrossBorder = selected(crossBorder);
    const selectedSecurityMeasures = selected(securityMeasures);

    const groupedRecords = groupBy(selectedRecords, "category_key");
    const groupedInfoCategories = groupBy(
      selectedInformationCategories,
      "person_type"
    );

    const rawSignatoryRows =
      signatories.length > 0
        ? signatories
        : [
            {
              signatory_name:
                manual.information_officer_name || "Information Officer",
              signatory_capacity:
                manual.information_officer_position || "Information Officer",
              signature_label: "Signature",
              signed_at: "",
            },
          ];

    const signatoryRows = rawSignatoryRows.map((row: AnyRow) => ({
      ...row,
      signatory_name:
        row.signatory_name === "Information Officer"
          ? manual.information_officer_name || row.signatory_name
          : row.signatory_name,
      signatory_capacity:
        row.signatory_capacity === "Information Officer"
          ? manual.information_officer_position || row.signatory_capacity
          : row.signatory_capacity,
    }));

    const revisionDate =
      manual.next_review_date ||
      (() => {
        const date = new Date(manual.date_compiled || new Date());
        date.setFullYear(date.getFullYear() + 1);
        return date.toISOString().slice(0, 10);
      })();

    const contentsRows = [
      ["1", "List of acronyms and abbreviations"],
      ["2", "Purpose of PAIA manual"],
      ["3", "Details of the private body"],
      ["4", "Information Officer"],
      ["5", "Guide on how to use PAIA and how to obtain access to the Guide"],
      ["6", "Categories of records available without a formal PAIA request"],
      ["7", "Records available in terms of other legislation"],
      ["8", "Subjects and categories of records held by the private body"],
      ["9", "Processing of personal information"],
      ["10", "Recipients, cross-border transfers and security measures"],
      ["11", "Request procedure"],
      ["12", "Fees"],
      ["13", "Grounds for refusal and remedies"],
      ["14", "Availability of the manual"],
      ["15", "Updating of the manual"],
      ["16", "Approval and sign-off"],
    ];

    const acronymsHtml = `
      <h2>1. List of acronyms and abbreviations</h2>
      ${rowsTable(
        ["Acronym / abbreviation", "Meaning"],
        [
          ["CEO", "Chief Executive Officer"],
          ["DIO", "Deputy Information Officer"],
          ["IO", "Information Officer"],
          ["Minister", "Minister of Justice and Correctional Services"],
          ["PAIA", "Promotion of Access to Information Act No. 2 of 2000, as amended"],
          ["POPIA", "Protection of Personal Information Act No. 4 of 2013"],
          ["Regulator", "Information Regulator"],
          ["Republic", "Republic of South Africa"],
        ].map((row) => [esc(row[0]), esc(row[1])])
      )}
    `;

    const purposeHtml = `
      <h2>2. Purpose of PAIA manual</h2>
      <p>
        This PAIA manual is intended to assist members of the public, requesters and data subjects
        to understand the categories of records held by ${esc(manual.entity_name)}, the procedure
        to request access to records, and the manner in which personal information is processed.
      </p>
      <p>
        This manual is useful to enable a requester to:
      </p>
      <ol class="numbered-list">
        <li>check the categories of records held by the private body which are available without a person having to submit a formal PAIA request;</li>
        <li>obtain a sufficient understanding of how to make a request for access to a record of the private body;</li>
        <li>understand the subjects on which the private body holds records and the categories of records held on each subject;</li>
        <li>identify the records of the private body which are available in accordance with other South African legislation;</li>
        <li>access the relevant contact details of the Information Officer who will assist with requests for access to information;</li>
        <li>understand how to obtain access to the Guide on how to use PAIA, as updated and made available by the Information Regulator;</li>
        <li>understand the purposes for which the private body processes personal information;</li>
        <li>understand the categories of data subjects and categories of personal information processed by the private body;</li>
        <li>understand the recipients or categories of recipients to whom personal information may be supplied;</li>
        <li>understand whether personal information may be transferred or processed outside the Republic of South Africa; and</li>
        <li>understand the general security measures implemented to protect the confidentiality, integrity and availability of personal information.</li>
      </ol>
    `;

    const guideHtml = `
      <h2>5. Guide on how to use PAIA and how to obtain access to the Guide</h2>
      <p>
        The Information Regulator has, in terms of section 10(1) of PAIA, as amended,
        updated and made available the Guide on how to use PAIA. The Guide is intended
        to assist any person who wishes to exercise any right contemplated in PAIA and POPIA.
      </p>
      <p>
        The Guide is made available in an easily comprehensible form and manner, as may
        reasonably be required by a person who wishes to exercise any right contemplated
        in PAIA and POPIA.
      </p>
      <p>
        The Guide contains, among other things, information relating to:
      </p>
      <ol class="numbered-list">
        <li>the objects of PAIA and POPIA;</li>
        <li>the contact details of Information Officers and Deputy Information Officers of public and private bodies, where applicable;</li>
        <li>the manner and form of a request for access to records of public and private bodies;</li>
        <li>the assistance available from Information Officers in terms of PAIA and POPIA;</li>
        <li>the assistance available from the Information Regulator;</li>
        <li>all remedies in law available regarding an act or failure to act in respect of a right or duty conferred or imposed by PAIA and POPIA;</li>
        <li>the manner of lodging a complaint to the Information Regulator;</li>
        <li>the manner of approaching a court with jurisdiction where applicable;</li>
        <li>the provisions requiring public and private bodies to compile manuals and make them available;</li>
        <li>the voluntary disclosure of categories of records by public and private bodies;</li>
        <li>the notices and regulations regarding fees payable in relation to requests for access; and</li>
        <li>the regulations made in terms of PAIA.</li>
      </ol>
      <p>
        Members of the public can inspect or make copies of the Guide from the offices
        of public and private bodies, including the office of the Information Regulator,
        during normal working hours, where applicable.
      </p>
      <p>
        The Guide may also be obtained from the Information Regulator, including through
        the Information Regulator's official website or by request to the Information Regulator.
      </p>
      <p>
        A copy of the Guide may also be requested from the Information Officer of
        ${esc(manual.entity_name)} using the contact details set out in this manual.
      </p>
    `;

    const recordsWithoutRequestHtml = `
      <h2>6. Categories of records available without a formal PAIA request</h2>
      <p>
        Certain records may be made available without a requester having to submit a formal
        PAIA request. These records may, where applicable, be available on the website of
        the private body, by inspection at the offices of the private body, or by another
        automatic access method adopted by the private body.
      </p>
      ${
        publicRecords.length > 0
          ? rowsTable(
              ["Category of records", "Method of access", "Notes"],
              publicRecords.map((row: AnyRow) => [
                esc(row.record_name),
                "Website / publicly available",
                escBlank(row.notes),
              ])
            )
          : `
            <p>
              No categories of records are marked as automatically available without a formal
              PAIA request, other than records that may be published on the website or otherwise
              made publicly available by ${esc(manual.entity_name)} from time to time.
            </p>
          `
      }
      <p>
        All other records listed in this manual are records held by the private body and may be
        requested through the formal PAIA request procedure, subject to PAIA, POPIA, applicable
        fees, verification requirements and any lawful ground for refusal.
      </p>
    `;

    const requestProcedureHtml = `
      <h2>11. Request procedure</h2>
      <p>
        Any requester who wishes to request access to a record of ${esc(manual.entity_name)}
        must complete the prescribed PAIA request form and submit it to the Information Officer.
        The request must contain sufficient detail to enable the Information Officer to identify
        the requester, the requested record, the form of access required, and the right that the
        requester seeks to exercise or protect.
      </p>
      <p>
        In terms of PAIA, a requester must be given access to a record of a private body if:
      </p>
      <ol class="numbered-list">
        <li>the record is required for the exercise or protection of any rights;</li>
        <li>the requester complies with the procedural requirements in PAIA relating to a request for access to that record; and</li>
        <li>access to that record is not refused in terms of any ground for refusal contemplated in PAIA.</li>
      </ol>
      <p>
        Requests must be submitted to the Information Officer using the contact details set out
        in this manual. The requester may also be required to pay the prescribed request fee and
        any applicable access fee before access is granted.
      </p>
      <p>
        ${esc(manual.entity_name)} will process PAIA requests within the periods prescribed by
        PAIA, subject to any extension permitted by the Act.
      </p>
    `;

    const feesHtml = `
      <h2>12. Fees</h2>
      <p>
        A requester may be required to pay the prescribed fees as set out in PAIA and its
        regulations. These may include a request fee, search and preparation fees, reproduction
        fees and access fees, depending on the nature of the request and the form of access required.
      </p>
      <p>
        The Information Officer may require the requester to pay the prescribed request fee,
        where applicable, before further processing the request.
      </p>
      <p>
        Personal requesters are not required to pay a request fee for access to records containing
        their own personal information, but access or reproduction fees may still apply where permitted.
      </p>
      <p>
        A fee for a copy of this manual, as contemplated in the PAIA regulations, may be payable
        per each A4-size photocopy made where a physical copy is requested.
      </p>
    `;

    const refusalHtml = `
      <h2>13. Grounds for refusal and remedies</h2>
      <p>
        Access to a record may be refused on any ground permitted under PAIA. These grounds include,
        among others, the protection of privacy of third parties, commercial information of third parties,
        confidential information, safety of individuals and property, legally privileged records, research
        information and records that are otherwise protected from disclosure under PAIA.
      </p>
      <p>
        If a request for access is refused, the requester will be informed of the decision and the reasons
        for refusal. A requester may lodge a complaint with the Information Regulator or approach a court
        with jurisdiction, as provided for in PAIA.
      </p>
      <p>
        The remedies available to a requester include any complaint, application or court procedure made
        available in terms of PAIA, POPIA and applicable law.
      </p>
    `;

    const availabilityHtml = `
      <h2>14. Availability of the manual</h2>
      <p>
        A copy of this manual is available:
      </p>
      <ol class="numbered-list">
        <li>on the website of ${esc(manual.entity_name)}, where applicable;</li>
        <li>at the head office or principal place of business of ${esc(manual.entity_name)} for public inspection during normal business hours, where applicable;</li>
        <li>to any person upon request and upon payment of a reasonable prescribed fee, where applicable; and</li>
        <li>to the Information Regulator upon request.</li>
      </ol>
      <p>
        This manual may be made available electronically or in printed format, depending on the
        manner of request and availability.
      </p>
    `;

    const updatingHtml = `
      <h2>15. Updating of the manual</h2>
      <p>
        The head of ${esc(manual.entity_name)} or the authorised Information Officer will update
        this manual on a regular basis, or whenever material changes occur to the private body,
        its records, its processing of personal information, its contact details, applicable legislation,
        or any other information contained in this manual.
      </p>
      <p>
        Date of compilation: ${esc(formatDate(manual.date_compiled))}
      </p>
      <p>
        Date of revision / next review: ${esc(formatDate(revisionDate))}
      </p>
    `;

    const coverHtml = `
      <section class="cover-template-page page-break-after">
        <img class="cover-template-image" src="${COVER_TEMPLATE_URL}" alt="PAIA cover template" />

        ${
          manual.logo_url
            ? `
              <div class="cover-logo-slot">
                <img src="${esc(manual.logo_url)}" alt="Client logo" />
              </div>
            `
            : `
              <div class="cover-logo-slot cover-logo-placeholder">
                ${esc(manual.entity_name)}
              </div>
            `
        }

        <div class="cover-detail-block">
          <div class="cover-detail-title">${esc(manual.entity_name)}</div>

          <div class="cover-detail-grid">
            <div>
              <span>Registration number</span>
              <strong>${esc(manual.entity_registration_number)}</strong>
            </div>
            <div>
              <span>Entity type</span>
              <strong>${esc(manual.entity_type)}</strong>
            </div>
            <div>
              <span>Information Officer</span>
              <strong>${esc(manual.information_officer_name)}</strong>
            </div>
            <div>
              <span>Telephone</span>
              <strong>${esc(manual.telephone || manual.information_officer_telephone)}</strong>
            </div>
            <div>
              <span>Website</span>
              <strong>${esc(manual.website)}</strong>
            </div>
            <div>
              <span>Version / date</span>
              <strong>${esc(manual.version_number || "1.0")} · ${esc(formatDate(manual.date_compiled))}</strong>
            </div>
          </div>
        </div>
      </section>
    `;

    const recordsHtml = Object.keys(groupedRecords)
      .map((category) => {
        const rows = groupedRecords[category].map((row: AnyRow) => [
          esc(row.record_name),
          esc(availableOn(row)),
          escBlank(row.notes),
        ]);

        return `
          <h3>${esc(categoryLabel(category))}</h3>
          ${rowsTable(["Record category", "Available on", "Notes"], rows)}
        `;
      })
      .join("");

    const infoCategoriesHtml = Object.keys(groupedInfoCategories)
      .map((personType) => {
        return `
          <h3>${esc(personTypeLabel(personType))}</h3>
          ${list(groupedInfoCategories[personType].map((row: AnyRow) => esc(row.category_name)))}
        `;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PAIA Manual - ${esc(manual.entity_name)}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .toolbar {
      max-width: 920px;
      margin: 18px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .toolbar a,
    .toolbar button {
      border: 1px solid #0f3b66;
      background: #0f3b66;
      color: white;
      padding: 9px 13px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .toolbar a:first-child {
      background: #ffffff;
      color: #0f3b66;
    }

    .sheet {
      width: 920px;
      min-height: 1280px;
      margin: 0 auto 18px auto;
      background: white;
      padding: 56px 64px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
      position: relative;
    }

    .cover-template-page {
      width: 920px;
      height: 1280px;
      margin: 0 auto 18px auto;
      background: white;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
      position: relative;
      overflow: hidden;
    }

    .cover-template-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      z-index: 1;
    }

    .cover-logo-slot {
      position: absolute;
      top: 30px;
      left: 50%;
      transform: translateX(-50%);
      width: 270px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      color: #0f3b66;
      font-size: 12px;
      font-weight: 800;
      text-align: center;
    }

    .cover-logo-slot img {
      max-width: 240px;
      max-height: 64px;
      object-fit: contain;
      display: block;
    }

    .cover-logo-placeholder {
      opacity: 0.72;
      letter-spacing: 0.02em;
    }

    .cover-detail-block {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      min-height: 210px;
      padding: 34px 70px 42px 70px;
      background: rgba(15, 67, 94, 0.86);
      color: #ffffff;
      z-index: 2;
    }

    .cover-detail-title {
      font-size: 22px;
      font-weight: 900;
      margin-bottom: 16px;
      letter-spacing: 0.01em;
    }

    .cover-detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 32px;
      row-gap: 10px;
      font-size: 12px;
      line-height: 1.3;
    }

    .cover-detail-grid span {
      display: block;
      opacity: 0.74;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
    }

    .cover-detail-grid strong {
      display: block;
      font-size: 12px;
      font-weight: 750;
    }

    h2 {
      margin: 0 0 14px 0;
      font-size: 18px;
      color: #0c2948;
      padding-bottom: 8px;
      border-bottom: 2px solid #d8e3ef;
    }

    h3 {
      margin: 12px 0 6px 0;
      font-size: 13px;
      color: #0c2948;
    }

    h2,
    h3 {
      break-after: avoid;
      page-break-after: avoid;
    }

    p,
    li {
      orphans: 3;
      widows: 3;
    }

    tr,
    .signature,
    .approval-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .records-table,
    .details {
      break-inside: auto;
      page-break-inside: auto;
    }

    p {
      font-size: 12px;
      line-height: 1.55;
      margin: 0 0 9px 0;
    }

    .muted {
      color: #64748b;
    }

    .details,
    .records-table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 12px 0;
      font-size: 11.5px;
      table-layout: fixed;
    }

    .details th {
      width: 230px;
    }

    .details th,
    .records-table th {
      text-align: left;
      vertical-align: top;
      color: #334155;
      background: #f8fbff;
      border: 1px solid #d8e3ef;
      padding: 5px 6px;
      font-weight: 800;
    }

    .details td,
    .records-table td {
      border: 1px solid #d8e3ef;
      padding: 5px 6px;
      vertical-align: top;
      word-wrap: break-word;
    }

    .plain-list,
    .numbered-list {
      margin: 5px 0 10px 0;
      padding-left: 18px;
      font-size: 12px;
      line-height: 1.45;
    }

    .plain-list li,
    .numbered-list li {
      margin-bottom: 3px;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 28px;
    }

    .signature {
      padding-top: 34px;
      border-top: 1px solid #111827;
      font-size: 12px;
    }

    .page-break-after {
      page-break-after: always;
    }

    .approval-block {
      break-before: page;
      page-break-before: always;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 0;
    }

    .approval-block h2 {
      break-after: avoid;
      page-break-after: avoid;
    }

    .signature-grid {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    @media print {
      html,
      body {
        background: #ffffff !important;
      }

      .toolbar {
        display: none !important;
      }

      .sheet,
      .cover-template-page {
        width: 100%;
        min-height: auto;
        margin: 0;
        box-shadow: none;
        background: #ffffff !important;
      }

      .sheet {
        padding: 14mm 14mm 15mm 14mm;
      }

      .cover-template-page {
        padding: 0;
        height: 267mm;
      }

      .approval-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a href="/compliance/paia/${esc(manualId)}">← Back to working file</a>
    <a href="/api/paia/manuals/${esc(manualId)}/pdf">Download PDF</a>
  </div>

  ${coverHtml}

  <section class="sheet page-break-after">
    <h2>Contents</h2>
    ${rowsTable(["Section", "Description"], contentsRows.map((row) => [esc(row[0]), esc(row[1])]))}
  </section>

  <section class="sheet">
    ${acronymsHtml}

    ${purposeHtml}

    <h2>3. Details of the private body</h2>
    ${rowsTable(
      ["Detail", "Information"],
      [
        ["Name of private body", esc(manual.entity_name)],
        ["Registration number", esc(manual.entity_registration_number)],
        ["Entity type", esc(manual.entity_type)],
        ["Industry / nature of business", esc(manual.industry)],
        ["Website", esc(manual.website)],
        ["Telephone number", esc(manual.telephone)],
        ["Physical address", esc(manual.physical_address)],
        ["Postal address", esc(manual.postal_address)],
      ]
    )}

    <h2>4. Information Officer</h2>
    ${rowsTable(
      ["Detail", "Information"],
      [
        ["Information Officer", esc(manual.information_officer_name)],
        ["Position", esc(manual.information_officer_position)],
        ["Email address", esc(manual.information_officer_email)],
        ["Telephone number", esc(manual.information_officer_telephone)],
      ]
    )}

    ${guideHtml}

    ${recordsWithoutRequestHtml}

    <h2>7. Records available in terms of other legislation</h2>
    ${rowsTable(
      ["Legislation", "Records / comments"],
      selectedLegislation.map((row: AnyRow) => [
        esc(row.legislation_name),
        esc(row.applicable_records),
      ])
    )}

    <h2>8. Subjects and categories of records held by the private body</h2>
    ${recordsHtml}

    <h2>9. Processing of personal information</h2>
    <h3>Purposes of processing</h3>
    ${list(selectedPurposes.map((row: AnyRow) => esc(row.purpose_name)))}

    <h3>Categories of data subjects</h3>
    ${rowsTable(
      ["Data subject", "Information processed"],
      selectedDataSubjects.map((row: AnyRow) => [
        esc(row.subject_name),
        esc(row.information_processed),
      ])
    )}

    ${infoCategoriesHtml}

    <h2>10. Recipients of personal information</h2>
    ${rowsTable(
      ["Recipient", "Information shared"],
      selectedRecipients.map((row: AnyRow) => [
        esc(row.recipient_name),
        esc(row.information_shared),
      ])
    )}

    <h2>10.1 Cross-border transfers</h2>
    ${list(selectedCrossBorder.map((row: AnyRow) => esc(row.description)))}

    <h2>10.2 Security measures</h2>
    ${list(selectedSecurityMeasures.map((row: AnyRow) => esc(row.measure_name)))}

    ${requestProcedureHtml}

    ${feesHtml}

    ${refusalHtml}

    ${availabilityHtml}

    ${updatingHtml}

    <div class="approval-block">
      <h2>16. Approval and sign-off</h2>
      <p>
        This manual has been prepared and approved by the private body and will be reviewed periodically.
      </p>

      <h3>Document sign-off</h3>
      ${rowsTable(
        ["Document control", "Details"],
        [
          ["Prepared for", esc(manual.entity_name)],
          ["Prepared by", esc(manual.prepared_by || "Bizzacc Menlyn (Pty) Ltd")],
          ["Reviewed by", esc(manual.reviewed_by || "—")],
          ["Approved by", esc(manual.approved_by || "—")],
          ["Date compiled", esc(formatDate(manual.date_compiled))],
          ["Date of revision / next review", esc(formatDate(revisionDate))],
          ["Version", esc(manual.version_number || "1.0")],
        ]
      )}

      <p class="muted">
        The Information Officer / authorised representative signs this manual on behalf of the private body.
      </p>

      <div class="signature-grid">
        ${signatoryRows
          .map(
            (row: AnyRow) => `
              <div class="signature">
                <strong>${esc(row.signatory_name)}</strong><br />
                ${esc(row.signatory_capacity)}<br />
                Date: ${escBlank(formatDate(row.signed_at))}
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  </section>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to export PAIA manual." },
      { status: 500 }
    );
  }
}
