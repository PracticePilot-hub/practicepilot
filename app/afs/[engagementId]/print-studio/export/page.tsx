"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/*
  Legacy compatibility route only.

  The PDF now renders the real Print Studio page directly. This route no longer
  contains a second statement engine, second note renderer or separate cash-flow
  calculation.
*/
export default function AfsPrintStudioExportRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const engagementId = String(params?.engagementId || "");

  useEffect(() => {
    if (!engagementId) return;

    const next = new URLSearchParams();
    next.set("pdf", "1");

    if (
      searchParams.get("draft") === "1" ||
      searchParams.get("draft") === "true"
    ) {
      next.set("draft", "1");
    }

    router.replace(`/afs/${engagementId}/print-studio?${next.toString()}`);
  }, [engagementId, router, searchParams]);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", fontSize: 13 }}>
      Opening Print Studio export…
    </main>
  );
}
