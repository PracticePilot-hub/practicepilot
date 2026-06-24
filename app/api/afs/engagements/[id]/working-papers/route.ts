import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getId(context: any) {
  const params = await context?.params;
  return String(params?.id || "");
}

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const leadScheduleKey = url.searchParams.get("leadScheduleKey");
    const filePath = url.searchParams.get("filePath");
    const supabase = getSupabaseServer();

    if (filePath) {
      const { data, error } = await supabase.storage
        .from("afs-working-papers")
        .createSignedUrl(filePath, 60 * 10);

      if (error) throw error;

      return NextResponse.json({ url: data?.signedUrl || "" });
    }

    let query = supabase
      .from("afs_working_papers")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: false });

    if (leadScheduleKey) {
      query = query.eq("lead_schedule_key", leadScheduleKey);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ workingPapers: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load working papers." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const leadScheduleKey = cleanText(formData.get("leadScheduleKey"));
    const leadScheduleNumber = cleanText(formData.get("leadScheduleNumber"));
    const title = cleanText(formData.get("title"));
    const wpReference = cleanText(formData.get("wpReference"));
    const documentType = cleanText(formData.get("documentType"));
    const note = cleanText(formData.get("note"));

    if (!file) {
      return NextResponse.json({ error: "No file selected." }, { status: 400 });
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timeStamp = Date.now();
    const filePath = `${engagementId}/${leadScheduleKey || "general"}/${timeStamp}-${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("afs-working-papers")
      .upload(filePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("afs_working_papers")
      .insert({
        engagement_id: engagementId,
        section: "lead-schedules",
        lead_schedule_key: leadScheduleKey,
        lead_schedule_number: leadScheduleNumber,
        title: title || file.name || "Working paper",
        wp_reference: wpReference,
        document_type: documentType,
        note,
        file_name: file.name,
        file_path: filePath,
        file_mime_type: file.type || null,
        file_size: file.size || null,
        uploaded_at: new Date().toISOString(),
        status: "Uploaded",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ workingPaper: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save working paper." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const workingPaperId = String(body?.id || "").trim();

    if (!workingPaperId) {
      return NextResponse.json(
        { error: "Missing working paper id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data: paper, error: loadError } = await supabase
      .from("afs_working_papers")
      .select("id, file_path")
      .eq("id", workingPaperId)
      .eq("engagement_id", engagementId)
      .single();

    if (loadError) throw loadError;

    if (paper?.file_path) {
      const { error: storageError } = await supabase.storage
        .from("afs-working-papers")
        .remove([paper.file_path]);

      if (storageError) throw storageError;
    }

    const { error: deleteError } = await supabase
      .from("afs_working_papers")
      .delete()
      .eq("id", workingPaperId)
      .eq("engagement_id", engagementId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ deleted: true, id: workingPaperId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete working paper." },
      { status: 500 }
    );
  }
}