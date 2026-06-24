import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

function getId(context: any) {
  return String(context?.params?.id || "");
}

const defaultSignoffs = [
  { area_key: "client-setup", area_title: "Client setup" },
  { area_key: "trial-balance", area_title: "Trial balance" },
  { area_key: "mapping", area_title: "Mapping" },
  { area_key: "lead-schedules", area_title: "Lead schedules" },
  { area_key: "working-papers", area_title: "Working papers" },
  { area_key: "adjusting-journals", area_title: "Adjusting journals" },
  { area_key: "tax", area_title: "Tax" },
  { area_key: "financial-statements", area_title: "Financial statements" },
];

export async function GET(_request: Request, context: any) {
  try {
    const engagementId = getId(context);
    const supabase = getSupabaseServer();

    const { data: existing, error: existingError } = await supabase
      .from("afs_review_signoffs")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("area_key", { ascending: true });
    if (existingError) throw existingError;

    if (!existing || existing.length === 0) {
      const { error: seedError } = await supabase
        .from("afs_review_signoffs")
        .insert(defaultSignoffs.map((item) => ({ ...item, engagement_id: engagementId })));
      if (seedError) throw seedError;
    }

    const { data, error } = await supabase
      .from("afs_review_signoffs")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("area_key", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ signoffs: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load sign-offs." }, { status: 500 });
  }
}
