import Link from "next/link";

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTitle}>CRM</div>

        <Link href="/crm" style={styles.activeNavItem}>
          Client Database
        </Link>

        <Link href="/crm/new-client" style={styles.navItem}>
          New Client
        </Link>

        <Link href="/crm/edit-client" style={styles.navItem}>
          Edit Client
        </Link>

        <Link href="/crm/tasks" style={styles.navItem}>
          Tasks
        </Link>

        <Link href="/crm/calendar" style={styles.navItem}>
          Calendar
        </Link>
      </aside>

      <section style={styles.content}>{children}</section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    minHeight: "calc(100vh - 60px)",
    background: "#f3f8fc",
  },
  sidebar: {
    width: "190px",
    background: "#f3f8fc",
    borderRight: "1px solid #e1e8f0",
    padding: "22px 10px",
  },
  sidebarTitle: {
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.12em",
    color: "#526173",
    textTransform: "uppercase",
    marginBottom: "14px",
    padding: "0 10px",
  },
  activeNavItem: {
    display: "block",
    background: "#0b5cab",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "10px",
    padding: "12px 12px",
    fontSize: "14px",
    fontWeight: 900,
    marginBottom: "8px",
  },
  navItem: {
    display: "block",
    background: "#ffffff",
    color: "#0b2f4f",
    textDecoration: "none",
    border: "1px solid #e1e8f0",
    borderRadius: "10px",
    padding: "12px 12px",
    fontSize: "14px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
};