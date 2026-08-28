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
};

type TransactionType = "issue" | "transfer" | "cancellation";

type Body = {
  clientId?: string;
  transactionType?: TransactionType;
  fromShareholderId?: string;
  toShareholderId?: string;
  shareClassId?: string;
  numberOfShares?: number | string;
  effectiveDate?: string;
  reference?: string;
  notes?: string;

  certificateNumber?: string;
  considerationPerShare?: number | string;
  amountPaidPerShare?: number | string;
  fullyPaid?: boolean;
  placeOfIssue?: string;
  transferRestriction?: string;
  signatoryOneName?: string;
  signatoryOneCapacity?: string;
  signatoryTwoName?: string;
  signatoryTwoCapacity?: string;
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
  supabase: ReturnType<typeof adminClient>,
) {
  const token = bearer(request);

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
    .select("id,user_id,role,organisation_id,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return {
    profile: data as UserProfile,
    response: null as NextResponse | null,
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value: unknown) {
  return String(value || "").trim();
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
  shareClassId: string,
) {
  const { data, error } = await supabase
    .from("secretarial_share_transactions")
    .select("transaction_type,number_of_shares")
    .eq("client_id", clientId)
    .eq("shareholder_id", shareholderId)
    .eq("share_class_id", shareClassId);

  if (error) throw error;

  return (data || []).reduce(
    (total, row) =>
      total +
      signedMovement(
        String(row.transaction_type || ""),
        numberValue(row.number_of_shares),
      ),
    0,
  );
}

async function activeCertificatesFor(
  supabase: ReturnType<typeof adminClient>,
  clientId: string,
  shareholderId: string,
  shareClassId: string,
) {
  const { data, error } = await supabase
    .from("secretarial_share_certificates")
    .select("id,certificate_number,number_of_shares,certificate_status")
    .eq("client_id", clientId)
    .eq("shareholder_id", shareholderId)
    .eq("share_class_id", shareClassId)
    .eq("certificate_status", "issued");

  if (error) throw error;
  return data || [];
}

async function nextResolutionReference(
  supabase: ReturnType<typeof adminClient>,
  clientId: string,
  date: string,
) {
  const year = Number(date.slice(0, 4)) || new Date().getFullYear();

  const { count, error } = await supabase
    .from("secretarial_share_matters")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("board_resolution_date", `${year}-01-01`)
    .lte("board_resolution_date", `${year}-12-31`);

  if (error) throw error;

  return `RES ${String((count || 0) + 1).padStart(3, "0")}/${year}`;
}

async function postIssue(args: {
  supabase: ReturnType<typeof adminClient>;
  profile: UserProfile;
  client: any;
  body: Body;
}) {
  const { supabase, profile, client, body } = args;

  const clientId = client.id;
  const shareholderId = clean(body.toShareholderId);
  const shareClassId = clean(body.shareClassId);
  const shares = numberValue(body.numberOfShares);
  const effectiveDate =
    clean(body.effectiveDate) || new Date().toISOString().slice(0, 10);
  const certificateNumber = clean(body.certificateNumber);
  const considerationPerShare = optionalNumber(body.considerationPerShare);
  const amountPaidPerShare = optionalNumber(body.amountPaidPerShare);

  if (!shareholderId || !shareClassId || shares <= 0 || !certificateNumber) {
    return NextResponse.json(
      { error: "Complete the shareholder, share class, shares and certificate number." },
      { status: 400 },
    );
  }

  const [{ data: shareholder, error: holderError }, { data: shareClass, error: classError }] =
    await Promise.all([
      supabase
        .from("secretarial_shareholders")
        .select("id,full_legal_name")
        .eq("id", shareholderId)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .single(),
      supabase
        .from("secretarial_share_classes")
        .select("id,class_name,authorised_shares,issued_shares")
        .eq("id", shareClassId)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .single(),
    ]);

  if (holderError || !shareholder) {
    return NextResponse.json({ error: "The selected shareholder could not be found." }, { status: 400 });
  }

  if (classError || !shareClass) {
    return NextResponse.json({ error: "The selected share class could not be found." }, { status: 400 });
  }

  const authorised = numberValue(shareClass.authorised_shares);
  const issued = numberValue(shareClass.issued_shares);

  if (authorised > 0 && issued + shares > authorised) {
    return NextResponse.json(
      { error: "This issue would exceed the authorised shares for this class." },
      { status: 400 },
    );
  }

  const { data: duplicateMatter, error: duplicateMatterError } = await supabase
    .from("secretarial_share_matters")
    .select("id")
    .eq("client_id", clientId)
    .eq("certificate_number", certificateNumber)
    .maybeSingle();

  if (duplicateMatterError) throw duplicateMatterError;

  const { data: duplicateCertificate, error: duplicateCertificateError } = await supabase
    .from("secretarial_share_certificates")
    .select("id")
    .eq("client_id", clientId)
    .eq("certificate_number", certificateNumber)
    .maybeSingle();

  if (duplicateCertificateError) throw duplicateCertificateError;

  if (duplicateMatter || duplicateCertificate) {
    return NextResponse.json(
      { error: `Certificate number ${certificateNumber} already exists for this client.` },
      { status: 409 },
    );
  }

  const resolutionReference = clean(body.reference) ||
    (await nextResolutionReference(supabase, clientId, effectiveDate));

  const totalConsideration =
    considerationPerShare == null ? null : shares * considerationPerShare;
  const totalPaid =
    amountPaidPerShare == null ? null : shares * amountPaidPerShare;

  const resolutionText =
    `RESOLVED that the company issue ${shares.toLocaleString("en-ZA")} ` +
    `${shareClass.class_name || "shares"} to ${shareholder.full_legal_name}, ` +
    `and that the securities register be updated and Share Certificate ` +
    `${certificateNumber} be issued accordingly.`;

  const { data: matter, error: matterError } = await supabase
    .from("secretarial_share_matters")
    .insert({
      organisation_id: client.organisation_id,
      client_id: clientId,
      matter_status: "completed",
      current_step: 9,
      certificate_number: certificateNumber,
      shareholder_id: shareholderId,
      share_class_id: shareClassId,
      number_of_shares: shares,
      issue_date: effectiveDate,
      place_of_issue: clean(body.placeOfIssue) || "Pretoria",
      transfer_restriction:
        clean(body.transferRestriction) ||
        "The transfer of these shares is subject to the restrictions contained in the company's Memorandum of Incorporation.",
      fully_paid: body.fullyPaid !== false,
      consideration_per_share: considerationPerShare,
      total_consideration: totalConsideration,
      amount_paid: totalPaid,
      board_resolution_date: effectiveDate,
      board_resolution_reference: resolutionReference,
      board_resolution_text: resolutionText,
      signatory_one_name: clean(body.signatoryOneName) || null,
      signatory_one_capacity: clean(body.signatoryOneCapacity) || null,
      signatory_two_name: clean(body.signatoryTwoName) || null,
      signatory_two_capacity: clean(body.signatoryTwoCapacity) || null,
      created_by_user_id: profile.id,
      updated_by_user_id: profile.id,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (matterError || !matter) {
    throw matterError || new Error("Could not create the completed share issue record.");
  }

  const { error: transactionError } = await supabase
    .from("secretarial_share_transactions")
    .insert({
      organisation_id: client.organisation_id,
      client_id: clientId,
      matter_id: matter.id,
      transaction_type: "issue",
      transaction_date: effectiveDate,
      number_of_shares: shares,
      shareholder_id: shareholderId,
      share_class_id: shareClassId,
      consideration_per_share: considerationPerShare,
      total_consideration: totalConsideration,
      transaction_reference: resolutionReference,
      notes: clean(body.notes) || `Share Certificate ${certificateNumber}`,
      created_by_user_id: profile.id,
    });

  if (transactionError) throw transactionError;

  const { data: certificate, error: certificateError } = await supabase
    .from("secretarial_share_certificates")
    .insert({
      organisation_id: client.organisation_id,
      client_id: clientId,
      matter_id: matter.id,
      shareholder_id: shareholderId,
      share_class_id: shareClassId,
      certificate_number: certificateNumber,
      issue_date: effectiveDate,
      number_of_shares: shares,
      certificate_status: "issued",
    })
    .select("id")
    .single();

  if (certificateError || !certificate) {
    throw certificateError || new Error("Could not create the share certificate.");
  }

  const { error: updateClassError } = await supabase
    .from("secretarial_share_classes")
    .update({ issued_shares: issued + shares })
    .eq("id", shareClassId);

  if (updateClassError) throw updateClassError;

  return NextResponse.json({
    message: "Share issue posted and certificate created.",
    transactionType: "issue",
    matterId: matter.id,
    certificateId: certificate.id,
    certificateNumber,
    resolutionReference,
  });
}

async function postTransferOrCancellation(args: {
  supabase: ReturnType<typeof adminClient>;
  profile: UserProfile;
  client: any;
  body: Body;
  transactionType: "transfer" | "cancellation";
}) {
  const { supabase, client, body, transactionType } = args;

  const clientId = client.id;
  const fromShareholderId = clean(body.fromShareholderId);
  const toShareholderId = clean(body.toShareholderId);
  const shareClassId = clean(body.shareClassId);
  const shares = numberValue(body.numberOfShares);
  const effectiveDate =
    clean(body.effectiveDate) || new Date().toISOString().slice(0, 10);
  const reference = clean(body.reference);
  const notes = clean(body.notes);

  if (!fromShareholderId || !shareClassId || shares <= 0) {
    return NextResponse.json(
      { error: "Complete the shareholder, share class and number of shares." },
      { status: 400 },
    );
  }

  if (transactionType === "transfer" && !toShareholderId) {
    return NextResponse.json(
      { error: "Select the shareholder receiving the shares." },
      { status: 400 },
    );
  }

  if (
    transactionType === "transfer" &&
    fromShareholderId === toShareholderId
  ) {
    return NextResponse.json(
      { error: "The transferor and transferee cannot be the same shareholder." },
      { status: 400 },
    );
  }

  const currentFrom = await holdingFor(
    supabase,
    clientId,
    fromShareholderId,
    shareClassId,
  );

  if (currentFrom < shares) {
    return NextResponse.json(
      {
        error: `The shareholder only holds ${currentFrom} share${
          currentFrom === 1 ? "" : "s"
        } in this class.`,
      },
      { status: 400 },
    );
  }

  const groupId = randomUUID();

  const oldFromCertificates = await activeCertificatesFor(
    supabase,
    clientId,
    fromShareholderId,
    shareClassId,
  );

  let oldToCertificates: Awaited<ReturnType<typeof activeCertificatesFor>> = [];

  if (transactionType === "transfer") {
    oldToCertificates = await activeCertificatesFor(
      supabase,
      clientId,
      toShareholderId,
      shareClassId,
    );

    const { error } = await supabase
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

    if (error) throw error;
  } else {
    const { error } = await supabase
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

    if (error) throw error;
  }

  const certificateIds = [
    ...oldFromCertificates.map((row) => row.id),
    ...oldToCertificates.map((row) => row.id),
  ];

  if (certificateIds.length) {
    const { error } = await supabase
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

    if (error) throw error;
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
      shareClassId,
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
    const { error } = await supabase
      .from("secretarial_certificate_replacement_queue")
      .insert(queueRows);

    if (error) throw error;
  }

  if (transactionType === "cancellation") {
    const { data: shareClass, error: shareClassError } = await supabase
      .from("secretarial_share_classes")
      .select("issued_shares")
      .eq("id", shareClassId)
      .eq("client_id", clientId)
      .single();

    if (shareClassError || !shareClass) throw shareClassError;

    const newIssued = Math.max(
      0,
      numberValue(shareClass.issued_shares) - shares,
    );

    const { error: updateClassError } = await supabase
      .from("secretarial_share_classes")
      .update({ issued_shares: newIssued })
      .eq("id", shareClassId);

    if (updateClassError) throw updateClassError;
  }

  return NextResponse.json({
    message:
      transactionType === "transfer"
        ? "Share transfer posted. Replacement certificates have been queued."
        : "Share cancellation posted. Replacement certificates have been queued where required.",
    transactionType,
    transactionGroupId: groupId,
    replacementCount: queueRows.length,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = adminClient();

  try {
    const auth = await currentProfile(request, supabase);
    if (auth.response) return auth.response;

    const profile = auth.profile;
    if (!profile) {
      return NextResponse.json({ error: "Could not determine the current user." }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const clientId = clean(body.clientId);
    const transactionType = body.transactionType;

    if (
      !clientId ||
      !transactionType ||
      !["issue", "transfer", "cancellation"].includes(transactionType)
    ) {
      return NextResponse.json(
        { error: "Select a valid share transaction type." },
        { status: 400 },
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select("id,organisation_id,client_name")
      .eq("id", clientId)
      .single();

    if (clientError || !client || !client.organisation_id) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (
      !isAdmin(profile.role) &&
      profile.organisation_id !== client.organisation_id
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    if (transactionType === "issue") {
      return await postIssue({ supabase, profile, client, body });
    }

    return await postTransferOrCancellation({
      supabase,
      profile,
      client,
      body,
      transactionType,
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
      { status: 500 },
    );
  }
}
