import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AnyRow = Record<string, any>;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceKey) as any;
}

function firstFilled(row: AnyRow | null | undefined, keys: string[]) {
  if (!row) return "";

  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function normaliseImageValue(value: unknown) {
  return String(value || "").trim();
}

function getLogoValue(row: AnyRow | null | undefined, keys: string[]) {
  return firstFilled(row, keys);
}

function firstFilledByNamePattern(row: AnyRow | null | undefined, includeTerms: string[], excludeTerms: string[] = []) {
  if (!row) return "";

  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    const normalKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const hasInclude = includeTerms.every((term) => normalKey.includes(term));
    const hasExclude = excludeTerms.some((term) => normalKey.includes(term));

    if (!hasInclude || hasExclude) continue;

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

async function tryDownloadFromPossibleBuckets(supabase: any, value: string) {
  const cleanValue = String(value || "").trim().replace(/^\/+/, "");
  if (!cleanValue) return "";

  const possibleBuckets = [
    "afs-firm-settings",
    "afs_firm_settings",
    "afs-settings",
    "afs_settings",
    "afs-logos",
    "afs_logos",
    "firm-settings",
    "firm_settings",
    "logos",
    "public",
  ];

  const parts = cleanValue.split("/").filter(Boolean);
  const candidates: Array<{ bucket: string; objectPath: string }> = [];

  if (parts.length >= 2) {
    candidates.push({
      bucket: parts[0],
      objectPath: parts.slice(1).join("/"),
    });
  }

  for (const bucket of possibleBuckets) {
    candidates.push({
      bucket,
      objectPath: cleanValue,
    });
  }

  for (const candidate of candidates) {
    try {
      const { data, error } = await supabase.storage
        .from(candidate.bucket)
        .download(candidate.objectPath);

      if (!error && data) {
        return await blobToDataUrl(data, getMimeFromUrl(cleanValue));
      }
    } catch {
      // Try next candidate.
    }
  }

  return "";
}


function getMimeFromUrl(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".gif")) return "image/gif";

  return "image/png";
}

async function blobToDataUrl(blob: Blob, fallbackMime: string) {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mime = blob.type || fallbackMime || "image/png";

  return `data:${mime};base64,${base64}`;
}

function parseSupabaseStorageObject(value: string) {
  try {
    const url = new URL(value);
    const publicMarker = "/storage/v1/object/public/";
    const signedMarker = "/storage/v1/object/sign/";
    const authMarker = "/storage/v1/object/authenticated/";

    const marker = url.pathname.includes(publicMarker)
      ? publicMarker
      : url.pathname.includes(signedMarker)
        ? signedMarker
        : url.pathname.includes(authMarker)
          ? authMarker
          : "";

    if (!marker) return null;

    const afterMarker = decodeURIComponent(url.pathname.split(marker)[1] || "");
    const parts = afterMarker.split("/").filter(Boolean);
    const bucket = parts.shift();
    const objectPath = parts.join("/");

    if (!bucket || !objectPath) return null;

    return { bucket, objectPath };
  } catch {
    return null;
  }
}

async function imageToDataUrl(supabase: any, rawValue: unknown) {
  const value = normaliseImageValue(rawValue);

  if (!value) return "";
  if (value.startsWith("data:image/")) return value;

  /*
    First try to fetch the URL exactly as stored. This covers public URLs and
    signed URLs produced by the settings upload.
  */
  if (/^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value, { cache: "no-store" });

      if (response.ok) {
        return await blobToDataUrl(await response.blob(), getMimeFromUrl(value));
      }
    } catch (error) {
      console.error("Failed to fetch AFS settings image URL", value, error);
    }

    /*
      If the direct URL failed, try downloading from Supabase storage with the
      service-role client. This covers expired signed URLs and private buckets.
    */
    const parsed = parseSupabaseStorageObject(value);

    if (parsed) {
      try {
        const { data, error } = await supabase.storage
          .from(parsed.bucket)
          .download(parsed.objectPath);

        if (!error && data) {
          return await blobToDataUrl(data, getMimeFromUrl(value));
        }

        if (error) {
          console.error("Failed to download AFS settings image from storage", error);
        }
      } catch (error) {
        console.error("Failed to download AFS settings image from storage", error);
      }
    }

    return value;
  }

  /*
    Last fallback for older rows that may store "bucket/path/to/file.png".
  */
  const parts = value.split("/").filter(Boolean);

  if (parts.length >= 2) {
    const bucket = parts.shift() || "";
    const objectPath = parts.join("/");

    try {
      const { data, error } = await supabase.storage.from(bucket).download(objectPath);

      if (!error && data) {
        return await blobToDataUrl(data, getMimeFromUrl(value));
      }

      if (error) {
        console.error("Failed to download relative AFS settings image path", error);
      }
    } catch (error) {
      console.error("Failed to download relative AFS settings image path", error);
    }
  }

  const downloadedFromPossibleBucket = await tryDownloadFromPossibleBuckets(supabase, value);
  if (downloadedFromPossibleBucket) return downloadedFromPossibleBucket;

  return value;
}

