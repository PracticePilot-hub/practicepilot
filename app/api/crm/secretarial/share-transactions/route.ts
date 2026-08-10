import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_secretarial: boolean | null;
};

type CurrentProfileResult =
  | { profile: UserProfile; response: null }
  | { profile: null; response: NextResponse };

type Body = {
  clientId?: string;
  transactionType?: "transfer" | "cancellation";
  fromShareholderId?: string;
  toShareholderId?: string;
  shareClassId?: string;
  numberOfShares?: number | string;
  effectiveDate?: string;
  reference?: string;
  notes?: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing server Supabase service key.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>
): Promise<CurrentProfileResult> {
  const token = bearer(request);

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
    .select(
      "id, user_id, role, organisation_id, access_enabled, can_access_secretarial"
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return {
      profile: null,
      response: NextResponse.json({ error: "User profile not found." }, { status: 403 }),
    };
  }

  const profile = data as UserProfile;

  if (
    !profile.access_enabled ||
    (!isAdmin(profile.role) && !profile.can_access_secretarial)
  ) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "You do not have access to Secretarial." },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function signedMovement(type: string, shares: number) {
  const normal = type.toLowerCase();

  if (normal === "issue" || normal === "transfer_in") return shares;

  if (
    normal === "transfer_out" ||
    normal === "redemption" ||
    normal === "repurchase" ||
    normal === "cancellation"
  ) {
    return -shares;
  }

  return 0;
}

async function holdingFor(
  supabase: ReturnType<typeof adminClient>,
  clientId: string,
  shareholderId: string,
  shareClassId: string
) {
  const { data, error } = await supabase
    .from("secretarial_share_transactions")
    .select("transaction_type, number_of_shares")
    .eq("client_id", clientId)
    .eq("shareholder_id", shareholderId)
    .eq("share_class_id", shareClassId);

  if (error) throw error;

  return (data || []).reduce(
    (total, row) =>
      total +
      signedMovement(
        String(row.transaction_type || ""),
        numberValue(row.number_of_shares)
      ),
    0
  );
}

async function activeCertificatesFor(
  supabase: ReturnType<typeof adminClient>,
  clientId: string,
  shareholderId: string,
  shareClassId: string
) {
  const { data, error } = await supabase
    .from("secretarial_share_certificates")
    .select("id, certificate_number, number_of_shares, certificate_status")
    .eq("client_id", clientId)
    .eq("shareholder_id", shareholderId)
    .eq("share_class_id", shareClassId)
    .in("certificate_status", ["issued"]);

  if (error) throw error;
  return data || [];
}


