import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Authority = "Pilot" | "First Officer" | "Captain";
type WorkflowMode = "solo" | "team";

type UserProfile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_access_afs?: boolean;
  afs_authority?: Authority | null;
  can_restrict_afs_files?: boolean | null;
  can_manage_practice_users?: boolean | null;
  staff_code?: string | null;
  can_delete_afs_drafts?: boolean | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing server Supabase service-role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function canManage(profile: UserProfile) {
  return (
    isGlobalAdmin(profile.role) ||
    profile.role === "Client Manager" ||
    Boolean(profile.can_manage_practice_users)
  );
}

function normalAuthority(value: unknown): Authority {
  if (value === "First Officer" || value === "Captain") return value;
  return "Pilot";
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_afs,afs_authority,can_restrict_afs_files,can_manage_practice_users,staff_code,can_delete_afs_drafts",
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return { profile: data as UserProfile, response: null as NextResponse | null };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await currentProfile(request, supabase);
    if (response || !profile) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice / organisation." },
        { status: 400 },
      );
    }

    const [{ data: organisation, error: orgError }, { data: users, error: usersError }] =
      await Promise.all([
        supabase
          .from("organisations")
          .select("id,name,afs_workflow_mode")
          .eq("id", profile.organisation_id)
          .single(),
        supabase
          .from("user_profiles")
          .select(
            "id,user_id,full_name,email,role,access_enabled,can_access_afs,afs_authority,can_restrict_afs_files,can_manage_practice_users,staff_code,can_delete_afs_drafts",
          )
          .eq("organisation_id", profile.organisation_id)
          .order("full_name", { ascending: true }),
      ]);

    if (orgError) throw orgError;
    if (usersError) throw usersError;

    return NextResponse.json({
      organisation,
      currentUserId: profile.id,
      canManage: canManage(profile),
      canManageRegisterSettings:
        isGlobalAdmin(profile.role) || normalAuthority(profile.afs_authority) === "Captain",
      users: (users || []).map((user: any) => ({
        ...user,
        afs_authority: normalAuthority(user.afs_authority),
      })),
    });
  } catch (error: any) {
    console.error("AFS WORKFLOW GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load AFS workflow settings." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await currentProfile(request, supabase);
    if (response || !profile) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice / organisation." },
        { status: 400 },
      );
    }

    if (!canManage(profile)) {
      return NextResponse.json(
        { error: "You do not have permission to manage practice workflow." },
        { status: 403 },
      );
    }

    const body = await request.json();

    if (body.action === "workflow-mode") {
      const mode: WorkflowMode = body.mode === "team" ? "team" : "solo";

      const { error } = await supabase
        .from("organisations")
        .update({ afs_workflow_mode: mode })
        .eq("id", profile.organisation_id);

      if (error) throw error;

      return NextResponse.json({ success: true, mode });
    }

    if (body.action === "user-register-settings") {
      const targetUserId = String(body.userId || "").trim();
      const requestedCode = String(body.staffCode || "").trim().toUpperCase();
      const canDeleteDrafts = Boolean(body.canDeleteAfsDrafts);

      const canManageRegister =
        isGlobalAdmin(profile.role) ||
        normalAuthority(profile.afs_authority) === "Captain";

      if (!canManageRegister) {
        return NextResponse.json(
          { error: "Only a Captain can manage AFS register codes and delegated Draft deletion." },
          { status: 403 },
        );
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "User is required." }, { status: 400 });
      }

      if (requestedCode && !/^[A-Z0-9]{2,8}$/.test(requestedCode)) {
        return NextResponse.json(
          { error: "Staff code must be 2 to 8 letters or numbers." },
          { status: 400 },
        );
      }

      const { data: target, error: targetError } = await supabase
        .from("user_profiles")
        .select("id,organisation_id,afs_authority")
        .eq("id", targetUserId)
        .single();

      if (targetError || !target) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      if (target.organisation_id !== profile.organisation_id) {
        return NextResponse.json(
          { error: "User is outside your practice." },
          { status: 403 },
        );
      }

      if (requestedCode) {
        const { data: duplicate, error: duplicateError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("organisation_id", profile.organisation_id)
          .ilike("staff_code", requestedCode)
          .neq("id", targetUserId)
          .limit(1)
          .maybeSingle();

        if (duplicateError) throw duplicateError;

        if (duplicate) {
          return NextResponse.json(
            { error: `Staff code ${requestedCode} is already in use in this practice.` },
            { status: 409 },
          );
        }
      }

      const targetAuthority = normalAuthority(target.afs_authority);
      const delegatedDelete =
        targetAuthority === "Captain" ? false : canDeleteDrafts;

      const { error } = await supabase
        .from("user_profiles")
        .update({
          staff_code: requestedCode || null,
          can_delete_afs_drafts: delegatedDelete,
        })
        .eq("id", targetUserId)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        userId: targetUserId,
        staffCode: requestedCode || null,
        canDeleteAfsDrafts: delegatedDelete,
      });
    }

    if (body.action === "user-authority") {
      const targetUserId = String(body.userId || "").trim();
      const authority = normalAuthority(body.authority);

      if (!targetUserId) {
        return NextResponse.json({ error: "User is required." }, { status: 400 });
      }

      const { data: target, error: targetError } = await supabase
        .from("user_profiles")
        .select("id,role,organisation_id")
        .eq("id", targetUserId)
        .single();

      if (targetError || !target) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      if (target.organisation_id !== profile.organisation_id) {
        return NextResponse.json({ error: "User is outside your practice." }, { status: 403 });
      }

      // Platform role and AFS authority are separate.
      // A Client Manager may still be Pilot, First Officer or Captain.
      const finalAuthority = authority;

      const canRestrict =
        finalAuthority === "First Officer" || finalAuthority === "Captain";

      const { error } = await supabase
        .from("user_profiles")
        .update({
          afs_authority: finalAuthority,
          can_restrict_afs_files: canRestrict,
        })
        .eq("id", targetUserId)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        userId: targetUserId,
        authority: finalAuthority,
        canRestrictAfsFiles: canRestrict,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("AFS WORKFLOW PATCH ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not save AFS workflow settings." },
      { status: 500 },
    );
  }
}
