// Path: app/legal/saas-subscription-agreement/page.tsx


import type { CSSProperties } from "react";
import CloseLegalTabButton from "../CloseLegalTabButton";

export const metadata = {
  title: "PracticePilot SaaS Subscription Agreement",
  description: "PracticePilot Software as a Service Subscription Agreement.",
};

export default function SaasSubscriptionAgreementPage() {
  return (
   <main style={s.page}>
  <div style={s.shell}>
    <div style={{ marginBottom: 16 }}>
      <CloseLegalTabButton />
    </div>

    <header style={s.header}>
          <div style={s.eyebrow}>LEGAL</div>
          <h1 style={s.title}>PracticePilot SaaS Subscription Agreement</h1>
          <p style={s.meta}>Version 1.0</p>
        </header>

        <section style={s.document}>
          <p>
            This Software as a Service Subscription Agreement (“Agreement”) governs
            the subscription to and use of the PracticePilot software platform.
          </p>

          <h2 style={s.h2}>1. Parties</h2>
          <p>
            This Agreement is concluded between <strong>Corepilot Software Holdings (Pty) Ltd</strong>,
            registration number <strong>2026/399739/07</strong>, trading as <strong>PracticePilot</strong>,
            with registered and operational address at 81 Kafue Street, Lynnwood Glen,
            Pretoria, Gauteng, 0081, South Africa (“Corepilot”, “PracticePilot”, “we”,
            “us” or “our”), and the business, accounting practice, company, close
            corporation, partnership, trust, sole proprietor or other entity subscribing
            to or using PracticePilot (“Customer”, “you” or “your”).
          </p>
          <p>
            The individual accepting this Agreement on behalf of the Customer warrants
            that he or she is duly authorised to enter into and bind the Customer to this
            Agreement.
          </p>

          <h2 style={s.h2}>2. PracticePilot</h2>
          <p>
            PracticePilot is a cloud-based software platform providing accounting,
            financial reporting, compliance, practice management, client management,
            secretarial, project management, billing and related business software
            functionality.
          </p>
          <p>
            PracticePilot consists of various modules, products and functionality which
            may be introduced, amended or expanded from time to time. Access to specific
            functionality depends on the subscription, modules, permissions and services
            selected by the Customer.
          </p>
          <p>
            Corepilot may improve, update, modify or replace functionality as
            PracticePilot develops, but will not intentionally remove material
            functionality from a paid subscription without reasonable notice where
            reasonably practicable.
          </p>

          <h2 style={s.h2}>3. Month-to-month subscription</h2>
          <p>
            Unless a separate written agreement expressly provides otherwise, all
            PracticePilot subscriptions are supplied on a <strong>month-to-month basis</strong>.
            There is no fixed annual commitment and no cancellation penalty applicable to
            the standard month-to-month subscription.
          </p>
          <p>
            The Customer may cancel its subscription through the cancellation
            functionality provided within PracticePilot. Cancellation becomes effective
            at the end of the applicable paid subscription period.
          </p>
          <p>
            Cancellation does not extinguish invoices already issued, subscription fees
            already payable, usage fees incurred before cancellation, charges relating to
            transactions already completed, or any other accrued obligation.
          </p>

          <h2 style={s.h2}>4. Billing cycle</h2>
          <p>
            PracticePilot operates on a recurring monthly billing cycle. The monthly
            <strong> billing cut-off is the 25th day of each month</strong> and regular
            monthly billing is processed on the <strong>26th day of each month</strong>.
          </p>
          <p>
            Subscription fees are generally billed in advance for the next subscription
            period, while usage-based fees incurred up to and including the 25th are
            generally billed in arrears on the 26th.
          </p>
          <p>
            Unless otherwise stated on an invoice, all invoices are payable within
            <strong> 7 calendar days</strong> from the invoice date.
          </p>

          <h2 style={s.h2}>5. AFS Flex</h2>
          <p>
            At the current pricing applicable to the Customer, AFS Flex comprises a
            monthly subscription fee of <strong>R199</strong>, one Financial Statement
            engagement included per billing cycle, and additional Financial Statement
            engagements charged at <strong>R295 each</strong>.
          </p>
          <p>
            Where a Customer activates AFS Flex after the beginning of a billing period,
            the full AFS Flex monthly subscription fee is charged and is not pro-rated.
            The Customer nevertheless receives the full allocation of one included AFS
            engagement for that billing cycle.
          </p>
          <p>
            The included AFS engagement is available only for the applicable billing
            cycle, does not roll over or accumulate if unused, has no cash value, may not
            be transferred to another organisation, and expires when that billing cycle
            ends.
          </p>
          <p>
            Once the included AFS has been used, any further AFS engagements created
            during the same billing cycle attract the applicable additional AFS charge.
            Additional AFS usage recorded up to and including the 25th is invoiced on the
            26th.
          </p>

          <h2 style={s.h2}>6. AFS Unlimited</h2>
          <p>
            AFS Unlimited is charged at <strong>R499 per licence per month</strong> at
            current pricing. The Customer selects the required number of licences when
            activating the plan.
          </p>
          <p>
            AFS Unlimited permits unlimited legitimate AFS engagement creation during
            the period in which the applicable licences remain active, subject to this
            Agreement and PracticePilot's acceptable-use restrictions.
          </p>
          <p>
            The initial AFS Unlimited subscription fee will be
            <strong> pro-rated</strong> where the subscription begins partway through a
            month. Thereafter, the full subscription amount is invoiced monthly in
            advance.
          </p>

          <h2 style={s.h2}>7. PAIA manuals and other usage-based services</h2>
          <p>
            Certain PracticePilot services are charged according to actual usage. At the
            current pricing applicable to the Customer, each billable PAIA manual is
            charged at <strong>R250</strong>.
          </p>
          <p>
            Billable PAIA manuals created up to and including the 25th of the month are
            consolidated and invoiced on the 26th. PAIA charges are therefore billed in
            arrears according to actual usage and are payable within 7 calendar days.
          </p>
          <p>
            Once a billable PAIA manual has been validly created, the associated charge
            becomes payable even if the Customer subsequently chooses not to deliver the
            manual to its own client.
          </p>

          <h2 style={s.h2}>8. Promotional and free AFS credits</h2>
          <p>
            PracticePilot may grant free AFS engagements or promotional credits. Such
            credits are consumed before normal paid AFS usage charging begins, have no
            cash value, cannot be exchanged for cash, and are not transferable to another
            Customer or organisation.
          </p>

          <h2 style={s.h2}>9. Prices and VAT</h2>
          <p>
            Prices displayed by PracticePilot are intended to represent the amount
            payable by the Customer unless specifically stated otherwise.
          </p>
          <p>
            While Corepilot is not registered or liable to be registered as a VAT vendor,
            VAT will not be separately charged. If Corepilot becomes registered or liable
            to register as a VAT vendor, the displayed PracticePilot price will, unless
            expressly stated otherwise, be treated as VAT-inclusive.
          </p>
          <p>
            Corepilot does not intend automatically to increase an existing displayed
            PracticePilot price merely because VAT subsequently becomes applicable.
            Once VAT applies, the VAT portion will be extracted from the displayed price
            and shown separately on a compliant tax invoice where required.
          </p>

          <h2 style={s.h2}>10. Price changes</h2>
          <p>
            Corepilot may change subscription and usage prices from time to time. Any
            material price increase affecting an existing recurring subscription will be
            communicated before the new price becomes effective.
          </p>
          <p>
            If the Customer does not wish to continue at the new price, the Customer may
            cancel the affected subscription before the new price takes effect.
          </p>

          <h2 style={s.h2}>11. Billing and payment</h2>
          <p>
            PracticePilot may issue consolidated invoices containing subscription and
            usage charges. Unless expressly stated otherwise, invoices are payable within
            7 calendar days from invoice date.
          </p>
          <p>
            Billing queries, invoice disputes and payment correspondence may be sent to
            <strong> billing@practicepilot.co.za</strong>.
          </p>
          <p>
            Failure to receive, open or forward an invoice does not extinguish a valid
            payment obligation. Corepilot may correct genuine billing errors.
          </p>

          <h2 style={s.h2}>12. Non-payment and suspension</h2>
          <p>
            If an invoice becomes overdue, Corepilot may notify the Customer and may
            suspend access to some or all paid PracticePilot functionality if payment
            remains outstanding after reasonable notice.
          </p>
          <p>
            Suspension does not cancel the subscription, extinguish outstanding amounts,
            constitute a waiver of Corepilot's rights, or automatically delete Customer
            Data.
          </p>

          <h2 style={s.h2}>13. Users and licences</h2>
          <p>
            User accounts are intended for individual authorised users and login
            credentials may not be shared for the purpose of avoiding licence charges.
          </p>
          <p>
            The Customer is responsible for allocating user access appropriately,
            maintaining accurate user information, removing access when required,
            safeguarding credentials and monitoring activity performed through its
            authorised accounts.
          </p>

          <h2 style={s.h2}>14. Licence to use PracticePilot</h2>
          <p>
            Subject to payment of applicable fees and compliance with this Agreement,
            Corepilot grants the Customer a limited, non-exclusive, non-transferable
            right to access and use PracticePilot for the Customer's legitimate internal
            business and professional purposes.
          </p>
          <p>
            The Customer may not reverse engineer, decompile, unlawfully copy, resell,
            sublicense or circumvent billing, licence, usage or security controls, nor
            use PracticePilot for unlawful purposes.
          </p>

          <h2 style={s.h2}>15. Customer Data</h2>
          <p>
            Customer Data remains the property of the Customer or the applicable
            underlying data owner. Corepilot does not acquire ownership of Customer Data
            merely because it is stored or processed through PracticePilot.
          </p>
          <p>
            The Customer grants Corepilot the limited authority necessary to host,
            store, process, transmit, back up, retrieve and otherwise process Customer
            Data to the extent reasonably required to provide and maintain PracticePilot.
          </p>

          <h2 style={s.h2}>16. POPIA and data processing</h2>
          <p>
            Each party must comply with the Protection of Personal Information Act 4 of
            2013 (“POPIA”) to the extent applicable to it.
          </p>
          <p>
            Where Corepilot processes Personal Information on behalf of the Customer,
            Corepilot acts as an operator in respect of that processing and the Customer
            remains the responsible party, except where Corepilot independently
            determines the purpose and means of processing for its own lawful purposes.
          </p>
          <p>
            Corepilot will maintain reasonable technical and organisational safeguards
            designed to protect Personal Information and may use reputable third-party
            infrastructure and service providers subject to appropriate protections.
          </p>

          <h2 style={s.h2}>17. Confidentiality</h2>
          <p>
            Each party must keep the other party's confidential and proprietary
            information confidential and may use it only for purposes relating to the
            provision or use of PracticePilot, except where disclosure is required by law
            or otherwise lawfully permitted.
          </p>

          <h2 style={s.h2}>18. Intellectual property</h2>
          <p>
            All intellectual property rights in PracticePilot remain vested in Corepilot
            or its applicable licensors. This includes software, source code,
            architecture, database structures, workflow logic, interface designs,
            templates, reports, documentation, trademarks, branding, methodologies,
            improvements and enhancements.
          </p>
          <p>
            Customer-specific data remains Customer Data.
          </p>

          <h2 style={s.h2}>19. Third-party services</h2>
          <p>
            PracticePilot may rely on third-party providers for hosting, database
            infrastructure, storage, authentication, communications, email, payment
            processing and other technology services. Corepilot is not liable for
            failures entirely outside its reasonable control but will use commercially
            reasonable efforts to restore affected functionality.
          </p>

          <h2 style={s.h2}>20. Availability, maintenance and support</h2>
          <p>
            Corepilot will use commercially reasonable efforts to maintain the
            availability and proper functioning of PracticePilot. PracticePilot may
            occasionally be unavailable due to maintenance, software updates,
            infrastructure failure, cyber incidents, third-party outages or
            circumstances beyond Corepilot's reasonable control.
          </p>
          <p>
            Technical and user support queries should be directed to
            <strong> support@practicepilot.co.za</strong>.
          </p>

          <h2 style={s.h2}>21. Accounting, tax and professional responsibility</h2>
          <p>
            PracticePilot is a software platform and does not replace professional
            judgement.
          </p>
          <p>
            The Customer remains responsible for reviewing and approving accounting
            records, financial statements, tax calculations, statutory documents,
            compliance documents, reports, calculations and other outputs before
            relying on, issuing, submitting or distributing them.
          </p>
          <p>
            Corepilot does not become the Customer's auditor, independent reviewer,
            accountant, tax practitioner, company secretary, Information Officer,
            attorney or other professional adviser merely because PracticePilot provides
            software functionality relating to those activities.
          </p>
          <p>
            Financial statements generated through PracticePilot do not constitute an
            audit opinion, independent review conclusion or other assurance opinion
            issued by Corepilot.
          </p>

          <h2 style={s.h2}>22. Customer's own clients</h2>
          <p>
            Where the Customer uses PracticePilot in providing services to its own
            clients, the Customer remains responsible for that professional engagement.
            Corepilot is not a party to the engagement between the Customer and its
            client.
          </p>

          <h2 style={s.h2}>23. Warranties and disclaimers</h2>
          <p>
            Corepilot will use reasonable commercial efforts to maintain and improve
            PracticePilot. PracticePilot is intended to assist competent users and is not
            a substitute for appropriate professional review.
          </p>
          <p>
            To the extent permitted by law, Corepilot does not warrant uninterrupted
            availability, immediate correction of every defect, suitability of every
            output for every circumstance, or prevention of every user error, fraud,
            omission or incorrect input.
          </p>

          <h2 style={s.h2}>24. Limitation of liability</h2>
          <p>
            Neither party will be liable to the other for indirect, special, incidental
            or consequential losses, including loss of anticipated profit, opportunity
            or reputation, except to the extent such exclusion is prohibited by law.
          </p>
          <p>
            To the fullest extent permitted by law, Corepilot's total aggregate liability
            for claims arising from or connected with PracticePilot will be limited to
            the total subscription and usage fees actually paid by the Customer to
            Corepilot during the six months immediately preceding the event giving rise
            to the claim.
          </p>

          <h2 style={s.h2}>25. Breach</h2>
          <p>
            If either party materially breaches this Agreement, the other party may
            provide written notice requiring that breach to be remedied. Corepilot may
            suspend access immediately where reasonably necessary because of deliberate
            security compromise, fraud, unlawful activity, deliberate circumvention of
            billing or licence controls, serious abuse or conduct creating a material
            threat to PracticePilot or other users.
          </p>

          <h2 style={s.h2}>26. Cancellation and termination</h2>
          <p>
            The Customer may cancel an active month-to-month subscription through
            PracticePilot. PracticePilot must clearly display the effective cancellation
            date before final confirmation and the Customer must actively confirm the
            cancellation.
          </p>
          <p>
            Normal cancellation takes effect at the end of the current paid subscription
            period. Amounts incurred before the effective cancellation date remain
            payable.
          </p>

          <h2 style={s.h2}>27. Data following termination</h2>
          <p>
            Where reasonably practicable, the Customer will be provided an opportunity
            to export available Customer Data before final account closure.
          </p>
          <p>
            Corepilot may retain information after termination where required by law or
            reasonably necessary for financial, audit, billing, security, dispute or
            backup purposes.
          </p>

          <h2 style={s.h2}>28. Changes to this Agreement</h2>
          <p>
            Corepilot may update this Agreement where reasonably required because of
            changes in law, regulatory requirements, functionality, security,
            operations or reasonable commercial changes.
          </p>
          <p>
            Material changes affecting an existing paid Customer will be communicated
            before becoming effective.
          </p>

          <h2 style={s.h2}>29. Electronic acceptance</h2>
          <p>
            The parties agree that this Agreement may be concluded electronically.
            Acceptance occurs when an appropriately authorised user selects the
            applicable PracticePilot subscription, is presented with this Agreement or
            access to it, actively selects the acceptance checkbox, and clicks the
            applicable acceptance and activation button.
          </p>
          <p>
            Corepilot may retain an electronic acceptance record including the Customer,
            accepting user, email address, subscription selected, licence quantity,
            pricing accepted, date and time, Agreement version, applicable commercial
            terms and technical transaction records reasonably required to evidence
            acceptance.
          </p>

          <h2 style={s.h2}>30. Notices and communication</h2>
          <p>
            General contractual and legal notices to Corepilot may be sent to
            <strong> practice@practicepilot.co.za</strong>.
          </p>
          <p>
            Billing queries and payment correspondence may be sent to
            <strong> billing@practicepilot.co.za</strong>, and support queries to
            <strong> support@practicepilot.co.za</strong>.
          </p>
          <p>
            A cancellation submitted using PracticePilot's online cancellation process
            constitutes written cancellation notice.
          </p>

          <h2 style={s.h2}>31. Corepilot contact details</h2>
          <p>
            <strong>Corepilot Software Holdings (Pty) Ltd</strong><br />
            Registration number: 2026/399739/07<br />
            Trading as: PracticePilot<br />
            81 Kafue Street<br />
            Lynnwood Glen<br />
            Pretoria<br />
            Gauteng<br />
            0081<br />
            South Africa
          </p>
          <p>
            Website: <strong>practicepilot.co.za</strong><br />
            General / Legal: <strong>practice@practicepilot.co.za</strong><br />
            Billing: <strong>billing@practicepilot.co.za</strong><br />
            Support: <strong>support@practicepilot.co.za</strong>
          </p>

          <h2 style={s.h2}>32. Force majeure</h2>
          <p>
            Neither party will be liable for delay or failure caused by circumstances
            beyond its reasonable control, including major infrastructure failure,
            natural disaster, governmental action, war, civil unrest,
            telecommunications interruption or widespread third-party technology
            failure.
          </p>

          <h2 style={s.h2}>33. Relationship</h2>
          <p>
            Nothing in this Agreement creates a partnership, joint venture, employment
            relationship, agency or fiduciary relationship between Corepilot and the
            Customer. Each party acts independently.
          </p>

          <h2 style={s.h2}>34. Assignment</h2>
          <p>
            The Customer may not transfer or resell its subscription without Corepilot's
            prior written consent. Corepilot may transfer this Agreement as part of a
            bona fide restructuring, merger, sale, acquisition or transfer of the
            PracticePilot business, provided that the Customer's substantive contractual
            rights are not materially diminished.
          </p>

          <h2 style={s.h2}>35. Entire Agreement</h2>
          <p>
            This Agreement, the Customer's subscription selection, the applicable
            Privacy Notice and any expressly incorporated Data Processing or
            service-specific terms constitute the agreement governing use of
            PracticePilot.
          </p>

          <h2 style={s.h2}>36. Severability</h2>
          <p>
            If any provision is invalid or unenforceable, that provision will be limited
            or severed to the minimum extent necessary and the remaining provisions will
            continue in force.
          </p>

          <h2 style={s.h2}>37. No waiver</h2>
          <p>
            Failure or delay in enforcing a contractual right does not constitute a
            waiver of that right.
          </p>

          <h2 style={s.h2}>38. Governing law</h2>
          <p>
            This Agreement is governed by the laws of the Republic of South Africa. The
            parties will first attempt in good faith to resolve any dispute directly.
            Nothing prevents either party from approaching a court of competent
            jurisdiction where necessary.
          </p>

          <h2 style={s.h2}>39. Customer acceptance</h2>
          <p>By accepting this Agreement electronically, the Customer confirms that:</p>
          <ul style={s.list}>
            <li>the person accepting is authorised to bind the Customer;</li>
            <li>the Customer has had an opportunity to read this Agreement;</li>
            <li>the Customer accepts the selected PracticePilot subscription and pricing;</li>
            <li>the Customer understands that the standard subscription is month-to-month;</li>
            <li>the Customer understands that the billing cut-off is the 25th;</li>
            <li>the Customer understands that regular invoices are generated on the 26th;</li>
            <li>the Customer understands that invoices are payable within 7 calendar days;</li>
            <li>the Customer understands that AFS Flex is not pro-rated on initial activation;</li>
            <li>the Customer understands that unused AFS Flex included engagements do not roll over;</li>
            <li>the Customer understands that an initial AFS Unlimited subscription may be pro-rated;</li>
            <li>the Customer understands the online cancellation arrangements;</li>
            <li>the Customer accepts the applicable Privacy Notice and Data Processing provisions; and</li>
            <li>the Customer agrees to be bound by this Agreement.</li>
          </ul>

          <div style={s.footerNote}>
            <strong>Agreement version:</strong> 1.0
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
