import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing Supabase service-role key");

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const moduleFields: Record<string, string> = {
  crm: "can_access_crm",
  accounting: "can_access_accounting",
  afs: "can_access_afs",
  assets: "can_access_assets",
  secretarial: "can_access_secretarial",
  projects: "can_access_projects",
  management_reports: "can_access_management_reports",
  paia: "can_access_paia",
  proposals: "can_access_proposals",
};

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function canManage(profile: any) {
  return Boolean(
    profile?.is_practice_owner ||
      profile?.can_manage_practice_users ||
      profile?.role === "Client Manager" ||
      profile?.role === "Super Admin" ||
      profile?.role === "Admin"
  );
}

function bool(value: unknown) {
  return value === true;
}

async function currentProfile(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return { profile: null, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return { profile: null, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_manage_practice_users,is_practice_owner"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.access_enabled === false) {
    return { profile: null, response: NextResponse.json({ error: "Access denied." }, { status: 403 }) };
  }

  if (!canManage(profile)) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "You do not have permission to manage this team." },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null };
}

async function loadPracticeTeam(profile: any) {
  const isPracticePilotInternal =
    !profile.organisation_id &&
    ["Super Admin", "Admin", "Staff"].includes(String(profile.role || ""));

  if (isPracticePilotInternal) {
    const { data: users, error: usersError } = await admin
      .from("user_profiles")
      .select(
        "id,user_id,organisation_id,full_name,email,role,access_enabled,can_manage_practice_users,is_practice_owner,can_access_crm,can_access_accounting,can_access_afs,can_access_assets,can_access_secretarial,can_access_projects,can_access_management_reports,can_access_paia,can_access_proposals"
      )
      .is("organisation_id", null)
      .in("role", ["Super Admin", "Admin", "Staff"])
      .order("full_name", { ascending: true });

    if (usersError) throw usersError;

    return {
      organisation: { id: "practicepilot-internal", name: "PracticePilot" },
      internalTeam: true,
      users: users || [],
      licences: [],
    };
  }

  if (!profile.organisation_id) {
    throw new Error("Your user is not linked to a practice.");
  }

  const [organisationResult, usersResult, licencesResult] = await Promise.all([
    admin
      .from("organisations")
      .select("id,name")
      .eq("id", profile.organisation_id)
      .single(),

    admin
      .from("user_profiles")
      .select(
        "id,user_id,organisation_id,full_name,email,role,access_enabled,can_manage_practice_users,is_practice_owner,can_access_crm,can_access_accounting,can_access_afs,can_access_assets,can_access_secretarial,can_access_projects,can_access_management_reports,can_access_paia,can_access_proposals"
      )
      .eq("organisation_id", profile.organisation_id)
      .order("is_practice_owner", { ascending: false })
      .order("full_name", { ascending: true }),

    admin
      .from("practice_module_licences")
      .select("module_key,licence_limit,is_enabled")
      .eq("organisation_id", profile.organisation_id)
      .order("module_key", { ascending: true }),
  ]);

  if (organisationResult.error) throw organisationResult.error;
  if (usersResult.error) throw usersResult.error;
  if (licencesResult.error) throw licencesResult.error;

  const users = usersResult.data || [];
  const licences = (licencesResult.data || []).map((licence: any) => {
    const field = moduleFields[licence.module_key];
    const used = field
      ? users.filter((teamUser: any) => teamUser.access_enabled !== false && teamUser[field] === true).length
      : 0;

    return {
      ...licence,
      used,
      available: Math.max(Number(licence.licence_limit || 0) - used, 0),
    };
  });

  return {
    organisation: organisationResult.data,
    internalTeam: false,
    users,
    licences,
  };
}

async function assertSamePractice(profile: any, targetUserId: string) {
  const { data: target, error } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !target) {
    throw new Error("Team member not found.");
  }

  const isInternal = !profile.organisation_id;
  if (isInternal) {
    if (target.organisation_id !== null) throw new Error("User is outside PracticePilot.");
  } else if (target.organisation_id !== profile.organisation_id) {
    throw new Error("User is outside your practice.");
  }

  return target;
}

