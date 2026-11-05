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

/** HTTP header values must be ASCII; filename* retains the actual Unicode entity name. */
export function afsPdfDownloadHeaders(title:string,filename:string){
  const ascii=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7E]/g,'_').replace(/["\\]/g,'_');
  const encoded=encodeURIComponent(filename).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
  return {'Content-Disposition':`attachment; filename="${ascii(filename)}"; filename*=UTF-8''${encoded}`,'X-AFS-PDF-Title':ascii(title)};
}
