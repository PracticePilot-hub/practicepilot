import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getIdFromContext(context: any) {
  const params = await context?.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    throw new Error("Missing AFS engagement id.");
  }

  return id;
}

function cleanText(value: any) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function boolValue(value: any, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function numberOrNull(value: any) {
  if (value === "" || value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function integerOrDefault(value: any, fallback: number) {
  const numberValue = parseInt(String(value ?? ""), 10);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export async function GET(_req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { data: settings, error: settingsError } = await supabase
      .from("afs_report_disclosure_settings")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("page_key", { ascending: true })
      .order("display_order", { ascending: true });

    if (settingsError) throw settingsError;

    const { data: manualTables, error: manualTablesError } = await supabase
      .from("afs_report_manual_tables")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("table_key", { ascending: true })
      .order("display_order", { ascending: true });

    if (manualTablesError) throw manualTablesError;

    const { data: assets, error: assetsError } = await supabase
      .from("afs_report_assets")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("asset_type", { ascending: true })
      .order("uploaded_at", { ascending: false });

    if (assetsError) throw assetsError;

    return NextResponse.json({
      settings: settings || [],
      manualTables: manualTables || [],
      assets: assets || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load AFS disclosure settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const settingsInput = Array.isArray(body?.settings) ? body.settings : [];
    const manualRowsInput = Array.isArray(body?.manualTables)
      ? body.manualTables
      : [];

    const settingsPayload = settingsInput
      .map((item: any) => ({
        engagement_id: engagementId,
        page_key: cleanText(item.page_key || item.pageKey),
        section_key: cleanText(item.section_key || item.sectionKey),
        disclosure_key: cleanText(item.disclosure_key || item.disclosureKey),
        is_enabled: boolValue(item.is_enabled ?? item.isEnabled, true),
        display_order: integerOrDefault(item.display_order ?? item.displayOrder, 0),
        selected_variant: cleanText(item.selected_variant ?? item.selectedVariant),
        custom_title: cleanText(item.custom_title ?? item.customTitle),
        custom_text: cleanText(item.custom_text ?? item.customText),
        manual_current: numberOrNull(item.manual_current ?? item.manualCurrent),
        manual_prior: numberOrNull(item.manual_prior ?? item.manualPrior),
        manual_note_number: cleanText(
          item.manual_note_number ?? item.manualNoteNumber
        ),
        updated_at: new Date().toISOString(),
      }))
      .filter(
        (item: any) => item.page_key && item.section_key && item.disclosure_key
      );

    const manualRowsPayload = manualRowsInput
      .map((item: any) => ({
        engagement_id: engagementId,
        table_key: cleanText(item.table_key || item.tableKey),
        row_key: cleanText(item.row_key || item.rowKey),
        display_order: integerOrDefault(item.display_order ?? item.displayOrder, 0),
        label: cleanText(item.label) || "Manual row",
        note_number: cleanText(item.note_number ?? item.noteNumber),
        current_value: numberOrNull(item.current_value ?? item.currentValue),
        prior_value: numberOrNull(item.prior_value ?? item.priorValue),
        text_value: cleanText(item.text_value ?? item.textValue),
        is_enabled: boolValue(item.is_enabled ?? item.isEnabled, true),
        updated_at: new Date().toISOString(),
      }))
      .filter((item: any) => item.table_key && item.row_key);

    let savedSettings: any[] = [];
    let savedManualTables: any[] = [];

    if (settingsPayload.length > 0) {
      const { data, error } = await supabase
        .from("afs_report_disclosure_settings")
        .upsert(settingsPayload, {
          onConflict: "engagement_id,page_key,section_key,disclosure_key",
        })
        .select("*");

      if (error) throw error;
      savedSettings = data || [];
    }

    if (manualRowsPayload.length > 0) {
      const { data, error } = await supabase
        .from("afs_report_manual_tables")
        .upsert(manualRowsPayload, {
          onConflict: "engagement_id,table_key,row_key",
        })
        .select("*");

      if (error) throw error;
      savedManualTables = data || [];
    }

    return NextResponse.json({
      success: true,
      settings: savedSettings,
      manualTables: savedManualTables,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save AFS disclosure settings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const formData = await req.formData();
    const supabase = getSupabaseServer();

    const file = formData.get("file") as File | null;
    const assetType = cleanText(formData.get("assetType")) || "logo";
    const title = cleanText(formData.get("title"));

    if (!file) {
      return NextResponse.json({ error: "No file selected." }, { status: 400 });
    }

    const isAllowedImage = ["image/png", "image/jpeg", "image/webp"].includes(
      file.type || ""
    );

    if (!isAllowedImage) {
      return NextResponse.json(
        { error: "Only PNG, JPG or WEBP images are allowed." },
        { status: 400 }
      );
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${engagementId}/${assetType}/${Date.now()}-${safeFileName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("afs-report-assets")
      .upload(filePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("afs_report_assets")
      .insert({
        engagement_id: engagementId,
        asset_type: assetType,
        title,
        file_name: file.name,
        file_path: filePath,
        file_mime_type: file.type || null,
        file_size: file.size || null,
        is_active: true,
        uploaded_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, asset: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload AFS report asset." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const id = cleanText(body?.id);
    const kind = cleanText(body?.kind) || "setting";
    const supabase = getSupabaseServer();

    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    if (kind === "manual-row") {
      const { error } = await supabase
        .from("afs_report_manual_tables")
        .delete()
        .eq("engagement_id", engagementId)
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (kind === "asset") {
      const { data: asset, error: assetError } = await supabase
        .from("afs_report_assets")
        .select("id, file_path")
        .eq("engagement_id", engagementId)
        .eq("id", id)
        .single();

      if (assetError) throw assetError;

      if (asset?.file_path) {
        const { error: storageError } = await supabase.storage
          .from("afs-report-assets")
          .remove([asset.file_path]);

        if (storageError) throw storageError;
      }

      const { error } = await supabase
        .from("afs_report_assets")
        .delete()
        .eq("engagement_id", engagementId)
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from("afs_report_disclosure_settings")
      .delete()
      .eq("engagement_id", engagementId)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete AFS disclosure item." },
      { status: 500 }
    );
  }
}
