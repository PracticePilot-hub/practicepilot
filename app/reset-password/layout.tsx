import { Suspense, type ReactNode } from "react";

export default function ResetPasswordLayout({
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
          Loading password reset...
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
