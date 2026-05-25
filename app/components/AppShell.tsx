"use client";

import { usePathname } from "next/navigation";
import TopNav from "./TopNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const publicPages = ["/", "/login", "/reset-password"];
  const isPublicPage = publicPages.includes(pathname);

  return (
    <>
      {!isPublicPage && <TopNav />}
      {children}
    </>
  );
}