import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Image
          src="/brand/practicepilot-horizontal-logo.png"
          alt="PracticePilot"
          width={220}
          height={69}
          style={styles.logo}
          priority
        />

        <nav style={styles.nav}>
          <a href="#what-we-do" style={styles.navLink}>What we do</a>
          <a href="#who-we-are" style={styles.navLink}>Who we are</a>
          <a href="#pricing" style={styles.navLink}>Pricing</a>
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
            <h1 style={styles.heroTitle}>Your practice, finally in one workspace.</h1>
            <p style={styles.heroText}>
              PracticePilot helps accounting practices manage clients, projects, reporting and workflows fron one secure platform.
            </p>

            <div style={styles.heroButtons}>
              <Link href="/login" style={styles.primaryButton}>Client / Staff Login</Link>
              <a href="#pricing" style={styles.secondaryButton}>View Pricing</a>
            </div>
          </div>
        </div>
      </section>

      <section id="what-we-do" style={styles.section}>
        <p style={styles.kicker}>What we do</p>
        <h2 style={styles.sectionTitle}>Built for modern accounting teams.</h2>

        <div style={styles.cards}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Client Management</h3>
            <p style={styles.cardText}>Keep client records, services and responsibilities in one place.</p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Project Tracking</h3>
            <p style={styles.cardText}>Track project quotes, phases, invoices, payments and supporting documents.</p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Reporting Workspace</h3>
            <p style={styles.cardText}>Create clearer reporting packs and give decision-makers better visibility.</p>
          </div>
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
          <h3 style={styles.infoTitle}>Core focus</h3>
          <p style={styles.cardText}>
            Practical systems for client management, project control, reporting,
            billing visibility and team workflow.
          </p>
        </div>
      </section>

      <section id="pricing" style={styles.section}>
        <p style={styles.kicker}>Pricing</p>
        <h2 style={styles.sectionTitle}>Simple starting structure.</h2>

        <div style={styles.pricingGrid}>
          <div style={styles.priceCard}>
            <h3 style={styles.cardTitle}>Starter</h3>
            <p style={styles.price}>Custom</p>
            <p style={styles.cardText}>For smaller teams starting with one module.</p>
          </div>

          <div style={styles.priceCardFeatured}>
            <h3 style={styles.cardTitle}>Professional</h3>
            <p style={styles.price}>Custom</p>
            <p style={styles.cardText}>For firms using multiple PracticePilot modules.</p>
          </div>

          <div style={styles.priceCard}>
            <h3 style={styles.cardTitle}>Enterprise</h3>
            <p style={styles.price}>Custom</p>
            <p style={styles.cardText}>For larger teams needing tailored setup and access control.</p>
          </div>
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
    height: "82px",
    background: "#ffffff",
    borderBottom: "1px solid #D5DDE6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 56px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  logo: {
    objectFit: "contain",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "28px",
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
    padding: "12px 20px",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: 800,
  },
  hero: {
    position: "relative",
    height: "560px",
    overflow: "hidden",
  },
  heroImage: {
    objectFit: "cover",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, rgba(11,47,79,0.78), rgba(11,47,79,0.12))",
    display: "flex",
    alignItems: "center",
    padding: "0 72px",
  },
  heroContent: {
    maxWidth: "620px",
  },
  heroTitle: {
    fontSize: "56px",
    lineHeight: 1.05,
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-1px",
  },
  heroText: {
    fontSize: "20px",
    lineHeight: 1.6,
    color: "#EAF4F8",
    marginTop: "22px",
    marginBottom: "32px",
  },
  heroButtons: {
    display: "flex",
    gap: "14px",
  },
  primaryButton: {
    background: "#00A6B4",
    color: "#ffffff",
    textDecoration: "none",
    padding: "14px 22px",
    borderRadius: "12px",
    fontWeight: 800,
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#0B2F4F",
    textDecoration: "none",
    padding: "14px 22px",
    borderRadius: "12px",
    fontWeight: 800,
  },
  section: {
    padding: "76px 72px",
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
    fontSize: "38px",
    margin: "0 0 28px 0",
    color: "#0B2F4F",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "22px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #D5DDE6",
    borderRadius: "18px",
    padding: "28px",
    boxShadow: "0 10px 28px rgba(11,47,79,0.06)",
  },
  cardTitle: {
    margin: "0 0 12px 0",
    fontSize: "22px",
    color: "#0B2F4F",
  },
  cardText: {
    margin: 0,
    color: "#5B6775",
    fontSize: "16px",
    lineHeight: 1.6,
  },
  splitSection: {
    padding: "76px 72px",
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr",
    gap: "36px",
    background: "#ffffff",
  },
  bodyText: {
    color: "#5B6775",
    fontSize: "18px",
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  infoBox: {
    background: "#F3F8FC",
    border: "1px solid #D5DDE6",
    borderRadius: "18px",
    padding: "30px",
  },
  infoTitle: {
    margin: "0 0 12px 0",
    fontSize: "22px",
    color: "#0B2F4F",
  },
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "22px",
  },
  priceCard: {
    background: "#ffffff",
    border: "1px solid #D5DDE6",
    borderRadius: "18px",
    padding: "30px",
  },
  priceCardFeatured: {
    background: "#ffffff",
    border: "2px solid #00A6B4",
    borderRadius: "18px",
    padding: "30px",
    boxShadow: "0 14px 34px rgba(0,166,180,0.16)",
  },
  price: {
    fontSize: "32px",
    fontWeight: 900,
    margin: "0 0 12px 0",
    color: "#0B5CAB",
  },
  footer: {
    background: "#0B2F4F",
    padding: "36px 72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLogo: {
    objectFit: "contain",
    filter: "brightness(0) invert(1)",
  },
  footerText: {
    color: "#D5DDE6",
    fontSize: "14px",
  },
};