/** Use reporting metadata; a practitioner named in report prose is not the reporting entity. */
export function afsExportIdentity(input: {
  entityName: unknown;
  yearEnd: unknown;
}) {
  const entityName = String(input.entityName ?? "").replace(/\s+/g, " ").trim();
  const yearEnd = String(input.yearEnd ?? "")
    .replace(/\s+/g, " ")
    .replace(/^.*year end\s*/i, "")
    .trim();

  if (!entityName) {
    throw new Error("The reporting entity name is missing. Check Client Setup before exporting.");
  }
  if (!yearEnd) {
    throw new Error("The reporting year end is missing. Check Client Setup before exporting.");
  }
  return { entityName, yearEnd };
}