function cleanSettingsRow(row: AnyRow | null | undefined) {
  const data = row || {};

  return {
    reportOptions: data.report_options || data.reportOptions || {},
    directorsReportTexts:
      data.directors_report_texts || data.directorsReportTexts || {},
    accountingPolicyTexts:
      data.accounting_policy_texts || data.accountingPolicyTexts || {},
    noteTexts: data.note_texts || data.noteTexts || {},
    statementOverrides: data.statement_overrides || data.statementOverrides || {},
  };
}

async function cleanFirmSettings(supabase: any, row: AnyRow | null | undefined) {
  if (!row) return null;

  const logoUrl =
    getLogoValue(row, [
      "logo_data_url",
      "logoDataUrl",
      "logo_url",
      "logoUrl",
      "logo_path",
      "logoPath",
      "logo_storage_path",
      "logoStoragePath",
      "firm_logo_url",
      "firmLogoUrl",
      "firm_logo_path",
      "firmLogoPath",
      "letterhead_logo_url",
      "letterheadLogoUrl",
      "letterhead_logo_path",
      "letterheadLogoPath",
      "header_logo_url",
      "headerLogoUrl",
      "header_logo_path",
      "headerLogoPath",
    ]) ||
    firstFilledByNamePattern(row, ["logo"], [
      "footer",
      "governing",
      "professional",
      "second",
    ]);

  const governingBodyLogoUrl =
    getLogoValue(row, [
      "governing_body_logo_data_url",
      "governingBodyLogoDataUrl",
      "governing_body_logo_url",
      "governingBodyLogoUrl",
      "governing_body_logo_path",
      "governingBodyLogoPath",
      "governing_logo_url",
      "governing_logo_path",
      "professional_body_logo_url",
      "professionalBodyLogoUrl",
      "professional_body_logo_path",
      "professionalBodyLogoPath",
    ]) ||
    firstFilledByNamePattern(row, ["governing", "logo"], ["second"]) ||
    firstFilledByNamePattern(row, ["professional", "logo"], ["second"]);

  const secondGoverningBodyLogoUrl =
    getLogoValue(row, [
      "second_governing_body_logo_data_url",
      "secondGoverningBodyLogoDataUrl",
      "second_governing_body_logo_url",
      "secondGoverningBodyLogoUrl",
      "second_governing_body_logo_path",
      "secondGoverningBodyLogoPath",
      "second_professional_body_logo_url",
      "secondProfessionalBodyLogoUrl",
      "second_professional_body_logo_path",
      "secondProfessionalBodyLogoPath",
    ]) ||
    firstFilledByNamePattern(row, ["second", "logo"]);

  const footerLogoUrl =
    getLogoValue(row, [
      "footer_logo_data_url",
      "footerLogoDataUrl",
      "footer_logo_url",
      "footerLogoUrl",
      "footer_logo_path",
      "footerLogoPath",
      "footer_strip_url",
      "footerStripUrl",
      "footer_strip_path",
      "footerStripPath",
      "firm_footer_logo_url",
      "firmFooterLogoUrl",
      "firm_footer_logo_path",
      "firmFooterLogoPath",
    ]) ||
    firstFilledByNamePattern(row, ["footer", "logo"]) ||
    firstFilledByNamePattern(row, ["footer", "strip"]);

  const [logoDataUrl, governingBodyLogoDataUrl, secondGoverningBodyLogoDataUrl, footerLogoDataUrl] =
    await Promise.all([
      imageToDataUrl(supabase, logoUrl),
      imageToDataUrl(supabase, governingBodyLogoUrl),
      imageToDataUrl(supabase, secondGoverningBodyLogoUrl),
      imageToDataUrl(supabase, footerLogoUrl),
    ]);

  return {
    id: row.id || null,
    user_id: row.user_id || null,

    firm_name: row.firm_name || row.firmName || null,
    trading_name: row.trading_name || row.tradingName || null,

    logo_url: logoUrl || null,
    logo_data_url: logoDataUrl || null,

    address_lines: row.address_lines || row.addressLines || null,
    telephone: row.telephone || row.phone || row.firm_phone || null,
    email: row.email || row.firm_email || null,
    website: row.website || row.firm_website || null,

    practitioner_name:
      row.practitioner_name || row.practitionerName || row.partner_name || null,
    practitioner_designation:
      row.practitioner_designation ||
      row.practitionerDesignation ||
      row.designation ||
      null,

    governing_body_name:
      row.governing_body_name ||
      row.governingBodyName ||
      row.professional_body_name ||
      null,
    governing_body_registration_number:
      row.governing_body_registration_number ||
      row.governingBodyRegistrationNumber ||
      row.professional_body_registration_number ||
      row.practice_number ||
      row.membership_number ||
      null,
    governing_body_logo_url: governingBodyLogoUrl || null,
    governing_body_logo_data_url: governingBodyLogoDataUrl || null,

    second_governing_body_name:
      row.second_governing_body_name ||
      row.secondGoverningBodyName ||
      row.second_professional_body_name ||
      null,
    second_governing_body_registration_number:
      row.second_governing_body_registration_number ||
      row.secondGoverningBodyRegistrationNumber ||
      row.second_professional_body_registration_number ||
      null,
    second_governing_body_logo_url: secondGoverningBodyLogoUrl || null,
    second_governing_body_logo_data_url: secondGoverningBodyLogoDataUrl || null,

    footer_text: row.footer_text || row.footerText || null,
    footer_logo_url: footerLogoUrl || null,
    footer_logo_data_url: footerLogoDataUrl || null,
  };
}

