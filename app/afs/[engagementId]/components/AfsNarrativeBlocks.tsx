"use client";

import React from "react";

export type DirectorsReportSectionKey =
  | "generalReview"
  | "incorporation"
  | "natureBusiness"
  | "reviewActivities"
  | "financialResults"
  | "eventsAfter"
  | "dividends"
  | "shareCapital"
  | "directors"
  | "secretary"
  | "externalAccountant"
  | "interestContracts"
  | "borrowingLimitations"
  | "shareholder"
  | "goingConcern"
  | "liquiditySolvency"
  | "litigation"
  | "socialEthics"
  | "subsidiaries"
  | "associates"
  | "jointVentures"
  | "nonCurrentAssets"
  | "authorisation"
  | "other1"
  | "other2"
  | "other3"
  | "other4"
  | "other5"
  | "other6"
  | "other7"
  | "other8"
  | "other9"
  | "other10";

export type DirectorsReportTextOverrides = Partial<
  Record<DirectorsReportSectionKey, { title?: string | null; text?: string | null }>
>;

type NarrativeContext = Record<string, any> & {
  clientName?: string | null;
  entityType?: string | null;
  yearEnd?: string | null;
  registrationNumber?: string | null;
  bodyLabel?: string | null;
  bodyLabelCapitalised?: string | null;
  roleLabel?: string | null;
  framework?: string | null;
  approvalDate?: string | null;
  compilationDate?: string | null;
  practitionerFirm?: string | null;
  practitionerName?: string | null;
  practitionerDesignation?: string | null;
  practitionerLogoUrl?: string | null;
  practitionerFooterLogoUrl?: string | null;
  logo_url?: string | null;
  footer_logo_url?: string | null;
  governing_body_logo_url?: string | null;
  second_governing_body_logo_url?: string | null;
  practitionerAddressLines?: string | null;
  practitionerTelephone?: string | null;
  practitionerEmail?: string | null;
  practitionerWebsite?: string | null;
  governingBodyName?: string | null;
  governingBodyRegistrationNumber?: string | null;
  governingBodyLogoUrl?: string | null;
  secondGoverningBodyName?: string | null;
  secondGoverningBodyRegistrationNumber?: string | null;
  secondGoverningBodyLogoUrl?: string | null;
  practitionerFooterText?: string | null;
  natureOfBusiness?: string | null;
  country?: string | null;
  directors?: any[];
  directorsReportTexts?: DirectorsReportTextOverrides;
};

function value(context: NarrativeContext, key: string, fallback = "") {
  const item = context?.[key];
  if (item === null || item === undefined || String(item).trim() === "") return fallback;
  return String(item);
}

function bodyLabel(context: NarrativeContext) {
  return value(context, "bodyLabel", "directors");
}

function bodyLabelCapitalised(context: NarrativeContext) {
  return value(context, "bodyLabelCapitalised", "Directors");
}

function roleLabel(context: NarrativeContext) {
  return value(context, "roleLabel", "Directors");
}

function isCloseCorporation(context: NarrativeContext) {
  const entity = value(context, "entityType", "").toLowerCase();
  return entity.includes("close") || entity.includes("cc") || entity.includes("close corporation");
}

function isTrust(context: NarrativeContext) {
  const entity = value(context, "entityType", "").toLowerCase();
  return entity.includes("trust");
}

function governingAct(context: NarrativeContext) {
  if (isCloseCorporation(context)) return "the Close Corporations Act of South Africa";
  if (isTrust(context)) return "the applicable trust deed and legislation";
  return "the Companies Act of South Africa";
}

function frameworkLabel(context: NarrativeContext) {
  return value(context, "framework", "the applicable financial reporting framework");
}

function singleBodyLabel(context: NarrativeContext) {
  const body = bodyLabel(context).toLowerCase();
  if (body.includes("member")) return "member";
  if (body.includes("trustee")) return "trustee";
  if (body.includes("director")) return "director";
  return body.replace(/s$/, "") || "director";
}

