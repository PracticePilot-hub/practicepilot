from pathlib import Path
from datetime import datetime
import re

ROOT = Path.cwd()

notes_path = ROOT / "app/afs/[engagementId]/print-studio/AfsStructuredNotesPanel.tsx"
page_path = ROOT / "app/afs/[engagementId]/print-studio/page.tsx"

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

def backup(path: Path):
    backup_path = path.with_suffix(path.suffix + f".bak_{stamp}")
    backup_path.write_text(path.read_text(), encoding="utf-8")
    print(f"Backup created: {backup_path}")

def replace_all(text: str, old: str, new: str):
    count = text.count(old)
    if count:
        text = text.replace(old, new)
    return text, count

if not notes_path.exists():
    raise SystemExit(f"Missing file: {notes_path}")

backup(notes_path)
notes = notes_path.read_text(encoding="utf-8")

# 1) Remove pale/light body row lines in the notes renderer.
line_patterns = [
    'borderBottom: "1px solid #e5e7eb"',
    "borderBottom: '1px solid #e5e7eb'",
    'borderBottom: "1px solid #eef2f7"',
    "borderBottom: '1px solid #eef2f7'",
    'borderBottom: "1px solid #f1f5f9"',
    "borderBottom: '1px solid #f1f5f9'",
]
total_removed = 0
for pattern in line_patterns:
    notes, count = replace_all(notes, pattern, 'borderBottom: "none"')
    total_removed += count

# Restore dark header/total rules if the broad replacement hit them.
notes = notes.replace(
    'thLeft: { textAlign: "left", borderBottom: "none",',
    'thLeft: { textAlign: "left", borderBottom: "1px solid #111827",',
)
notes = notes.replace(
    'thRight: { textAlign: "right", borderBottom: "none",',
    'thRight: { textAlign: "right", borderBottom: "1px solid #111827",',
)
notes = notes.replace(
    'totalLabel: { padding: "4px 0", borderTop: "none",',
    'totalLabel: { padding: "4px 0", borderTop: "1px solid #111827",',
)
notes = notes.replace(
    'totalAmount: { padding: "4px 3px", borderTop: "none",',
    'totalAmount: { padding: "4px 3px", borderTop: "1px solid #111827",',
)

# 2) Add showTotal prop support to NoteTable if missing.
if "showTotal?: boolean" not in notes:
    notes = re.sub(
        r"(function NoteTable\(\{\s*rows,\s*edit\s*=\s*false,\s*state,\s*stateKey,\s*update,)",
        r"\1\n  showTotal = true,",
        notes,
        count=1,
        flags=re.S,
    )

    notes = re.sub(
        r"(rows:\s*AmountLine\[\];\s*edit\?:\s*boolean;\s*state:\s*StructuredNotesState;\s*stateKey:\s*keyof StructuredNotesState;\s*update:\s*\(patch:\s*Partial<StructuredNotesState>\)\s*=>\s*void;)",
        r"\1\n  showTotal?: boolean;",
        notes,
        count=1,
        flags=re.S,
    )

# 3) Wrap the Total row so it can be suppressed.
if "showTotal ? (" not in notes:
    # Most likely TSX table total row pattern in this file.
    notes = re.sub(
        r"(\s*<tr>\s*<td style=\{styles\.totalLabel\}>Total</td>\s*<td style=\{styles\.totalAmount\}>\{amount\(rowsTotal\(mappedRows,\s*\"current\"\)\)\}</td>\s*<td style=\{styles\.totalAmount\}>\{amount\(rowsTotal\(mappedRows,\s*\"prior\"\)\)\}</td>\s*</tr>)",
        r"\n        {showTotal ? (\1\n        ) : null}",
        notes,
        count=1,
        flags=re.S,
    )

# 4) Suppress the fake total for cash-used-in-operations note by detecting the stateKey.
# Add default variable near NoteTable body.
if "const suppressTotalForCashUsed" not in notes:
    notes = re.sub(
        r"(function NoteTable\([\s\S]*?\)\s*\{)",
        r'\1\n  const suppressTotalForCashUsed = String(stateKey).toLowerCase().includes("cashused") || String(stateKey).toLowerCase().includes("cash_used") || String(stateKey).toLowerCase().includes("cashoperations") || String(stateKey).toLowerCase().includes("cash_operations");\n  const effectiveShowTotal = showTotal && !suppressTotalForCashUsed;',
        notes,
        count=1,
    )

notes = notes.replace("showTotal ? (", "effectiveShowTotal ? (")

notes_path.write_text(notes, encoding="utf-8")
print(f"Updated notes file: {notes_path}")
print(f"Body border replacements attempted: {total_removed}")

# 5) Cover double-line: remove the extra cover-page divider without touching report page headers.
if page_path.exists():
    backup(page_path)
    page = page_path.read_text(encoding="utf-8")

    # Remove common duplicate/extra divider immediately around cover title block.
    cover_patterns = [
        r'\s*<div\s+style=\{\{\s*height:\s*1,\s*background:\s*"#111827",\s*margin:\s*"[^"]*"\s*\}\}\s*/>\s*',
        r'\s*<div\s+style=\{\{\s*borderTop:\s*"1px solid #111827",\s*margin:\s*"[^"]*"\s*\}\}\s*/>\s*',
        r'\s*<div\s+style=\{\{\s*borderBottom:\s*"1px solid #111827",\s*margin:\s*"[^"]*"\s*\}\}\s*/>\s*',
    ]

    # Do not remove all global dividers blindly; remove only first matching divider inside cover-page area.
    # This is intentionally conservative.
    before = page
    for pat in cover_patterns:
        new_page, count = re.subn(pat, "\n", page, count=1)
        if count:
            page = new_page
            print("Removed one likely duplicate cover divider.")
            break

    if page != before:
        page_path.write_text(page, encoding="utf-8")
        print(f"Updated page file: {page_path}")
    else:
        print("No obvious cover duplicate divider found in page.tsx. Left page.tsx unchanged.")
else:
    print(f"Page file not found, skipped cover-line fix: {page_path}")

print("Done. Now run: rm -rf .next && npm run dev")