async function enforceLicenceLimits(
  organisationId: string | null,
  targetUserId: string | null,
  nextAccessEnabled: boolean,
  nextModules: Record<string, boolean>
) {
  if (!organisationId || !nextAccessEnabled) return;

  const { data: licences, error: licenceError } = await admin
    .from("practice_module_licences")
    .select("module_key,licence_limit,is_enabled")
    .eq("organisation_id", organisationId);

  if (licenceError) throw licenceError;

  // Legacy-safe: where PP has not configured a licence row yet, do not block.
  const configured = new Map((licences || []).map((row: any) => [row.module_key, row]));

  for (const [moduleKey, requested] of Object.entries(nextModules)) {
    if (!requested) continue;

    const licence: any = configured.get(moduleKey);
    if (!licence) continue;

    if (licence.is_enabled === false) {
      throw new Error(`${moduleKey} is not enabled for this practice.`);
    }

    const field = moduleFields[moduleKey];
    if (!field) continue;

    let query = admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("access_enabled", true)
      .eq(field, true);

    if (targetUserId) query = query.neq("id", targetUserId);

    const { count, error } = await query;
    if (error) throw error;

    if (Number(count || 0) + 1 > Number(licence.licence_limit || 0)) {
      throw new Error(
        `No ${moduleKey} licences are available. ${licence.licence_limit} licence(s) are configured.`
      );
    }
  }
}

function modulesFromBody(body: any) {
  return {
    crm: bool(body.canAccessCrm),
    accounting: bool(body.canAccessAccounting),
    afs: bool(body.canAccessAfs),
    assets: bool(body.canAccessAssets),
    secretarial: bool(body.canAccessSecretarial),
    projects: bool(body.canAccessProjects),
    management_reports: bool(body.canAccessManagementReports),
    paia: bool(body.canAccessPaia),
    proposals: bool(body.canAccessProposals),
  };
}

