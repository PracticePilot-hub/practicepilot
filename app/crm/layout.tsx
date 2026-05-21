import Sidebar from "../components/Sidebar";

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
      <Sidebar />

      <div style={{ flex: 1, padding: 40, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}