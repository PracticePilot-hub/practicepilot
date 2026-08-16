// Path: app/legal/data-processing-agreement/page.tsx


import type { CSSProperties } from "react";
import CloseLegalTabButton from "../CloseLegalTabButton";

export const metadata = {
  title: "PracticePilot Data Processing and Operator Agreement",
  description: "PracticePilot Data Processing and Operator Agreement.",
};

export default function DataProcessingAgreementPage() {
  return (
    <main style={s.page}>
  <div style={s.shell}>
    <div style={{ marginBottom: 16 }}>
      <CloseLegalTabButton />
    </div>

    <header style={s.header}>
          <div style={s.eyebrow}>LEGAL</div>
          <h1 style={s.title}>PracticePilot Data Processing and Operator Agreement</h1>
          <p style={s.meta}>Version 1.0</p>
        </header>

        <section style={s.document}>
          <p>
            This Data Processing and Operator Agreement (“DPA”) forms part of the
            PracticePilot Software as a Service Subscription Agreement between
            <strong> Corepilot Software Holdings (Pty) Ltd</strong>, trading as
            <strong> PracticePilot</strong>, and the Customer.
          </p>
          <p>
            It governs the processing of Personal Information by Corepilot on behalf of
            the Customer.
          </p>

          <h2 style={s.h2}>1. Parties</h2>
          <p>
            <strong>Corepilot Software Holdings (Pty) Ltd</strong><br />
            Registration number: 2026/399739/07<br />
            Trading as: PracticePilot<br />
            Registered and operational address: 81 Kafue Street, Lynnwood Glen,
            Pretoria, Gauteng, 0081, South Africa<br />
            Website: practicepilot.co.za<br />
            General / Legal: practice@practicepilot.co.za<br />
            Billing: billing@practicepilot.co.za<br />
            Support: support@practicepilot.co.za
          </p>
          <p>
            The Customer is the business, accounting practice, company, close
            corporation, partnership, trust, sole proprietor or other organisation
            subscribing to PracticePilot and on whose behalf Corepilot processes
            Personal Information.
          </p>

          <h2 style={s.h2}>2. Purpose of this Agreement</h2>
          <p>
            PracticePilot allows Customers to upload, create, store, manage and process
            information relating to their businesses and their clients.
          </p>
          <p>
            In providing the PracticePilot service, Corepilot may process Personal
            Information on behalf of the Customer.
          </p>
          <p>
            The purpose of this DPA is to record the respective responsibilities of the
            Customer and Corepilot, govern Corepilot's processing of Personal Information
            on behalf of the Customer, satisfy applicable requirements under the
            Protection of Personal Information Act 4 of 2013 (“POPIA”), and establish
            contractual safeguards for Personal Information processed through
            PracticePilot.
          </p>
          <p>
            This DPA must be read together with the PracticePilot Software as a Service
            Subscription Agreement, the PracticePilot Privacy Notice and any applicable
            service-specific terms.
          </p>

          <h2 style={s.h2}>3. Definitions</h2>
          <p>
            <strong>Customer Data</strong> means information uploaded, entered, generated,
            stored or otherwise processed through PracticePilot by or on behalf of the
            Customer.
          </p>
          <p>
            <strong>Data Subject</strong>, <strong>Operator</strong>, <strong>Personal Information</strong>,
            <strong> Processing</strong> and <strong>Responsible Party</strong> have the
            meanings given to those terms in POPIA.
          </p>
          <p>
            <strong>Security Compromise</strong> means unauthorised access to, acquisition
            of, loss of, destruction of, alteration of or unlawful processing of Personal
            Information.
          </p>
          <p>
            <strong>Sub-operator</strong> means a third party appointed by Corepilot to
            process Personal Information for purposes connected with providing
            PracticePilot.
          </p>

          <h2 style={s.h2}>4. Role of the Customer</h2>
          <p>
            The Customer is ordinarily the Responsible Party in relation to Personal
            Information that it processes through PracticePilot for its own business
            purposes or on behalf of its own clients.
          </p>
          <p>
            The Customer determines why the Personal Information is processed, what
            information is processed, which Data Subjects are involved, which
            PracticePilot users may access the information, and what professional or
            business purposes the information is used for.
          </p>

          <h2 style={s.h2}>5. Customer responsibilities</h2>
          <p>The Customer warrants that it will:</p>
          <ul style={s.list}>
            <li>have a lawful basis for the Personal Information it processes through PracticePilot;</li>
            <li>obtain consent where consent is the applicable lawful basis;</li>
            <li>provide required privacy notices to Data Subjects;</li>
            <li>process only information appropriate for lawful business and professional purposes;</li>
            <li>ensure Personal Information supplied to PracticePilot is reasonably accurate and complete;</li>
            <li>ensure user permissions are appropriately allocated;</li>
            <li>prevent unauthorised users from accessing Customer Data;</li>
            <li>protect passwords, authentication methods and endpoint devices;</li>
            <li>notify Corepilot promptly of suspected unauthorised access; and</li>
            <li>provide Corepilot with lawful processing instructions.</li>
          </ul>

          <h2 style={s.h2}>6. Role of Corepilot</h2>
          <p>
            Where Corepilot processes Personal Information on behalf of the Customer,
            Corepilot acts as an Operator.
          </p>
          <p>
            Corepilot will process such information only with the knowledge or
            authorisation of the Customer, in accordance with this DPA and the Customer's
            lawful use of PracticePilot, as reasonably required to provide, secure,
            support and maintain PracticePilot, or where processing is required or
            permitted by law.
          </p>

          <h2 style={s.h2}>7. Nature and purpose of processing</h2>
          <p>Corepilot may process Customer Personal Information for purposes including:</p>
          <ul style={s.list}>
            <li>hosting and storing Customer Data;</li>
            <li>displaying data to authorised users;</li>
            <li>authenticating users and controlling permissions;</li>
            <li>providing accounting and financial statement functionality;</li>
            <li>preparing compliance documentation and PAIA manuals;</li>
            <li>providing secretarial, CRM, project management and billing functionality;</li>
            <li>generating documents, reports, calculations and validations;</li>
            <li>backing up Customer Data;</li>
            <li>providing support and diagnosing technical issues;</li>
            <li>maintaining audit records;</li>
            <li>detecting misuse or unauthorised access; and</li>
            <li>securing the platform.</li>
          </ul>

          <h2 style={s.h2}>8. Categories of Personal Information</h2>
          <p>
            Depending on the modules used, Customer Data may include names and surnames,
            identity and passport details, addresses, telephone numbers, email addresses,
            dates of birth, employment and payroll information, remuneration and tax
            information, banking and financial information, accounting records, financial
            statements, company registration information, director, shareholder, member,
            beneficial ownership, trust, trustee, beneficiary, employee, supplier and
            customer information, statutory records, contracts, supporting documents,
            correspondence and professional working papers.
          </p>

          <h2 style={s.h2}>9. Categories of Data Subjects</h2>
          <p>
            Personal Information processed through PracticePilot may relate to Customer
            employees, directors, members, shareholders, partners, contractors,
            consultants, clients, client employees, client directors, client shareholders,
            trustees, beneficiaries, beneficial owners, suppliers, customers, debtors,
            creditors, representatives, authorised users and other persons whose
            information is lawfully processed by the Customer.
          </p>

          <h2 style={s.h2}>10. Special Personal Information</h2>
          <p>
            Certain Customer Data may constitute special personal information or
            information subject to additional protection under POPIA. The Customer is
            responsible for determining whether it is lawfully permitted to process such
            information.
          </p>

          <h2 style={s.h2}>11. Security safeguards</h2>
          <p>
            Corepilot will establish and maintain reasonable technical and organisational
            safeguards appropriate to the nature of the Personal Information processed
            and the risks associated with such processing.
          </p>
          <p>These safeguards may include, where appropriate:</p>
          <ul style={s.list}>
            <li>authentication controls and role-based access;</li>
            <li>restricted administrative access;</li>
            <li>encryption in transit;</li>
            <li>secure hosting and database access controls;</li>
            <li>file access controls;</li>
            <li>activity logging and audit trails;</li>
            <li>backup procedures;</li>
            <li>security monitoring and vulnerability management;</li>
            <li>software updates and credential protection; and</li>
            <li>environment separation and administrative access controls.</li>
          </ul>
          <p>
            Corepilot will periodically review and adapt safeguards where reasonably
            appropriate in light of identified risks, technological developments,
            operational changes and changes to PracticePilot.
          </p>

          <h2 style={s.h2}>12. Confidentiality</h2>
          <p>
            Corepilot will treat Customer Personal Information as confidential. Persons
            authorised by Corepilot to access Personal Information will access it only
            where reasonably necessary for their duties and will be subject to appropriate
            confidentiality obligations.
          </p>

          <h2 style={s.h2}>13. Sub-operators</h2>
          <p>
            The Customer authorises Corepilot to appoint reputable Sub-operators where
            reasonably necessary to operate PracticePilot.
          </p>
          <p>
            Sub-operators may provide cloud infrastructure, database hosting, data
            storage, software hosting, authentication, email, communications, backups,
            security, monitoring, payment processing and other supporting technology
            services.
          </p>
          <p>
            Corepilot will take reasonable steps to ensure that Sub-operators processing
            Personal Information on its behalf are subject to appropriate contractual
            confidentiality and security obligations.
          </p>

          <h2 style={s.h2}>14. Cross-border processing</h2>
          <p>
            Certain PracticePilot infrastructure or Sub-operators may process or store
            Personal Information outside the Republic of South Africa. Corepilot will take
            reasonable steps to ensure that cross-border transfers are made in accordance
            with applicable requirements under POPIA.
          </p>

          <h2 style={s.h2}>15. Security compromises</h2>
          <p>
            Corepilot will notify the Customer as soon as reasonably practicable after
            becoming aware of reasonable grounds to believe that Personal Information
            processed on behalf of that Customer has been accessed or acquired by an
            unauthorised person.
          </p>
          <p>
            Corepilot will provide reasonably available information concerning the nature
            of the incident, information potentially affected, known or reasonably
            suspected consequences, measures taken or proposed, and information reasonably
            required by the Customer to meet applicable notification obligations.
          </p>
          <p>
            Where the Customer is the Responsible Party, the Customer remains responsible
            for determining and carrying out notifications to Data Subjects and the
            Information Regulator as required by law.
          </p>

          <h2 style={s.h2}>16. Data Subject requests</h2>
          <p>
            Where the Customer is the Responsible Party, Corepilot may refer Data Subject
            requests to the Customer and will provide reasonable assistance, taking into
            account the functionality and nature of PracticePilot, to enable the Customer
            to respond to lawful access, correction, deletion, destruction, objection and
            other applicable requests.
          </p>

          <h2 style={s.h2}>17. Correction and deletion</h2>
          <p>
            PracticePilot may provide functionality allowing authorised users to update or
            correct Customer Data. Where information cannot reasonably be corrected or
            deleted through normal application functionality, the Customer may submit a
            support request.
          </p>
          <p>
            Corepilot may decline deletion where information must lawfully be retained for
            statutory, financial, billing, security, audit, legal claim or other lawful
            retention purposes.
          </p>

          <h2 style={s.h2}>18. Customer Data export</h2>
          <p>
            Corepilot will use reasonable efforts to provide appropriate functionality
            allowing Customers to export relevant Customer Data. The Customer is
            responsible for exporting information it requires before final closure of its
            account where export functionality is available.
          </p>

          <h2 style={s.h2}>19. Data retention following termination</h2>
          <p>
            Following cancellation or termination, Corepilot may retain Customer Data for
            a limited period to allow reasonable data export, close the account, process
            outstanding billing, comply with law, protect legal rights, resolve disputes,
            investigate security events and complete ordinary backup cycling.
          </p>
          <p>
            Corepilot will not retain identifiable Customer Personal Information
            indefinitely without a lawful purpose.
          </p>

          <h2 style={s.h2}>20. Backups</h2>
          <p>
            Corepilot may maintain backups for service continuity, disaster recovery and
            security purposes. Information removed from active PracticePilot systems may
            remain temporarily within backup systems until the relevant backup expires or
            is overwritten through ordinary backup cycling.
          </p>

          <h2 style={s.h2}>21. Customer access control</h2>
          <p>
            The Customer controls which of its users are authorised to access its
            PracticePilot environment and is responsible for creating appropriate user
            accounts, assigning roles and permissions, reviewing access, removing
            unnecessary access, preventing credential sharing and notifying Corepilot
            where an account may have been compromised.
          </p>

          <h2 style={s.h2}>22. Audit and compliance information</h2>
          <p>
            On reasonable request, Corepilot will make available information reasonably
            necessary to demonstrate compliance with its obligations under this DPA,
            subject to reasonable scope, security obligations, confidentiality obligations
            to other Customers and avoiding unreasonable disruption to Corepilot's
            business.
          </p>

          <h2 style={s.h2}>23. Government and regulatory requests</h2>
          <p>
            Corepilot may disclose Personal Information where required by law, court
            order, warrant, subpoena, the Information Regulator or another body lawfully
            authorised to require the information.
          </p>
          <p>
            Where legally permitted and reasonably practicable, Corepilot may notify the
            Customer of such a request.
          </p>

          <h2 style={s.h2}>24. Anonymised and de-identified information</h2>
          <p>
            Corepilot may use information that has been properly de-identified so that it
            cannot reasonably be linked to an identifiable Data Subject for purposes
            including improving PracticePilot, analysing platform performance, identifying
            product usage trends, capacity planning, security analysis and product
            development.
          </p>

          <h2 style={s.h2}>25. Artificial intelligence and automated functionality</h2>
          <p>
            PracticePilot may from time to time include automated, machine-assisted or
            artificial-intelligence-assisted functionality.
          </p>
          <p>
            Corepilot will not use identifiable Customer Data to train a general-purpose
            artificial intelligence model owned by Corepilot or a third party unless such
            use is clearly disclosed to the Customer, an appropriate lawful basis exists,
            and any additional consent or agreement required by law or contract has been
            obtained.
          </p>
          <p>
            Where an external artificial intelligence service processes Customer Data on
            behalf of PracticePilot, it will be treated as a Sub-operator and subject to
            the applicable requirements of this DPA.
          </p>

          <h2 style={s.h2}>26. Processing outside the operator relationship</h2>
          <p>
            Corepilot may separately act as a Responsible Party in relation to Personal
            Information required for Corepilot's own legitimate business purposes,
            including Customer account administration, subscription management,
            invoicing, payment records, contract acceptance records, communications,
            security, fraud prevention, legal compliance and customer support
            administration.
          </p>

          <h2 style={s.h2}>27. Liability</h2>
          <p>
            Liability arising from this DPA is subject to the limitation of liability
            provisions contained in the PracticePilot SaaS Subscription Agreement, except
            where liability may not lawfully be limited or excluded.
          </p>

          <h2 style={s.h2}>28. Duration</h2>
          <p>
            This DPA begins when the Customer accepts the PracticePilot SaaS Subscription
            Agreement or otherwise begins using PracticePilot in circumstances where this
            DPA is incorporated into the agreement.
          </p>
          <p>
            It continues for as long as Corepilot processes Customer Personal Information
            on behalf of the Customer.
          </p>

          <h2 style={s.h2}>29. Changes to this DPA</h2>
          <p>
            Corepilot may amend this DPA where reasonably necessary because of amendments
            to POPIA, regulatory guidance, infrastructure changes, security developments,
            changes in PracticePilot functionality or changes in legal requirements.
          </p>
          <p>
            Material amendments will be communicated to affected Customers before taking
            effect.
          </p>

          <h2 style={s.h2}>30. Governing law</h2>
          <p>
            This DPA is governed by the laws of the Republic of South Africa. References
            to POPIA include applicable regulations and legally binding requirements
            issued under POPIA.
          </p>

          <h2 style={s.h2}>31. Contact</h2>
          <p>
            <strong>Corepilot Software Holdings (Pty) Ltd</strong><br />
            Trading as PracticePilot<br />
            81 Kafue Street<br />
            Lynnwood Glen<br />
            Pretoria<br />
            Gauteng<br />
            0081<br />
            South Africa
          </p>
          <p>
            Privacy / Legal: <strong>practice@practicepilot.co.za</strong><br />
            Support: <strong>support@practicepilot.co.za</strong><br />
            Website: <strong>practicepilot.co.za</strong>
          </p>

          <h2 style={s.h2}>32. Incorporation and acceptance</h2>
          <p>
            This DPA is incorporated into the PracticePilot SaaS Subscription Agreement.
            The Customer does not need to sign a separate paper copy where it is validly
            incorporated into the electronic PracticePilot subscription process.
          </p>
          <p>
            When the Customer accepts the PracticePilot SaaS Subscription Agreement, the
            Customer also acknowledges and accepts this DPA. Corepilot will record the
            version of this DPA applicable to the Customer's subscription acceptance.
          </p>

          <div style={s.footerNote}>
            <strong>DPA version:</strong> 1.0
          </div>
        </section>
      </div>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f7fb",
    padding: "32px 20px 56px",
    color: "#0f172a",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: {
    maxWidth: 980,
    margin: "0 auto",
  },
  back: {
    display: "inline-block",
    marginBottom: 16,
    color: "#0b5cab",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
  header: {
    background: "#0b2f4f",
    color: "#ffffff",
    borderLeft: "6px solid #00a6b4",
    padding: "26px 28px",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.3,
    color: "#9edee4",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 32,
    lineHeight: 1.15,
    fontWeight: 900,
  },
  meta: {
    margin: "8px 0 0",
    color: "#c9d9e5",
    fontSize: 14,
  },
  document: {
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    borderTop: 0,
    padding: "28px 32px",
    fontSize: 15,
    lineHeight: 1.72,
    color: "#334155",
  },
  h2: {
    margin: "28px 0 8px",
    paddingTop: 2,
    fontSize: 19,
    lineHeight: 1.3,
    color: "#0f172a",
    fontWeight: 900,
  },
  list: {
    paddingLeft: 22,
  },
  footerNote: {
    marginTop: 30,
    paddingTop: 16,
    borderTop: "1px solid #d7e1eb",
    color: "#64748b",
  },
};
