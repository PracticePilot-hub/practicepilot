import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getDocumentProviderAdapter } from "@/app/lib/documentProviders";
import {
  isWithinDocumentRoot,
  normaliseDocumentPath,
  type WorkpaperScope,
} from "./model";

export class WorkpaperError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function workpaperAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new WorkpaperError("Server connection is unavailable.", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function workpaperContext(
  request: Request,
  scopeValue: string,
  scopeId: string,
  write = false,
) {
  const scope = scopeValue as WorkpaperScope;
  if (!/^[0-9a-f-]{36}$/i.test(scopeId) || !["afs", "crm"].includes(scope))
    throw new WorkpaperError("Invalid working-file reference.");
  const db = workpaperAdmin();
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new WorkpaperError("Please sign in to PracticePilot.", 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user)
    throw new WorkpaperError(
      "Your session has expired. Please sign in again.",
      401,
    );
  const { data: profile, error } = await db
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_afs,can_access_crm",
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (
    error ||
    !profile?.organisation_id ||
    profile.access_enabled !== true ||
    (scope === "afs"
      ? profile.can_access_afs === false
      : profile.can_access_crm === false)
  )
    throw new WorkpaperError("You do not have access to this module.", 403);
  const { data: entity, error: entityError } = await db
    .from(scope === "afs" ? "afs_engagements" : "crm_clients")
    .select("*")
    .eq("id", scopeId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();
  if (entityError) throw entityError;
  if (!entity) throw new WorkpaperError("Working file not found.", 404);
  const locked =
    scope === "afs" && /^(final|archived)$/i.test(String(entity.status || ""));
  if (write && locked)
    throw new WorkpaperError(
      "This flight is locked. Reopen it before changing working papers.",
      423,
    );
  const { data: workflow, error: workflowError } =
    scope === "afs"
      ? await db
          .from("afs_engagement_workflow")
          .select("*")
          .eq("engagement_id", scopeId)
          .eq("organisation_id", profile.organisation_id)
          .maybeSingle()
      : { data: null, error: null };
  if (workflowError) throw workflowError;
  const crew = [
    ...(workflow?.pilot_user_ids || []),
    ...(workflow?.first_officer_user_ids || []),
    ...(workflow?.captain_user_ids || []),
  ].map(String);
  if (
    write &&
    scope === "afs" &&
    workflow?.is_started &&
    !crew.includes(profile.id) &&
    !["Super Admin", "Admin"].includes(profile.role)
  )
    throw new WorkpaperError(
      "Only the assigned flight crew can change this working file.",
      403,
    );
  return {
    db,
    profile,
    entity,
    workflow,
    locked,
    scope,
    scopeId,
    organisationId: profile.organisation_id as string,
  };
}
export type WorkpaperContext = Awaited<ReturnType<typeof workpaperContext>>;
export async function validateEvidenceSource(
  ctx: WorkpaperContext,
  path: string,
) {
  if (path.startsWith("pp-upload:")) {
    if (ctx.scope !== "afs")
      throw new WorkpaperError(
        "This evidence is not linked to the CRM client.",
        403,
      );
    const storagePath = path.slice("pp-upload:".length),
      { data, error } = await ctx.db
        .from("afs_working_papers")
        .select("id,file_path,file_name")
        .eq("engagement_id", ctx.scopeId)
        .eq("file_path", storagePath)
        .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new WorkpaperError(
        "Existing working paper not found in this engagement.",
        404,
      );
    return data;
  }
  await providerFor(ctx, path);
  return null;
}
export async function readEvidence(ctx: WorkpaperContext, path: string) {
  const uploaded = path.startsWith("pp-upload:")
    ? await validateEvidenceSource(ctx, path)
    : null;
  if (uploaded) {
    const { data, error } = await ctx.db.storage
      .from("afs-working-papers")
      .download(uploaded.file_path);
    if (error || !data)
      throw (
        error ||
        new WorkpaperError("Existing working paper could not be loaded.", 404)
      );
    return {
      bytes: await data.arrayBuffer(),
      file_name: uploaded.file_name,
      content_type: data.type,
    };
  }
  const source = await providerFor(ctx, path);
  return source.adapter.downloadFile({
    provider: source.provider,
    path: source.path,
  });
}
export async function providerFor(ctx: WorkpaperContext, path?: string) {
  const clientId = ctx.scope === "crm" ? ctx.scopeId : ctx.entity.client_id;
  if (!clientId)
    throw new WorkpaperError(
      "Link this AFS engagement to a CRM client to browse its documents.",
      409,
    );
  const { data: client } = await ctx.db
    .from("crm_clients")
    .select("id")
    .eq("id", clientId)
    .eq("organisation_id", ctx.organisationId)
    .maybeSingle();
  if (!client)
    throw new WorkpaperError("The linked client is not in this practice.", 403);
  const { data: location, error } = await ctx.db
    .from("crm_client_document_locations")
    .select("*")
    .eq("client_id", clientId)
    .eq("organisation_id", ctx.organisationId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .maybeSingle();
  if (error) throw error;
  if (!location)
    throw new WorkpaperError(
      "Connect a client document folder in Settings → Document providers.",
      409,
    );
  const { data: provider, error: providerError } = await ctx.db
    .from("organisation_document_providers")
    .select("*")
    .eq("id", location.provider_id)
    .eq("organisation_id", ctx.organisationId)
    .eq("is_active", true)
    .maybeSingle();
  if (providerError) throw providerError;
  if (!provider)
    throw new WorkpaperError(
      "The client's document connection is inactive.",
      409,
    );
  if (path && !isWithinDocumentRoot(location.folder_path, path))
    throw new WorkpaperError("Document is outside this client's folder.", 403);
  return {
    provider,
    location,
    adapter: getDocumentProviderAdapter(provider.provider),
    path: normaliseDocumentPath(path || location.folder_path),
  };
}
export async function invalidateWorkpaperSignoff(
  ctx: WorkpaperContext,
  resourceKey: string,
) {
  if (ctx.scope !== "afs") return;
  const schedule = resourceKey.startsWith("lead:")
    ? resourceKey.split(":")[1]
    : null;
  const { error } = await ctx.db
    .from("afs_section_signoffs")
    .update({
      prepared_by: null,
      prepared_at: null,
      reviewed_by: null,
      reviewed_at: null,
      captain_cleared_by: null,
      captain_cleared_at: null,
      reopened_by: ctx.profile.id,
      reopened_at: new Date().toISOString(),
      reopen_reason: "Underlying working paper or evidence changed",
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", ctx.organisationId)
    .eq("engagement_id", ctx.scopeId)
    .in(
      "section_key",
      schedule
        ? [`lead-schedule:${schedule}`, "lead-schedules"]
        : ["lead-schedules"],
    );
  if (error) throw error;
}
export function workpaperErrorResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : String(
          (error as { message?: string })?.message ||
            "Working paper request failed.",
        );
  const missing = /pp_workpaper|schema cache|does not exist/.test(message);
  return Response.json(
    {
      error: missing
        ? "Working-paper storage needs the new database migration. Your changes have not been saved."
        : message,
    },
    { status: error instanceof WorkpaperError ? error.status : 503 },
  );
}
