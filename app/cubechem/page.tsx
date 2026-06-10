"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ComparisonRow = {
  sheet_name: string;
  item_code: string;
  description: string;
  supplier_description?: string;
  old_price: number;
  supplier_ex_vat: number | null;
  hq_price: number | null;
  new_price: number | null;
  difference: number | null;
  difference_percent: number | null;
  status: string;
  pricing_method?: string;
  missing_sources?: string[];
  final_price?: number | null;
  saving_note?: string | null;
  category_name?: string | null;
  category_sort?: number | null;
  item_sort?: number | null;
  accepted_increase?: boolean;
  manually_adjusted?: boolean;
  hq_markup_percent?: number | null;
  branch_markup_percent?: number | null;
};

type GroupedRows = {
  categoryName: string;
  rows: ComparisonRow[];
};

const franchiseOptions = [
  { code: "pretoria", label: "Pretoria" },
  { code: "carletonville", label: "Carletonville / Potchefstroom" },
  { code: "jhb", label: "Johannesburg" },
  { code: "bethal", label: "Bethal" },
];

function formatMonth(monthValue: string) {
  if (!monthValue) return "";

  const [year, month] = monthValue.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `R ${Number(value).toFixed(2)}`;
}

function percentage(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toFixed(2)}%`;
}

function calculatePercentageChange(oldPrice: number, finalPrice: number | null | undefined) {
  if (!oldPrice || finalPrice === null || finalPrice === undefined) return null;
  return ((Number(finalPrice) - Number(oldPrice)) / Number(oldPrice)) * 100;
}

export default function CubeChemPage() {
  const router = useRouter();

  const [accessLoading, setAccessLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  const [supplierFile, setSupplierFile] = useState<File | null>(null);

  const [uploadMonth, setUploadMonth] = useState("2026-06");
  const [compareFromMonth, setCompareFromMonth] = useState("2026-05");
  const [compareToMonth, setCompareToMonth] = useState("2026-06");
  const [exportMonth, setExportMonth] = useState("2026-06");
  const [franchiseCode, setFranchiseCode] = useState("pretoria");

  const [bulkHqPercent, setBulkHqPercent] = useState("10");
  const [bulkBranchPercent, setBulkBranchPercent] = useState("40");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const [supplierLoading, setSupplierLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [internalExportLoading, setInternalExportLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkAcceptLoading, setBulkAcceptLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingCode, setSavingCode] = useState("");

  const [comparison, setComparison] = useState<ComparisonRow[]>([]);

  useEffect(() => {
    checkPageAccess();
  }, []);

  async function checkPageAccess() {
    setAccessLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        router.push("/login");
        return;
      }

      const email = user.email.toLowerCase();
      setCurrentUserEmail(email);

      const res = await fetch("/api/cubechem/check-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.allowed) {
        setAccessAllowed(false);
        setError(data.error || "You do not have access to the CubeChem module.");
        return;
      }

      setAccessAllowed(true);
    } catch (err) {
      setAccessAllowed(false);
      setError(
        err instanceof Error ? err.message : "Could not check CubeChem access."
      );
    } finally {
      setAccessLoading(false);
    }
  }

  const compareFromLabel = formatMonth(compareFromMonth);
  const compareToLabel = formatMonth(compareToMonth);
  const uploadLabel = formatMonth(uploadMonth);
  const exportLabel = formatMonth(exportMonth);

  const selectedFranchiseLabel =
    franchiseOptions.find((item) => item.code === franchiseCode)?.label ||
    "Pretoria";

  const validComparisonRows = useMemo(
    () =>
      comparison.filter(
        (row) =>
          row.status !== "NOT FOUND" &&
          row.status !== "RULE SOURCE MISSING" &&
          row.new_price !== null
      ),
    [comparison]
  );

  const groupedComparison = useMemo<GroupedRows[]>(() => {
    const groups = new Map<string, ComparisonRow[]>();

    for (const row of comparison) {
      const categoryName = row.category_name || "Other";

      if (!groups.has(categoryName)) {
        groups.set(categoryName, []);
      }

      groups.get(categoryName)?.push(row);
    }

    return Array.from(groups.entries()).map(([categoryName, rows]) => ({
      categoryName,
      rows,
    }));
  }, [comparison]);

  function isSelectable(row: ComparisonRow) {
    return (
      row.status !== "NOT FOUND" &&
      row.status !== "RULE SOURCE MISSING" &&
      row.supplier_ex_vat !== null &&
      row.supplier_ex_vat !== undefined
    );
  }

  function getSelectableCodesForGroup(rows: ComparisonRow[]) {
    return rows.filter(isSelectable).map((row) => row.item_code);
  }

  function isGroupSelected(rows: ComparisonRow[]) {
    const codes = getSelectableCodesForGroup(rows);

    return codes.length > 0 && codes.every((code) => selectedCodes.includes(code));
  }

  function toggleGroupSelected(rows: ComparisonRow[]) {
    const codes = getSelectableCodesForGroup(rows);

    if (codes.length === 0) return;

    const allSelected = codes.every((code) => selectedCodes.includes(code));

    setSelectedCodes((current) => {
      if (allSelected) {
        return current.filter((code) => !codes.includes(code));
      }

      return Array.from(new Set([...current, ...codes]));
    });
  }

  function toggleSelected(itemCode: string) {
    setSelectedCodes((current) =>
      current.includes(itemCode)
        ? current.filter((code) => code !== itemCode)
        : [...current, itemCode]
    );
  }

  function clearSelected() {
    setSelectedCodes([]);
  }

  async function handleBulkAcceptIncrease() {
    setMessage("");
    setError("");

    if (selectedCodes.length === 0) {
      setError("Please tick at least one item first.");
      return;
    }

    setBulkAcceptLoading(true);

    try {
      const res = await fetch("/api/cubechem/bulk-accept-increase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth: compareToMonth,
          itemCodes: selectedCodes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Bulk accept failed.");
      }

      const acceptedCodes = new Set(
        (data.rows || []).map((row: any) => String(row.itemCode).toUpperCase())
      );

      setComparison((current) =>
        current.map((item) =>
          acceptedCodes.has(String(item.item_code).toUpperCase())
            ? {
                ...item,
                accepted_increase: true,
                manually_adjusted: false,
                saving_note: "Accepted",
              }
            : item
        )
      );

      setSelectedCodes([]);
      setMessage(`${data.acceptedCount} selected increases accepted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk accept failed.");
    } finally {
      setBulkAcceptLoading(false);
    }
  }

  async function handleBulkUpdateMarkups() {
    setMessage("");
    setError("");

    if (selectedCodes.length === 0) {
      setError("Please tick at least one item first.");
      return;
    }

    const hqMarkupPercent = Number(bulkHqPercent);
    const branchMarkupPercent = Number(bulkBranchPercent);

    if (
      !Number.isFinite(hqMarkupPercent) ||
      !Number.isFinite(branchMarkupPercent)
    ) {
      setError("Please enter valid HQ and Branch percentages.");
      return;
    }

    setBulkLoading(true);

    try {
      const res = await fetch("/api/cubechem/bulk-update-markups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth: compareToMonth,
          itemCodes: selectedCodes,
          hqMarkupPercent,
          branchMarkupPercent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Bulk update failed.");
      }

      const updatedMap = new Map<string, any>();

      for (const row of data.rows || []) {
        updatedMap.set(String(row.itemCode).toUpperCase(), row);
      }

      setComparison((current) =>
        current.map((item) => {
          const updated = updatedMap.get(String(item.item_code).toUpperCase());

          if (!updated) return item;

          return {
            ...item,
            hq_markup_percent: updated.hqMarkupPercent,
            branch_markup_percent: updated.branchMarkupPercent,
            hq_price: updated.hqPrice,
            new_price: updated.finalPrice,
            final_price: updated.finalPrice,
            difference: updated.difference,
            difference_percent: updated.differencePercent,
            status: updated.status,
            accepted_increase: false,
            manually_adjusted: true,
            saving_note: "Bulk %",
          };
        })
      );

      setSelectedCodes([]);
      setMessage(`${data.updatedCount} selected items updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleUploadSupplier() {
    setMessage("");
    setError("");

    if (!supplierFile) {
      setError("Please select the Abyx supplier price list first.");
      return;
    }

    setSupplierLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", supplierFile);
      formData.append("priceMonth", uploadMonth);

      const res = await fetch("/api/cubechem/upload-supplier", {
        method: "POST",
        headers: {
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Supplier upload failed.");
      }

      setMessage(
        `${uploadLabel} Abyx price list uploaded. ${data.itemCount} items saved.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supplier upload failed.");
    } finally {
      setSupplierLoading(false);
    }
  }

  async function handleCompareMonths() {
    setMessage("");
    setError("");
    setComparison([]);
    setSelectedCodes([]);
    setCompareLoading(true);

    try {
      const res = await fetch("/api/cubechem/compare-saved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth: compareToMonth,
          compareFromMonth,
          compareToMonth,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Comparison failed.");
      }

      const rows = (data.comparison || []).map((row: ComparisonRow) => ({
        ...row,
        final_price: row.final_price ?? row.new_price,
        saving_note: null,
        accepted_increase: row.accepted_increase ?? false,
        manually_adjusted: row.manually_adjusted ?? false,
        hq_markup_percent: row.hq_markup_percent ?? 15,
        branch_markup_percent: row.branch_markup_percent ?? 45,
      }));

      setComparison(rows);

      setMessage(
        `${compareFromLabel} compared to ${compareToLabel}. ${data.ccdCount} items loaded.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setCompareLoading(false);
    }
  }

  async function saveFinalPrice(row: ComparisonRow, finalPrice: number) {
    setSavingCode(row.item_code);

    try {
      const res = await fetch("/api/cubechem/update-final-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth: compareToMonth,
          itemCode: row.item_code,
          finalPrice,
          calculatedPrice: row.new_price,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not save final price.");
      }

      setComparison((current) =>
        current.map((item) =>
          item.item_code === row.item_code
            ? {
                ...item,
                saving_note: data.overrideReason || "Saved",
                accepted_increase: data.acceptedIncrease,
                manually_adjusted: data.manuallyAdjusted,
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save final price.");
    } finally {
      setSavingCode("");
    }
  }

  async function saveAcceptIncrease(row: ComparisonRow, accepted: boolean) {
    if (row.manually_adjusted) return;

    setSavingCode(row.item_code);

    try {
      const res = await fetch("/api/cubechem/accept-increase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth: compareToMonth,
          itemCode: row.item_code,
          accepted,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not save accept increase.");
      }

      setComparison((current) =>
        current.map((item) =>
          item.item_code === row.item_code
            ? {
                ...item,
                accepted_increase: accepted,
                manually_adjusted: false,
                saving_note: "Saved",
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save accept increase."
      );
    } finally {
      setSavingCode("");
    }
  }

  async function saveMarkups(row: ComparisonRow) {
    if (
      row.hq_markup_percent === null ||
      row.hq_markup_percent === undefined ||
      row.branch_markup_percent === null ||
      row.branch_markup_percent === undefined
    ) {
      return;
    }

    setSavingCode(row.item_code);

    try {
      const res = await fetch("/api/cubechem/update-markups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth: compareToMonth,
          itemCode: row.item_code,
          hqMarkupPercent: row.hq_markup_percent,
          branchMarkupPercent: row.branch_markup_percent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not save markup percentages.");
      }

      setComparison((current) =>
        current.map((item) =>
          item.item_code === row.item_code
            ? {
                ...item,
                hq_markup_percent: data.hqMarkupPercent,
                branch_markup_percent: data.branchMarkupPercent,
                hq_price: data.hqPrice,
                new_price: data.finalPrice,
                final_price: data.finalPrice,
                difference: data.difference,
                difference_percent: data.differencePercent,
                status: data.status,
                accepted_increase: false,
                manually_adjusted: true,
                saving_note: "Manual %",
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save markup percentages."
      );
    } finally {
      setSavingCode("");
    }
  }

  function handleMarkupChange(
    itemCode: string,
    field: "hq_markup_percent" | "branch_markup_percent",
    value: string
  ) {
    const numberValue = value === "" ? null : Number(value);

    setComparison((current) =>
      current.map((row) => {
        if (row.item_code !== itemCode) return row;

        return {
          ...row,
          [field]: numberValue,
          accepted_increase: false,
          manually_adjusted: true,
          saving_note: null,
        };
      })
    );
  }

  function handleFinalPriceChange(itemCode: string, value: string) {
    const numberValue = value === "" ? null : Number(value);

    setComparison((current) =>
      current.map((row) => {
        if (row.item_code !== itemCode) return row;

        const isManual =
          row.new_price !== null &&
          row.new_price !== undefined &&
          numberValue !== null &&
          numberValue !== row.new_price;

        return {
          ...row,
          final_price: numberValue,
          accepted_increase: isManual ? false : row.accepted_increase,
          manually_adjusted: isManual,
          saving_note: null,
        };
      })
    );
  }

  async function handleFinalPriceBlur(row: ComparisonRow) {
    if (row.final_price === null || row.final_price === undefined) return;
    if (!Number.isFinite(Number(row.final_price))) return;
    if (row.status === "NOT FOUND" || row.status === "RULE SOURCE MISSING") return;

    await saveFinalPrice(row, Number(row.final_price));
  }

  async function handleExportMonth() {
    setMessage("");
    setError("");
    setExportLoading(true);

    try {
      const res = await fetch("/api/cubechem/export-month", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({ exportMonth }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Excel export failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `CCD_PRICE_LIST_${exportLabel.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage(`${exportLabel} Excel exported successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel export failed.");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleExportPdf() {
    setMessage("");
    setError("");
    setExportLoading(true);

    try {
      const res = await fetch("/api/cubechem/export-month-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          exportMonth,
          franchiseCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "PDF export failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `CCD_PRICE_LIST_${selectedFranchiseLabel.replace(
        /\s+/g,
        "_"
      )}_${exportLabel.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage(`${exportLabel} ${selectedFranchiseLabel} PDF exported successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleInternalExportPdf() {
    setMessage("");
    setError("");
    setInternalExportLoading(true);

    try {
      const res = await fetch("/api/cubechem/export-internal-review-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          exportMonth: compareToMonth,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Internal review PDF export failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `CCD_INTERNAL_PRICE_REVIEW_${compareToLabel.replace(
        /\s+/g,
        "_"
      )}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage(`${compareToLabel} internal review PDF exported successfully.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Internal review PDF export failed."
      );
    } finally {
      setInternalExportLoading(false);
    }
  }

  if (accessLoading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={cardStyle}>
            <h1 style={pageTitleStyle}>CubeChem Price Manager</h1>
            <p style={pageTextStyle}>Checking CubeChem access...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!accessAllowed) {
    return (
      <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={cardStyle}>
            <h1 style={pageTitleStyle}>Access denied</h1>
            <p style={pageTextStyle}>
              {error || "You do not have access to the CubeChem Price Manager."}
            </p>
            {currentUserEmail && (
              <p style={smallTextStyle}>Signed in as: {currentUserEmail}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px" }}>
      <div style={{ maxWidth: "1900px", margin: "0 auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={pageTitleStyle}>CubeChem Price Manager</h1>
          <p style={pageTextStyle}>
            Upload Abyx price lists by month, compare any two months, edit final prices inline,
            change markup percentages, and export the selected month to Excel or PDF.
          </p>
        </div>

        <section style={topGridStyle}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Upload Abyx Price List</h2>

            <label style={labelStyle}>
              Upload Month
              <input
                type="month"
                value={uploadMonth}
                onChange={(e) => setUploadMonth(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={{ ...labelStyle, marginTop: "16px" }}>
              Abyx Excel File
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setSupplierFile(e.target.files?.[0] || null)}
                style={inputStyle}
              />
            </label>

            {supplierFile && (
              <p style={fileTextStyle}>Selected file: {supplierFile.name}</p>
            )}

            <button
              onClick={handleUploadSupplier}
              disabled={supplierLoading}
              style={{
                ...buttonStyle,
                opacity: supplierLoading ? 0.7 : 1,
                cursor: supplierLoading ? "not-allowed" : "pointer",
              }}
            >
              {supplierLoading ? "Uploading..." : `Upload ${uploadLabel}`}
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Compare Months</h2>

            <div style={twoColumnStyle}>
              <label style={labelStyle}>
                Compare From
                <input
                  type="month"
                  value={compareFromMonth}
                  onChange={(e) => setCompareFromMonth(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Compare To
                <input
                  type="month"
                  value={compareToMonth}
                  onChange={(e) => setCompareToMonth(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <button
              onClick={handleCompareMonths}
              disabled={compareLoading}
              style={{
                ...buttonStyle,
                background: "#2563eb",
                opacity: compareLoading ? 0.7 : 1,
                cursor: compareLoading ? "not-allowed" : "pointer",
              }}
            >
              {compareLoading
                ? "Comparing..."
                : `Compare ${compareFromLabel} to ${compareToLabel}`}
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Export Price List</h2>

            <div style={twoColumnStyle}>
              <label style={labelStyle}>
                Export Month
                <input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Franchise
                <select
                  value={franchiseCode}
                  onChange={(e) => setFranchiseCode(e.target.value)}
                  style={inputStyle}
                >
                  {franchiseOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={handleExportMonth}
                disabled={exportLoading}
                style={{
                  ...buttonStyle,
                  background: "#16a34a",
                  opacity: exportLoading ? 0.7 : 1,
                  cursor: exportLoading ? "not-allowed" : "pointer",
                }}
              >
                {exportLoading ? "Exporting..." : `Export ${exportLabel} Excel`}
              </button>

              <button
                onClick={handleExportPdf}
                disabled={exportLoading}
                style={{
                  ...buttonStyle,
                  background: "#dc2626",
                  opacity: exportLoading ? 0.7 : 1,
                  cursor: exportLoading ? "not-allowed" : "pointer",
                }}
              >
                {exportLoading
                  ? "Exporting..."
                  : `Export ${selectedFranchiseLabel} PDF`}
              </button>

              <button
                onClick={handleInternalExportPdf}
                disabled={internalExportLoading}
                style={{
                  ...buttonStyle,
                  background: "#7c3aed",
                  opacity: internalExportLoading ? 0.7 : 1,
                  cursor: internalExportLoading ? "not-allowed" : "pointer",
                }}
              >
                {internalExportLoading
                  ? "Exporting..."
                  : `Internal Review PDF`}
              </button>
            </div>
          </div>
        </section>

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {comparison.length > 0 && (
          <section style={{ ...cardStyle, marginTop: "22px", overflowX: "auto" }}>
            <div style={bulkBarStyle}>
              <strong>{selectedCodes.length} selected</strong>

              <label style={bulkLabelStyle}>
                HQ %
                <input
                  type="number"
                  value={bulkHqPercent}
                  onChange={(e) => setBulkHqPercent(e.target.value)}
                  style={bulkInputStyle}
                />
              </label>

              <label style={bulkLabelStyle}>
                Branch %
                <input
                  type="number"
                  value={bulkBranchPercent}
                  onChange={(e) => setBulkBranchPercent(e.target.value)}
                  style={bulkInputStyle}
                />
              </label>

              <button
                onClick={handleBulkUpdateMarkups}
                disabled={bulkLoading}
                style={{
                  ...buttonStyle,
                  marginTop: 0,
                  background: "#0f766e",
                  opacity: bulkLoading ? 0.7 : 1,
                }}
              >
                {bulkLoading ? "Updating..." : "Bulk Update %"}
              </button>

              <button
                onClick={handleBulkAcceptIncrease}
                disabled={bulkAcceptLoading}
                style={{
                  ...buttonStyle,
                  marginTop: 0,
                  background: "#2563eb",
                  opacity: bulkAcceptLoading ? 0.7 : 1,
                }}
              >
                {bulkAcceptLoading ? "Accepting..." : "Bulk Accept Increases"}
              </button>

              <button
                onClick={clearSelected}
                style={{
                  ...buttonStyle,
                  marginTop: 0,
                  background: "#64748b",
                }}
              >
                Clear
              </button>
            </div>

            <div style={tableHeaderRowStyle}>
              <div>
                <h2 style={sectionTitleStyle}>
                  {compareFromLabel} vs {compareToLabel}
                </h2>
                <p style={smallTextStyle}>
                  Valid items: {validComparisonRows.length} / Total items: {comparison.length}
                </p>
              </div>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Select</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Description</th>
                  <th style={thRightStyle}>{compareFromLabel} Price</th>
                  <th style={thRightStyle}>HQ %</th>
                  <th style={thRightStyle}>Branch %</th>
                  <th style={thRightStyle}>{compareToLabel} Calculated</th>
                  <th style={thRightStyle}>{compareToLabel} Final</th>
                  <th style={thRightStyle}>R Change</th>
                  <th style={thRightStyle}>% Change</th>
                  <th style={thRightStyle}>Saving</th>
                  <th style={thStyle}>Accept Increase</th>
                  <th style={thStyle}>Save Status</th>
                  <th style={thStyle}>Method</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>

              <tbody>
                {groupedComparison.map((group) => (
                  <React.Fragment key={group.categoryName}>
                    <tr>
                      <td colSpan={15} style={categoryRowStyle}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isGroupSelected(group.rows)}
                            onChange={() => toggleGroupSelected(group.rows)}
                          />
                          <span>{group.categoryName}</span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "none",
                            }}
                          >
                            Select all in section
                          </span>
                        </label>
                      </td>
                    </tr>

                    {group.rows.map((row) => {
                      const calculatedPrice = row.new_price;
                      const finalPrice = row.final_price;

                      const saving =
                        calculatedPrice !== null &&
                        calculatedPrice !== undefined &&
                        finalPrice !== null &&
                        finalPrice !== undefined &&
                        finalPrice < calculatedPrice
                          ? calculatedPrice - finalPrice
                          : 0;

                      const difference =
                        finalPrice !== null &&
                        finalPrice !== undefined &&
                        row.old_price !== null &&
                        row.old_price !== undefined
                          ? finalPrice - row.old_price
                          : null;

                      const percentChange = calculatePercentageChange(
                        row.old_price,
                        finalPrice
                      );

                      const canAccept =
                        row.status === "INCREASE" && !row.manually_adjusted;

                      const canEditMarkup = isSelectable(row);

                      return (
                        <tr key={row.item_code}>
                          <td style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={selectedCodes.includes(row.item_code)}
                              disabled={!canEditMarkup}
                              onChange={() => toggleSelected(row.item_code)}
                            />
                          </td>

                          <td style={tdStyle}>{row.item_code}</td>
                          <td style={tdStyle}>{row.description}</td>
                          <td style={tdRightStyle}>{money(row.old_price)}</td>

                          <td style={tdRightStyle}>
                            {canEditMarkup ? (
                              <input
                                type="number"
                                value={row.hq_markup_percent ?? 15}
                                onChange={(e) =>
                                  handleMarkupChange(
                                    row.item_code,
                                    "hq_markup_percent",
                                    e.target.value
                                  )
                                }
                                onBlur={() => saveMarkups(row)}
                                style={percentInputStyle}
                              />
                            ) : (
                              "-"
                            )}
                          </td>

                          <td style={tdRightStyle}>
                            {canEditMarkup ? (
                              <input
                                type="number"
                                value={row.branch_markup_percent ?? 45}
                                onChange={(e) =>
                                  handleMarkupChange(
                                    row.item_code,
                                    "branch_markup_percent",
                                    e.target.value
                                  )
                                }
                                onBlur={() => saveMarkups(row)}
                                style={percentInputStyle}
                              />
                            ) : (
                              "-"
                            )}
                          </td>

                          <td style={tdRightStyle}>{money(row.new_price)}</td>

                          <td style={tdRightStyle}>
                            {row.status === "NOT FOUND" ||
                            row.status === "RULE SOURCE MISSING" ? (
                              "-"
                            ) : (
                              <input
                                type="number"
                                value={finalPrice ?? ""}
                                onChange={(e) =>
                                  handleFinalPriceChange(row.item_code, e.target.value)
                                }
                                onBlur={() => handleFinalPriceBlur(row)}
                                style={priceInputStyle}
                              />
                            )}
                          </td>

                          <td style={tdRightStyle}>
                            {difference === null ? "-" : money(difference)}
                          </td>

                          <td style={tdRightStyle}>
                            {percentage(percentChange)}
                          </td>

                          <td style={tdRightStyle}>
                            {saving > 0 ? `Save R ${saving.toFixed(2)}` : "-"}
                          </td>

                          <td style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.accepted_increase)}
                              disabled={!canAccept}
                              onChange={(e) =>
                                saveAcceptIncrease(row, e.target.checked)
                              }
                            />
                          </td>

                          <td style={tdStyle}>
                            {savingCode === row.item_code
                              ? "Saving..."
                              : row.manually_adjusted
                              ? "Manual"
                              : row.saving_note || "-"}
                          </td>

                          <td style={tdStyle}>{row.pricing_method || "-"}</td>

                          <td style={tdStyle}>
                            <span style={statusStyle(row.status)}>{row.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}

function statusStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };

  if (status === "INCREASE") return { ...base, background: "#fee2e2", color: "#991b1b" };
  if (status === "DECREASE") return { ...base, background: "#dcfce7", color: "#166534" };
  if (status === "NOT FOUND") return { ...base, background: "#fef3c7", color: "#92400e" };
  if (status === "RULE SOURCE MISSING") return { ...base, background: "#ffedd5", color: "#9a3412" };

  return { ...base, background: "#e2e8f0", color: "#334155" };
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "34px",
  fontWeight: 800,
  color: "#0f172a",
  margin: 0,
};

const pageTextStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#475569",
  marginTop: "8px",
  maxWidth: "950px",
};

const topGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "18px",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "22px",
  padding: "24px",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#0f172a",
  marginTop: 0,
  marginBottom: "14px",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontSize: "14px",
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "10px",
  fontSize: "14px",
  background: "#ffffff",
  width: "100%",
};

const priceInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "8px",
  fontSize: "13px",
  background: "#ffffff",
  width: "100px",
  textAlign: "right",
  fontWeight: 700,
};

const percentInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "8px",
  fontSize: "13px",
  background: "#ffffff",
  width: "75px",
  textAlign: "right",
  fontWeight: 700,
};

const fileTextStyle: React.CSSProperties = {
  marginTop: "14px",
  fontSize: "14px",
  color: "#2563eb",
  fontWeight: 800,
};

const buttonStyle: React.CSSProperties = {
  marginTop: "16px",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 800,
};

const successStyle: React.CSSProperties = {
  marginTop: "18px",
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  borderRadius: "14px",
  padding: "14px 16px",
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  marginTop: "18px",
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: "14px",
  padding: "14px 16px",
  fontWeight: 800,
};

const bulkBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "12px",
  marginBottom: "16px",
};

const bulkLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#334155",
};

const bulkInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "8px",
  fontSize: "13px",
  width: "80px",
  textAlign: "right",
  fontWeight: 800,
};

const tableHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "14px",
};

const smallTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 700,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #cbd5e1",
  color: "#334155",
  whiteSpace: "nowrap",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const categoryRowStyle: React.CSSProperties = {
  padding: "12px 10px",
  background: "#e2e8f0",
  color: "#0f172a",
  fontWeight: 900,
  borderTop: "2px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  verticalAlign: "top",
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};