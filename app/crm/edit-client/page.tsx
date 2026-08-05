"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ClientForm from "../_components/ClientForm";

function EditClientContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("id") || "";

  if (!clientId) {
    return (
      <div style={{ padding: 32 }}>
        No client was selected.
      </div>
    );
  }

  return <ClientForm mode="edit" clientId={clientId} />;
}

export default function EditClientPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading client...</div>}>
      <EditClientContent />
    </Suspense>
  );
}