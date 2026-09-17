import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_URLS: Record<string, string> = {
  j401: "https://www.justice.gov.za/master/m_forms/J401_trust-registration-amendment-eform.pdf",
  j405: "https://www.justice.gov.za/master/m_forms/J405_acceptance-auditor-eform.pdf",
  j417: "https://www.justice.gov.za/master/m_forms/J417_acceptance-trustee-eform.pdf",
  j450: "https://www.justice.gov.za/master/m_forms/J450_beneficiaries-declaration-eform.pdf",
  affidavit: "https://www.justice.gov.za/master/m_forms/moh-SwornAffTrustee.pdf",
  "annexure-b": "https://www.justice.gov.za/master/m_forms/moh_Trusts-anxB_PrescFee.pdf",
};

const LOCAL_TEMPLATES: Record<string, string> = {
  j401: "J401_trust-registration-amendment-eform.pdf",
  j405: "J405_acceptance-auditor-eform.pdf",
  j417: "J417_acceptance-trustee-eform.pdf",
  j450: "J450_beneficiaries-declaration-eform.pdf",
  affidavit: "moh-SwornAffTrustee.pdf",
  "annexure-b": "moh_Trusts-anxB_PrescFee.pdf",
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function cap(value: unknown) {
  return clean(value).toUpperCase();
}

function safeFilename(value: unknown) {
  return (
    clean(value)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Trust"
  );
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase server environment variables.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedContext(req: Request, trustId: string) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Missing PracticePilot session token.");

  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new Error("PracticePilot session could not be verified.");
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select(
      "access_enabled,can_access_trusts,organisation_id,trusts_organisation_id"
    )
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.access_enabled || !profile?.can_access_trusts) {
    throw new Error("Trusts access is not enabled for this login.");
  }

  const organisationId =
    profile.trusts_organisation_id || profile.organisation_id;
  if (!organisationId) {
    throw new Error("No Trusts organisation is linked to this login.");
  }

  const [trustResult, partiesResult] = await Promise.all([
    admin
      .from("pp_trusts")
      .select("*")
      .eq("id", trustId)
      .eq("organisation_id", organisationId)
      .maybeSingle(),
    admin
      .from("pp_trust_parties")
      .select("*")
      .eq("trust_id", trustId)
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: true }),
  ]);

  if (trustResult.error) throw trustResult.error;
  if (partiesResult.error) throw partiesResult.error;
  if (!trustResult.data) throw new Error("Trust not found or access denied.");

  return {
    trust: trustResult.data,
    parties: partiesResult.data || [],
  };
}

