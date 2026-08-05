"use client";

import { usePathname } from "next/navigation";
import TopNav from "./TopNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const publicPages = ["/", "/login", "/reset-password"];
  const isPublicPage = publicPages.includes(pathname);

  const isDocumentExport =
    /^\/proposals\/[^/]+\/export\/?$/.test(pathname) ||
    pathname.includes("/print-studio/export") ||
    pathname.includes("/reference");

  return (
    <>
      {!isPublicPage && !isDocumentExport && <TopNav />}
      {children}
    </>
  );
}