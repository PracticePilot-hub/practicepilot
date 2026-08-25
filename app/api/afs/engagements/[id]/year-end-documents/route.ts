import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  access_enabled: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing Supabase service-role key.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>,
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,user_id,organisation_id,full_name,email,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return { profile: data as Profile, response: null };
}

async function engagementIdFrom(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

async function authorisedContext(request: Request, context: any) {
  const engagementId = await engagementIdFrom(context);
  if (!engagementId) {
    return {
      error: NextResponse.json({ error: "Missing engagement id." }, { status: 400 }),
    };
  }

  const supabase = adminClient();
  const auth = await currentProfile(request, supabase);
  if (auth.response || !auth.profile) return { error: auth.response! };

  const { data: engagement, error: engagementError } = await supabase
    .from("afs_engagements")
    .select("id,organisation_id,afs_methodology_snapshot")
    .eq("id", engagementId)
    .maybeSingle();

  if (engagementError || !engagement) {
    return {
      error: NextResponse.json({ error: "AFS engagement not found." }, { status: 404 }),
    };
  }

  if (
    !auth.profile.organisation_id ||
    engagement.organisation_id !== auth.profile.organisation_id
  ) {
    return {
      error: NextResponse.json({ error: "Access denied." }, { status: 403 }),
    };
  }

  const { data: organisation, error: organisationError } = await supabase
    .from("organisations")
    .select("id,name,afs_white_label_documents")
    .eq("id", engagement.organisation_id)
    .maybeSingle();

  if (organisationError || !organisation) {
    return {
      error: NextResponse.json({ error: "Practice not found." }, { status: 404 }),
    };
  }

  const methodologySnapshot =
    engagement.afs_methodology_snapshot &&
    typeof engagement.afs_methodology_snapshot === "object"
      ? engagement.afs_methodology_snapshot
      : null;

  const lockedPracticeName =
    methodologySnapshot?.organisationName ||
    organisation.name ||
    "Accounting practice";

  const lockedWhiteLabel =
    methodologySnapshot?.documents?.whiteLabel === undefined
      ? Boolean(organisation.afs_white_label_documents)
      : Boolean(methodologySnapshot.documents.whiteLabel);

  return {
    error: null,
    supabase,
    engagementId,
    profile: auth.profile,
    organisation,
    practiceName: lockedPracticeName,
    whiteLabel: lockedWhiteLabel,
  };
}

export async function GET(request: Request, context: any) {
  try {
    const ctx = await authorisedContext(request, context);
    if (ctx.error) return ctx.error;

    const url = new URL(request.url);
    const documentKey = String(url.searchParams.get("documentKey") || "afs-approval").trim();

    const { data, error } = await ctx.supabase
      .from("afs_year_end_documents")
      .select("*")
      .eq("engagement_id", ctx.engagementId)
      .eq("document_key", documentKey)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      document: data || null,
      practiceName: ctx.practiceName,
      whiteLabel: ctx.whiteLabel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load year-end document." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: any) {
  try {
    const ctx = await authorisedContext(request, context);
    if (ctx.error) return ctx.error;

    const body = await request.json();
    const documentKey = String(body?.documentKey || "").trim();
    const status = String(body?.status || "draft").trim().toLowerCase();
    const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};

    if (!documentKey) {
      return NextResponse.json({ error: "Missing document key." }, { status: 400 });
    }

    if (!["draft", "prepared", "signed"].includes(status)) {
      return NextResponse.json({ error: "Invalid document status." }, { status: 400 });
    }

    const now = new Date().toISOString();

    const record: Record<string, any> = {
      engagement_id: ctx.engagementId,
      organisation_id: ctx.organisation.id,
      document_key: documentKey,
      status,
      payload,
      updated_at: now,
    };

    if (status === "prepared") {
      record.prepared_at = now;
      record.prepared_by = ctx.profile.user_id;
      record.signed_at = null;
      record.signed_by = null;
    } else if (status === "signed") {
      record.signed_at = now;
      record.signed_by = ctx.profile.user_id;
    } else {
      record.prepared_at = null;
      record.prepared_by = null;
      record.signed_at = null;
      record.signed_by = null;
    }

    const { data, error } = await ctx.supabase
      .from("afs_year_end_documents")
      .upsert(record, { onConflict: "engagement_id,document_key" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      document: data,
      practiceName: ctx.practiceName,
      whiteLabel: ctx.whiteLabel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not save year-end document." },
      { status: 500 },
    );
  }
}