async function loadTemplate(form: string) {
  const localName = LOCAL_TEMPLATES[form];
  const localPath = localName
    ? path.join(process.cwd(), "public", "forms", "trusts", localName)
    : "";

  if (localPath) {
    try {
      return new Uint8Array(await readFile(localPath));
    } catch {
      // Fall back to the current DOJ template below.
    }
  }

  const url = TEMPLATE_URLS[form];
  if (!url) throw new Error(`No official template configured for ${form}.`);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Could not fetch official DOJ ${form.toUpperCase()} template (${response.status}).`
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function partyAddress(p: any) {
  return [
    p?.address_line1,
    p?.address_line2,
    p?.city,
    p?.province,
    p?.postal_code,
  ]
    .map(clean)
    .filter(Boolean);
}

function partyPostal(p: any) {
  return [
    p?.postal_line1,
    p?.postal_line2,
    p?.postal_city,
    p?.postal_province,
    p?.postal_postal_code,
  ]
    .map(clean)
    .filter(Boolean);
}

function representativeParts(p: any) {
  const explicitFirst = clean(p?.representative_first_names);
  const explicitSurname = clean(p?.representative_surname);
  if (explicitFirst || explicitSurname) {
    return {
      firstNames: explicitFirst,
      surname: explicitSurname,
      fullName: [explicitFirst, explicitSurname].filter(Boolean).join(" "),
    };
  }
  const fallback = clean(p?.representative_name);
  const parts = splitName(fallback);
  return { ...parts, fullName: fallback };
}

function trustPhysical(trust: any) {
  return [
    trust?.physical_line1,
    trust?.physical_line2,
    trust?.physical_city,
    trust?.physical_province,
    trust?.physical_postal_code,
  ]
    .map(clean)
    .filter(Boolean);
}

function trustPostal(trust: any) {
  return [
    trust?.postal_line1,
    trust?.postal_line2,
    trust?.postal_city,
    trust?.postal_province,
    trust?.postal_postal_code,
  ]
    .map(clean)
    .filter(Boolean);
}

function splitName(fullName: unknown) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  const surname = parts.pop() || "";
  return { surname, firstNames: parts.join(" ") };
}

function dobFromId(id: unknown) {
  const value = clean(id).replace(/\D/g, "");
  if (value.length !== 13) return "";
  const yy = Number(value.slice(0, 2));
  const currentYY = new Date().getFullYear() % 100;
  const year = yy <= currentYY ? 2000 + yy : 1900 + yy;
  return `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

function isMinorFromId(id: unknown) {
  const dob = dobFromId(id);
  if (!dob) return false;
  const d = new Date(`${dob}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const beforeBirthday =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age < 18;
}

function isEntity(p: any) {
  return p?.party_kind === "entity";
}

function textField(form: any, name: string, value: unknown, fontSize = 8) {
  const v = clean(value);
  if (!v) return;
  try {
    const field = form.getTextField(name);
    field.setText(v);
    try {
      field.setFontSize(fontSize);
    } catch {}
  } catch (error) {
    console.warn(`Trust form text field not found: ${name}`, error);
  }
}

function checkField(form: any, name: string, checked: boolean) {
  try {
    const field = form.getCheckBox(name);
    if (checked) field.check();
    else field.uncheck();
  } catch (error) {
    console.warn(`Trust form checkbox not found: ${name}`, error);
  }
}

function setYesNo(
  form: any,
  yesName: string,
  noName: string,
  value: boolean | null | undefined
) {
  if (value === undefined || value === null) return;
  checkField(form, yesName, value === true);
  checkField(form, noName, value === false);
}

async function finishForm(pdf: PDFDocument) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  form.updateFieldAppearances(font);
  form.flatten();
  return pdf.save();
}

async function fillJ405(template: Uint8Array, trust: any, parties: any[]) {
  const pdf = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = pdf.getForm();
  const accountant = parties.find((p) => p.role_accountant);
  if (!accountant) throw new Error("No accountant has been captured for this trust.");

  const founder = parties.find((p) => p.role_founder);
  const rep = representativeParts(accountant);
  const representativeName = rep.fullName || accountant.full_name;
  const representativeId = accountant.representative_id_number || accountant.id_number;

  textField(form, "I.0", cap(representativeName), 8);
  textField(form, "undefined", representativeId, 8);
  if (isEntity(accountant)) {
    textField(
      form,
      "Representative of Organisation If Applicable",
      cap(accountant.full_name),
      8
    );
    textField(
      form,
      "Registration Number If Applicable",
      accountant.registration_number,
      8
    );
  }

  textField(
    form,
    "Accreditation Body",
    accountant.accreditation_body || trust.accountant_accreditation_body,
    8
  );
  textField(
    form,
    "Accreditation Registration No",
    accountant.accreditation_number ||
      accountant.professional_registration_number ||
      trust.accountant_accreditation_number,
    8
  );
  textField(form, "Undertake", cap(trust.name), 8);

  const physical = partyAddress(accountant);
  const postal = partyPostal(accountant).length ? partyPostal(accountant) : physical;

  for (let i = 0; i < 4; i += 1) {
    textField(
      form,
      `Domicillium Citandi et executandi physical address ${i + 1}`,
      physical[i],
      8
    );
    textField(form, `Postal Address ${i + 1}`, postal[i], 8);
  }

  const phone = accountant.phone || accountant.mobile || "";
  const cell = accountant.mobile || accountant.phone || "";
  textField(form, "Tel", phone, 8);
  textField(form, "Cell", cell, 8);
  textField(form, "Email", accountant.email, 8);

  // These five boxes are the undertakings the accountant accepts by signing J405.
  for (let i = 0; i < 5; i += 1) {
    checkField(form, `Check Box2.${i}`, true);
  }

  return finishForm(pdf);
}

async function fillJ417(template: Uint8Array, trust: any, trustee: any) {
  const pdf = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = pdf.getForm();

  const entity = isEntity(trustee);
  const displayName = entity
    ? trustee.representative_name || trustee.full_name
    : trustee.full_name;
  const id = entity
    ? trustee.representative_id_number || ""
    : trustee.id_number || "";

  textField(form, "I Full names and surname", cap(displayName), 8);
  textField(form, "ID  Passport No", id, 8);

  if (entity) {
    textField(
      form,
      "Representative of Organisation If Applicable",
      cap(trustee.full_name),
      8
    );
    textField(
      form,
      "Registration Number If Applicable",
      trustee.registration_number,
      8
    );
  }

  textField(form, "as", cap(trust.name), 8);

  const physical = partyAddress(trustee).length
    ? partyAddress(trustee)
    : trustPhysical(trust);
  const postal = partyPostal(trustee).length ? partyPostal(trustee) : physical;

  for (let i = 0; i < 4; i += 1) {
    textField(
      form,
      `Domicillium Citandi et executandi physical address ${i + 1}`,
      physical[i],
      8
    );
    textField(form, `Postal Address ${i + 1}`, postal[i], 8);
  }

  textField(form, "Tel", trustee.phone || trustee.mobile, 8);
  textField(form, "Cell", trustee.mobile || trustee.phone, 8);
  textField(form, "Email", trustee.email, 8);

  // Page 1 questions that PP can answer from captured facts.
  const familyBusiness =
    typeof trust.is_family_business_trust === "boolean"
      ? trust.is_family_business_trust
      : clean(trust.trust_type).toLowerCase().includes("family");
  setYesNo(form, "Check Box1.0.0", "Check Box1.0.1", familyBusiness);
  setYesNo(
    form,
    "Check Box1.1.0",
    "Check Box1.1.1",
    Boolean(trustee.role_independent_trustee)
  );
  setYesNo(
    form,
    "Check Box1.2.0",
    "Check Box1.2.1",
    Boolean(trustee.role_beneficiary)
  );
  setYesNo(
    form,
    "Check Box1.3.0",
    "Check Box1.3.1",
    trustee.j417_related_to_beneficiary_or_trustee
  );
  setYesNo(
    form,
    "Check Box1.4.0",
    "Check Box1.4.1",
    trustee.j417_all_beneficiaries_related
  );
  setYesNo(
    form,
    "Check Box1.5.0",
    "Check Box1.5.1",
    trustee.j417_direct_control
  );

  textField(
    form,
    "Profession and or business occupation of the trustee",
    trustee.occupation || trustee.profession,
    8
  );
  textField(
    form,
    "Previous practical experience in trust administration Mention any specific cases 1",
    trustee.trust_administration_experience || trustee.experience_notes,
    8
  );

  // The remaining relationship, fiduciary and statutory declarations are deliberately
  // left for the trustee to confirm personally before signature / commissioner of oaths.

  return finishForm(pdf);
}

async function fillJ450(template: Uint8Array, parties: any[]) {
  const pdf = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = pdf.getForm();
  const beneficiaries = parties.filter((p) => p.role_beneficiary).slice(0, 25);

  beneficiaries.forEach((b, index) => {
    const row = index + 1;
    textField(
      form,
      `Beneficiary Type${row}`,
      isEntity(b) ? "Organisation" : "Individual",
      7
    );
    textField(
      form,
      `Beneficiary Full Names Organisation Name${row}`,
      cap(b.full_name),
      7
    );
    textField(
      form,
      `IDPassport Registration No${row}`,
      b.registration_number || b.id_number,
      7
    );
    textField(
      form,
      `Date of Birth${row}`,
      isEntity(b) ? "" : b.date_of_birth || dobFromId(b.id_number),
      7
    );
    textField(
      form,
      `Is Beneficiary a Minor Mentally Incapacitated${row}`,
      b.is_minor || isMinorFromId(b.id_number) ? "YES" : "NO",
      7
    );
    if (b.is_minor || isMinorFromId(b.id_number)) {
      textField(form, `Guardian Full Names${row}`, cap(b.guardian_name), 7);
      textField(form, `Guardian ID Passport${row}`, b.guardian_id_number, 7);
    }
  });

  return finishForm(pdf);
}

function fillPersonOnJ401(
  form: any,
  prefix: string,
  person: any,
  trusteeYesName?: string,
  trusteeNoName?: string
) {
  if (!person) return;
  const entity = isEntity(person);
  const repName = entity
    ? person.representative_name || ""
    : person.full_name || "";
  const repId = entity
    ? person.representative_id_number || ""
    : person.id_number || "";
  const { surname, firstNames } = splitName(repName);

  // The page 5 founder groups use ten text fields per founder.
  textField(form, `${prefix}.0`, entity ? cap(person.full_name) : "", 8);
  textField(form, `${prefix}.1`, entity ? person.registration_number : "", 8);
  textField(form, `${prefix}.3`, surname, 8);
  textField(form, `${prefix}.5`, firstNames, 8);
  textField(form, `${prefix}.7`, repId, 8);
  textField(form, `${prefix}.9`, "South Africa", 8);

  if (trusteeYesName && trusteeNoName) {
    setYesNo(
      form,
      trusteeYesName,
      trusteeNoName,
      Boolean(person.role_trustee || person.role_independent_trustee)
    );
  }
}

async function fillJ401(template: Uint8Array, trust: any, parties: any[]) {
  const pdf = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = pdf.getForm();

  const trustees = parties.filter(
    (p) => p.role_trustee || p.role_independent_trustee
  );
  const founders = parties.filter((p) => p.role_founder);
  const accountant = parties.find((p) => p.role_accountant);
  const founder = founders[0];
  const individualTrustees = trustees.filter((p) => !isEntity(p));
  const organisationTrustees = trustees.filter((p) => isEntity(p));

  // PAGE 1 — Summary details
  checkField(form, "Check Box1.0.0", true); // Trust Registration
  textField(form, "Text2.0", cap(trust.name), 9);
  textField(form, "Text2.2", trust.registration_number, 8);
  textField(
    form,
    "Text2.3",
    trust.masters_office || trust.physical_city || "Pretoria",
    8
  );
  textField(form, "Text2.5", individualTrustees.length, 8);
  textField(form, "Text2.6", organisationTrustees.length, 8);
  textField(form, "Text2.7.0", trust.minimum_trustees || 2, 8);
  textField(form, "Text2.8.0", trust.maximum_trustees || 5, 8);
  setYesNo(
    form,
    "Check Box4.1.0",
    "Check Box4.1.1",
    Boolean(trust.annual_audit_required)
  );
  setYesNo(form, "Check Box4.3.0", "Check Box4.3.1", false);

  // PAGE 2 — Applicant / Agent: the appointed accountant organisation / representative
  if (accountant) {
    const rep = representativeParts(accountant);
    const repName = rep.fullName || accountant.full_name;
    const repId = accountant.representative_id_number || accountant.id_number;
    const { surname, firstNames } = rep.fullName ? rep : splitName(repName);

    textField(form, "Text3.0", isEntity(accountant) ? cap(accountant.full_name) : "", 8);
    textField(form, "Text3.2", isEntity(accountant) ? accountant.registration_number : "", 8);
    textField(form, "Text3.3", surname, 8);
    textField(form, "Text3.5", firstNames, 8);
    textField(form, "Text3.7", "South Africa", 8);
    textField(form, "Text3.8", repId, 8);

    // Preferred communication = email; preferred collection = collect by hand.
    checkField(form, "Check Box2.2", true);
    checkField(form, "Check Box2.5", true);

    textField(form, "Text3.11", accountant.phone || accountant.mobile || founder?.mobile, 8);
    textField(form, "Text3.12", accountant.mobile || founder?.mobile || accountant.phone, 8);
    textField(form, "Text3.14", accountant.email || founder?.email, 8);

    const applicantPhysical = partyAddress(accountant);
    const applicantPostal = partyPostal(accountant).length
      ? partyPostal(accountant)
      : applicantPhysical;

    textField(form, "Text3.15", applicantPostal[0], 8);
    textField(form, "Text3.16", applicantPostal[1], 8);
    textField(form, "Text3.17", applicantPostal[3], 8);
    textField(form, "Text3.18", applicantPostal[2], 8);
    textField(form, "Text3.19", applicantPostal[4], 8);
    textField(form, "Text3.20", applicantPhysical[0], 8);
    textField(form, "Text3.21", applicantPhysical[1], 8);
    textField(form, "Text3.22", applicantPhysical[3], 8);
    textField(form, "Text3.23", applicantPhysical[2], 8);
    textField(form, "Text3.24", applicantPhysical[4], 8);

    // Applicant capacities: not trustee; accountant yes; main contact no; founder no.
    checkField(form, "Check Box2.9", true);
    checkField(form, "Check Box2.10", true);
    checkField(form, "Check Box2.13", true);
    checkField(form, "Check Box2.15", true);
  }

  // PAGE 4 — Main contact + bank details: use the founder/main trustee.
  if (founder) {
    const { surname, firstNames } = splitName(founder.full_name);
    textField(form, "Text6.2", surname, 8);
    textField(form, "Text6.3", firstNames, 8);
    textField(form, "Text6.4", "South Africa", 8);
    textField(form, "Text6.5", founder.id_number, 8);

    checkField(form, "Check Box5.2", true); // email
    checkField(form, "Check Box5.5", true); // collect by hand

    textField(form, "Text6.8", founder.phone || founder.mobile, 8);
    textField(form, "Text6.9", founder.mobile || founder.phone, 8);
    textField(form, "Text6.11", founder.email, 8);

    const mainPhysical = partyAddress(founder).length
      ? partyAddress(founder)
      : trustPhysical(trust);
    const mainPostal = partyPostal(founder).length ? partyPostal(founder) : mainPhysical;

    textField(form, "Text6.12", mainPostal[0], 8);
    textField(form, "Text6.21", mainPostal[1], 8);
    textField(form, "Text6.13", mainPostal[3], 8);
    textField(form, "Text6.14", mainPostal[2], 8);
    textField(form, "Text6.15", mainPostal[4], 8);
    textField(form, "Text6.16", mainPhysical[0], 8);
    textField(form, "Text6.17", mainPhysical[1], 8);
    textField(form, "Text6.18", mainPhysical[3], 8);
    textField(form, "Text6.19", mainPhysical[2], 8);
    textField(form, "Text6.20", mainPhysical[4], 8);

    setYesNo(form, "Check Box5.7", "Check Box5.9", Boolean(founder.role_trustee));
    setYesNo(form, "Check Box5.8", "Check Box5.10", false);
    setYesNo(form, "Check Box5.11", "Check Box5.12.0", true);
  }

  textField(form, "Text6.22.0.0", trust.bank_name || "First National Bank", 8);
  textField(
    form,
    "Text6.22.0.1",
    trust.bank_branch_name || trust.masters_office || "Pretoria",
    8
  );
  if (trust.bank_account_status === "existing") {
    textField(form, "Text6.22.0.2", trust.bank_branch_code, 8);
    textField(form, "Text6.22.0.3", trust.bank_account_number, 8);
  } else {
    // The Trusteeze examples use this wording on the official form for a new trust.
    textField(
      form,
      "Text6.22.0.2",
      "Account will be opened after registration",
      7
    );
  }

  // PAGE 5 — Founder details (up to three founders).
  const founderPrefixes = ["Text7", "Text7", "Text7"];
  founders.slice(0, 3).forEach((f, index) => {
    const base = index * 10;
    const entity = isEntity(f);
    const repName = entity ? f.representative_name || "" : f.full_name;
    const repId = entity ? f.representative_id_number || "" : f.id_number;
    const { surname, firstNames } = splitName(repName);
    textField(form, `Text7.${base}`, entity ? cap(f.full_name) : "", 8);
    textField(form, `Text7.${base + 1}`, entity ? f.registration_number : "", 8);
    textField(form, `Text7.${base + 3}`, surname, 8);
    textField(form, `Text7.${base + 5}`, firstNames, 8);
    textField(form, `Text7.${base + 7}`, repId, 8);
    textField(form, `Text7.${base + 9}`, "South Africa", 8);
    setYesNo(
      form,
      `Check Box6.${index}.0`,
      `Check Box6.${index}.1`,
      Boolean(f.role_trustee || f.role_independent_trustee)
    );
  });

  // PAGE 6 — Trustees summary.
  trustees.slice(0, 15).forEach((t, index) => {
    textField(form, `Text8.0.${index}`, isEntity(t) ? "Organisation" : "Individual", 7);
    textField(form, `Text8.1.${index}`, cap(t.full_name), 7);
    textField(
      form,
      `Text8.2.${index}`,
      t.registration_number || t.id_number,
      7
    );
    if (isEntity(t)) {
      textField(form, `Text8.3.${index}`, cap(t.representative_name), 7);
      textField(form, `Text8.4.${index}`, t.representative_id_number, 7);
    }
  });

  // PAGE 7 — Auditor / accountant + security exemption.
  if (accountant) {
    const rep = representativeParts(accountant);
    const repName = rep.fullName || accountant.full_name;
    const repId = accountant.representative_id_number || accountant.id_number;
    const { surname, firstNames } = rep.fullName ? rep : splitName(repName);

    textField(form, "Text9.0", isEntity(accountant) ? cap(accountant.full_name) : "", 8);
    textField(form, "Text9.2", isEntity(accountant) ? accountant.registration_number : "", 8);
    textField(form, "Text9.3", surname, 8);
    textField(form, "Text9.5", firstNames, 8);
    textField(form, "Text9.7", "South Africa", 8);
    textField(form, "Text9.8", repId, 8);

    const accreditation = clean(
      accountant.accreditation_body || trust.accountant_accreditation_body
    ).toLowerCase();
    if (accreditation.includes("saipa")) checkField(form, "Check Box7.1.0", true);
    else if (accreditation.includes("saica")) checkField(form, "Check Box7.0.1", true);
    else if (accreditation.includes("irba")) checkField(form, "Check Box7.0.0", true);
    else if (accreditation.includes("cima")) checkField(form, "Check Box7.2.0", true);
    else if (accreditation.includes("acca")) checkField(form, "Check Box7.1.1", true);
    else if (accreditation) checkField(form, "Check Box7.2.1", true);

    textField(
      form,
      "Text9.10",
      accountant.accreditation_number ||
        accountant.professional_registration_number ||
        trust.accountant_accreditation_number,
      8
    );
  }

  setYesNo(form, "Check Box7.3.0", "Check Box7.3.1", false);
  textField(
    form,
    "Text9.13",
    "AS PER CLAUSE 11 OF THE TRUST DEED, TRUSTEES EXEMPT FROM PROVIDING SECURITY",
    8
  );

  return finishForm(pdf);
}

async function fillAffidavit(template: Uint8Array, trust: any, parties: any[]) {
  const pdf = await PDFDocument.load(template, { ignoreEncryption: true });
  const trustee = parties.find((p) => p.role_independent_trustee);
  if (!trustee) {
    throw new Error("No independent trustee has been captured for this trust.");
  }

  const entity = isEntity(trustee);
  const rep = representativeParts(trustee);
  const displayName = entity ? rep.fullName : trustee.full_name;
  const id = entity
    ? trustee.representative_id_number || ""
    : trustee.id_number || "";

  const form = pdf.getForm();
  const textFields = form
    .getFields()
    .filter((field: any) => typeof field?.setText === "function") as any[];

  // The current DOJ affidavit exposes the four identity fields at the top as
  // the first four text fields. Fill the native fields instead of drawing text
  // over the artwork. If a future DOJ version changes that, fall back safely.
  if (textFields.length >= 4) {
    textFields[0].setText(cap(displayName));
    textFields[1].setText(id);
    textFields[2].setText(entity ? cap(trustee.full_name) : "");
    textFields[3].setText(entity ? clean(trustee.registration_number) : "");
    try {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      form.updateFieldAppearances(font);
      form.flatten();
      return pdf.save();
    } catch {
      // Continue to the conservative overlay fallback below.
    }
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPages()[0];
  const draw = (text: unknown, x: number, y: number, size = 8) => {
    const value = clean(text);
    if (!value) return;
    page.drawText(value.slice(0, 80), { x, y, size, font });
  };

  draw(cap(displayName), 302, 680, 8);
  draw(id, 302, 657, 8);
  if (entity) {
    draw(cap(trustee.full_name), 302, 635, 8);
    draw(trustee.registration_number, 302, 612, 8);
  }

  return pdf.save();
}

async function fillAnnexureB(template: Uint8Array, trust: any, parties: any[]) {
  const pdf = await PDFDocument.load(template, { ignoreEncryption: true });
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const founder = parties.find((p) => p.role_founder);
  if (!founder) throw new Error("No founder has been captured for this trust.");

  const draw = (value: unknown, x: number, y: number, size = 10) => {
    const text = clean(value);
    if (!text) return;
    page.drawText(text, { x, y, size, font });
  };

  // Current DOJ Circular 90/2017 Annexure B. Leave receipt/date/signature fields blank
  // because those are completed when payment/signature actually occurs.
  draw(trust.masters_office || "Pretoria", 255, 575, 10);
  draw(cap(trust.name), 170, 544, 10);
  draw(cap(founder.full_name), 178, 513, 10);
  draw(founder.id_number || founder.registration_number, 335, 482, 10);

  return pdf.save();
}

export async function GET(
  req: Request,
  context: { params: Promise<{ trustId: string; form: string }> }
) {
  try {
    const { trustId, form: rawForm } = await context.params;
    const formKey = clean(rawForm).toLowerCase();

    if (!TEMPLATE_URLS[formKey]) {
      return NextResponse.json(
        { error: "Unsupported Master form." },
        { status: 404 }
      );
    }

    const { trust, parties } = await authenticatedContext(req, trustId);
    const url = new URL(req.url);
    const partyId = url.searchParams.get("partyId");
    const template = await loadTemplate(formKey);

    let bytes: Uint8Array;
    let label = formKey.toUpperCase();

    if (formKey === "j401") {
      bytes = await fillJ401(template, trust, parties);
    } else if (formKey === "j450") {
      bytes = await fillJ450(template, parties);
    } else if (formKey === "j405") {
      bytes = await fillJ405(template, trust, parties);
    } else if (formKey === "affidavit") {
      bytes = await fillAffidavit(template, trust, parties);
    } else if (formKey === "annexure-b") {
      bytes = await fillAnnexureB(template, trust, parties);
      label = "Annexure B - Masters Prescribed Fee";
    } else {
      const trustee = parties.find(
        (p: any) =>
          p.id === partyId &&
          (p.role_trustee || p.role_independent_trustee)
      );
      if (!trustee) throw new Error("Select a valid trustee for the J417.");
      bytes = await fillJ417(template, trust, trustee);
      label = `J417 - ${trustee.full_name}`;
    }

    const filename = `${safeFilename(trust.name)} - ${safeFilename(label)}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("TRUST MASTER FORM ERROR", error);
    return NextResponse.json(
      { error: error?.message || "Could not generate Master form." },
      { status: 500 }
    );
  }
}
