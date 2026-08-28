import { NextResponse } from "next/server";
import fs from "fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Number.isFinite(amount) ? amount : 0)
    .replace(/\u00a0/g, " ");
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const contentType = req.headers.get("content-type") || "";

    let body: any;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const payload = String(formData.get("payload") || "{}");
      body = JSON.parse(payload);
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const payload = String(formData.get("payload") || "{}");
      body = JSON.parse(payload);
    } else {
      body = await req.json();
    }

    const {
      clientName,
      registrationNumber,
      taxYear,
      provisionalPeriod,
      dueDate,
      basisLabel,
      basicTaxableIncome,
      basicPayment,
      currentTaxableIncome,
      currentPayment,
      projectedTaxableIncome,
      projectedPayment,
      recommendedTaxableIncome,
      recommendedPayment,
      adviserNote,
      approvalStatus,
      approvedByName,
      approvedAt,
      authorisedPersonName,
      authorisedPersonCapacity,
      firmSettings,
    } = body;

    if (!clientName) {
      return NextResponse.json(
        { success: false, error: "Client name is required." },
        { status: 400 }
      );
    }

    const approvalText =
      approvalStatus === "approved"
        ? `Approved${approvedByName ? ` by ${esc(approvedByName)}` : ""}${
            approvedAt
              ? ` on ${new Date(approvedAt).toLocaleDateString("en-ZA")}`
              : ""
          }`
        : approvalStatus === "query"
          ? "Client query raised"
          : "Pending client approval";

    const firmName = esc(
      firmSettings?.trading_name || firmSettings?.firm_name || "Bizzacc"
    );
    const logoUrl = esc(firmSettings?.logo_url || "");
    const addressLines = esc(firmSettings?.address_lines || "").replace(/\n/g, "<br />");
    const firmContact = [
      firmSettings?.telephone,
      firmSettings?.email,
      firmSettings?.website,
    ]
      .filter(Boolean)
      .map(esc)
      .join(" | ");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 14mm 17mm 15mm; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
    background: #ffffff;
    font-size: 11.2px;
    line-height: 1.42;
  }

  .page {
    min-height: 266mm;
    position: relative;
    padding-bottom: 15mm;
  }

  .letterhead {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    align-items: start;
    padding-bottom: 12px;
    border-bottom: 2px solid #17263a;
  }

  .brand-side {
    min-width: 0;
  }

  .logo {
    display: block;
    max-width: 205px;
    max-height: 72px;
    object-fit: contain;
    object-position: left top;
  }

  .firm-name {
    font-size: 22px;
    font-weight: 900;
    color: #17263a;
  }

  .contact-side {
    text-align: right;
    color: #536171;
    font-size: 9.5px;
    line-height: 1.5;
  }

  .contact-side strong {
    display: block;
    margin-bottom: 2px;
    color: #17263a;
    font-size: 10.5px;
  }

  .doc-banner {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 20px;
    align-items: end;
    padding: 15px 0 10px;
  }

  h1 {
    margin: 0;
    color: #17263a;
    font-size: 25px;
    line-height: 1.08;
    font-weight: 800;
  }

  .subheading {
    margin-top: 4px;
    color: #667085;
    font-size: 10.2px;
  }

  .doc-meta {
    text-align: right;
    color: #536171;
    font-size: 9.5px;
    line-height: 1.45;
  }

  .doc-meta strong {
    display: block;
    color: #17263a;
    font-size: 10.5px;
  }

  .details {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    border-top: 1px solid #d8dde1;
  }

  .details td {
    padding: 5px 3px;
    border-bottom: 1px solid #e5e7eb;
  }

  .details .label {
    width: 165px;
    color: #667085;
    font-size: 9.4px;
    font-weight: 700;
  }

  .details .value {
    color: #17263a;
    font-size: 10.8px;
    font-weight: 700;
  }

  .intro {
    margin: 0 0 13px;
    color: #344054;
    font-size: 10.7px;
  }

  .section-title {
    margin: 14px 0 6px;
    color: #17263a;
    font-size: 13px;
    font-weight: 800;
  }

  .calc {
    width: 100%;
    border-collapse: collapse;
    border-top: 1.7px solid #17263a;
    border-bottom: 1.7px solid #17263a;
  }

  .calc td {
    padding: 6px 8px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
    font-size: 10.6px;
  }

  .calc td.amount {
    width: 200px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .calc tr.rule td {
    border-top: 1px solid #98a2b3;
    font-weight: 700;
  }

  .calc tr.total td {
    border-top: 2px solid #17263a;
    border-bottom: 0;
    padding-top: 8px;
    padding-bottom: 8px;
    font-size: 11.6px;
    font-weight: 900;
  }

  .basis {
    color: #344054;
    font-size: 10.4px;
  }

  .adviser-note {
    margin-top: 5px;
    padding: 7px 10px;
    border-left: 3px solid #98a2b3;
    background: #fafafa;
    color: #344054;
    font-size: 10.2px;
  }

  .approval {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1.5px solid #17263a;
  }

  .approval-title {
    font-size: 13px;
    font-weight: 800;
    color: #17263a;
  }

  .approval-text {
    margin-top: 5px;
    color: #344054;
    font-size: 10.2px;
  }

  .signature-grid,
  .name-grid {
    display: grid;
    grid-template-columns: 1.45fr .75fr;
    gap: 28px;
  }

  .signature-grid {
    margin-top: 18px;
  }

  .name-grid {
    margin-top: 10px;
  }

  .signature-line {
    height: 34px;
    border-bottom: 1px solid #17263a;
  }

  .short-line {
    min-height: 24px;
    border-bottom: 1px solid #98a2b3;
    display: flex;
    align-items: flex-end;
    padding: 0 2px 3px;
    color: #17263a;
    font-size: 10px;
    font-weight: 700;
  }

  .signature-label {
    margin-top: 4px;
    color: #667085;
    font-size: 8.8px;
  }

  .disclaimer {
    margin-top: 11px;
    padding-top: 7px;
    border-top: 1px solid #e0e4e7;
    color: #667085;
    font-size: 8.8px;
    line-height: 1.42;
  }

  .footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding-top: 8px;
    border-top: 1px solid #d9dee2;
    display: flex;
    justify-content: space-between;
    gap: 18px;
    color: #7a8491;
    font-size: 8.2px;
  }
