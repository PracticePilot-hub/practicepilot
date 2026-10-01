import { Suspense, type ReactNode } from "react";

export default function PortalAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#eef3f8",
            color: "#10233a",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Opening PracticePilot...
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