function tokenise(text: string, context: NarrativeContext) {
  return String(text || "")
    .replaceAll("{clientName}", value(context, "clientName", "the entity"))
    .replaceAll("{yearEnd}", value(context, "yearEnd", "the reporting date"))
    .replaceAll("{framework}", value(context, "framework", "the applicable financial reporting framework"))
    .replaceAll("{bodyLabel}", bodyLabel(context))
    .replaceAll("{body}", bodyLabel(context))
    .replaceAll("{bodyLabelCapitalised}", bodyLabelCapitalised(context))
    .replaceAll("{roleLabel}", roleLabel(context))
    .replaceAll("{approvalDate}", value(context, "approvalDate", "________________"))
    .replaceAll("{compilationDate}", value(context, "compilationDate", "________________"))
    .replaceAll("{practitionerFirm}", value(context, "practitionerFirm", "the practitioner"))
    .replaceAll("{practitionerName}", value(context, "practitionerName", "the practitioner"))
    .replaceAll("{practitionerDesignation}", value(context, "practitionerDesignation", ""))
    .replaceAll("{natureOfBusiness}", value(context, "natureOfBusiness", "the principal activities of the entity"))
    .replaceAll("{country}", value(context, "country", "South Africa"));
}

function paragraphs(text: string, context: NarrativeContext) {
  return tokenise(text, context)
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function personName(person: any) {
  return (
    person?.full_name ||
    person?.person_name ||
    person?.name ||
    person?.display_name ||
    "Name not captured"
  );
}

function personRole(person: any) {
  return (
    person?.designation ||
    person?.capacity ||
    person?.role ||
    person?.type ||
    person?.person_type ||
    "Director"
  );
}

function defaultText(context: NarrativeContext): DirectorsReportTextOverrides {
  const client = value(context, "clientName", "The entity");
  const yearEnd = value(context, "yearEnd", "the reporting date");
  const framework = value(context, "framework", "the applicable financial reporting framework");
  const body = bodyLabel(context);
  const bodyCap = bodyLabelCapitalised(context);
  const nature = value(context, "natureOfBusiness", "the principal activities disclosed in these annual financial statements");
  const approval = value(context, "approvalDate", "________________");

  return {
    generalReview: {
      title: "General review",
      text: `The ${body} submit their report on the annual financial statements of {clientName} for the year ended {yearEnd}.`,
    },
    incorporation: {
      title: "Incorporation",
      text: `${client} is incorporated in {country}.`,
    },
    natureBusiness: {
      title: "Nature of business",
      text: `The principal activities of the entity are ${nature}.`,
    },
    reviewActivities: {
      title: "Review of activities",
      text: "The entity continued to conduct its principal activities during the year under review. The operating results and the state of affairs of the entity are fully set out in the attached annual financial statements and, in the opinion of the {body}, do not require further comment except as disclosed in this report. There were no major changes in the nature of the business or operations during the year, unless otherwise disclosed.",
    },
    financialResults: {
      title: "Financial results",
      text: `The financial results of the entity for the year ended ${yearEnd} are set out in these annual financial statements. The annual financial statements have been prepared in accordance with ${framework}. The ${body} have considered the results for the year under review, the financial position at year end and the related disclosures, and are satisfied that these annual financial statements fairly reflect the affairs of the entity based on the accounting records and information available to them.`,
    },
    eventsAfter: {
      title: "Events after the reporting date",
      text: `All events subsequent to the reporting date and for which the applicable financial reporting framework requires adjustment or disclosure have been considered. The ${body} are not aware of any material matter or circumstance arising since the end of the financial year and up to the date of approval of these annual financial statements that requires further adjustment or disclosure.`,
    },
    dividends: {
      title: "Dividends",
      text: "No dividends were declared or proposed during the year under review, unless otherwise disclosed in these annual financial statements.",
    },
    shareCapital: {
      title: "Authorised and issued share capital",
      text: "There have been no changes to the authorised or issued share capital during the year under review, unless otherwise disclosed in these annual financial statements.",
    },
    directors: {
      title: roleLabel(context),
      text: "The directors in office during the year and up to the date of this report are set out below.",
    },
    secretary: {
      title: "Secretary",
      text: "The company secretary details are disclosed where applicable.",
    },
    externalAccountant: {
      title: "External accountant / compiler",
      text: "The annual financial statements were compiled by the independent compiler disclosed in the practitioner’s compilation report.",
    },
    interestContracts: {
      title: "Interest in contracts",
      text: `No material contracts in which ${body} had an interest and which significantly affected the affairs of the entity were entered into during the year, unless otherwise disclosed.`,
    },
    borrowingLimitations: {
      title: "Borrowing limitations",
      text: "Borrowing powers are exercised by the directors in terms of the applicable constitutional documents and relevant legislation.",
    },
    shareholder: {
      title: "Shareholder",
      text: "There have been no changes in ownership during the current financial year, unless otherwise disclosed.",
    },
    goingConcern: {
      title: "Going concern",
      text: "The annual financial statements have been prepared on the basis of accounting policies applicable to a going concern. This basis presumes that funds will be available to finance future operations and that the realisation of assets and settlement of liabilities, contingent obligations and commitments will occur in the ordinary course of business. The {body} have reviewed the entity’s budgets, expected cash flows and available resources and are satisfied that the entity has adequate resources to continue in operational existence for the foreseeable future, unless otherwise disclosed in these annual financial statements.",
    },
    liquiditySolvency: {
      title: "Liquidity and solvency",
      text: `The ${body} have considered the liquidity and solvency position of the entity, including available cash resources, forecast commitments and liabilities falling due after the reporting date. Based on the information available to them, the ${body} are satisfied that the entity is able to meet its obligations as they become due in the ordinary course of business, unless otherwise disclosed in these annual financial statements.`,
    },
    litigation: {
      title: "Litigation",
      text: "The directors are not aware of any material legal or arbitration proceedings, pending or threatened, which may have a material effect on the financial position of the entity.",
    },
    socialEthics: {
      title: "Social and ethics committee",
      text: "The social and ethics committee disclosure is included where applicable.",
    },
    subsidiaries: {
      title: "Interest in subsidiaries",
      text: "Details of interests in subsidiaries are disclosed where applicable.",
    },
    associates: {
      title: "Interest in associates",
      text: "Details of interests in associates are disclosed where applicable.",
    },
    jointVentures: {
      title: "Joint ventures",
      text: "Details of interests in joint ventures are disclosed where applicable.",
    },
    nonCurrentAssets: {
      title: "Non-current assets",
      text: "Details of material non-current assets are disclosed in the notes to the annual financial statements.",
    },
    authorisation: {
      title: "Authorisation of annual financial statements",
      text: `The annual financial statements were authorised for issue by the ${body} on ${approval}.`,
    },
    other1: { title: "Other matter 1", text: "" },
    other2: { title: "Other matter 2", text: "" },
    other3: { title: "Other matter 3", text: "" },
    other4: { title: "Other matter 4", text: "" },
    other5: { title: "Other matter 5", text: "" },
    other6: { title: "Other matter 6", text: "" },
    other7: { title: "Other matter 7", text: "" },
    other8: { title: "Other matter 8", text: "" },
    other9: { title: "Other matter 9", text: "" },
    other10: { title: "Other matter 10", text: "" },
  };
}

export function buildDefaultDirectorsReportTexts(
  context: NarrativeContext
): DirectorsReportTextOverrides {
  return defaultText(context || {});
}

const directorsReportOrder: Array<{
  key: DirectorsReportSectionKey;
  option: string;
}> = [
  { key: "generalReview", option: "directorsReportGeneralReview" },
  { key: "incorporation", option: "directorsReportIncorporation" },
  { key: "natureBusiness", option: "directorsReportNatureBusiness" },
  { key: "reviewActivities", option: "directorsReportReviewActivities" },
  { key: "financialResults", option: "directorsReportFinancialResults" },
  { key: "eventsAfter", option: "directorsReportEventsAfter" },
  { key: "dividends", option: "directorsReportDividends" },
  { key: "shareCapital", option: "directorsReportShareCapital" },
  { key: "directors", option: "directorsReportDirectors" },
  { key: "secretary", option: "directorsReportSecretary" },
  { key: "externalAccountant", option: "directorsReportExternalAccountant" },
  { key: "interestContracts", option: "directorsReportInterestContracts" },
  { key: "borrowingLimitations", option: "directorsReportBorrowingLimitations" },
  { key: "shareholder", option: "directorsReportShareholder" },
  { key: "goingConcern", option: "directorsReportGoingConcern" },
  { key: "liquiditySolvency", option: "directorsReportLiquiditySolvency" },
  { key: "litigation", option: "directorsReportLitigation" },
  { key: "socialEthics", option: "directorsReportSocialEthics" },
  { key: "subsidiaries", option: "directorsReportSubsidiaries" },
  { key: "associates", option: "directorsReportAssociates" },
  { key: "jointVentures", option: "directorsReportJointVentures" },
  { key: "nonCurrentAssets", option: "directorsReportNonCurrentAssets" },
  { key: "authorisation", option: "directorsReportAuthorisation" },
  { key: "other1", option: "directorsReportOther1" },
  { key: "other2", option: "directorsReportOther2" },
  { key: "other3", option: "directorsReportOther3" },
  { key: "other4", option: "directorsReportOther4" },
  { key: "other5", option: "directorsReportOther5" },
  { key: "other6", option: "directorsReportOther6" },
  { key: "other7", option: "directorsReportOther7" },
  { key: "other8", option: "directorsReportOther8" },
  { key: "other9", option: "directorsReportOther9" },
  { key: "other10", option: "directorsReportOther10" },
];

export function getActiveDirectorsReportSectionKeys(
  context: NarrativeContext,
): DirectorsReportSectionKey[] {
  return directorsReportOrder
    .filter(({ key, option }) => {
      if (!context?.[option]) return false;

      const defaults = buildDefaultDirectorsReportTexts(context || {});
      const texts = { ...defaults, ...(context?.directorsReportTexts || {}) };
      const item = texts[key] || defaults[key];
      const text = item?.text || "";

      return !(!text.trim() && key.toString().startsWith("other"));
    })
    .map(({ key }) => key);
}

export function DirectorsReportBlock({
  context,
  startNumber = 0,
  sectionKeys,
}: {
  context: NarrativeContext;
  startNumber?: number;
  sectionKeys?: DirectorsReportSectionKey[];
}) {
  const defaults = buildDefaultDirectorsReportTexts(context || {});
  const texts = { ...defaults, ...(context?.directorsReportTexts || {}) };
  let number = startNumber;

  return (
    <div>
      {directorsReportOrder.map(({ key, option }) => {
        if (!context?.[option]) return null;
        if (sectionKeys && !sectionKeys.includes(key)) return null;

        const item = texts[key] || defaults[key];
        const text = item?.text || "";
        const title = item?.title || defaults[key]?.title || "";

        if (!text.trim() && key.toString().startsWith("other")) return null;

        number += 1;

        return (
          <section key={key} style={styles.reportSection}>
            <h2 style={styles.reportHeading}>{number}. {title}</h2>
            {key === "directors" ? <DirectorsTable context={context} /> : null}
            {paragraphs(text, context).map((paragraph, index) => (
              <p key={`${key}-${index}`} style={styles.paragraph}>{paragraph}</p>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function DirectorsTable({ context }: { context: NarrativeContext }) {
  const directors = Array.isArray(context?.directors) ? context.directors : [];
  if (!directors.length) return null;

  return (
    <table style={styles.directorsTable}>
      <thead>
        <tr>
          <th style={styles.thLeft}>{roleLabel(context).replace(/s$/, "")}</th>
          <th style={styles.thLeft}>Designation</th>
          <th style={styles.thLeft}>Nationality</th>
        </tr>
      </thead>
      <tbody>
        {directors.map((person, index) => (
          <tr key={`${personName(person)}-${index}`}>
            <td style={styles.tdLeft}>{personName(person)}</td>
            <td style={styles.tdLeft}>{personRole(person)}</td>
            <td style={styles.tdLeft}>{person?.nationality || ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DirectorsResponsibilitiesBlock({ context }: { context: NarrativeContext }) {
  const body = bodyLabel(context);
  const bodyCap = bodyLabelCapitalised(context);
  const singularBody = singleBodyLabel(context);
  const framework = frameworkLabel(context);
  const act = governingAct(context);
  const approvalDate = value(context, "approvalDate", "________________");
  const isCc = isCloseCorporation(context);
  const signatories = Array.isArray(context?.directors) && context.directors.length
    ? context.directors
    : [{ name: "" }, { name: "" }];

  return (
    <section>
      <p style={styles.paragraph}>
        The {body} are required in terms of {act} to maintain adequate accounting records and are responsible for the content and integrity of the annual financial statements and related financial information included in this report. It is their responsibility to ensure that the annual financial statements fairly present the financial position of the entity as at the end of the financial year and the results of its operations and cash flows for the year then ended, in conformity with {framework}.
      </p>

      <p style={styles.paragraph}>
        The annual financial statements have been prepared on the going concern basis and are based on appropriate accounting policies consistently applied and supported by reasonable and prudent judgements and estimates. The {body} are responsible for selecting and applying these accounting policies, making accounting estimates that are reasonable in the circumstances, and ensuring that the annual financial statements are prepared from accounting records and supporting information that are complete and reliable.
      </p>

      <p style={styles.paragraph}>
        The {body} acknowledge that they are ultimately responsible for the system of internal financial control established by the entity and place considerable importance on maintaining a strong control environment. To enable the {body} to meet these responsibilities, the {body} set standards for internal control aimed at reducing the risk of error, fraud or loss in a cost-effective manner. These standards include the proper delegation of responsibilities, effective accounting procedures, adequate segregation of duties where practical, and controls designed to safeguard, verify and maintain accountability over the assets of the entity.
      </p>

      <p style={styles.paragraph}>
        These controls and procedures are monitored as considered appropriate in the circumstances. The {body} are responsible for taking reasonable steps to prevent and detect fraud and other irregularities and for ensuring that the entity conducts its affairs in accordance with applicable laws and regulations. While no system of internal control can provide absolute assurance against material misstatement or loss, the {body} are of the opinion, based on the information and explanations available to them, that the system of internal control provides reasonable assurance that the financial records may be relied upon for the preparation of the annual financial statements.
      </p>

      <p style={styles.paragraph}>
        In preparing the annual financial statements, the {body} are responsible for assessing the entity’s ability to continue as a going concern, disclosing matters related to going concern where applicable, and using the going concern basis of accounting unless the {body} either intend to liquidate the entity or to cease operations, or have no realistic alternative but to do so. The {body} have reviewed the entity’s cash flow forecast, available resources and expected future operations and have no reason to believe that the entity will not continue as a going concern for the foreseeable future, unless otherwise disclosed in these annual financial statements.
      </p>

      {isCc ? (
        <p style={styles.paragraph}>
          The member confirms, to the best of their knowledge and belief and based on the information available at the date of approval, that the close corporation has maintained accounting records as required by the Close Corporations Act of South Africa and that the annual financial statements are in agreement with those records. The member has also considered the solvency and liquidity position of the close corporation at the reporting date.
        </p>
      ) : (
        <p style={styles.paragraph}>
          The {body} are responsible for ensuring that the entity complies with the requirements of the Companies Act of South Africa insofar as they relate to annual financial statements. The {body} have considered the solvency and liquidity position of the entity and are satisfied that the entity will be able to meet its obligations as they become due in the ordinary course of business, unless otherwise disclosed in this report.
        </p>
      )}

      <p style={styles.paragraph}>
        The independent practitioner’s report, where applicable, is presented separately and should be read together with these annual financial statements. The practitioner’s responsibilities are limited to the engagement described in that report and do not reduce the responsibility of the {body} for the annual financial statements.
      </p>

      <p style={styles.paragraph}>
        The annual financial statements set out in this report were approved by the {body} on {approvalDate} and are signed on their behalf by:
      </p>

      <div style={styles.signatureGrid}>
        {signatories.map((person, index) => (
          <div key={index} style={styles.signatureBlock}>
            <div style={styles.signatureLine} />
            <div>{personName(person) !== "Name not captured" ? personName(person) : bodyCap}</div>
            <div style={styles.signatureCaption}>{personRole(person) || singularBody}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function multilineValue(context: NarrativeContext, keys: string[], fallback: string[] = []) {
  for (const key of keys) {
    const raw = context?.[key];

    if (Array.isArray(raw)) {
      const lines = raw.map((item) => String(item || "").trim()).filter(Boolean);
      if (lines.length) return lines;
    }

    const text = String(raw || "").trim();
    if (text) {
      return text
        .split(/\n|\r\n|,\s(?=\D)/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  return fallback;
}

function firstValue(context: NarrativeContext, keys: string[], fallback = "") {
  for (const key of keys) {
    const raw = context?.[key];
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      return String(raw).trim();
    }
  }

  return fallback;
}

function LogoWithFallback({
  sources,
  alt,
  style,
}: {
  sources: string[];
  alt: string;
  style: React.CSSProperties;
}) {
  const cleanSources = uniqueStrings(sources);
  const [index, setIndex] = React.useState(0);

  if (!cleanSources.length || index >= cleanSources.length) return null;

  return (
    <img
      src={cleanSources[index]}
      alt={alt}
      style={style}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}

export function CompilationReportBlock({ context }: { context: NarrativeContext }) {
  const clientName = value(context, "clientName", "the entity");
  const framework = value(
    context,
    "framework",
    "the applicable financial reporting framework",
  );
  const practitionerName = value(context, "practitionerName", "Compiler");
  const practitionerDesignation = value(context, "practitionerDesignation", "");
  const practitionerFirm = value(context, "practitionerFirm", "");
  const compilationDate = value(context, "compilationDate", "________________");

  const logoSources = uniqueStrings([
    firstValue(context, [
      "practitionerLogoUrl",
      "firmLogoUrl",
      "logoUrl",
      "letterheadLogoUrl",
      "logo_url",
      "firm_logo_url",
      "letterhead_logo_url",
      "compiler_logo_url",
    ]),
  ]);

  const footerLogoSources = uniqueStrings([
    firstValue(context, [
      "practitionerFooterLogoUrl",
      "firmFooterLogoUrl",
      "footerLogoUrl",
      "footer_logo_url",
      "firm_footer_logo_url",
      "letterhead_footer_logo_url",
      "compiler_footer_logo_url",
    ]),
  ]);

  const governingLogoSources = uniqueStrings([
    firstValue(context, [
      "governingBodyLogoUrl",
      "governingBodyLogo1Url",
      "professionalBodyLogoUrl",
      "governing_body_logo_url",
      "professional_body_logo_url",
    ]),
    firstValue(context, [
      "secondGoverningBodyLogoUrl",
      "governingBodyLogo2Url",
      "secondProfessionalBodyLogoUrl",
      "second_governing_body_logo_url",
      "second_professional_body_logo_url",
    ]),
  ]);

  const firmAddressLines = multilineValue(
    context,
    [
      "practitionerAddressLines",
      "firmAddressLines",
      "firmAddress",
      "practitionerAddress",
    ],
    [],
  );

  const firmTelephone = firstValue(
    context,
    ["practitionerTelephone", "firmTelephone", "firmPhone", "telephone"],
    "",
  );

  const firmEmail = firstValue(
    context,
    ["practitionerEmail", "firmEmail", "email"],
    "",
  );

  const firmWebsite = firstValue(
    context,
    ["practitionerWebsite", "firmWebsite", "website"],
    "",
  );

  const governingBodyName = firstValue(
    context,
    ["governingBodyName", "professionalBodyName", "regulatoryBodyName"],
    "",
  );

  const governingBodyRegistration = firstValue(
    context,
    [
      "governingBodyRegistrationNumber",
      "professionalBodyRegistrationNumber",
      "practiceNumber",
      "membershipNumber",
    ],
    "",
  );

  const secondGoverningBodyName = firstValue(
    context,
    ["secondGoverningBodyName", "secondProfessionalBodyName"],
    "",
  );

  const secondGoverningBodyRegistration = firstValue(
    context,
    [
      "secondGoverningBodyRegistrationNumber",
      "secondProfessionalBodyRegistrationNumber",
    ],
    "",
  );

  const footerText = firstValue(
    context,
    ["practitionerFooterText", "footerText"],
    "",
  );

  const primaryGoverningLine =
    footerText ||
    [governingBodyName, governingBodyRegistration].filter(Boolean).join(" ");

  const secondGoverningLine = [
    secondGoverningBodyName,
    secondGoverningBodyRegistration,
  ]
    .filter(Boolean)
    .join(" ");

  const governingLines = [primaryGoverningLine, secondGoverningLine].filter(Boolean);

  return (
    <section style={styles.compilationReportPage}>
      <div style={styles.letterheadHeader}>
        <div style={styles.letterheadLogoWrap}>
          <LogoWithFallback
            sources={logoSources}
            alt={`${practitionerFirm || "Firm"} logo`}
            style={styles.letterheadLogo}
          />
        </div>

        <div style={styles.letterheadContactBlock}>
          {practitionerFirm ? (
            <div style={styles.letterheadFirmName}>{practitionerFirm}</div>
          ) : null}

          {firmAddressLines.map((line, index) => (
            <div key={`firm-address-${index}`}>{line}</div>
          ))}

          {firmTelephone ? <div>Tel: {firmTelephone.replace(/^Tel:\s*/i, "")}</div> : null}
          {firmEmail ? <div>Email: {firmEmail.replace(/^Email:\s*/i, "")}</div> : null}
          {firmWebsite ? <div>{firmWebsite}</div> : null}
        </div>
      </div>

      <h1 style={styles.compilationHeading}>Practitioner’s Compilation Report</h1>

      <p style={styles.paragraph}>
        We have compiled the annual financial statements of {clientName}, as set out in this report, based on information provided by management. These annual financial statements comprise the statement of financial position as at {value(context, "yearEnd", "the reporting date")}, the statement of comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and the notes to the annual financial statements, including a summary of significant accounting policies and other explanatory information.
      </p>

      <p style={styles.paragraph}>
        We performed this compilation engagement in accordance with International Standard on Related Services 4410 (Revised), Compilation Engagements. We have applied our expertise in accounting and financial reporting to assist management in the preparation and presentation of these annual financial statements in accordance with {framework}.
      </p>

      <p style={styles.paragraph}>
        We have complied with relevant ethical requirements, including the principles of integrity, objectivity, professional competence and due care, confidentiality and professional behaviour. A compilation engagement involves applying accounting and financial reporting expertise to assist management in presenting financial information in accordance with the selected reporting framework.
      </p>

      <p style={styles.paragraph}>
        These annual financial statements and the accuracy and completeness of the records, documents, explanations and other information used to compile them are the responsibility of management. Management is also responsible for the judgements, estimates and accounting policies applied in the preparation of the annual financial statements.
      </p>

      <p style={styles.paragraph}>
        Since a compilation engagement is not an assurance engagement, we are not required to verify the accuracy or completeness of the information provided to us to compile these annual financial statements. Accordingly, we do not express an audit opinion or a review conclusion on whether these annual financial statements are prepared in accordance with {framework}.
      </p>

      <p style={styles.paragraph}>
        Our report is intended solely for the use of management and those charged with governance of the entity and should be read together with the annual financial statements, accounting policies and notes included in this report.
      </p>

      <div style={styles.compilationSignatureBlock}>
        <div style={styles.signatureLine} />

        {practitionerFirm ? (
          <p style={styles.paragraph}>
            <strong>{practitionerFirm}</strong>
          </p>
        ) : null}

        <p style={styles.paragraph}>
          <strong>{practitionerName}</strong>
        </p>

        {practitionerDesignation ? (
          <p style={styles.paragraph}>{practitionerDesignation}</p>
        ) : null}

        <p style={styles.paragraph}>{compilationDate}</p>
      </div>

      <div style={styles.letterheadFooter}>
        <div style={styles.footerTextBlock}>
          <strong>{practitionerName}</strong>

          {practitionerDesignation ? (
            <div>{practitionerDesignation}</div>
          ) : null}

          {governingLines.map((line, index) => (
            <div key={`governing-line-${index}`} style={styles.footerGoverningLine}>
              {line}
            </div>
          ))}
        </div>

        <div style={styles.footerLogoRow}>
          <LogoWithFallback
            sources={governingLogoSources}
            alt="Governing body logo"
            style={styles.governingBodyLogo}
          />

          <LogoWithFallback
            sources={footerLogoSources}
            alt={`${practitionerFirm || "Firm"} footer`}
            style={styles.footerStripLogo}
          />
        </div>
      </div>
    </section>
  );
}


const styles: Record<string, React.CSSProperties> = {
  paragraph: {
    margin: "0 0 7px",
    fontFamily: "inherit",
    fontSize: 12.5,
    lineHeight: 1.34,
  },
  reportSection: {
    marginBottom: 13,
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  reportHeading: {
    fontSize: 12.9,
    lineHeight: 1.25,
    fontWeight: 900,
    margin: "13px 0 5px",
  },
  directorsTable: {
    width: "100%",
    borderCollapse: "collapse",
    margin: "2px 0 8px",
    fontSize: 10.5,
  },
  thLeft: {
    textAlign: "left",
    borderBottom: "1px solid #111827",
    padding: "3px 4px",
    fontWeight: 900,
  },
  tdLeft: {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "3px 4px",
  },
  compilationReportPage: {
    position: "relative",
    minHeight: "265mm",
    paddingBottom: 0,
    fontFamily: "inherit",
    fontSize: 10.1,
    lineHeight: 1.34,
    display: "flex",
    flexDirection: "column",
  },
  compilationHeading: {
    fontFamily: "inherit",
    fontSize: 13.5,
    lineHeight: 1.25,
    fontWeight: 900,
    margin: "0 0 13px",
    paddingBottom: 7,
    borderBottom: "1.25px solid #111827",
  },
  letterheadHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 58mm",
    alignItems: "center",
    columnGap: 18,
    margin: "0 0 14px",
    paddingBottom: 8,
    borderBottom: "1.25px solid #111827",
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  letterheadLogoWrap: {
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  letterheadLogo: {
    width: "62mm",
    maxWidth: "100%",
    height: "auto",
    maxHeight: "23mm",
    objectFit: "contain",
    objectPosition: "left center",
    display: "block",
  },
  letterheadContactBlock: {
    textAlign: "right",
    fontFamily: "inherit",
    fontSize: 8.5,
    lineHeight: 1.25,
    color: "#111827",
  },
  letterheadFirmName: {
    fontWeight: 900,
    marginBottom: 3,
  },
  compilationSignatureBlock: {
    marginTop: 26,
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  signatureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 30,
    marginTop: 30,
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  signatureBlock: {
    fontSize: 10.9,
    lineHeight: 1.25,
  },
  signatureCaption: {
    marginTop: 2,
    color: "#374151",
    fontSize: 10.4,
  },
  signatureLine: {
    borderTop: "1px solid #111827",
    height: 1,
    marginBottom: 6,
    width: "58mm",
    maxWidth: "58mm",
  },
  letterheadFooter: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 45mm",
    gap: 14,
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 10,
    borderTop: "1px solid #111827",
    fontFamily: "inherit",
    fontSize: 9.2,
    lineHeight: 1.3,
    color: "#111827",
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  footerTextBlock: {
    display: "grid",
    gap: 4,
    justifyItems: "start",
    textAlign: "left",
  },
  footerGoverningLine: {
    fontWeight: 900,
    marginTop: 3,
  },
  footerLogoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    minHeight: 24,
  },
  governingBodyLogo: {
    maxWidth: "32mm",
    maxHeight: "11mm",
    width: "auto",
    height: "auto",
    objectFit: "contain",
    display: "block",
  },
  footerStripLogo: {
    maxWidth: "36mm",
    maxHeight: "10mm",
    width: "auto",
    height: "auto",
    objectFit: "contain",
    objectPosition: "right center",
    display: "block",
  },
};
