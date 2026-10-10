import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { getDocumentProviderAdapter } from "@/app/lib/documentProviders/index";



type DocumentProviderRecord = {

  id: string;

  organisation_id: string;

  provider: "egnyte" | "google_drive" | "onedrive" | "dropbox" | "manual";

  provider_domain?: string | null;

  provider_base_url?: string | null;

  root_folder_path?: string | null;

  access_token_encrypted?: string | null;

};



type DocumentLocationRecord = {

  id: string;

  organisation_id: string;

  client_id: string;

  provider_id: string;

  folder_id?: string | null;

  folder_path: string;

  folder_name?: string | null;

  is_primary: boolean;

  is_active: boolean;

};



type BrowsePayload = {

  success: true;

  linked: true;

  provider: DocumentProviderRecord["provider"];

  root_path: string;

  root_name: string;

  current_path: string;

  current_name: string;

  items: Array<{

    id: string | null;

    name: string;

    path: string;

    type: "folder" | "file";

    size_bytes: number | null;

    modified_at: string | null;

  }>;

};



type CacheEntry = {
  expiresAt: number;
  staleUntil: number;
  value: BrowsePayload;
};



export const dynamic = "force-dynamic";



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const serviceKey =

  process.env.SUPABASE_SERVICE_ROLE_KEY ||

  process.env.SUPABASE_SECRET_KEY ||

  process.env.SUPABASE_SERVICE_KEY ||

  "";



if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

if (!serviceKey) throw new Error("Missing Supabase service-role key");



const admin = createClient(supabaseUrl, serviceKey, {

  auth: {

    persistSession: false,

    autoRefreshToken: false,

  },

});



const BROWSE_CACHE_TTL_MS = 60_000;
const BROWSE_CACHE_STALE_MS = 5 * 60_000;
const PROVIDER_MIN_INTERVAL_MS = 650;
const PROVIDER_RATE_LIMIT_RETRIES = 3;

const browseCache = new Map<string, CacheEntry>();
const browseInFlight = new Map<string, Promise<BrowsePayload>>();
const providerQueues = new Map<string, Promise<void>>();
const providerLastCallAt = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProviderRateLimitError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error || "");

  const normalised = message.toLowerCase();

  return (
    normalised.includes("spikearrest") ||
    normalised.includes("spike arrest") ||
    normalised.includes("allowed rate") ||
    normalised.includes("rate limit") ||
    normalised.includes("too many requests") ||
    normalised.includes("429")
  );
}

async function runProviderCall<T>(
  providerKey: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = providerQueues.get(providerKey) || Promise.resolve();

  let releaseCurrent!: () => void;
  const currentGate = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });

  const queued = previous.catch(() => undefined).then(() => currentGate);
  providerQueues.set(providerKey, queued);

  await previous.catch(() => undefined);

  try {
    for (let attempt = 0; attempt < PROVIDER_RATE_LIMIT_RETRIES; attempt += 1) {
      const lastCallAt = providerLastCallAt.get(providerKey) || 0;
      const spacingWait = Math.max(
        0,
        lastCallAt + PROVIDER_MIN_INTERVAL_MS - Date.now()
      );

      if (spacingWait > 0) {
        await sleep(spacingWait);
      }

      providerLastCallAt.set(providerKey, Date.now());

      try {
        return await operation();
      } catch (error) {
        const isRateLimited = isProviderRateLimitError(error);
        const isLastAttempt = attempt === PROVIDER_RATE_LIMIT_RETRIES - 1;

        if (!isRateLimited || isLastAttempt) {
          throw error;
        }

        await sleep(900 * 2 ** attempt);
      }
    }

    throw new Error("Document provider request could not be completed.");
  } finally {
    releaseCurrent();

    if (providerQueues.get(providerKey) === queued) {
      providerQueues.delete(providerKey);
    }
  }
}



function bearerToken(request: Request) {

  return (request.headers.get("authorization") || "")

    .replace(/^Bearer\s+/i, "")

    .trim();

}



async function currentContext(request: Request) {

  const token = bearerToken(request);



  if (!token) {

    return {

      profile: null,

      response: NextResponse.json(

        { error: "Not authenticated." },

        { status: 401 }

      ),

    };

  }



  const {

    data: { user },

    error: authError,

  } = await admin.auth.getUser(token);



  if (authError || !user) {

    return {

      profile: null,

      response: NextResponse.json(

        { error: "Not authenticated." },

        { status: 401 }

      ),

    };

  }



  const { data: profile, error } = await admin

    .from("user_profiles")

    .select(

      "id,user_id,organisation_id,role,access_enabled,can_access_crm"

    )

    .eq("user_id", user.id)

    .maybeSingle();



  if (

    error ||

    !profile ||

    !profile.organisation_id ||

    profile.access_enabled === false ||

    profile.can_access_crm === false

  ) {

    return {

      profile: null,

      response: NextResponse.json(

        { error: "CRM access is required." },

        { status: 403 }

      ),

    };

  }



  return { profile, response: null };

}



function normalisePath(value: string) {

  const parts = String(value || "")

    .split("/")

    .filter(Boolean);



  return `/${parts.join("/")}`;

}



function isInsideRoot(rootPath: string, requestedPath: string) {

  const root = normalisePath(rootPath);

  const requested = normalisePath(requestedPath);



  return requested === root || requested.startsWith(`${root}/`);

}



