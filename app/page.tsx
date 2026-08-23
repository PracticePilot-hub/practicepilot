import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brandLink} aria-label="PracticePilot home">
          <Image
            src="/brand/practicepilot-horizontal-logo.png"
            alt="PracticePilot"
            width={190}
            height={59}
            className={styles.logo}
            priority
          />
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#products">Products</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
          <Link href="/login">Login</Link>
          <Link href="/financial-statements" className={styles.navCta}>
            Financial Statements
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>Your practice, finally in one workspace.</h1>

          <p className={styles.heroLead}>
            PracticePilot brings client management, financial statements,
            compliance, projects and practice workflows together in one secure,
            professional platform.
          </p>

          <div className={styles.heroActions}>
            <Link href="/financial-statements" className={styles.primaryButton}>
              Explore Financial Statements
            </Link>

            <Link href="/login" className={styles.secondaryButton}>
              Login
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <Image
            src="/brand/practicepilot-hero-v2.png"
            alt="PracticePilot workspace"
            fill
            sizes="(max-width: 980px) 100vw, 50vw"
            className={styles.heroImage}
            priority
          />
        </div>
      </section>

      <section id="products" className={styles.productsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Use what your practice needs.</h2>
          </div>

          <p>
            Start with one PracticePilot product and add more as your practice grows.
            Your team remains in the same workspace and access model.
          </p>
        </div>

        <div className={styles.productRows}>
          <article className={styles.productRow}>
            <div className={styles.productCopy}>
              <h3>Practice Management</h3>
              <p>
                Manage clients, proposals, projects, responsibilities, workflow and
                practice visibility from one central workspace.
              </p>
            </div>

            <div className={styles.productMeta}>
              CRM · Proposals · Projects · Workflow
            </div>
          </article>

          <article className={`${styles.productRow} ${styles.productRowFeatured}`}>
            <div className={styles.productCopy}>
              <h3>Financial Statements</h3>
              <p>
                Import the trial balance, map accounts, process journals, complete
                working papers and produce professional Annual Financial Statements.
              </p>
            </div>

            <Link href="/financial-statements" className={styles.productLink}>
              First 2 AFS sets free →
            </Link>
          </article>

          <article className={styles.productRow}>
            <div className={styles.productCopy}>
              <h3>PAIA Manuals</h3>
              <p>
                Create professional PAIA manuals for your own practice or for clients,
                with structured data capture and professional PDF output.
              </p>
            </div>

            <div className={styles.productMeta}>Usage-based billing</div>
          </article>
        </div>
      </section>

      <section className={styles.warmBand}>
        <div>
          <h2>Software should make the work feel lighter, not add another layer of admin.</h2>
        </div>

        <p>
          PracticePilot is designed around the way accounting practices actually work:
          client files, deadlines, working papers, review points, compliance and the
          constant need to know what still requires attention.
        </p>
      </section>

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.pricingIntro}>
          <h2>AFS your way.</h2>
          <p>
            Choose Flex for occasional AFS work or Unlimited for regular,
            higher-volume preparation.
          </p>
        </div>

        <div className={styles.pricingGrid}>
          <article className={styles.priceCard}>
            <div className={styles.priceCardTop}>
              <span>Flex</span>
              <span>Lower volume</span>
            </div>

            <h3>Pay as you prepare.</h3>

            <div className={styles.priceLine}>
              <strong>R199</strong>
              <span>/ month</span>
            </div>

            <div className={styles.priceRule} />

            <ul>
              <li>1 AFS included every month</li>
              <li>Additional AFS: R295 each</li>
              <li>Practice-based pricing</li>
              <li>Ideal for occasional AFS work</li>
            </ul>

            <div className={styles.trialNote}>
              <strong>First 2 AFS sets free.</strong>
              <span>Use PracticePilot on real client files before you commit.</span>
            </div>
          </article>

          <article className={`${styles.priceCard} ${styles.priceCardFeatured}`}>
            <div className={styles.priceCardTop}>
              <span>Unlimited</span>
              <span>Higher volume</span>
            </div>

            <h3>Unlimited AFS.</h3>

            <div className={styles.priceLine}>
              <strong>R499</strong>
              <span>/ user / month</span>
            </div>

            <div className={styles.priceRule} />

            <ul>
              <li>Unlimited AFS</li>
              <li>No per-engagement charges</li>
              <li>Pay only for AFS preparers</li>
              <li>Predictable monthly cost</li>
            </ul>

            <div className={styles.trialNote}>
              <strong>First 2 AFS sets free.</strong>
              <span>Then choose the model that makes sense for your practice.</span>
            </div>
          </article>
        </div>
      </section>

      <section id="about" className={styles.aboutSection}>
        <div>
          <h2>Built around real practice workflows.</h2>
        </div>

        <div className={styles.aboutCopy}>
          <p>
            PracticePilot is developed by Corepilot Software (Pty) Ltd to help
            professional firms work with better structure, better visibility and fewer
            spreadsheet-driven errors.
          </p>

          <p>
            Financial Statements, PAIA, Practice Management and future PracticePilot
            products live within the same platform and access model.
          </p>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <div>
          <h2>See the financial statements workflow in action.</h2>
          <p>
            From TB import to final PDF — built around the way accounting practices work.
          </p>
        </div>

        <Link href="/financial-statements" className={styles.lightButton}>
          Explore Financial Statements
        </Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Image
            src="/brand/practicepilot-horizontal-logo.png"
            alt="PracticePilot"
            width={165}
            height={51}
            className={styles.footerLogo}
          />

          <span>
            © {new Date().getFullYear()} Corepilot Software (Pty) Ltd. All rights reserved.
          </span>
        </div>

        <div className={styles.footerLinks}>
          <Link href="/legal/copyright">Copyright &amp; Intellectual Property</Link>
          <a href="mailto:practice@practicepilot.co.za">practice@practicepilot.co.za</a>
        </div>
      </footer>
    </main>
  );
}
