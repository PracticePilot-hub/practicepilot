"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { key: "register", label: "Asset Register", href: "" },
  { key: "depreciation", label: "Depreciation", href: "/depreciation" },
  { key: "movements", label: "Additions & Disposals", href: "/movements" },
  { key: "afs-reconciliation", label: "AFS Reconciliation", href: "/afs-reconciliation" },
  { key: "reports", label: "Reports", href: "/reports" },
];

export default function AssetClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ clientId: string }>();
  const base = `/assets/${params.clientId}`;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="border-b border-slate-300 bg-white">
        <div className="mx-auto max-w-[1500px] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link href="/assets" className="text-xs font-medium text-slate-500 hover:text-slate-900">
                ← Client Asset Registers
              </Link>
              <h1 className="mt-1 text-xl font-semibold">Asset Register</h1>
              <p className="mt-1 text-sm text-slate-500">Client ID: {params.clientId}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-[1500px] px-6">
          {tabs.map((tab) => {
            const href = `${base}${tab.href}`;
            const active =
              tab.href === ""
                ? pathname === base
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={tab.key}
                href={href}
                className={[
                  "border-b-2 px-4 py-3 text-sm font-medium",
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-900",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-6 py-6">{children}</div>
    </main>
  );
}
