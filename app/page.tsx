import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/" style={styles.brandLink}>
          <Image
            src="/brand/practicepilot-horizontal-logo.png"
            alt="PracticePilot"
            width={190}
            height={59}
            style={styles.logo}
            priority
          />
        </Link>

        <nav style={styles.nav}>
          <a href="#products" style={styles.navLink}>Products</a>
          <a href="#pricing" style={styles.navLink}>Pricing</a>
          <a href="#who-we-are" style={styles.navLink}>About</a>
          <Link href="/login" style={styles.loginButton}>Login</Link>
        </nav>
      </header>

      <section style={styles.hero}>
        <Image
          src="/brand/practicepilot-hero-v2.png"
          alt="PracticePilot dashboard"
          fill
          style={styles.heroImage}
          priority
        />

        <div style={styles.heroOverlay}>
          <div style={styles.heroContent}>
            <p style={styles.heroKicker}>Built for accounting practices</p>
            <h1 style={styles.heroTitle}>Your practice, finally in one workspace.</h1>
            <p style={styles.heroText}>
              PracticePilot brings client management, financial statements,
              compliance, projects and practice workflows together in one secure platform.
            </p>

            <div style={styles.heroButtons}>
              <Link href="/login" style={styles.primaryButton}>Login</Link>
              <a href="#products" style={styles.secondaryButton}>Explore Products</a>
            </div>
          </div>
        </div>
      </section>

      <section id="products" style={styles.section}>
        <div style={styles.sectionHeadingWrap}>
          <div>
            <p style={styles.kicker}>Products</p>
            <h2 style={styles.sectionTitle}>One platform. Use what your practice needs.</h2>
          </div>
          <p style={styles.sectionIntro}>
            Start with one PracticePilot product and add more as your practice grows.
            Your team stays inside the same PracticePilot account and workspace.
          </p>
        </div>

        <div style={styles.productGrid}>
          <article style={styles.productCard}>
            <div style={styles.productTopLine}>
              <span style={styles.productTag}>Core platform</span>
            </div>
            <h3 style={styles.productTitle}>Practice Management</h3>
            <p style={styles.cardText}>
              Manage clients, proposals, projects, responsibilities, workflow and
              practice visibility from one central workspace.
            </p>
            <div style={styles.productMeta}>CRM · Proposals · Projects · Workflow</div>
          </article>

          <article style={styles.productCardFeatured}>
            <div style={styles.productTopLine}>
              <span style={styles.productTagFeatured}>Financial Statements</span>
              <span style={styles.launchBadge}>2 AFS free</span>
            </div>
            <h3 style={styles.productTitle}>PracticePilot AFS</h3>
            <p style={styles.cardText}>
              Import the trial balance, map accounts, process journals, complete
              working papers, tax, disclosures, review and produce professional
              annual financial statements.
            </p>
            <div style={styles.productMeta}>
              Flex or Unlimited pricing — choose what suits your practice.
            </div>
          </article>

          <article style={styles.productCard}>
            <div style={styles.productTopLine}>
              <span style={styles.productTag}>Compliance</span>
            </div>
            <h3 style={styles.productTitle}>PAIA Manuals</h3>
            <p style={styles.cardText}>
              Create professional PAIA manuals for your own practice or for clients,
              with structured data capture and professional PDF output.
            </p>
            <div style={styles.productMeta}>Usage-based billing</div>
          </article>
        </div>
      </section>

      <section id="pricing" style={styles.pricingSection}>
        <div style={styles.pricingHeader}>
          <p style={styles.kicker}>Financial Statements pricing</p>
          <h2 style={styles.sectionTitle}>AFS your way.</h2>
          <p style={styles.pricingLead}>
            Whether you prepare a few sets of financial statements or hundreds,
            choose the model that works for your practice.
          </p>
        </div>

        <div style={styles.pricingGrid}>
          <article style={styles.priceCard}>
            <div style={styles.priceCardHeader}>
              <div>
                <p style={styles.priceEyebrow}>AFS Flex</p>
                <h3 style={styles.priceTitle}>Pay as you prepare</h3>
              </div>
              <span style={styles.bestForBadge}>Low volume</span>
            </div>

            <div style={styles.priceBlock}>
              <div style={styles.oldPrice}>Standard R249 / month</div>
              <div style={styles.priceLine}>
                <span style={styles.price}>R199</span>
                <span style={styles.priceSuffix}>/ month</span>
              </div>
              <div style={styles.launchText}>Launch pricing</div>
            </div>

            <div style={styles.rule} />

            <ul style={styles.featureList}>
              <li style={styles.featureItem}>1 AFS included every month</li>
              <li style={styles.featureItem}>Additional AFS: R295 each</li>
              <li style={styles.featureItem}>Standard additional AFS: R325 each</li>
              <li style={styles.featureItem}>Practice-based pricing</li>
              <li style={styles.featureItem}>Ideal for occasional AFS work</li>
            </ul>

            <div style={styles.freeTrialBox}>
              <strong>First 2 AFS free</strong>
              <span>Use PracticePilot on real client files before you commit.</span>
            </div>
          </article>

          <article style={styles.priceCardFeatured}>
            <div style={styles.priceCardHeader}>
              <div>
                <p style={styles.priceEyebrow}>AFS Unlimited</p>
                <h3 style={styles.priceTitle}>Unlimited AFS</h3>
              </div>
              <span style={styles.recommendedBadge}>Recommended</span>
            </div>

            <div style={styles.priceBlock}>
              <div style={styles.oldPrice}>Standard R649 / user / month</div>
              <div style={styles.priceLine}>
                <span style={styles.price}>R499</span>
                <span style={styles.priceSuffix}>/ user / month</span>
              </div>
              <div style={styles.launchText}>
                Launch pricing · Save R1,800 per user annually
              </div>
            </div>

            <div style={styles.rule} />

            <ul style={styles.featureList}>
              <li style={styles.featureItem}>Unlimited AFS</li>
              <li style={styles.featureItem}>No per-engagement charges</li>
              <li style={styles.featureItem}>Pay only for AFS preparers</li>
              <li style={styles.featureItem}>Predictable monthly cost</li>
              <li style={styles.featureItem}>Best for regular and high-volume practices</li>
            </ul>

            <div style={styles.freeTrialBoxFeatured}>
              <strong>First 2 AFS free</strong>
              <span>Then move onto the model that makes sense for your practice.</span>
            </div>
          </article>
        </div>

        <div style={styles.pricingNote}>
          <strong>Not sure which model suits your practice?</strong>
          <span>
            During onboarding we will look at your AFS volume and number of preparers
            and help you choose the more economical option.
          </span>
        </div>
      </section>

      <section id="who-we-are" style={styles.splitSection}>
        <div>
          <p style={styles.kicker}>Who we are</p>
          <h2 style={styles.sectionTitle}>Software built around real practice workflows.</h2>
          <p style={styles.bodyText}>
            PracticePilot is developed by Corepilot Software (Pty) Ltd to help
            professional firms work with better structure, better visibility and
            fewer spreadsheet-driven errors.
          </p>
        </div>

        <div style={styles.infoBox}>
          <p style={styles.infoKicker}>One PracticePilot account</p>
          <h3 style={styles.infoTitle}>One login. Multiple products.</h3>
          <p style={styles.cardText}>
            Financial Statements, PAIA, Practice Management and future PracticePilot
            products all live within the same platform and access model.
          </p>
        </div>
      </section>

      <footer style={styles.footer}>
        <Image
          src="/brand/practicepilot-horizontal-logo.png"
          alt="PracticePilot"
          width={170}
          height={53}
          style={styles.footerLogo}
        />
        <p style={styles.footerText}>
          © {new Date().getFullYear()} Corepilot Software (Pty) Ltd. All rights reserved.
        </p>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F3F8FC",
    color: "#0B2F4F",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    minHeight: "82px",
    background: "#ffffff",
    borderBottom: "1px solid #D5DDE6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    padding: "0 56px",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  brandLink: {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
  },
  logo: { objectFit: "contain" },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "28px",
    flexWrap: "wrap",
  },
  navLink: {
    color: "#0B2F4F",
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: 700,
  },
  loginButton: {
    background: "#0B5CAB",
    color: "#ffffff",
    textDecoration: "none",
    padding: "11px 20px",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 800,
  },
  hero: {
    position: "relative",
    minHeight: "560px",
    overflow: "hidden",
  },
  heroImage: { objectFit: "cover" },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, rgba(11,47,79,0.86) 0%, rgba(11,47,79,0.62) 42%, rgba(11,47,79,0.10) 78%)",
    display: "flex",
    alignItems: "center",
    padding: "0 clamp(28px, 6vw, 84px)",
  },
  heroContent: { maxWidth: "680px" },
  heroKicker: {
    margin: "0 0 12px 0",
    color: "#7FE2E7",
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: "1.6px",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "clamp(42px, 5vw, 66px)",
    lineHeight: 1.02,
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-1.5px",
  },
  heroText: {
    fontSize: "20px",
    lineHeight: 1.6,
    color: "#EAF4F8",
    marginTop: "22px",
    marginBottom: "32px",
    maxWidth: "650px",
  },
  heroButtons: { display: "flex", gap: "14px", flexWrap: "wrap" },
  primaryButton: {
    background: "#00A6B4",
    color: "#ffffff",
    textDecoration: "none",
    padding: "14px 22px",
    borderRadius: "8px",
    fontWeight: 800,
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#0B2F4F",
    textDecoration: "none",
    padding: "14px 22px",
    borderRadius: "8px",
    fontWeight: 800,
  },
  section: { padding: "78px clamp(28px, 6vw, 84px)" },
  sectionHeadingWrap: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
    gap: "40px",
    alignItems: "end",
    marginBottom: "34px",
  },
  kicker: {
    color: "#00A6B4",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1.4px",
    fontSize: "13px",
    margin: "0 0 12px 0",
  },
  sectionTitle: {
    fontSize: "clamp(32px, 4vw, 44px)",
    lineHeight: 1.08,
    margin: 0,
    color: "#0B2F4F",
    letterSpacing: "-0.6px",
  },
  sectionIntro: { margin: 0, color: "#5B6775", fontSize: "17px", lineHeight: 1.65 },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
  },
  productCard: {
    background: "#ffffff",
    border: "1px solid #D5DDE6",
    borderRadius: "10px",
    padding: "28px",
    boxShadow: "0 8px 24px rgba(11,47,79,0.05)",
  },
  productCardFeatured: {
    background: "#ffffff",
    border: "2px solid #00A6B4",
    borderRadius: "10px",
    padding: "27px",
    boxShadow: "0 12px 30px rgba(0,166,180,0.10)",
  },
  productTopLine: {
    minHeight: "27px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "18px",
  },
  productTag: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #D5DDE6",
    background: "#F7FAFC",
    color: "#5B6775",
    padding: "5px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.7px",
    textTransform: "uppercase",
  },
  productTagFeatured: {
    display: "inline-flex",
    alignItems: "center",
    background: "#E8F9FA",
    color: "#007C86",
    padding: "5px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.7px",
    textTransform: "uppercase",
  },
  launchBadge: {
    background: "#0B2F4F",
    color: "#ffffff",
    padding: "5px 9px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 900,
  },
  productTitle: { margin: "0 0 12px 0", color: "#0B2F4F", fontSize: "24px" },
  cardText: { margin: 0, color: "#5B6775", fontSize: "16px", lineHeight: 1.65 },
  productMeta: {
    marginTop: "22px",
    paddingTop: "17px",
    borderTop: "1px solid #E3E9EF",
    color: "#0B5CAB",
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 800,
  },
  pricingSection: {
    padding: "78px clamp(28px, 6vw, 84px)",
    background: "#ffffff",
    borderTop: "1px solid #D5DDE6",
    borderBottom: "1px solid #D5DDE6",
  },
  pricingHeader: { maxWidth: "780px", marginBottom: "34px" },
  pricingLead: { color: "#5B6775", fontSize: "18px", lineHeight: 1.65, margin: "18px 0 0 0" },
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    maxWidth: "1100px",
  },
  priceCard: {
    border: "1px solid #D5DDE6",
    borderRadius: "10px",
    background: "#ffffff",
    padding: "30px",
  },
  priceCardFeatured: {
    border: "2px solid #00A6B4",
    borderRadius: "10px",
    background: "#ffffff",
    padding: "29px",
    boxShadow: "0 14px 34px rgba(0,166,180,0.13)",
  },
  priceCardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" },
  priceEyebrow: {
    margin: "0 0 6px 0",
    color: "#00A6B4",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  priceTitle: { margin: 0, fontSize: "24px", color: "#0B2F4F" },
  bestForBadge: {
    background: "#F3F8FC",
    color: "#5B6775",
    border: "1px solid #D5DDE6",
    borderRadius: "4px",
    padding: "5px 8px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  recommendedBadge: {
    background: "#00A6B4",
    color: "#ffffff",
    borderRadius: "4px",
    padding: "5px 8px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  priceBlock: { marginTop: "28px" },
  oldPrice: { color: "#7A8793", fontSize: "13px", textDecoration: "line-through", marginBottom: "4px" },
  priceLine: { display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" },
  price: { color: "#0B5CAB", fontSize: "44px", lineHeight: 1, fontWeight: 900, letterSpacing: "-1px" },
  priceSuffix: { color: "#5B6775", fontSize: "14px", fontWeight: 700 },
  launchText: { marginTop: "8px", color: "#007C86", fontSize: "13px", fontWeight: 900 },
  rule: { height: "1px", background: "#E3E9EF", margin: "25px 0" },
  featureList: {
    margin: 0,
    paddingLeft: "20px",
    color: "#334155",
    display: "grid",
    gap: "11px",
    fontSize: "15px",
    lineHeight: 1.45,
  },
  featureItem: { paddingLeft: "3px" },
  freeTrialBox: {
    marginTop: "26px",
    background: "#F3F8FC",
    border: "1px solid #D5DDE6",
    padding: "14px 16px",
    display: "grid",
    gap: "5px",
    color: "#0B2F4F",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  freeTrialBoxFeatured: {
    marginTop: "26px",
    background: "#E8F9FA",
    border: "1px solid #B6E8EB",
    padding: "14px 16px",
    display: "grid",
    gap: "5px",
    color: "#0B2F4F",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  pricingNote: {
    maxWidth: "1100px",
    marginTop: "20px",
    padding: "18px 20px",
    background: "#F3F8FC",
    borderLeft: "4px solid #0B5CAB",
    display: "grid",
    gap: "5px",
    color: "#5B6775",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  splitSection: {
    padding: "78px clamp(28px, 6vw, 84px)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.7fr)",
    gap: "42px",
    background: "#F3F8FC",
  },
  bodyText: {
    color: "#5B6775",
    fontSize: "18px",
    lineHeight: 1.7,
    maxWidth: "760px",
    marginTop: "20px",
  },
  infoBox: {
    background: "#ffffff",
    border: "1px solid #D5DDE6",
    borderRadius: "10px",
    padding: "30px",
  },
  infoKicker: {
    margin: "0 0 8px 0",
    color: "#00A6B4",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  infoTitle: { margin: "0 0 12px 0", fontSize: "23px", color: "#0B2F4F" },
  footer: {
    background: "#0B2F4F",
    padding: "34px clamp(28px, 6vw, 84px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    flexWrap: "wrap",
  },
  footerLogo: { objectFit: "contain", filter: "brightness(0) invert(1)" },
  footerText: { color: "#D5DDE6", fontSize: "14px", margin: 0 },
};
