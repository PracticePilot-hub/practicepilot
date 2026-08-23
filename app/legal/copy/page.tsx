import Link from "next/link";

export const metadata = {
  title: "Copyright & Intellectual Property | PracticePilot",
  description: "PracticePilot copyright and intellectual property notice.",
};

export default function CopyrightPage() {
  return (
    <main style={s.page}>
      <header style={s.header}>
        <Link href="/" style={s.brand}>PracticePilot</Link>
        <Link href="/" style={s.back}>Back to website</Link>
      </header>

      <section style={s.hero}>
        <div style={s.wrap}>
          <p style={s.label}>Legal</p>
          <h1 style={s.title}>Copyright &amp; Intellectual Property</h1>
          <p style={s.lead}>
            This notice records the ownership and permitted use of PracticePilot and its
            proprietary software, interfaces, workflows and original content.
          </p>
        </div>
      </section>

      <section style={s.content}>
        <div style={s.wrapNarrow}>
          <h2 style={s.h2}>Copyright notice</h2>
          <p style={s.p}>
            © 2026 Corepilot Software (Pty) Ltd. All rights reserved.
          </p>

          <h2 style={s.h2}>Ownership</h2>
          <p style={s.p}>
            PracticePilot, including its software, source code, architecture, database
            structures, workflow logic, interface designs, templates, reports,
            documentation, graphics, original website content, branding, methodologies,
            improvements and enhancements, is proprietary to Corepilot Software (Pty) Ltd
            and/or its applicable licensors.
          </p>

          <h2 style={s.h2}>Permitted use</h2>
          <p style={s.p}>
            Access to PracticePilot does not transfer ownership of the software or any
            underlying intellectual property. Customers and authorised users receive only
            the rights of access and use granted under the applicable PracticePilot terms.
          </p>

          <h2 style={s.h2}>Restrictions</h2>
          <p style={s.p}>
            Except where permitted by law or expressly authorised in writing, no person may
            reproduce, copy, adapt, distribute, resell, sublicense, reverse engineer,
            decompile, scrape, extract or create derivative works from proprietary
            PracticePilot software, code, interface elements, documentation or original
            content.
          </p>

          <h2 style={s.h2}>Customer data</h2>
          <p style={s.p}>
            This notice does not claim ownership of customer-specific accounting records,
            client records or other customer data processed through PracticePilot.
          </p>

          <h2 style={s.h2}>Trade marks and branding</h2>
          <p style={s.p}>
            PracticePilot names, logos, product names and branding may be protected by
            trade mark and other intellectual property rights. Their display on this site
            does not grant any licence to use them outside the ordinary use of PracticePilot.
          </p>

          <h2 style={s.h2}>Reporting infringement</h2>
          <p style={s.p}>
            Suspected unauthorised copying or misuse may be reported to
            <a href="mailto:practice@practicepilot.co.za" style={s.link}> practice@practicepilot.co.za</a>.
          </p>

          <div style={s.notice}>
            <strong>PracticePilot proprietary notice</strong>
            <span>© 2026 Corepilot Software (Pty) Ltd. All rights reserved.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#ffffff", color: "#0d2438" },
  header: {
    minHeight: 82,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 clamp(28px, 5vw, 78px)",
    borderBottom: "1px solid #dfe6ec",
  },
  brand: { color: "#0d2438", fontSize: 24, fontWeight: 800, textDecoration: "none" },
  back: { color: "#0d2f49", fontSize: 14, fontWeight: 700, textDecoration: "none" },
  hero: { background: "#f3eee5", padding: "78px 0", borderBottom: "1px solid #e3d9ca" },
  wrap: { width: "min(1180px, calc(100% - 56px))", margin: "0 auto" },
  wrapNarrow: { width: "min(860px, calc(100% - 56px))", margin: "0 auto" },
  label: { margin: "0 0 12px", color: "#667788", fontSize: 17, fontWeight: 700 },
  title: { margin: 0, fontSize: "clamp(42px, 5vw, 68px)", lineHeight: 1.02, letterSpacing: "-0.04em" },
  lead: { margin: "22px 0 0", maxWidth: 780, color: "#5c6e7f", fontSize: 19, lineHeight: 1.65 },
  content: { padding: "74px 0 90px" },
  h2: { margin: "36px 0 10px", fontSize: 24, letterSpacing: "-0.02em" },
  p: { margin: 0, color: "#53677a", fontSize: 16, lineHeight: 1.75 },
  link: { color: "#0d2f49", fontWeight: 700 },
  notice: {
    marginTop: 46,
    padding: "22px 24px",
    background: "#0d2f49",
    color: "#ffffff",
    display: "grid",
    gap: 6,
    fontSize: 14,
  },
};