async function nextResolutionNumber(
  supabase: ReturnType<typeof adminClient>,
  clientId: string,
  resolutionDate: string
) {
  const year = Number(String(resolutionDate).slice(0, 4)) || new Date().getFullYear();

  const { count, error } = await supabase
    .from("secretarial_resolutions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("resolution_date", `${year}-01-01`)
    .lte("resolution_date", `${year}-12-31`);

  if (error) throw error;

  return `RES ${String((count || 0) + 1).padStart(3, "0")}/${year}`;
}

async function createShareTransactionResolution(args: {
  supabase: ReturnType<typeof adminClient>;
  organisationId: string;
  clientId: string;
  clientName: string;
  transactionType: "transfer" | "cancellation";
  effectiveDate: string;
  groupId: string;
  shares: number;
  fromName: string;
  toName?: string;
  shareClassName: string;
  reference?: string;
}) {
  const {
    supabase,
    organisationId,
    clientId,
    transactionType,
    effectiveDate,
    groupId,
    shares,
    fromName,
    toName,
    shareClassName,
    reference,
  } = args;

  const resolutionNumber = await nextResolutionNumber(
    supabase,
    clientId,
    effectiveDate
  );

  const isTransfer = transactionType === "transfer";

  const title = isTransfer
    ? "Share Transfer Resolution"
    : "Share Cancellation Resolution";

  const bodyText = isTransfer
    ? `RESOLVED that the transfer of ${shares.toLocaleString("en-ZA")} ${shareClassName} from ${fromName} to ${toName || "the transferee"} be recorded, subject to the company's Memorandum of Incorporation and any applicable approvals, and that the securities register and related share certificates be updated accordingly.`
    : `RESOLVED that ${shares.toLocaleString("en-ZA")} ${shareClassName} held by ${fromName} be cancelled / surrendered as recorded in the supporting transaction documents, and that the securities register, issued share position and related share certificates be updated accordingly.`;

  const { data, error } = await supabase
    .from("secretarial_resolutions")
    .insert({
      organisation_id: organisationId,
      client_id: clientId,
      resolution_number: resolutionNumber,
      resolution_type: "board",
      resolution_category: isTransfer ? "share_transfer" : "share_cancellation",
      title,
      resolution_date: effectiveDate,
      related_area: "share_transactions",
      transaction_group_id: groupId,
      body_text: bodyText,
      status: "generated",
    })
    .select("id, resolution_number")
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = adminClient();

  try {
    const authResult = await currentProfile(request, supabase);

    if (authResult.response) {
      return authResult.response;
    }

    const profile = authResult.profile;

    const body = (await request.json()) as Body;

    const clientId = String(body.clientId || "").trim();
    const transactionType = body.transactionType;
    const fromShareholderId = String(body.fromShareholderId || "").trim();
    const toShareholderId = String(body.toShareholderId || "").trim();
    const shareClassId = String(body.shareClassId || "").trim();
    const shares = numberValue(body.numberOfShares);
    const effectiveDate =
      String(body.effectiveDate || "").trim() ||
      new Date().toISOString().slice(0, 10);
    const reference = String(body.reference || "").trim();
    const notes = String(body.notes || "").trim();

    if (!clientId || !transactionType || !fromShareholderId || !shareClassId) {
      return NextResponse.json(
        { error: "Complete the required share transaction information." },
        { status: 400 }
      );
    }

    if (shares <= 0) {
      return NextResponse.json(
        { error: "Number of shares must be greater than zero." },
        { status: 400 }
      );
    }

    if (transactionType === "transfer" && !toShareholderId) {
      return NextResponse.json(
        { error: "Select the shareholder receiving the shares." },
        { status: 400 }
      );
    }

    if (
      transactionType === "transfer" &&
      fromShareholderId === toShareholderId
    ) {
      return NextResponse.json(
        { error: "The transferor and transferee cannot be the same shareholder." },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select("id, organisation_id, client_name")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (
      !isAdmin(profile.role) &&
      profile.organisation_id !== client.organisation_id
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const currentFrom = await holdingFor(
      supabase,
      clientId,
      fromShareholderId,
      shareClassId
    );

    if (currentFrom < shares) {
      return NextResponse.json(
        {
          error: `The shareholder only holds ${currentFrom} share${
            currentFrom === 1 ? "" : "s"
          } in this class.`,
        },
        { status: 400 }
      );
    }

    const [{ data: fromHolder }, { data: toHolder }, { data: shareClassInfo }] =
      await Promise.all([
        supabase
          .from("secretarial_shareholders")
          .select("full_legal_name")
          .eq("id", fromShareholderId)
          .eq("client_id", clientId)
          .single(),
        transactionType === "transfer"
          ? supabase
              .from("secretarial_shareholders")
              .select("full_legal_name")
              .eq("id", toShareholderId)
              .eq("client_id", clientId)
              .single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("secretarial_share_classes")
          .select("class_name")
          .eq("id", shareClassId)
          .eq("client_id", clientId)
          .single(),
      ]);

    const groupId = randomUUID();

    const oldFromCertificates = await activeCertificatesFor(
      supabase,
      clientId,
      fromShareholderId,
      shareClassId
    );

    let oldToCertificates: Awaited<ReturnType<typeof activeCertificatesFor>> = [];

    if (transactionType === "transfer") {
      oldToCertificates = await activeCertificatesFor(
        supabase,
        clientId,
        toShareholderId,
        shareClassId
      );
    }

    if (transactionType === "transfer") {
      const { error: transactionError } = await supabase
        .from("secretarial_share_transactions")
        .insert([
          {
            organisation_id: client.organisation_id,
            client_id: clientId,
            transaction_group_id: groupId,
            transaction_type: "transfer_out",
            transaction_date: effectiveDate,
            number_of_shares: shares,
            shareholder_id: fromShareholderId,
            counterparty_shareholder_id: toShareholderId,
            share_class_id: shareClassId,
            transaction_reference: reference || null,
            notes: notes || null,
          },
          {
            organisation_id: client.organisation_id,
            client_id: clientId,
            transaction_group_id: groupId,
            transaction_type: "transfer_in",
            transaction_date: effectiveDate,
            number_of_shares: shares,
            shareholder_id: toShareholderId,
            counterparty_shareholder_id: fromShareholderId,
            share_class_id: shareClassId,
            transaction_reference: reference || null,
            notes: notes || null,
          },
        ]);

      if (transactionError) throw transactionError;
    } else {
      const { error: transactionError } = await supabase
        .from("secretarial_share_transactions")
        .insert({
          organisation_id: client.organisation_id,
          client_id: clientId,
          transaction_group_id: groupId,
          transaction_type: "cancellation",
          transaction_date: effectiveDate,
          number_of_shares: shares,
          shareholder_id: fromShareholderId,
          share_class_id: shareClassId,
          transaction_reference: reference || null,
          notes: notes || null,
        });

      if (transactionError) throw transactionError;
    }

    const certificateIds = [
      ...oldFromCertificates.map((row) => row.id),
      ...oldToCertificates.map((row) => row.id),
    ];

    if (certificateIds.length) {
      const { error: certificateError } = await supabase
        .from("secretarial_share_certificates")
        .update({
          certificate_status: "replaced",
          superseded_at: new Date().toISOString(),
          superseded_reason:
            transactionType === "transfer"
              ? "Shareholding changed by transfer."
              : "Shareholding changed by cancellation / surrender.",
          replacement_transaction_group_id: groupId,
        })
        .in("id", certificateIds);

      if (certificateError) throw certificateError;
    }

    const afterFrom = currentFrom - shares;
    const queueRows: Array<Record<string, unknown>> = [];

    if (afterFrom > 0) {
      queueRows.push({
        organisation_id: client.organisation_id,
        client_id: clientId,
        transaction_group_id: groupId,
        shareholder_id: fromShareholderId,
        share_class_id: shareClassId,
        previous_certificate_id: oldFromCertificates[0]?.id || null,
        replacement_shares: afterFrom,
        replacement_reason:
          transactionType === "transfer"
            ? "Replacement after share transfer"
            : "Replacement after partial cancellation",
        queue_status: "pending",
      });
    }

    if (transactionType === "transfer") {
      const currentTo = await holdingFor(
        supabase,
        clientId,
        toShareholderId,
        shareClassId
      );

      queueRows.push({
        organisation_id: client.organisation_id,
        client_id: clientId,
        transaction_group_id: groupId,
        shareholder_id: toShareholderId,
        share_class_id: shareClassId,
        previous_certificate_id: oldToCertificates[0]?.id || null,
        replacement_shares: currentTo,
        replacement_reason: "Replacement / new certificate after share transfer",
        queue_status: "pending",
      });
    }

    if (queueRows.length) {
      const { error: queueError } = await supabase
        .from("secretarial_certificate_replacement_queue")
        .insert(queueRows);

      if (queueError) throw queueError;
    }

    if (transactionType === "cancellation") {
      const { data: shareClass, error: shareClassError } = await supabase
        .from("secretarial_share_classes")
        .select("id, issued_shares")
        .eq("id", shareClassId)
        .eq("client_id", clientId)
        .single();

      if (shareClassError || !shareClass) throw shareClassError;

      const newIssued = Math.max(
        0,
        numberValue(shareClass.issued_shares) - shares
      );

      const { error: updateClassError } = await supabase
        .from("secretarial_share_classes")
        .update({ issued_shares: newIssued })
        .eq("id", shareClassId);

      if (updateClassError) throw updateClassError;
    }

    const resolution = await createShareTransactionResolution({
      supabase,
      organisationId: client.organisation_id,
      clientId,
      clientName: client.client_name,
      transactionType,
      effectiveDate,
      groupId,
      shares,
      fromName: fromHolder?.full_legal_name || "the transferor / holder",
      toName: toHolder?.full_legal_name || undefined,
      shareClassName: shareClassInfo?.class_name || "shares",
      reference,
    });

    return NextResponse.json({
      message:
        transactionType === "transfer"
          ? "Share transfer posted. Existing certificates were preserved in history and replacement certificates were queued."
          : "Share cancellation posted. Existing certificates were preserved in history and replacement certificates were queued where required.",
      transactionGroupId: groupId,
      replacementCount: queueRows.length,
      resolution,
    });
  } catch (error) {
    console.error("Secretarial share transaction failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not post the share transaction.",
      },
      { status: 500 }
    );
  }
}
