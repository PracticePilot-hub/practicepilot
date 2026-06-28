"use client";

import React from "react";

export type AfsPerson = {
  name?: string | null;
  full_name?: string | null;
  person_name?: string | null;
  nationality?: string | null;
  designation?: string | null;
  person_type?: string | null;
  appointment_date?: string | null;
  resignation_date?: string | null;
};

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

export type DirectorsReportTextOverrides = Record<
  DirectorsReportSectionKey,
  {
    title: string;
    text: string;
  }
>;

export type AfsNarrativeContext = {
  clientName: string;
  entityType: string;
  yearEnd: string;
  registrationNumber?: string | null;
  bodyLabel: string;
  bodyLabelCapitalised: string;
  roleLabel: string;
  framework: string;
  approvalDate: string;
  compilationDate: string;
  practitionerFirm: string;
  practitionerName: string;
  practitionerDesignation: string;
  natureOfBusiness?: string | null;
  country?: string | null;
  directors: AfsPerson[];

  directorsReportGeneralReview?: boolean;
  directorsReportIncorporation?: boolean;
  directorsReportNatureBusiness?: boolean;
  directorsReportReviewActivities?: boolean;
  directorsReportFinancialResults?: boolean;
  directorsReportEventsAfter?: boolean;
  directorsReportDividends?: boolean;
  directorsReportShareCapital?: boolean;
  directorsReportDirectors?: boolean;
  directorsReportSecretary?: boolean;
  directorsReportExternalAccountant?: boolean;
  directorsReportInterestContracts?: boolean;
  directorsReportBorrowingLimitations?: boolean;
  directorsReportShareholder?: boolean;
  directorsReportGoingConcern?: boolean;
  directorsReportLiquiditySolvency?: boolean;
  directorsReportLitigation?: boolean;
  directorsReportSocialEthics?: boolean;
  directorsReportSubsidiaries?: boolean;
  directorsReportAssociates?: boolean;
  directorsReportJointVentures?: boolean;
  directorsReportNonCurrentAssets?: boolean;
  directorsReportAuthorisation?: boolean;
  directorsReportOther1?: boolean;
  directorsReportOther2?: boolean;
  directorsReportOther3?: boolean;
  directorsReportOther4?: boolean;
  directorsReportOther5?: boolean;
  directorsReportOther6?: boolean;
  directorsReportOther7?: boolean;
  directorsReportOther8?: boolean;
  directorsReportOther9?: boolean;
  directorsReportOther10?: boolean;

  directorsReportTexts?: DirectorsReportTextOverrides;
};

function getPersonName(person: AfsPerson) {
  return (
    person.full_name ||
    person.person_name ||
    person.name ||
    "Name not captured"
  );
}

