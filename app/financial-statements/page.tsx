import type { Metadata } from "next";
import Image from "next/image";
import styles from "./financial-statements.module.css";

export const metadata: Metadata = {
  title: "Annual Financial Statements | PracticePilot",
  description:
    "Prepare professional annual financial statements from trial balance to final PDF in one structured PracticePilot workflow.",
};

const bookingUrl =
  process.env.NEXT_PUBLIC_AFS_DEMO_BOOKING_URL ||
  "https://calendly.com/practice-practicepilot/practicepilot-afs-demo";

const workflow = ["Import", "Map", "Adjust", "Complete", "Review", "Export"];

export default function FinancialStatementsLandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="PracticePilot home">
          PracticePilot
        </a>

        <nav className={styles.nav} aria-label="Marketing navigation">
          <a href="#workflow">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="/login">Login</a>
          <a className={styles.headerCta} href={bookingUrl}>
            Book a demo
          </a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>PracticePilot Financial Statements</span>

          <h1>
            Annual Financial Statements.
            <br />
            Without the usual headache.
          </h1>

          <p className={styles.heroLead}>
            Prepare professional Annual Financial Statements from trial balance to
            final PDF in one structured workflow, built for South African accounting
            practices.
          </p>

          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href={bookingUrl}>
              Book a 20-minute demo
            </a>
            <span className={styles.freeTag}>Your first 2 AFS sets are free.</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <Image
            src="/marketing/afs/financial-statements.png"
            alt="PracticePilot annual financial statements Print Studio"
            width={1600}
            height={1000}
            priority
          />
        </div>
      </section>

      <section className={styles.workflowStrip} id="workflow">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>One workflow</span>
          <h2>From trial balance to finished AFS.</h2>
          <p>
            Keep the working file, adjustments, disclosures and final statements
            together instead of jumping between spreadsheets and templates.
          </p>
        </div>

        <div className={styles.workflowSteps}>
          {workflow.map((step, index) => (
            <div className={styles.workflowStep} key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.featureCopy}>
          <span className={styles.stepNumber}>01</span>
          <h2>Import your trial balance.</h2>
          <p>
            Bring current and prior-year balances into PracticePilot from Excel.
            Choose the import method that matches the records you have, map the
            columns and review the sample before importing.
          </p>

          <ul>
            <li>Current and prior-year final TB</li>
            <li>Opening balance plus annual movement</li>
            <li>Rolled-over figures plus current-year TB</li>
            <li>Current-year TB only</li>
          </ul>
        </div>

        <div className={styles.featureVisual}>
          <Image
            src="/marketing/afs/tb-import.png"
            alt="PracticePilot trial balance import options"
            width={1600}
            height={1000}
          />
        </div>
      </section>

      <section className={`${styles.featureSection} ${styles.reverse}`}>
        <div className={styles.featureCopy}>
          <span className={styles.stepNumber}>02</span>
          <h2>Map the accounts to the AFS.</h2>
          <p>
            Work through the trial balance against the PracticePilot mapping
            library. Suggested mappings and confidence indicators help speed up the
            process, while the accountant stays in control of every classification.
          </p>

          <div className={styles.callout}>
            See what is mapped, what still needs attention and exactly where each
            balance will appear.
          </div>
        </div>

        <div className={styles.featureVisual}>
          <Image
            src="/marketing/afs/mapping.png"
            alt="PracticePilot AFS mapping workspace"
            width={1600}
            height={1000}
          />
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.featureCopy}>
          <span className={styles.stepNumber}>03</span>
          <h2>Post adjustments inside the working file.</h2>
          <p>
            Create adjusting journals directly inside the engagement. Debits and
            credits are checked before posting and the adjustment flows through to
            the financial statements.
          </p>

          <div className={styles.statLine}>
            <strong>Balanced journal control</strong>
            <span>Debit = Credit = Nil difference</span>
          </div>
        </div>

        <div className={styles.featureVisual}>
          <Image
            src="/marketing/afs/journals.png"
            alt="PracticePilot adjusting journals"
            width={1600}
            height={1000}
          />
        </div>
      </section>

      <section className={`${styles.featureSection} ${styles.reverse}`}>
        <div className={styles.featureCopy}>
          <span className={styles.stepNumber}>04</span>
          <h2>Complete the notes and supporting work.</h2>
          <p>
            Build disclosures and supporting schedules in the same engagement.
            PracticePilot keeps the working detail close to the financial statements
            it supports.
          </p>

          <ul>
            <li>Property, plant and equipment</li>
            <li>Inventory and cash</li>
            <li>Operating expenses</li>
            <li>Loans and related parties</li>
            <li>Tax and accounting policies</li>
          </ul>
        </div>

        <div className={styles.featureVisual}>
          <Image
            src="/marketing/afs/notes-work.png"
            alt="PracticePilot notes work area"
            width={1600}
            height={1000}
          />
        </div>
      </section>

      <section className={styles.outputSection}>
        <div className={styles.sectionIntroLight}>
          <span className={styles.eyebrowLight}>
            From working file to client-ready AFS
          </span>
          <h2>See the statements while you work.</h2>
          <p>
            Review the Statement of Financial Position, income statement, equity,
            cash flow, policies, notes, detailed income statement and tax from one
            Print Studio.
          </p>
        </div>

        <div className={styles.outputGrid}>
          <div className={styles.outputImage}>
            <Image
              src="/marketing/afs/cover.png"
              alt="PracticePilot annual financial statements cover page"
              width={1600}
              height={1000}
            />
          </div>

          <div className={styles.outputImage}>
            <Image
              src="/marketing/afs/financial-statements.png"
              alt="PracticePilot Statement of Financial Position"
              width={1600}
              height={1000}
            />
          </div>
        </div>

        <div className={styles.flightdeckText}>
          <span>FLIGHTDECK</span>
          <strong>Review blockers before export.</strong>
          <p>
            PracticePilot highlights items that still require attention so you know
            what needs to be resolved before the file is finalised.
          </p>
        </div>
      </section>

      <section className={styles.demoSection} id="book-demo">
        <div>
          <span className={styles.eyebrow}>See it work</span>
          <h2>Book a 20-minute PracticePilot AFS demo.</h2>
          <p>
            We will take you through the same workflow you see above using the
            PracticePilot live demo file: TB import, mapping, journals, notes,
            financial statements and export.
          </p>
          <p className={styles.noPitch}>No 45-minute sales presentation.</p>
        </div>

        <a className={styles.primaryButton} href={bookingUrl}>
          Book my demo
        </a>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Try it before you commit</span>
          <h2>Your first 2 sets of AFS are free.</h2>
          <p>
            After onboarding, use PracticePilot on real work before choosing the
            pricing model that suits your practice.
          </p>
        </div>

        <div className={styles.pricingGrid}>
          <article className={styles.priceBox}>
            <span className={styles.priceLabel}>Flex</span>
            <div className={styles.price}>R199</div>
            <div className={styles.pricePeriod}>per month</div>
            <p>Includes 1 set of AFS per month.</p>
            <div className={styles.priceExtra}>Additional AFS: R295 each</div>
          </article>

          <article className={styles.priceBox}>
            <span className={styles.priceLabel}>Unlimited</span>
            <div className={styles.price}>R499</div>
            <div className={styles.pricePeriod}>per user / month</div>
            <p>
              For practices preparing higher volumes of Annual Financial Statements.
            </p>
            <div className={styles.priceExtra}>
              Unlimited AFS covered for licensed users.
            </div>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.eyebrowLight}>PracticePilot</span>
        <h2>Your AFS workflow can be simpler.</h2>
        <p>See the full workflow in a 20-minute online demonstration.</p>
        <a className={styles.lightButton} href={bookingUrl}>
          Book a demo
        </a>
      </section>

      <footer className={styles.footer}>
        <strong>PracticePilot</strong>
        <span>Financial Statements built around the way accounting practices work.</span>
        <a href="mailto:practice@practicepilot.co.za">
          practice@practicepilot.co.za
        </a>
      </footer>
    </main>
  );
}