</style>
</head>
<body>
<div class="page">
  <div class="letterhead">
    <div class="brand-side">
      ${
        logoUrl
          ? `<img src="${logoUrl}" class="logo" alt="${firmName} logo" />`
          : `<div class="firm-name">${firmName}</div>`
      }
    </div>

    <div class="contact-side">
      <strong>${firmName}</strong>
      ${addressLines}
      ${addressLines && firmContact ? "<br />" : ""}
      ${firmContact}
    </div>
  </div>

  <div class="doc-banner">
    <div>
      <h1>Provisional Tax Recommendation</h1>
      <div class="subheading">Prepared for client review and approval</div>
    </div>

    <div class="doc-meta">
      <strong>PROVISIONAL TAX</strong>
      Tax year: ${esc(taxYear)}<br />
      Period: ${esc(provisionalPeriod || "First Provisional")}
    </div>
  </div>

  <table class="details">
    <tr>
      <td class="label">Taxpayer</td>
      <td class="value">${esc(clientName)}</td>
    </tr>
    <tr>
      <td class="label">Registration number</td>
      <td class="value">${esc(registrationNumber || "-")}</td>
    </tr>
    <tr>
      <td class="label">Tax year</td>
      <td class="value">${esc(taxYear)}</td>
    </tr>
    <tr>
      <td class="label">Provisional period</td>
      <td class="value">${esc(provisionalPeriod || "First Provisional")}</td>
    </tr>
    <tr>
      <td class="label">Payment due date</td>
      <td class="value">${esc(dueDate || "-")}</td>
    </tr>
  </table>

  <p class="intro">
    Based on the information made available to us, we recommend that the provisional
    tax estimate for the above period be submitted on the following basis:
  </p>

  <div class="section-title">Provisional tax calculation</div>

  <table class="calc">
    <tr>
      <td>Estimated taxable income</td>
      <td class="amount">R ${money(recommendedTaxableIncome)}</td>
    </tr>
    <tr>
      <td>Tax on estimated taxable income at 27%</td>
      <td class="amount">R ${money(Number(recommendedTaxableIncome || 0) * 0.27)}</td>
    </tr>
    <tr class="rule">
      <td>Estimated tax liability for the full year</td>
      <td class="amount">R ${money(Number(recommendedTaxableIncome || 0) * 0.27)}</td>
    </tr>
    <tr>
      <td>First provisional period: 50% of full-year tax</td>
      <td class="amount">R ${money(recommendedPayment)}</td>
    </tr>
    <tr>
      <td>Less: Employees' tax / PAYE credits</td>
      <td class="amount">R 0.00</td>
    </tr>
    <tr>
      <td>Less: Foreign tax credits</td>
      <td class="amount">R 0.00</td>
    </tr>
    <tr class="total">
      <td>Total provisional tax payable</td>
      <td class="amount">R ${money(recommendedPayment)}</td>
    </tr>
  </table>

  <div class="section-title">Basis of estimate</div>
  <div class="basis">
    The estimate takes into account the latest assessed taxable income, current
    year-to-date results, anticipated trading performance for the remainder of the
    year and known or expected year-end and tax adjustments.
  </div>

  ${
    adviserNote
      ? `<div class="section-title">Adviser note</div>
         <div class="adviser-note">${esc(adviserNote)}</div>`
      : ""
  }

  <div class="approval">
    <div class="approval-title">Client approval</div>
    <div class="approval-text">
      I confirm that I have reviewed this provisional tax recommendation and approve
      the estimated taxable income and provisional tax payment reflected above for
      purposes of preparing and submitting the provisional tax return.
    </div>

    <div class="signature-grid">
      <div>
        <div class="signature-line"></div>
        <div class="signature-label">Signature of authorised person</div>
      </div>
      <div>
        <div class="signature-line"></div>
        <div class="signature-label">Date</div>
      </div>
    </div>

    <div class="name-grid">
      <div>
        <div class="short-line">${esc(authorisedPersonName || "")}</div>
        <div class="signature-label">Full name</div>
      </div>
      <div>
        <div class="short-line">${esc(authorisedPersonCapacity || "")}</div>
        <div class="signature-label">Capacity</div>
      </div>
    </div>
  </div>

  <div class="disclaimer">
    This recommendation is based on information available at the date of preparation
    and is not a final income tax assessment. The final tax liability may differ when
    the annual income tax return is prepared or if the taxpayer's circumstances change.
  </div>

  <div class="footer">
    <span>${firmName}</span>
    <span>Prepared using PracticePilot</span>
  </div>
</div>
</body>
</html>`;

    const localChromeCandidates = [
      process.env.CHROME_EXECUTABLE_PATH,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ].filter(Boolean) as string[];

    const localExecutablePath =
      localChromeCandidates.find((candidate) => fs.existsSync(candidate)) || null;

    const isVercel = Boolean(process.env.VERCEL);

    const executablePath = isVercel
      ? await chromium.executablePath()
      : localExecutablePath || (await chromium.executablePath());

    const launchArgs = isVercel
      ? chromium.args
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ];

    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: { width: 1200, height: 1600 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    const filename = safeFilename(
      `${clientName} - ${taxYear} First Provisional Tax Recommendation.pdf`
    );

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("PROVISIONAL TAX CLIENT SUMMARY PDF ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to generate client summary PDF.",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