function safeText(value: unknown, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function replaceTokens(text: string, context: AfsNarrativeContext) {
  return text
    .replaceAll("{clientName}", context.clientName)
    .replaceAll("{yearEnd}", context.yearEnd)
    .replaceAll("{bodyLabel}", context.bodyLabel)
    .replaceAll("{bodyLabelCapitalised}", context.bodyLabelCapitalised)
    .replaceAll("{roleLabel}", context.roleLabel)
    .replaceAll("{framework}", context.framework)
    .replaceAll("{approvalDate}", context.approvalDate)
    .replaceAll("{country}", context.country || "South Africa")
    .replaceAll(
      "{natureOfBusiness}",
      context.natureOfBusiness || "the principal activities of the entity"
    )
    .replaceAll("{practitionerFirm}", context.practitionerFirm)
    .replaceAll("{practitionerName}", context.practitionerName);
}

export function buildDefaultDirectorsReportTexts(
  context: AfsNarrativeContext
): DirectorsReportTextOverrides {
  return {
    generalReview: {
      title: "General review",
      text: "The {bodyLabel} submit their report on the annual financial statements of {clientName} for the year ended {yearEnd}.",
    },
    incorporation: {
      title: "Incorporation",
      text: "{clientName} is incorporated in {country}.",
    },
    natureBusiness: {
      title: "Nature of business",
      text: context.natureOfBusiness
        ? "The principal activities of the entity are {natureOfBusiness}."
        : "The principal activities of the entity have not yet been captured.",
    },
    reviewActivities: {
      title: "Review of activities",
      text: "The entity continued to conduct its operations during the year under review. The financial position and results of operations are set out in these annual financial statements.",
    },
    financialResults: {
      title: "Financial results",
      text: "The annual financial statements have been prepared in accordance with {framework}. The {bodyLabel} have considered the financial results for the year under review and are satisfied that the annual financial statements fairly reflect the financial position and performance of the entity based on the information available to them.",
    },
    eventsAfter: {
      title: "Events after the reporting date",
      text: "The {bodyLabel} are not aware of any material matter or circumstance arising since the end of the financial year and up to the date of this report that requires disclosure or adjustment in the annual financial statements.",
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
      title: context.roleLabel,
      text: "",
    },
    secretary: {
      title: "Secretary",
      text: "The company secretary details are disclosed in the general information section where applicable.",
    },
    externalAccountant: {
      title: "External accountant / compiler",
      text: "The annual financial statements were compiled by the independent compiler disclosed in the practitioner’s compilation report.",
    },
    interestContracts: {
      title: "Interest in contracts",
      text: "No material contracts involving directors’ interests were entered into during the year under review, unless otherwise disclosed.",
    },
    borrowingLimitations: {
      title: "Borrowing limitations",
      text: "The borrowing powers of the entity are subject to the applicable governing documents and statutory requirements.",
    },
    shareholder: {
      title: "Shareholder",
      text: "There have been no changes in ownership during the current financial year, unless otherwise disclosed.",
    },
    goingConcern: {
      title: "Going concern",
      text: "The annual financial statements have been prepared on the basis of accounting policies applicable to a going concern. This basis presumes that funds will be available to finance future operations and that the realisation of assets and settlement of liabilities, contingent obligations and commitments will occur in the ordinary course of business.",
    },
    liquiditySolvency: {
      title: "Liquidity and solvency",
      text: "The {bodyLabel} have considered the liquidity and solvency position of the entity and are satisfied that the entity is able to meet its obligations as they become due in the ordinary course of business, unless otherwise disclosed in these annual financial statements.",
    },
    litigation: {
      title: "Litigation",
      text: "The {bodyLabel} are not aware of any legal or arbitration proceedings that may have a material effect on the financial position of the entity, unless otherwise disclosed.",
    },
    socialEthics: {
      title: "Social and ethics committee",
      text: "Social and ethics committee matters are disclosed where applicable.",
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
      text: "Movements in non-current assets are disclosed in the notes to the annual financial statements where applicable.",
    },
    authorisation: {
      title: "Authorisation of annual financial statements",
      text: "The annual financial statements were authorised for issue by the {bodyLabel} on {approvalDate}.",
    },
    other1: {
      title: "Other matter 1",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other2: {
      title: "Other matter 2",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other3: {
      title: "Other matter 3",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other4: {
      title: "Other matter 4",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other5: {
      title: "Other matter 5",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other6: {
      title: "Other matter 6",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other7: {
      title: "Other matter 7",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other8: {
      title: "Other matter 8",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other9: {
      title: "Other matter 9",
      text: "Additional directors’ report disclosure to be edited.",
    },
    other10: {
      title: "Other matter 10",
      text: "Additional directors’ report disclosure to be edited.",
    },
  };
}

const paragraph: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 11,
  lineHeight: 1.48,
};

const heading2: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3,
  fontWeight: 800,
  margin: "16px 0 6px",
};

const mutedHeading: React.CSSProperties = {
  ...heading2,
  color: "#9ca3af",
};

function OffDisclosure({ title }: { title: string }) {
  return (
    <div style={{ margin: "10px 0 4px" }}>
      <div style={mutedHeading}>{title}</div>
      <p style={{ ...paragraph, color: "#6b7280" }}>
        Section switched off. Turn it on to include and edit this disclosure.
      </p>
    </div>
  );
}

function NumberedSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="reportSectionBlock" style={{ marginBottom: 12 }}>
      <h2 style={heading2}>
        {number}. {title}
      </h2>
      {children}
    </div>
  );
}

function renderText(text: string, context: AfsNarrativeContext) {
  const rendered = replaceTokens(text, context);
  const paragraphs = rendered
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return paragraphs.map((item, index) => (
    <p key={index} style={paragraph}>
      {item}
    </p>
  ));
}

export function DirectorsResponsibilitiesBlock({
  context,
}: {
  context: AfsNarrativeContext;
}) {
  const {
    clientName,
    bodyLabel,
    bodyLabelCapitalised,
    framework,
    approvalDate,
    directors,
  } = context;

  return (
    <>
      <p style={paragraph}>
        The {bodyLabel} are responsible for the preparation and fair presentation
        of the annual financial statements of {clientName}, and for such internal
        control as the {bodyLabel} determine is necessary to enable the
        preparation of annual financial statements that are free from material
        misstatement, whether due to fraud or error.
      </p>

      <p style={paragraph}>
        The {bodyLabel} are also responsible for maintaining adequate accounting
        records and for the selection and application of appropriate accounting
        policies, supported by reasonable and prudent judgements and estimates.
      </p>

      <p style={paragraph}>
        The annual financial statements have been prepared in accordance with{" "}
        {framework}. The {bodyLabel} acknowledge that they are ultimately
        responsible for the system of internal financial control established by
        the entity and place considerable importance on maintaining a strong
        control environment.
      </p>

      <p style={paragraph}>
        The controls are designed to reduce, but cannot eliminate, the risk of
        material misstatement or loss. The {bodyLabel} are not aware of any
        material breakdown in the functioning of these controls during the year
        under review.
      </p>

      <p style={paragraph}>
        In preparing the annual financial statements, the {bodyLabel} have
        assessed the entity’s ability to continue as a going concern. The annual
        financial statements have been prepared on the going concern basis unless
        otherwise indicated in these annual financial statements.
      </p>

      <p style={paragraph}>
        The independent compiler is responsible for reporting on the annual
        financial statements in accordance with the applicable compilation
        engagement standard. The annual financial statements have been approved
        by the {bodyLabel} on {approvalDate} and are signed on their behalf by:
      </p>

      <div
        style={{
          marginTop: 42,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 42,
        }}
      >
        {(directors.length ? directors : [{ name: bodyLabelCapitalised }]).map(
          (person, index) => (
            <div key={index}>
              <div
                style={{
                  borderTop: "1px solid #111827",
                  paddingTop: 6,
                  fontWeight: 700,
                }}
              >
                {getPersonName(person)}
              </div>
            </div>
          )
        )}
      </div>
    </>
  );
}

export function DirectorsReportBlock({
  context,
}: {
  context: AfsNarrativeContext;
}) {
  const defaults = buildDefaultDirectorsReportTexts(context);
  const texts = context.directorsReportTexts || defaults;

  const options: Record<DirectorsReportSectionKey, boolean> = {
    generalReview: context.directorsReportGeneralReview ?? true,
    incorporation: context.directorsReportIncorporation ?? true,
    natureBusiness: context.directorsReportNatureBusiness ?? true,
    reviewActivities: context.directorsReportReviewActivities ?? true,
    financialResults: context.directorsReportFinancialResults ?? true,
    eventsAfter: context.directorsReportEventsAfter ?? true,
    dividends: context.directorsReportDividends ?? true,
    shareCapital: context.directorsReportShareCapital ?? true,
    directors: context.directorsReportDirectors ?? true,
    secretary: context.directorsReportSecretary ?? false,
    externalAccountant: context.directorsReportExternalAccountant ?? true,
    interestContracts: context.directorsReportInterestContracts ?? false,
    borrowingLimitations: context.directorsReportBorrowingLimitations ?? false,
    shareholder: context.directorsReportShareholder ?? true,
    goingConcern: context.directorsReportGoingConcern ?? true,
    liquiditySolvency: context.directorsReportLiquiditySolvency ?? true,
    litigation: context.directorsReportLitigation ?? false,
    socialEthics: context.directorsReportSocialEthics ?? false,
    subsidiaries: context.directorsReportSubsidiaries ?? false,
    associates: context.directorsReportAssociates ?? false,
    jointVentures: context.directorsReportJointVentures ?? false,
    nonCurrentAssets: context.directorsReportNonCurrentAssets ?? false,
    authorisation: context.directorsReportAuthorisation ?? true,
    other1: context.directorsReportOther1 ?? false,
    other2: context.directorsReportOther2 ?? false,
    other3: context.directorsReportOther3 ?? false,
    other4: context.directorsReportOther4 ?? false,
    other5: context.directorsReportOther5 ?? false,
    other6: context.directorsReportOther6 ?? false,
    other7: context.directorsReportOther7 ?? false,
    other8: context.directorsReportOther8 ?? false,
    other9: context.directorsReportOther9 ?? false,
    other10: context.directorsReportOther10 ?? false,
  };

  let sectionNo = 1;

  function nextNumber() {
    const current = sectionNo;
    sectionNo += 1;
    return current;
  }

  function titleFor(key: DirectorsReportSectionKey) {
    return texts[key]?.title || defaults[key].title;
  }

  function textFor(key: DirectorsReportSectionKey) {
    return texts[key]?.text || defaults[key].text;
  }

  function renderNormalSection(key: DirectorsReportSectionKey) {
    const title = titleFor(key);

    if (!options[key]) {
      return <OffDisclosure key={key} title={title} />;
    }

    return (
      <NumberedSection key={key} number={nextNumber()} title={title}>
        {renderText(textFor(key), context)}
      </NumberedSection>
    );
  }

  function renderDirectorsSection() {
    const key: DirectorsReportSectionKey = "directors";
    const title = titleFor(key);

    if (!options.directors) {
      return <OffDisclosure key={key} title={title} />;
    }

    return (
      <NumberedSection key={key} number={nextNumber()} title={title}>
        {context.directors.length ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              marginTop: 6,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingBottom: 5 }}>
                  {context.roleLabel.slice(0, -1)}
                </th>
                <th style={{ textAlign: "left", paddingBottom: 5 }}>Office</th>
                <th style={{ textAlign: "left", paddingBottom: 5 }}>
                  Designation
                </th>
                <th style={{ textAlign: "left", paddingBottom: 5 }}>
                  Nationality
                </th>
              </tr>
            </thead>
            <tbody>
              {context.directors.map((person, index) => (
                <tr key={index}>
                  <td style={{ padding: "5px 0" }}>{getPersonName(person)}</td>
                  <td style={{ padding: "5px 0" }}>
                    {person.resignation_date ? "Resigned" : "Current"}
                  </td>
                  <td style={{ padding: "5px 0" }}>
                    {person.designation || context.roleLabel.slice(0, -1)}
                  </td>
                  <td style={{ padding: "5px 0" }}>
                    {person.nationality || "South African"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={paragraph}>
            No {context.roleLabel.toLowerCase()} have been captured.
          </p>
        )}
      </NumberedSection>
    );
  }

  return (
    <>
      {renderNormalSection("generalReview")}
      {renderNormalSection("incorporation")}
      {renderNormalSection("natureBusiness")}
      {renderNormalSection("reviewActivities")}
      {renderNormalSection("financialResults")}
      {renderNormalSection("eventsAfter")}
      {renderNormalSection("dividends")}
      {renderNormalSection("shareCapital")}
      {renderDirectorsSection()}
      {renderNormalSection("secretary")}
      {renderNormalSection("externalAccountant")}
      {renderNormalSection("interestContracts")}
      {renderNormalSection("borrowingLimitations")}
      {renderNormalSection("shareholder")}
      {renderNormalSection("goingConcern")}
      {renderNormalSection("liquiditySolvency")}
      {renderNormalSection("litigation")}
      {renderNormalSection("socialEthics")}
      {renderNormalSection("subsidiaries")}
      {renderNormalSection("associates")}
      {renderNormalSection("jointVentures")}
      {renderNormalSection("nonCurrentAssets")}
      {renderNormalSection("authorisation")}
      {renderNormalSection("other1")}
      {renderNormalSection("other2")}
      {renderNormalSection("other3")}
      {renderNormalSection("other4")}
      {renderNormalSection("other5")}
      {renderNormalSection("other6")}
      {renderNormalSection("other7")}
      {renderNormalSection("other8")}
      {renderNormalSection("other9")}
      {renderNormalSection("other10")}
    </>
  );
}

export function CompilationReportBlock({
  context,
}: {
  context: AfsNarrativeContext;
}) {
  const {
    clientName,
    yearEnd,
    framework,
    compilationDate,
    practitionerFirm,
    practitionerName,
    practitionerDesignation,
  } = context;

  return (
    <>
      <p style={{ ...paragraph, fontWeight: 800 }}>
        To the management of {clientName}
      </p>

      <p style={paragraph}>
        We have compiled the annual financial statements of {clientName}, based
        on information provided by management. These annual financial statements
        comprise the statement of financial position as at {yearEnd}, the
        statement of comprehensive income, statement of changes in equity,
        statement of cash flows, accounting policies and other explanatory
        information.
      </p>

      <p style={paragraph}>
        Management is responsible for the annual financial statements and for the
        accuracy and completeness of the information provided to us for the
        purpose of the compilation engagement.
      </p>

      <p style={paragraph}>
        We performed this compilation engagement in accordance with International
        Standard on Related Services 4410 (Revised), Compilation Engagements.
      </p>

      <p style={paragraph}>
        We have applied our expertise in accounting and financial reporting to
        assist management in the preparation and presentation of these annual
        financial statements in accordance with {framework}. We have complied
        with relevant ethical requirements, including the principles of
        integrity, objectivity, professional competence and due care.
      </p>

      <p style={paragraph}>
        A compilation engagement involves applying expertise in accounting and
        financial reporting to assist management in the preparation and
        presentation of financial information. It does not include performing
        procedures designed to obtain assurance on the annual financial
        statements.
      </p>

      <p style={paragraph}>
        Since a compilation engagement is not an assurance engagement, we are not
        required to verify the accuracy or completeness of the information
        provided by management. Accordingly, we do not express an audit opinion or
        a review conclusion on these annual financial statements.
      </p>

      <div style={{ marginTop: 44 }}>
        <div
          style={{
            width: 280,
            borderTop: "1px solid #111827",
            paddingTop: 6,
          }}
        >
          <strong>{practitionerFirm}</strong>
          <br />
          {practitionerName}
          <br />
          {practitionerDesignation}
          <br />
          <br />
          {compilationDate}
        </div>
      </div>
    </>
  );
}