import type { AfsStatementRow } from "../components/AfsStatementTable";
export function paginateSfpRows(sfpPrintableRows:AfsStatementRow[]) {
    const equityStart = sfpPrintableRows.findIndex((row: any) => {
      const label = String(row?.label || "").trim().toLowerCase();
      return label === "equity and liabilities" || label === "equity & liabilities";
    });
    const maxRows = 48;
    const sections = equityStart > 0 && sfpPrintableRows.length > maxRows
      ? [sfpPrintableRows.slice(0, equityStart), sfpPrintableRows.slice(equityStart)]
      : [sfpPrintableRows];
    const pages: AfsStatementRow[][] = [];
    // The SFP is a compact table: up to 44 mapped rows fit on an A4 page.
    // The previous 29-row cap created nearly empty continuation pages.
    // Split at the Assets / Equity and Liabilities boundary, then only
    // paginate within a section if that section genuinely exceeds one page.
    for (const section of sections) {
      for (let start = 0; start < section.length;) {
        let end = Math.min(section.length, start + maxRows);
        // Do not leave a group heading stranded at the bottom of a page.
        if (end < section.length && end > start + 1) {
          const last = section[end - 1] as any;
          const next = section[end] as any;
          const lastType = String(last?.type || last?.kind || "").toLowerCase();
          const lastLabel = String(last?.label || "").trim().toLowerCase();
          const nextType = String(next?.type || next?.kind || "").toLowerCase();
          if (
            lastType.includes("heading") || lastType === "section" ||
            ["assets", "non-current assets", "current assets", "equity", "liabilities", "non-current liabilities", "current liabilities"].includes(lastLabel)
          ) end -= 1;
          // Keep a total next to its preceding content where possible.
          else if ((nextType === "total" || nextType === "subtotal") && end - start > 2) end -= 1;
        }
        if (end <= start) end = Math.min(section.length, start + maxRows);
        pages.push(section.slice(start, end));
        start = end;
      }
    }
    return pages.length ? pages : [[]];
}
