from pathlib import Path
from datetime import datetime
import re

ROOT = Path.cwd()
notes_path = ROOT / "app/afs/[engagementId]/print-studio/AfsStructuredNotesPanel.tsx"
page_path = ROOT / "app/afs/[engagementId]/print-studio/page.tsx"
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

def backup(path: Path):
    bak = path.with_suffix(path.suffix + f".bak_{stamp}")
    bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Backup created: {bak}")

if not notes_path.exists():
    raise SystemExit(f"Missing notes file: {notes_path}")

backup(notes_path)
notes = notes_path.read_text(encoding="utf-8")

# Remove pale body-row lines from ordinary note body cells only.
for key in ["tdLeft", "tdRight", "amountTd"]:
    notes = re.sub(
        rf"({key}:\s*\{{[^\n\r]*?)borderBottom:\s*[\"'][^\"']+[\"']",
        rf"\1borderBottom: \"none\"",
        notes,
        flags=re.S,
    )

# Keep only heading and total rules dark.
for key in ["thLeft", "thRight"]:
    notes = re.sub(
        rf"({key}:\s*\{{[^\n\r]*?)borderBottom:\s*[\"'][^\"']+[\"']",
        rf"\1borderBottom: \"1px solid #111827\"",
        notes,
        flags=re.S,
    )
for key in ["totalLabel", "totalAmount"]:
    notes = re.sub(
        rf"({key}:\s*\{{[^\n\r]*?)borderTop:\s*[\"'][^\"']+[\"']",
        rf"\1borderTop: \"1px solid #111827\"",
        notes,
        flags=re.S,
    )

helper = r'''
function isCashUsedInOperationsRows(rows: AmountLine[]): boolean {
  const text = rows.map((row) => String(row.label || "")).join(" ").toLowerCase();
  return (
    text.includes("profit / (loss) before taxation") &&
    text.includes("cash generated") &&
    text.includes("net cash") &&
    text.includes("cash equivalents")
  );
}
'''
if "function isCashUsedInOperationsRows" not in notes:
    notes = notes.replace("function rowsTotal", helper + "\nfunction rowsTotal", 1)

pat = r"(\s*<tr>\s*<td\s+style=\{styles\.totalLabel\}>Total</td>\s*<td\s+style=\{styles\.totalAmount\}>\{amount\(rowsTotal\(mappedRows,\s*\"current\"\)\)\}</td>\s*<td\s+style=\{styles\.totalAmount\}>\{amount\(rowsTotal\(mappedRows,\s*\"prior\"\)\)\}</td>\s*</tr>)"
wrapped = 0

def wrap_total(m):
    global wrapped
    block = m.group(1)
    if "isCashUsedInOperationsRows" in block:
        return block
    wrapped += 1
    return "\n        {!isCashUsedInOperationsRows(mappedRows) ? (" + block + "\n        ) : null}"

notes = re.sub(pat, wrap_total, notes, flags=re.S)
notes = notes.replace("{effectiveShowTotal ? (", "{effectiveShowTotal && !isCashUsedInOperationsRows(mappedRows) ? (")
notes = notes.replace("{showTotal ? (", "{showTotal && !isCashUsedInOperationsRows(mappedRows) ? (")

notes_path.write_text(notes, encoding="utf-8")
print(f"Updated notes file: {notes_path}")
print(f"Wrapped mappedRows total rows: {wrapped}")

if page_path.exists():
    backup(page_path)
    page = page_path.read_text(encoding="utf-8")
    before = page
    page = re.sub(
        r"(fontSize:\s*[^,}\n]+,\s*fontWeight:\s*(?:800|900|\"[0-9]+\"),[^}\n]*?)borderBottom:\s*[\"'][^\"']+[\"'],\s*",
        r"\1",
        page,
        count=1,
        flags=re.S,
    )
    if page != before:
        page_path.write_text(page, encoding="utf-8")
        print(f"Updated page file: {page_path}")
        print("Removed one likely cover title underline.")
    else:
        print("No cover title underline pattern matched. Page file left unchanged.")

print("Done. Now run: rm -rf .next && npm run dev")