function cacheKey(args: {

  organisationId: string;

  clientId: string;

  providerId: string;

  requestedPath: string;

}) {

  return [

    args.organisationId,

    args.clientId,

    args.providerId,

    normalisePath(args.requestedPath),

  ].join("::");

}



function getCachedBrowse(key: string) {
  const cached = browseCache.get(key);

  if (!cached) return null;

  if (cached.staleUntil <= Date.now()) {
    browseCache.delete(key);
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached.value;
}

function getStaleBrowse(key: string) {
  const cached = browseCache.get(key);

  if (!cached) return null;

  if (cached.staleUntil <= Date.now()) {
    browseCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedBrowse(key: string, value: BrowsePayload) {
  const now = Date.now();

  browseCache.set(key, {
    expiresAt: now + BROWSE_CACHE_TTL_MS,
    staleUntil: now + BROWSE_CACHE_STALE_MS,
    value,
  });
}



export async function GET(

  request: Request,

  context: { params: Promise<{ id: string }> }

) {

  try {

    const { profile, response } = await currentContext(request);

    if (response || !profile) return response;



    const { id: clientId } = await context.params;

    const organisationId = profile.organisation_id;



    const { data: client, error: clientError } = await admin

      .from("crm_clients")

      .select("id,client_name")

      .eq("id", clientId)

      .eq("organisation_id", organisationId)

      .maybeSingle();



    if (clientError) throw clientError;



    if (!client) {

      return NextResponse.json(

        { error: "Client not found." },

        { status: 404 }

      );

    }



    const { data: mapping, error: mappingError } = await admin

      .from("crm_client_document_locations")

      .select(

        "id,organisation_id,client_id,provider_id,folder_id,folder_path,folder_name,is_primary,is_active"

      )

      .eq("organisation_id", organisationId)

      .eq("client_id", clientId)

      .eq("is_active", true)

      .eq("is_primary", true)

      .limit(1)

      .maybeSingle();



    if (mappingError) throw mappingError;



    if (!mapping) {

      return NextResponse.json({

        success: true,

        linked: false,

        provider: null,

        root_path: null,

        current_path: null,

        current_name: null,

        items: [],

        message:

          "This client is not linked to a document-provider folder yet.",

      });

    }



    const { data: provider, error: providerError } = await admin

      .from("organisation_document_providers")

      .select(

        "id,organisation_id,provider,provider_domain,provider_base_url,root_folder_path,access_token_encrypted"

      )

      .eq("id", mapping.provider_id)

      .eq("organisation_id", organisationId)

      .eq("is_active", true)

      .maybeSingle();



    if (providerError) throw providerError;



    if (!provider) {

      return NextResponse.json(

        {

          error:

            "The document provider linked to this client is no longer active.",

        },

        { status: 400 }

      );

    }



    const location = mapping as DocumentLocationRecord;

    const providerRecord = provider as DocumentProviderRecord;



    const url = new URL(request.url);

    const requestedPath = String(

      url.searchParams.get("path") || location.folder_path

    ).trim();

    const forceFresh = url.searchParams.get("fresh") === "1";



    if (!isInsideRoot(location.folder_path, requestedPath)) {

      return NextResponse.json(

        {

          error:

            "The requested folder is outside this client’s linked document root.",

        },

        { status: 403 }

      );

    }



    const key = cacheKey({

      organisationId,

      clientId,

      providerId: providerRecord.id,

      requestedPath,

    });



    if (!forceFresh) {

      const cached = getCachedBrowse(key);

      if (cached) {

        return NextResponse.json(cached, {

          headers: { "x-practicepilot-cache": "HIT" },

        });

      }



      const existingRequest = browseInFlight.get(key);

      if (existingRequest) {

        const sharedResult = await existingRequest;

        return NextResponse.json(sharedResult, {

          headers: { "x-practicepilot-cache": "SHARED" },

        });

      }

    }



    const browseRequest = (async () => {
    const adapter = getDocumentProviderAdapter(providerRecord.provider);
    const providerQueueKey = `${organisationId}::${providerRecord.id}`;

    try {
      const result = await runProviderCall(providerQueueKey, () =>
        adapter.browseFolder({
          provider: providerRecord,
          path: requestedPath,
        })
      );

      const payload: BrowsePayload = {
        success: true,
        linked: true,
        provider: providerRecord.provider,
        root_path: normalisePath(location.folder_path),
        root_name:
          location.folder_name ||
          location.folder_path.split("/").filter(Boolean).pop() ||
          client.client_name,
        current_path: result.current_path,
        current_name: result.current_name,
        items: result.items,
      };

      setCachedBrowse(key, payload);
      return payload;
    } catch (error) {
      if (isProviderRateLimitError(error)) {
        const stale = getStaleBrowse(key);

        if (stale) {
          console.warn(
            "CLIENT DOCUMENT BROWSE RATE LIMITED — serving stale cached folder:",
            requestedPath
          );
          return stale;
        }
      }

      throw error;
    }
  })();



    browseInFlight.set(key, browseRequest);



    try {

      const payload = await browseRequest;

      return NextResponse.json(payload, {

        headers: { "x-practicepilot-cache": forceFresh ? "REFRESH" : "MISS" },

      });

    } finally {

      browseInFlight.delete(key);

    }

  } catch (error) {

    console.error("CLIENT DOCUMENT BROWSE ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not browse the client document folder.",

      },

      { status: 500 }

    );

  }

}
