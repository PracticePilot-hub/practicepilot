import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RenderBody = {
  clientId?: string;
  documentType?: string;
  sourceId?: string | null;
};

type UserProfile = {
  id: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_secretarial: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Server Supabase credentials are not configured.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tokenFrom(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function globalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateText(value: unknown) {
  const text = String(value ?? "").slice(0, 10);
  if (!text) return "-";
  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return esc(text);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function fileSafe(value: string) {
  return value
    .replace(/[^a-z0-9\-_.]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function baseHtml(title: string, client: any, body: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; overflow: hidden; }
  body { font-family: Arial, Helvetica, sans-serif; color: #10233a; font-size: 10.5px; }
  .page-shell { position: relative; width: 180mm; height: 266mm; margin: 12mm 15mm 10mm; padding-bottom: 10mm; overflow: hidden; }
  .client { font-size: 18px; font-weight: 900; line-height: 1.05; }
  .reg { margin-top: 3px; color: #52647a; font-size: 10px; font-weight: 700; }
  .line { margin-top: 8px; border-bottom: 2px solid #10233a; }
  .document-title { margin: 11px 0 15px; text-align: center; font-size: 20px; font-weight: 900; }
  h1 { font-size: 18px; margin: 0 0 7px; }
  h2 { margin: 14px 0 6px; font-size: 12px; }
  h3 { margin: 10px 0 5px; font-size: 11px; }
  p { line-height: 1.48; margin: 5px 0; }
  ol { margin: 6px 0 8px 19px; padding: 0; }
  li { margin: 4px 0; line-height: 1.45; }
  .muted { color: #64748b; }
  .subject { margin: 10px 0 8px; font-size: 11px; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
  th { text-align: left; background: #f3f6f9; color: #52647a; font-size: 8px; letter-spacing: .04em; }
  th, td { padding: 6px 7px; border: 1px solid #d8dee7; vertical-align: top; }
  .label { width: 34%; color: #64748b; font-weight: 700; }
  .green { border: 1px solid #b7efc9; background: #ecfdf3; color: #166534; padding: 8px 10px; line-height: 1.45; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; margin-top: 30px; page-break-inside: avoid; }
  .sig { border-top: 1px solid #10233a; padding-top: 8px; min-height: 74px; font-size: 9.5px; line-height: 1.8; }
  .signature-single { width: 58%; margin-top: 34px; border-top: 1px solid #10233a; padding-top: 6px; }
  .mandate-body { font-size: 11.8px; line-height: 1.52; }
  .mandate-body p { line-height: 1.52; margin: 6px 0; }
  .mandate-body h2 { margin-top: 13px; font-size: 12.5px; }
  .mandate-body th { font-size: 8.4px; }
  .mandate-body td { font-size: 10.2px; }
  .ar-authority { font-size: 11.4px; line-height: 1.5; }
  .ar-authority p { line-height: 1.5; margin: 6px 0; }
  .ar-authority h2 { margin-top: 13px; font-size: 12.5px; }
  .ar-authority th { font-size: 8.4px; }
  .ar-authority td { font-size: 10.3px; padding: 6.5px 7px; }
  .entity-emphasis { margin: 8px 0 12px; font-size: 15px; font-weight: 900; }
  .powered { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; color: #d3dbe5; font-size: 6px; letter-spacing: .08em; }
</style>
</head>
<body>
<div class="page-shell">
  <div class="client">${esc(client.client_name)}</div>
  <div class="reg">${esc(client.registration_number || "")}</div>
  <div class="line"></div>
  <div class="document-title">${esc(title)}</div>
  ${body}
  <div class="powered">Powered by PracticePilot</div>
</div>
</body>
</html>`;
}



function compactAddress(row: any) {
  const parts = [
    row?.physical_address_line_1,
    row?.physical_address_line_2,
    row?.physical_address_city,
    row?.physical_address_province,
    row?.physical_address_postal_code,
    row?.physical_address_country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.join(", ");
}

function registerHtml(title: string, client: any, body: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; overflow: hidden; }
  body { font-family: Arial, Helvetica, sans-serif; color: #10233a; font-size: 9px; }
  .page-shell { position: relative; width: 180mm; height: 267mm; margin: 12mm 15mm 18mm; padding-bottom: 10mm; overflow: hidden; }
  .client { font-size: 20px; font-weight: 900; line-height: 1.05; }
  .reg { margin-top: 4px; color: #52647a; font-size: 10px; font-weight: 800; }
  .line { margin-top: 9px; border-bottom: 2px solid #10233a; }
  .register-title { margin: 11px 0 15px; text-align: center; font-size: 21px; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; }
  tr { page-break-inside: avoid; }
  th { text-align: left; background: #f3f6f9; color: #52647a; font-size: 7.5px; letter-spacing: .04em; }
  th, td { padding: 5px 6px; border: 1px solid #d8dee7; vertical-align: top; }
  .muted { color: #64748b; }
  .powered { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; color: #d3dbe5; font-size: 6px; letter-spacing: .08em; }
</style>
</head>
<body>
<div class="page-shell">
  <div class="client">${esc(client.client_name)}</div>
  <div class="reg">${esc(client.registration_number || "")}</div>
  <div class="line"></div>
  <div class="register-title">${esc(title)}</div>
  ${body}
  <div class="powered">Powered by PracticePilot</div>
</div>
</body>
</html>`;
}

function shareCertificateBackground() {
  const candidates = [
    path.join(process.cwd(), "public", "secretarial", "share-certificate-background.png"),
    path.join(process.cwd(), "public", "share-certificate-background.png"),
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) return "";
  return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function certificateHtml({
  client,
  certificate,
  shareholder,
  shareClass,
  matter,
}: {
  client: any;
  certificate: any;
  shareholder: any;
  shareClass: any;
  matter: any;
}) {
  const shareDescription = `${Number(certificate.number_of_shares || 0).toLocaleString("en-ZA")} ${shareClass?.class_name || "shares"}`;
  const bg = shareCertificateBackground();

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 297mm; height: 210mm; overflow: hidden; }
  body { color: #10233a; background: #fff; }
  .page { position: relative; width: 297mm; height: 210mm; overflow: hidden; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
  .content { position: absolute; inset: 12mm 17mm 10mm; text-align: center; font-family: Arial, Helvetica, sans-serif; }
  .cert-no { position: absolute; top: 0; right: 0; font-size: 8px; color: #64748b; text-align: right; }
  .cert-no strong { display: block; color: #10233a; font-size: 14px; margin-top: 2px; }
  .company { margin-top: 8mm; font-family: Georgia, "Times New Roman", serif; font-size: 28px; font-weight: 700; }
  .registration { margin-top: 2mm; color: #64748b; font: 9px Arial, sans-serif; }
  .title { margin: 11mm 0 8mm; font-family: Georgia, "Times New Roman", serif; font-size: 36px; font-weight: 700; letter-spacing: .12em; }
  .small { color: #52647a; font-size: 10px; }
  .holder-id { margin-top: 1.5mm; color: #64748b; font-size: 9px; }
  .detail-strip { margin: 6mm auto 0; width: 82%; display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
  .detail-cell { padding: 3mm 2mm; border-right: 1px solid #e2e8f0; }
  .detail-cell:last-child { border-right: 0; }
  .detail-label { display: block; color: #64748b; font-size: 7px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .detail-value { display: block; margin-top: 1mm; color: #10233a; font-size: 9px; font-weight: 800; }
  .holder { margin: 5mm 0 2mm; font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 700; }
  .holder-id { color: #64748b; font-size: 9px; margin-bottom: 3mm; }
  .shares { display: inline-block; min-width: 150mm; margin: 5mm auto; padding: 4mm 10mm; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; font-family: Georgia, "Times New Roman", serif; font-size: 19px; font-weight: 700; }
  .meta { margin-top: 6mm; color: #52647a; font-size: 10px; line-height: 1.55; }
  .restriction { max-width: 220mm; margin: 4mm auto 0; color: #64748b; font-size: 8.5px; line-height: 1.4; }
  .signatures { position: absolute; left: 12mm; right: 12mm; bottom: 2mm; display: grid; grid-template-columns: 1fr 1fr; gap: 40mm; }
  .signature { border-top: 1px solid #10233a; padding-top: 3mm; font: 9px Arial, sans-serif; }
  .signature strong { display: block; color: #10233a; }
  .signature span { color: #64748b; }
</style>
</head>
<body>
<div class="page">
  ${bg ? `<img class="bg" src="${bg}" />` : ""}
  <div class="content">
    <div class="cert-no">CERTIFICATE NO.<strong>${esc(certificate.certificate_number)}</strong></div>
    <div class="company">${esc(client.client_name)}</div>
    <div class="registration">Registration number: ${esc(client.registration_number || "")}</div>
    <div class="title">SHARE CERTIFICATE</div>
    <div class="small">This is to certify that</div>
    <div class="holder">${esc(shareholder?.full_legal_name || "")}</div>
    <div class="holder-id">${esc(shareholder?.id_registration_number || "")}</div>
    <div class="small">is the registered holder of</div>
    <div class="shares">${esc(shareDescription)}</div>
    <div class="small">in the issued share capital of the company.</div>
    <div class="detail-strip">
      <div class="detail-cell">
        <span class="detail-label">Share class</span>
        <span class="detail-value">${esc(shareClass?.class_name || "")}</span>
      </div>
      <div class="detail-cell">
        <span class="detail-label">Issue date</span>
        <span class="detail-value">${dateText(certificate.issue_date)}</span>
      </div>
      <div class="detail-cell">
        <span class="detail-label">Place of issue</span>
        <span class="detail-value">${esc(matter?.place_of_issue || "-")}</span>
      </div>
    </div>
    <div class="meta">${matter?.fully_paid === false ? "The shares are partly paid." : "The shares are fully paid."}</div>
    <div class="restriction"><strong>Transfer restriction:</strong> ${esc(
      matter?.transfer_restriction ||
        "No specific transfer restriction has been recorded for this certificate."
    )}</div>
    <div class="restriction">Issued as a certificated security and signed by two persons authorised by the board.</div>
    <div class="signatures">
      <div class="signature"><strong>${esc(matter?.signatory_one_name || "")}</strong><span>${esc(matter?.signatory_one_capacity || "Director")}</span></div>
      <div class="signature"><strong>${esc(matter?.signatory_two_name || "")}</strong><span>${esc(matter?.signatory_two_capacity || "Director")}</span></div>
    </div>
  </div>
</div>
</body>
</html>`;
}

async function launchBrowser() {
  const isLocal = process.env.NODE_ENV !== "production";

  if (isLocal) {
    const candidates = [
      process.env.CHROME_EXECUTABLE_PATH,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ].filter(Boolean) as string[];

    const fs = await import("fs");
    const localChrome = candidates.find((path) => fs.existsSync(path));

    if (localChrome) {
      return puppeteer.launch({
        executablePath: localChrome,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
  }

  const executablePath = await chromium.executablePath();

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: {
      width: 1440,
      height: 900,
    },
    executablePath,
    headless: true,
  });
}

export async function POST(request: Request) {
  const supabase = adminClient();

  try {
    const token = tokenFrom(request);
    if (!token) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        "id, role, organisation_id, access_enabled, can_access_secretarial"
      )
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Could not load your user profile." },
        { status: 403 }
      );
    }

    const typedProfile = profile as UserProfile;

    if (
      !typedProfile.access_enabled ||
      (!globalAdmin(typedProfile.role) &&
        !typedProfile.can_access_secretarial)
    ) {
      return NextResponse.json(
        { error: "You do not have access to Secretarial." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RenderBody;
    const clientId = String(body.clientId || "");
    const documentType = String(body.documentType || "");
    const sourceId = body.sourceId ? String(body.sourceId) : null;

    if (!clientId || !documentType) {
      return NextResponse.json(
        { error: "Client and document type are required." },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select(
        "id, client_name, trading_name, registration_number, entity_type, organisation_id, registration_date"
      )
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (
      !globalAdmin(typedProfile.role) &&
      typedProfile.organisation_id !== client.organisation_id
    ) {
      return NextResponse.json(
        { error: "You cannot access this client." },
        { status: 403 }
      );
    }

    let html = "";
    let fileName = "";

    if (documentType === "share-certificate") {
      if (!sourceId) throw new Error("Certificate source is required.");

      const { data: certificate, error } = await supabase
        .from("secretarial_share_certificates")
        .select(
          "id, certificate_number, issue_date, number_of_shares, certificate_status, shareholder_id, share_class_id, matter_id"
        )
        .eq("id", sourceId)
        .eq("client_id", clientId)
        .single();

      if (error || !certificate) throw new Error("Certificate not found.");

      const [{ data: shareholder }, { data: shareClass }, { data: matter }] =
        await Promise.all([
          supabase
            .from("secretarial_shareholders")
            .select("full_legal_name, id_registration_number")
            .eq("id", certificate.shareholder_id)
            .single(),
          supabase
            .from("secretarial_share_classes")
            .select("class_name, series_designation")
            .eq("id", certificate.share_class_id)
            .single(),
          supabase
            .from("secretarial_share_matters")
            .select(
              "place_of_issue, transfer_restriction, fully_paid, signatory_one_name, signatory_one_capacity, signatory_two_name, signatory_two_capacity"
            )
            .eq("id", certificate.matter_id)
            .single(),
        ]);

      html = certificateHtml({
        client,
        certificate,
        shareholder,
        shareClass,
        matter,
      });

      fileName = `${fileSafe(client.client_name)}-Share-Certificate-${fileSafe(
        certificate.certificate_number
      )}.pdf`;
    } else if (documentType === "resolution") {
      if (!sourceId) throw new Error("Resolution source is required.");

      const { data: resolution, error } = await supabase
        .from("secretarial_resolutions")
        .select(
          "client_id, resolution_number, resolution_type, resolution_category, title, resolution_date, body_text, status"
        )
        .eq("id", sourceId)
        .single();

      if (
        error ||
        !resolution ||
        String(resolution.client_id || "") !== clientId
      ) {
        throw new Error("Resolution could not be loaded for this client.");
      }

      html = baseHtml(
        `${resolution.resolution_number} · ${resolution.title}`,
        client,
        `
        <p><strong>Date:</strong> ${dateText(resolution.resolution_date)}</p>
        <p><strong>Resolution type:</strong> ${esc(
          String(resolution.resolution_type || "").replaceAll("_", " ")
        )}</p>
        <h2>Resolution</h2>
        <p>${esc(resolution.body_text)}</p>
        <div class="signature-grid">
          <div class="sig">
            <strong>Authorised signatory</strong><br/><br/>
            Name:<br/>________________________________________<br/><br/>
            Capacity:<br/>________________________________________
          </div>
          <div class="sig">
            <strong>Signature and date</strong><br/><br/>
            Signature:<br/>________________________________________<br/><br/>
            Date:<br/>________________________________________
          </div>
        </div>`
      );

      fileName = `${fileSafe(client.client_name)}-${fileSafe(
        resolution.resolution_number
      )}-${fileSafe(resolution.title)}.pdf`;
    } else if (documentType === "board-resolution") {
      if (!sourceId) throw new Error("Resolution source is required.");

      const { data: matter, error } = await supabase
        .from("secretarial_share_matters")
        .select(
          "client_id, board_resolution_reference, board_resolution_date, board_resolution_text, number_of_shares, shareholder_id, share_class_id"
        )
        .eq("id", sourceId)
        .single();

      if (error || !matter || String(matter.client_id || "") !== clientId) {
        throw new Error("Resolution could not be loaded for this client.");
      }

      const [{ data: shareholder }, { data: shareClass }] = await Promise.all([
        supabase
          .from("secretarial_shareholders")
          .select("full_legal_name")
          .eq("id", matter.shareholder_id)
          .single(),
        supabase
          .from("secretarial_share_classes")
          .select("class_name")
          .eq("id", matter.share_class_id)
          .single(),
      ]);

      const resolutionText =
        matter.board_resolution_text ||
        `RESOLVED that the company issue ${Number(
          matter.number_of_shares || 0
        ).toLocaleString("en-ZA")} ${
          shareClass?.class_name || "shares"
        } to ${shareholder?.full_legal_name || "the shareholder"} and that the directors are authorised to update the securities register and issue the relevant share certificate.`;

      html = baseHtml(
        `Board Resolution ${matter.board_resolution_reference || ""}`,
        client,
        `
        <p><strong>Date:</strong> ${dateText(matter.board_resolution_date)}</p>
        <h2>Resolution</h2>
        <p>${esc(resolutionText)}</p>
        <div class="signature-grid">
          <div class="sig">Director</div>
          <div class="sig">Director / Authorised Signatory</div>
        </div>`
      );

      fileName = `${fileSafe(client.client_name)}-Board-Resolution-${fileSafe(
        matter.board_resolution_reference || "Share-Issue"
      )}.pdf`;
    } else if (
      documentType === "securities-register" ||
      documentType === "shareholder-register"
    ) {
      const [{ data: transactions }, { data: shareholders }, { data: classes }] =
        await Promise.all([
          supabase
            .from("secretarial_share_transactions")
            .select(
              "id, transaction_type, transaction_date, number_of_shares, shareholder_id, share_class_id, notes"
            )
            .eq("client_id", clientId)
            .order("transaction_date", { ascending: true }),
          supabase
            .from("secretarial_shareholders")
            .select("id, full_legal_name, id_registration_number, holder_type, physical_address_line_1, physical_address_line_2, physical_address_city, physical_address_province, physical_address_postal_code, physical_address_country")
            .eq("client_id", clientId),
          supabase
            .from("secretarial_share_classes")
            .select("id, class_name")
            .eq("client_id", clientId),
        ]);

      const holderMap = new Map(
        (shareholders || []).map((row: any) => [row.id, row])
      );
      const classMap = new Map(
        (classes || []).map((row: any) => [row.id, row])
      );

      if (documentType === "securities-register") {
        const holderBalances = new Map<string, number>();

        const rows = (transactions || [])
          .map((row: any) => {
            const qty = Number(row.number_of_shares || 0);
            const type = String(row.transaction_type || "");
            const movement = ["issue", "transfer_in"].includes(type)
              ? qty
              : ["transfer_out", "redemption", "repurchase", "cancellation"].includes(type)
              ? -qty
              : 0;

            const balanceKey = `${row.shareholder_id}:${row.share_class_id}`;
            const nextBalance = (holderBalances.get(balanceKey) || 0) + movement;
            holderBalances.set(balanceKey, nextBalance);

            const movementText =
              movement > 0
                ? `+${movement.toLocaleString("en-ZA")}`
                : movement.toLocaleString("en-ZA");

            return `
          <tr>
            <td>${dateText(row.transaction_date)}</td>
            <td>${esc(type.replaceAll("_", " "))}</td>
            <td>
              <strong>${esc(holderMap.get(row.shareholder_id)?.full_legal_name || "")}</strong><br/>
              <span class="muted">${esc(holderMap.get(row.shareholder_id)?.id_registration_number || "")}</span>
            </td>
            <td>${esc(compactAddress(holderMap.get(row.shareholder_id)) || "—")}</td>
            <td>${esc(classMap.get(row.share_class_id)?.class_name || "")}</td>
            <td style="text-align:right;font-weight:800;">${movementText}</td>
            <td style="text-align:right;font-weight:800;">${nextBalance.toLocaleString("en-ZA")}</td>
            <td>${esc(row.notes || "")}</td>
          </tr>`;
          })
          .join("");

        html = registerHtml(
          "Securities Register",
          client,
          `<table>
            <thead><tr><th>Date</th><th>Transaction</th><th>Holder</th><th>Address</th><th>Class</th><th>Movement</th><th>Holder Balance</th><th>Reference / Notes</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="8">No transactions recorded.</td></tr>'}</tbody>
          </table>`
        );
        fileName = `${fileSafe(client.client_name)}-Securities-Register.pdf`;
      } else {
        const balances = new Map<string, number>();

        for (const row of transactions || []) {
          const key = `${row.shareholder_id}:${row.share_class_id}`;
          const qty = Number(row.number_of_shares || 0);
          const type = String(row.transaction_type || "");
          const signed = ["issue", "transfer_in"].includes(type)
            ? qty
            : ["transfer_out", "redemption", "repurchase", "cancellation"].includes(type)
            ? -qty
            : 0;
          balances.set(key, (balances.get(key) || 0) + signed);
        }

        const totalLiveShares = Array.from(balances.values()).reduce(
          (sum, qty) => sum + Math.max(0, qty),
          0
        );

        const liveRows = Array.from(balances.entries())
          .filter(([, qty]) => qty !== 0)
          .map(([key, qty]) => {
            const [holderId, classId] = key.split(":");
            const holder = holderMap.get(holderId);
            return `
            <tr>
              <td><strong>${esc(holder?.full_legal_name || "")}</strong><br/><span class="muted">${esc(holder?.holder_type || "")}</span></td>
              <td>${esc(holder?.id_registration_number || "")}</td>
              <td>${esc(compactAddress(holder) || "—")}</td>
              <td>${esc(classMap.get(classId)?.class_name || "")}</td>
              <td style="text-align:right;font-weight:800;">${qty.toLocaleString("en-ZA")}</td>
              <td style="text-align:right;font-weight:800;">${totalLiveShares > 0 ? ((qty / totalLiveShares) * 100).toFixed(2) : "0.00"}%</td>
            </tr>`;
          })
          .join("");

        html = registerHtml(
          "Current Shareholder Register",
          client,
          `<table>
            <colgroup>
              <col style="width:17%" />
              <col style="width:13%" />
              <col style="width:34%" />
              <col style="width:16%" />
              <col style="width:10%" />
              <col style="width:10%" />
            </colgroup>
            <thead><tr><th>Shareholder</th><th>ID / Registration</th><th>Registered / Residential Address</th><th>Class</th><th>Current Shares</th><th>% of Issued</th></tr></thead>
            <tbody>${liveRows || '<tr><td colspan="6">No current holdings recorded.</td></tr>'}</tbody>
          </table>`
        );
        fileName = `${fileSafe(client.client_name)}-Current-Shareholder-Register.pdf`;
      }
    } else if (documentType === "bo-mandate") {
      const [{ data: transactions }, { data: shareholders }, { data: classes }, { data: savedBoOwners }, { data: directors }] = await Promise.all([
        supabase.from("secretarial_share_transactions").select("transaction_type, number_of_shares, shareholder_id, share_class_id, transaction_date").eq("client_id", clientId).order("transaction_date", { ascending: true }),
        supabase.from("secretarial_shareholders").select("id, full_legal_name, id_registration_number, holder_type, email, phone").eq("client_id", clientId),
        supabase.from("secretarial_share_classes").select("id, class_name").eq("client_id", clientId),
        supabase.from("secretarial_beneficial_owners").select("full_legal_name, id_registration_number, ownership_percentage, ownership_type, linked_shareholder_id, nature_of_interest, effective_from").eq("client_id", clientId).eq("is_active", true).eq("owner_type", "individual"),
        supabase.from("crm_client_directors").select("director_name, id_passport_number, email, phone, director_capacity, is_active, appointment_date").eq("client_id", clientId).eq("is_active", true).order("appointment_date", { ascending: true }),
      ]);

      const holderMap = new Map((shareholders || []).map((row: any) => [row.id, row]));
      const classMap = new Map((classes || []).map((row: any) => [row.id, row]));
      const balances = new Map<string, { shares: number; effective: string | null }>();

      for (const row of transactions || []) {
        const key = `${row.shareholder_id}:${row.share_class_id}`;
        const qty = Number(row.number_of_shares || 0);
        const type = String(row.transaction_type || "");
        const signed = ["issue", "transfer_in"].includes(type) ? qty : ["transfer_out", "redemption", "repurchase", "cancellation"].includes(type) ? -qty : 0;
        const current = balances.get(key) || { shares: 0, effective: row.transaction_date || null };
        current.shares += signed;
        if (!current.effective && row.transaction_date) current.effective = row.transaction_date;
        balances.set(key, current);
      }

      const totalIssued = Array.from(balances.values()).reduce((sum, row) => sum + Math.max(0, row.shares), 0);

      const directRows = Array.from(balances.entries())
        .filter(([key, row]) => {
          if (row.shares <= 0) return false;
          const holder = holderMap.get(key.split(":")[0]);
          return String(holder?.holder_type || "individual").toLowerCase() === "individual";
        })
        .map(([key, row]) => {
          const [holderId, classId] = key.split(":");
          const holder = holderMap.get(holderId);
          const shareClass = classMap.get(classId);
          return { name: holder?.full_legal_name || "", idNumber: holder?.id_registration_number || "", interest: `Direct shareholding · ${shareClass?.class_name || "Shares"}`, percentage: totalIssued > 0 ? (row.shares / totalIssued) * 100 : 0, effective: row.effective };
        });

      const indirectRows = (savedBoOwners || []).filter((row: any) => !row.linked_shareholder_id).map((row: any) => ({
        name: row.full_legal_name || "",
        idNumber: row.id_registration_number || "",
        interest: String(row.nature_of_interest || row.ownership_type || "indirect").replaceAll("_", " "),
        percentage: row.ownership_percentage == null ? null : Number(row.ownership_percentage),
        effective: row.effective_from || null,
      }));

      const allOwners = [...directRows, ...indirectRows];
      const rows = allOwners.map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.idNumber)}</td><td>${esc(row.interest)}</td><td>${row.percentage == null ? "—" : `${row.percentage.toFixed(2)}%`}</td><td>${dateText(row.effective)}</td></tr>`).join("");
      const signatory = (directors || [])[0] || null;

      html = baseHtml(
        "Mandate to Lodge Beneficial Ownership",
        client,
        `<div class="mandate-body">
        <p>${dateText(new Date().toISOString())}</p>
        <div class="entity-emphasis">${esc(client.client_name)}${client.registration_number ? ` · ${esc(client.registration_number)}` : ""}</div>
        <p class="subject">MANDATE AND AUTHORITY TO LODGE BENEFICIAL OWNERSHIP INFORMATION</p>
        <p><strong>To whom it may concern,</strong></p>
        <p>I, the undersigned authorised representative of <strong>${esc(client.client_name)}</strong>, confirm that I am duly authorised to act for the company and that the beneficial ownership information reflected in this document is, to the best of my knowledge and belief, complete, accurate and current.</p>
        <p>I authorise the company's appointed accounting / secretarial representative to prepare, lodge and submit the beneficial ownership declaration and the applicable securities register or beneficial interest register to the Companies and Intellectual Property Commission, and to respond to reasonable filing queries relating to that submission.</p>
        <p>I acknowledge the company's responsibility to ensure that its beneficial ownership information is maintained accurately and updated when the underlying ownership or control position changes.</p>
        <h2>Natural-Person Beneficial Ownership Position</h2>
        <table><thead><tr><th>Name</th><th>ID / Passport</th><th>Nature of Interest</th><th>%</th><th>Effective</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No natural-person beneficial owner has been identified.</td></tr>'}</tbody></table>
        <h2>Authorised Client Signatory</h2>
        <table><tr><td class="label">Full name</td><td>${esc(signatory?.director_name || "")}</td></tr><tr><td class="label">ID / Passport number</td><td>${esc(signatory?.id_passport_number || "")}</td></tr><tr><td class="label">Capacity</td><td>${esc(signatory?.director_capacity || "Director")}</td></tr><tr><td class="label">Email</td><td>${esc(signatory?.email || "")}</td></tr><tr><td class="label">Telephone</td><td>${esc(signatory?.phone || "")}</td></tr></table>
        <p>This authority remains valid until revoked in writing by the company or replaced by a subsequent mandate.</p>
        <div class="signature-grid"><div class="sig"><strong>Authorised client representative</strong><br/><br/>Name:<br/>________________________________________<br/><br/>Capacity:<br/>________________________________________</div><div class="sig"><strong>Signature and date</strong><br/><br/>Signature:<br/>________________________________________<br/><br/>Date:<br/>________________________________________</div></div>
        </div>`
      );
      fileName = `${fileSafe(client.client_name)}-Mandate-to-Lodge-Beneficial-Ownership.pdf`;
    } else if (documentType === "annual-return-authority") {
      let query = supabase
        .from("secretarial_annual_returns")
        .select(
          "id, return_year, annual_turnover, annual_return_fee, penalty_amount, due_date, beneficial_ownership_status, financial_submission_type, financial_submission_status, return_status, cipc_reference"
        )
        .eq("client_id", clientId)
        .order("return_year", { ascending: false });

      if (sourceId) query = query.eq("id", sourceId);

      const { data: annual, error } = sourceId
        ? await query.single()
        : await query.limit(1).single();

      if (error || !annual) {
        throw new Error(
          "Save the Annual Return turnover and control record before generating the client authority."
        );
      }

      const total =
        Number(annual.annual_return_fee || 0) +
        Number(annual.penalty_amount || 0);

      html = baseHtml(
        `Annual Return Filing Authority - ${annual.return_year}`,
        client,
        `
        <div class="ar-authority">
        <div class="green">
          Client authority to proceed with the company's CIPC Annual Return filing for the ${esc(annual.return_year)} return year.
        </div>

        <h2>Information confirmed by the client</h2>
        <table>
          <tr><td class="label">Return year</td><td>${esc(annual.return_year)}</td></tr>
          <tr><td class="label">Filing deadline</td><td>${dateText(annual.due_date)}</td></tr>
          <tr><td class="label">Annual turnover</td><td><strong>${money(annual.annual_turnover)}</strong></td></tr>
          <tr><td class="label">Turnover source</td><td>Latest approved financial statements supplied / approved by the client</td></tr>
          <tr><td class="label">CIPC filing fee</td><td>${money(annual.annual_return_fee)}</td></tr>
          <tr><td class="label">Late amount</td><td>${money(annual.penalty_amount)}</td></tr>
          <tr><td class="label"><strong>Total payable to CIPC</strong></td><td><strong>${money(total)}</strong></td></tr>
          <tr><td class="label">Beneficial Ownership position</td><td>${esc(String(annual.beneficial_ownership_status || "").replaceAll("_", " "))}</td></tr>
          <tr><td class="label">AFS / FAS route</td><td>${esc(annual.financial_submission_type || "")} - ${esc(String(annual.financial_submission_status || "").replaceAll("_", " "))}</td></tr>
        </table>

        <h2>Authority</h2>
        <p>I confirm that the annual turnover and other information reflected above are complete and correct to the best of my knowledge and are based on the latest approved financial information made available by the company.</p>
        <p>I hereby authorise the company's appointed accounting / secretarial representative to prepare, submit and lodge the Annual Return with the Companies and Intellectual Property Commission (CIPC), together with the Beneficial Ownership information and the applicable AFS/FAS submission where required.</p>
        <p>I further authorise payment of the CIPC filing amount reflected above from funds made available by or on behalf of the company for this purpose, and authorise the representative to respond to reasonable CIPC queries arising directly from the filing.</p>
        <p>I acknowledge that the company remains responsible for the accuracy and completeness of the information supplied and for notifying its representative of any material change before submission.</p>

        <div class="signature-grid">
          <div class="sig">
            <strong>Authorised client signatory</strong><br/><br/>
            Name:<br/>________________________________________<br/><br/>
            Capacity:<br/>________________________________________
          </div>
          <div class="sig">
            <strong>Signature and date</strong><br/><br/>
            Signature:<br/>________________________________________<br/><br/>
            Date:<br/>________________________________________
          </div>
        </div>
        </div>`
      );

      fileName = `${fileSafe(client.client_name)}-Annual-Return-Authority-${annual.return_year}.pdf`;
    } else {
      throw new Error("This Secretarial document type is not supported yet.");
    }

    const browser = await launchBrowser();

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });

      const pdf = await page.pdf({
        format: "A4",
        landscape: documentType === "share-certificate",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        displayHeaderFooter: false,
      });

      const pdfBytes = new Uint8Array(pdf);

      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Secretarial PDF render failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate the Secretarial PDF.",
      },
      { status: 500 }
    );
  }
}