function moduleUpdate(modules: Record<string, boolean>) {
  return {
    can_access_crm: modules.crm,
    can_access_accounting: modules.accounting,
    can_access_afs: modules.afs,
    can_access_assets: modules.assets,
    can_access_secretarial: modules.secretarial,
    can_access_projects: modules.projects,
    can_access_management_reports: modules.management_reports,
    can_access_paia: modules.paia,
    can_access_proposals: modules.proposals,
  };
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response || !profile) return response;

    const team = await loadPracticeTeam(profile);

    return NextResponse.json({
      success: true,
      currentProfile: profile,
      canManage: true,
      ...team,
    });
  } catch (error: any) {
    console.error("PRACTICE TEAM GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load practice team." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response || !profile) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "PracticePilot internal users are still managed from Admin Users." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role === "Client Manager" ? "Client Manager" : "Staff";
    const accessEnabled = body.accessEnabled !== false;
    const canManagePracticeUsers = bool(body.canManagePracticeUsers);
    const modules = modulesFromBody(body);

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    await enforceLicenceLimits(
      profile.organisation_id,
      null,
      accessEnabled,
      modules
    );

    const temporaryPassword =
      `Pp!${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}a9`;

    const { data: createdAuth, error: authCreateError } =
      await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authCreateError || !createdAuth.user) {
      throw authCreateError || new Error("Could not create login.");
    }

    const { data: createdProfile, error: profileCreateError } = await admin
      .from("user_profiles")
      .insert({
        user_id: createdAuth.user.id,
        organisation_id: profile.organisation_id,
        full_name: fullName,
        email,
        role,
        access_enabled: accessEnabled,
        can_manage_practice_users: canManagePracticeUsers,
        is_practice_owner: false,
        ...moduleUpdate(modules),
      })
      .select("*")
      .single();

    if (profileCreateError) {
      await admin.auth.admin.deleteUser(createdAuth.user.id).catch(() => undefined);
      throw profileCreateError;
    }

    // Password-reset link doubles as the initial login/setup flow.
    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/login`,
    });

    return NextResponse.json({
      success: true,
      user: createdProfile,
      warning: resetError ? "User created, but the login email could not be sent." : null,
    });
  } catch (error: any) {
    console.error("PRACTICE TEAM POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not add team member." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response || !profile) return response;

    const body = await request.json();

    if (body.action === "update_licence") {
      if (!profile.is_practice_owner || !profile.organisation_id) {
        return NextResponse.json(
          { error: "Only the Practice Owner may change licence quantities." },
          { status: 403 }
        );
      }

      const moduleKey = String(body.moduleKey || "").trim();
      const licenceLimit = Number(body.licenceLimit ?? 0);
      const field = moduleFields[moduleKey];

      if (!field) {
        return NextResponse.json({ error: "Invalid module." }, { status: 400 });
      }

      if (!Number.isInteger(licenceLimit) || licenceLimit < 0) {
        return NextResponse.json(
          { error: "Licence quantity must be a whole number of 0 or more." },
          { status: 400 }
        );
      }

      const { count, error: usageError } = await admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", profile.organisation_id)
        .eq("access_enabled", true)
        .eq(field, true);

      if (usageError) throw usageError;

      const used = Number(count || 0);

      if (licenceLimit < used) {
        return NextResponse.json(
          {
            error: `This module is currently allocated to ${used} active user(s). Remove access from users before reducing the licence quantity below ${used}.`,
          },
          { status: 400 }
        );
      }

      const { data: licence, error: licenceError } = await admin
        .from("practice_module_licences")
        .upsert(
          {
            organisation_id: profile.organisation_id,
            module_key: moduleKey,
            licence_limit: licenceLimit,
            is_enabled: licenceLimit > 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organisation_id,module_key" }
        )
        .select("module_key,licence_limit,is_enabled")
        .single();

      if (licenceError) throw licenceError;

      return NextResponse.json({
        success: true,
        licence: {
          ...licence,
          used,
          available: Math.max(licenceLimit - used, 0),
        },
      });
    }

    const targetId = String(body.userId || "").trim();

    if (!targetId) {
      return NextResponse.json({ error: "Team member is required." }, { status: 400 });
    }

    const target = await assertSamePractice(profile, targetId);

    if (target.is_practice_owner && !profile.is_practice_owner) {
      return NextResponse.json(
        { error: "Only the Practice Owner may edit the Practice Owner." },
        { status: 403 }
      );
    }

    if (body.action === "copy_permissions") {
      const sourceId = String(body.sourceUserId || "").trim();
      if (!sourceId) {
        return NextResponse.json({ error: "Source team member is required." }, { status: 400 });
      }

      const source = await assertSamePractice(profile, sourceId);
      const nextModules: Record<string, boolean> = {
        crm: Boolean(source.can_access_crm),
        accounting: Boolean(source.can_access_accounting),
        afs: Boolean(source.can_access_afs),
        assets: Boolean(source.can_access_assets),
        secretarial: Boolean(source.can_access_secretarial),
        projects: Boolean(source.can_access_projects),
        management_reports: Boolean(source.can_access_management_reports),
        paia: Boolean(source.can_access_paia),
        proposals: Boolean(source.can_access_proposals),
      };

      await enforceLicenceLimits(
        target.organisation_id,
        target.id,
        target.access_enabled !== false,
        nextModules
      );

      const { data, error } = await admin
        .from("user_profiles")
        .update({
          ...moduleUpdate(nextModules),
          can_manage_practice_users: Boolean(source.can_manage_practice_users),
        })
        .eq("id", target.id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, user: data });
    }

    const nextRole =
      target.is_practice_owner
        ? target.role
        : body.role === "Client Manager"
          ? "Client Manager"
          : "Staff";

    const nextAccessEnabled =
      target.is_practice_owner ? true : body.accessEnabled !== false;

    const nextCanManage =
      target.is_practice_owner ? true : bool(body.canManagePracticeUsers);

    const nextModules = modulesFromBody(body);

    await enforceLicenceLimits(
      target.organisation_id,
      target.id,
      nextAccessEnabled,
      nextModules
    );

    const { data, error } = await admin
      .from("user_profiles")
      .update({
        full_name: String(body.fullName || target.full_name || "").trim(),
        role: nextRole,
        access_enabled: nextAccessEnabled,
        can_manage_practice_users: nextCanManage,
        ...moduleUpdate(nextModules),
      })
      .eq("id", target.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, user: data });
  } catch (error: any) {
    console.error("PRACTICE TEAM PATCH ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not update team member." },
      { status: 500 }
    );
  }
}