async function loadEngagement(supabase: any, engagementId: string) {
  const { data, error } = await supabase
    .from("afs_engagements")
    .select("*")
    .eq("id", engagementId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function loadPrintStudioSettings(supabase: any, engagementId: string) {
  const { data, error } = await supabase
    .from("afs_print_studio_settings")
    .select("*")
    .eq("engagement_id", engagementId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function loadFirmSettings(supabase: any, engagement: AnyRow | null) {
  const ownerUserId = firstFilled(engagement, [
    "owner_user_id",
    "user_id",
    "created_by_user_id",
    "created_by",
    "created_by_id",
  ]);

  if (ownerUserId) {
    const { data, error } = await supabase
      .from("afs_firm_settings")
      .select("*")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load AFS firm settings by owner user id", error);
    } else if (data) {
      return data;
    }
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("afs_firm_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    console.error("Failed to load fallback AFS firm settings", fallbackError);
    return null;
  }

  return fallbackData || null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const engagement = await loadEngagement(supabase, id);
    const settingsRow = await loadPrintStudioSettings(supabase, id);
    const firmSettingsRow = await loadFirmSettings(supabase, engagement);
    const settings = cleanSettingsRow(settingsRow);
    const firmSettings = await cleanFirmSettings(supabase, firmSettingsRow);

    return NextResponse.json({
      success: true,
      ...settings,
      firmSettings,
      firm_settings: firmSettings,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load Print Studio settings.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const payload = await request.json();
    const supabase = getSupabaseAdmin();
    const engagement = await loadEngagement(supabase, id);
    const existing = await loadPrintStudioSettings(supabase, id);

    const nextRow = {
      engagement_id: id,
      report_options:
        payload.reportOptions !== undefined
          ? payload.reportOptions
          : existing?.report_options || {},
      directors_report_texts:
        payload.directorsReportTexts !== undefined
          ? payload.directorsReportTexts
          : existing?.directors_report_texts || {},
      accounting_policy_texts:
        payload.accountingPolicyTexts !== undefined
          ? payload.accountingPolicyTexts
          : existing?.accounting_policy_texts || {},
      note_texts:
        payload.noteTexts !== undefined
          ? payload.noteTexts
          : existing?.note_texts || {},
      statement_overrides:
        payload.statementOverrides !== undefined
          ? payload.statementOverrides
          : existing?.statement_overrides || {},
      owner_user_id:
        existing?.owner_user_id ||
        firstFilled(engagement, [
          "owner_user_id",
          "user_id",
          "created_by_user_id",
          "created_by",
          "created_by_id",
        ]) ||
        null,
      updated_at: new Date().toISOString(),
    };

    let savedRow: AnyRow | null = null;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("afs_print_studio_settings")
        .update(nextRow)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      savedRow = data || null;
    } else {
      const { data, error } = await supabase
        .from("afs_print_studio_settings")
        .insert({
          ...nextRow,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      savedRow = data || null;
    }

    const firmSettingsRow = await loadFirmSettings(supabase, engagement);
    const settings = cleanSettingsRow(savedRow);
    const firmSettings = await cleanFirmSettings(supabase, firmSettingsRow);

    return NextResponse.json({
      success: true,
      ...settings,
      firmSettings,
      firm_settings: firmSettings,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to save Print Studio settings.",
      },
      { status: 500 },
    );
  }
}
