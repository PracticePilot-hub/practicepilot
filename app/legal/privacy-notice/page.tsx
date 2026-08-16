// Path: app/legal/privacy-notice/page.tsx


import type { CSSProperties } from "react";
import CloseLegalTabButton from "../CloseLegalTabButton";

export const metadata = {
  title: "PracticePilot Privacy Notice",
  description: "PracticePilot Privacy Notice.",
};

export default function PrivacyNoticePage() {
  return (
    <main style={s.page}>
  <div style={s.shell}>
    <div style={{ marginBottom: 16 }}>
      <CloseLegalTabButton />
    </div>

    <header style={s.header}>
          <div style={s.eyebrow}>LEGAL</div>
          <h1 style={s.title}>PracticePilot Privacy Notice</h1>
          <p style={s.meta}>Version 1.0</p>
        </header>

        <section style={s.document}>
          <p>
            This Privacy Notice explains how <strong>Corepilot Software Holdings (Pty) Ltd</strong>,
            trading as <strong>PracticePilot</strong>, collects, uses, stores, shares and protects
            personal information when individuals and organisations use the PracticePilot platform,
            website and related services.
          </p>

          <h2 style={s.h2}>1. Who we are</h2>
          <p>
            <strong>Corepilot Software Holdings (Pty) Ltd</strong><br />
            Registration number: 2026/399739/07<br />
            Trading as: PracticePilot<br />
            Registered and operational address: 81 Kafue Street, Lynnwood Glen, Pretoria,
            Gauteng, 0081, South Africa<br />
            Website: practicepilot.co.za<br />
            General / Privacy: practice@practicepilot.co.za<br />
            Billing: billing@practicepilot.co.za<br />
            Support: support@practicepilot.co.za
          </p>
          <p>
            For purposes of the Protection of Personal Information Act 4 of 2013 (“POPIA”),
            Corepilot may act as a responsible party where we determine the purpose and means of
            processing personal information, and as an operator where we process personal
            information on behalf of a PracticePilot customer.
          </p>

          <h2 style={s.h2}>2. Scope of this Notice</h2>
          <p>
            This Privacy Notice applies to personal information processed through the PracticePilot
            website, software platform, user accounts, customer onboarding, billing and subscription
            processes, customer support, communications with PracticePilot, use of PracticePilot
            modules and functionality, and related business and administrative activities.
          </p>
          <p>
            This Notice should be read together with the PracticePilot Software as a Service
            Subscription Agreement and any applicable service-specific terms.
          </p>

          <h2 style={s.h2}>3. Personal information we may process</h2>
          <p>Depending on how PracticePilot is used, we may process:</p>
          <ul style={s.list}>
            <li>names and surnames;</li>
            <li>email addresses and telephone numbers;</li>
            <li>job titles, employer and practice details;</li>
            <li>user roles, permissions and account information;</li>
            <li>company and entity information;</li>
            <li>registration numbers and business addresses;</li>
            <li>billing contacts, invoice information and payment references;</li>
            <li>subscription plans, licence quantities and billing history;</li>
            <li>client, employee, director, shareholder, member, trustee and beneficiary information;</li>
            <li>accounting, payroll, tax, statutory and financial information;</li>
            <li>beneficial ownership and compliance information;</li>
            <li>documents, correspondence and financial statements;</li>
            <li>IP addresses, browser and device information;</li>
            <li>login, session, audit, security and system records; and</li>
            <li>support requests, feedback, complaints and communications.</li>
          </ul>

          <h2 style={s.h2}>4. How we collect personal information</h2>
          <p>
            We may collect personal information directly from you, from your employer or
            organisation, from another authorised PracticePilot user, when an account is created,
            when a subscription is selected or managed, when information is uploaded into
            PracticePilot, when you contact support, through system and security logs, and from
            third-party service providers where legally permitted and reasonably necessary.
          </p>
          <p>
            Where a PracticePilot customer uploads information relating to another person, that
            customer is responsible for ensuring that it has lawful authority to do so.
          </p>

          <h2 style={s.h2}>5. Why we process personal information</h2>
          <p>We process personal information for purposes including:</p>
          <ul style={s.list}>
            <li>creating and managing PracticePilot accounts;</li>
            <li>authenticating users and controlling access;</li>
            <li>providing PracticePilot modules and services;</li>
            <li>processing customer data through selected functionality;</li>
            <li>generating documents, calculations and reports;</li>
            <li>administering subscriptions, licences, billing and invoicing;</li>
            <li>recording acceptance of agreements and commercial terms;</li>
            <li>providing customer support;</li>
            <li>maintaining platform security and audit trails;</li>
            <li>diagnosing software errors and preventing misuse;</li>
            <li>improving and developing PracticePilot;</li>
            <li>complying with legal and regulatory obligations;</li>
            <li>enforcing contractual rights; and</li>
            <li>resolving disputes.</li>
          </ul>

          <h2 style={s.h2}>6. Lawful basis for processing</h2>
          <p>
            Corepilot processes personal information only where a lawful basis exists. Depending on
            the circumstances, processing may be necessary to perform a contract, take steps before
            entering into a contract, comply with law, protect a legitimate interest, pursue a
            legitimate interest of Corepilot or a third party, or where consent is the appropriate
            lawful basis.
          </p>
          <p>
            Where Corepilot acts as an operator for a PracticePilot customer, processing is carried
            out in accordance with that customer’s lawful instructions and the applicable
            contractual arrangements.
          </p>

          <h2 style={s.h2}>7. Whether information is required</h2>
          <p>
            Certain personal information is necessary for us to provide PracticePilot. This may
            include user identification information, an email address, organisation information,
            authentication information and billing information where paid services are used.
          </p>
          <p>
            If required information is not provided, we may be unable to create an account,
            authenticate a user, provide access to the platform, provide certain functionality,
            issue invoices or provide support.
          </p>

          <h2 style={s.h2}>8. PracticePilot customers as responsible parties</h2>
          <p>
            Where an accounting practice, business or other customer uses PracticePilot to process
            information relating to its own clients, employees or other persons, that customer
            ordinarily determines the purpose for which the personal information is processed and
            remains responsible for ensuring that the processing is lawful.
          </p>
          <p>
            The customer is responsible for providing required privacy notices, obtaining consent
            where consent is required, and controlling which authorised users have access to the
            information.
          </p>

          <h2 style={s.h2}>9. Corepilot as operator</h2>
          <p>
            Where Corepilot processes personal information as an operator on behalf of a
            PracticePilot customer, Corepilot will process the information with the knowledge or
            authorisation of the customer, treat it as confidential, use it only for purposes
            connected with providing PracticePilot or otherwise lawfully authorised, maintain
            appropriate technical and organisational safeguards, and notify the customer where
            Corepilot becomes aware of a relevant security compromise.
          </p>

          <h2 style={s.h2}>10. Information security</h2>
          <p>
            Corepilot takes reasonable technical and organisational measures designed to protect
            personal information. These may include controlled access, user authentication,
            role-based permissions, encryption in transit, secure hosting, database access controls,
            security logging, monitoring, backup processes, software updates and audit trails.
          </p>
          <p>
            No internet-based service can guarantee absolute security. Customers and users are also
            responsible for protecting passwords and authentication credentials, securing their
            devices, maintaining appropriate user permissions and notifying PracticePilot promptly
            where unauthorised access is suspected.
          </p>

          <h2 style={s.h2}>11. Third-party service providers</h2>
          <p>
            PracticePilot relies on third-party technology and service providers, which may include
            providers of cloud infrastructure, database services, storage, hosting, authentication,
            email, communications, payment processing, security, analytics and other supporting
            technology.
          </p>
          <p>
            Corepilot may disclose personal information to such providers where reasonably necessary
            for them to provide their services and will take reasonable steps to ensure appropriate
            confidentiality, security and data protection obligations are in place.
          </p>

          <h2 style={s.h2}>12. Cross-border processing</h2>
          <p>
            Some third-party technology providers used by PracticePilot may store or process
            information outside South Africa. Where personal information is transferred outside
            South Africa, Corepilot will take reasonable steps to ensure that the transfer is
            permitted under POPIA and that appropriate safeguards are in place.
          </p>

          <h2 style={s.h2}>13. Disclosure of personal information</h2>
          <p>We do not sell customer personal information.</p>
          <p>
            We may disclose personal information to service providers supporting PracticePilot,
            where instructed by the relevant customer, where required to perform contractual
            obligations, where required by law or lawful court or regulatory process, where
            reasonably necessary to investigate fraud or security incidents, or as part of a lawful
            merger, acquisition, restructuring or sale of the PracticePilot business.
          </p>

          <h2 style={s.h2}>14. Marketing communications</h2>
          <p>
            Corepilot may communicate with existing customers regarding PracticePilot products,
            new modules, service updates, training, relevant features, subscription information and
            related services.
          </p>
          <p>
            Electronic direct marketing will be conducted in accordance with applicable law.
            Where required, consent will be obtained. Recipients may unsubscribe from marketing
            communications, while service, security, billing and contractual communications may
            still be sent where reasonably necessary.
          </p>

          <h2 style={s.h2}>15. Cookies and website technologies</h2>
          <p>
            The PracticePilot website may use cookies and similar technologies for session
            management, authentication, security, remembering user preferences, measuring website
            performance and improving the user experience.
          </p>
          <p>
            Where required, users will be provided with information and choices regarding
            non-essential cookies.
          </p>

          <h2 style={s.h2}>16. Retention of personal information</h2>
          <p>
            Corepilot retains personal information only for as long as reasonably necessary for
            providing PracticePilot, maintaining customer accounts, billing, tax and accounting
            records, security, audit trails, dispute resolution, compliance with legal obligations
            and other lawful business purposes.
          </p>
          <p>
            Once information is no longer reasonably required and no lawful basis for continued
            retention exists, it will be deleted, destroyed or de-identified as appropriate.
          </p>

          <h2 style={s.h2}>17. Data subject rights</h2>
          <p>
            Subject to POPIA and applicable limitations, a data subject may request confirmation of
            whether Corepilot holds personal information about them, access to personal information,
            correction of inaccurate information, updating of incomplete information, deletion or
            destruction where legally appropriate, objection to certain processing and other rights
            available under POPIA.
          </p>
          <p>
            A data subject may also lodge a complaint with the Information Regulator.
          </p>

          <h2 style={s.h2}>18. Access, correction and deletion requests</h2>
          <p>
            Privacy-related requests may be submitted to
            <strong> practice@practicepilot.co.za</strong>.
          </p>
          <p>
            We may require reasonable proof of identity before providing access to, correcting or
            deleting personal information.
          </p>

          <h2 style={s.h2}>19. Security compromises</h2>
          <p>
            Where Corepilot, acting as a responsible party, has reasonable grounds to believe that
            personal information has been accessed or acquired by an unauthorised person, Corepilot
            will take the steps required under applicable law.
          </p>
          <p>
            Where Corepilot acts as an operator and becomes aware of a security compromise affecting
            information processed on behalf of a customer, Corepilot will notify that customer as
            soon as reasonably practicable and cooperate reasonably in investigating and responding
            to the incident.
          </p>

          <h2 style={s.h2}>20. Children's personal information</h2>
          <p>
            PracticePilot is intended for business and professional use and is not directed at
            children. Customers should not process personal information relating to children through
            PracticePilot unless they have a lawful basis and all required authority to do so.
          </p>

          <h2 style={s.h2}>21. Special personal information</h2>
          <p>
            Certain customer records may contain special personal information. Customers are
            responsible for ensuring that they have lawful authority to process and upload such
            information through PracticePilot.
          </p>

          <h2 style={s.h2}>22. Automated processing</h2>
          <p>
            PracticePilot may perform automated calculations, classifications, validations,
            document generation and workflow processing based on information entered by users.
            These automated functions are intended to assist the customer and do not replace
            professional review or decision-making.
          </p>

          <h2 style={s.h2}>23. Account and usage records</h2>
          <p>
            Corepilot may retain system records relating to account creation, logins, user access,
            permission changes, agreement acceptance, plan selection, billing events, creation of
            engagements or manuals, subscription cancellation, administrative actions and other
            significant system events.
          </p>
          <p>
            These records may be used for security, billing, auditing, customer support,
            investigation of misuse, dispute resolution and evidence of electronic transactions.
          </p>

          <h2 style={s.h2}>24. Changes to this Privacy Notice</h2>
          <p>
            Corepilot may update this Privacy Notice where reasonably required because of changes
            in PracticePilot, new products or functionality, changes in law, regulatory guidance,
            technology changes or changes in processing activities.
          </p>
          <p>
            Material changes will be communicated through PracticePilot, email or another
            appropriate method.
          </p>

          <h2 style={s.h2}>25. Contact us</h2>
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
            Billing: <strong>billing@practicepilot.co.za</strong><br />
            Website: <strong>practicepilot.co.za</strong>
          </p>

          <h2 style={s.h2}>26. Information Regulator</h2>
          <p>
            A data subject who believes that personal information has been processed contrary to
            POPIA may lodge a complaint with the Information Regulator (South Africa). Current
            Information Regulator contact information should be obtained from the Regulator's
            official website.
          </p>

          <div style={s.footerNote}>
            <strong>Privacy Notice version:</strong> 1.0
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
