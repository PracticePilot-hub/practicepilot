// Path: app/api/engagements/[id]/export-pdf/route.ts

import fs from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserProfile = {
  id: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing server Supabase service role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getEngagementId(context: any) {
  const params = await context.params;
  return String(params?.id || "");
}

function bearer(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function globalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function moneyZA(value: unknown) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(money(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date =
    value.length === 10
      ? new Date(`${value}T00:00:00`)
      : new Date(value);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function filenameSafe(value: string) {
  return value
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
}

function scopeText(service: any) {
  const quantity =
    service.scope_quantity === null || service.scope_quantity === undefined
      ? ""
      : String(service.scope_quantity);

  const unit = String(service.scope_unit || "").trim();

  if (!quantity && !unit) return "";
  if (!quantity) return unit;
  if (!unit) return quantity;
  return `${quantity} ${unit}`;
}

function pageHeader(engagement: any, section: string) {
  return `
    <header class="page-header">
      <div>
        <strong>${escapeHtml(engagement.engagement_number)}</strong>
        <span>${escapeHtml(engagement.client_name)}</span>
      </div>
      <span>${escapeHtml(section)}</span>
    </header>
  `;
}

function pageFooter(_engagement?: any) {
  return "";
}


function serviceWeight(service: any) {
  const text = `${service.service_name || ""} ${service.description || ""} ${service.client_facing_note || ""} ${scopeText(service)}`;
  return 220 + Math.min(520, text.length * 0.32);
}

function clauseWeight(clause: any) {
  const text = `${clause.title || ""} ${clause.body || ""}`;
  return 260 + Math.min(760, text.length * 0.38);
}

function paginateServices(grouped: Map<string, any[]>) {
  const pages: Array<Array<{ category: string; services: any[] }>> = [];
  let current: Array<{ category: string; services: any[] }> = [];
  let used = 0;
  let firstPage = true;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
    firstPage = false;
  };

  for (const [category, services] of grouped.entries()) {
    let currentGroup: { category: string; services: any[] } | null = null;

    for (const service of services) {
      const capacity = firstPage ? 1680 : 2050;
      const categoryCost = currentGroup ? 0 : 150;
      const weight = serviceWeight(service) + categoryCost;

      if (current.length && used + weight > capacity) {
        flush();
        currentGroup = null;
      }

      if (!currentGroup) {
        currentGroup = { category, services: [] };
        current.push(currentGroup);
        used += 150;
      }

      currentGroup.services.push(service);
      used += serviceWeight(service);
    }
  }

  flush();
  return pages;
}

function paginateClauses(clauses: any[]) {
  const pages: any[][] = [];
  let current: any[] = [];
  let used = 0;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };

  clauses.forEach((clause, index) => {
    const capacity = pages.length === 0 ? 2050 : 2380;
    const weight = clauseWeight(clause);

    // Never allow more than five legal clauses on a physical page.
    if (current.length && (used + weight > capacity || current.length >= 5)) {
      flush();
    }

    current.push({ ...clause, displayNumber: index + 1 });
    used += weight;
  });

  flush();
  return pages;
}

function buildHtml(args: {
  engagement: any;
  services: any[];
  clauses: any[];
  billing: any[];
}) {
  const { engagement, services, clauses, billing } = args;

  const vatRate = money(engagement.vat_rate);
  const monthlyExVat = engagement.fee_is_exclusive_vat
    ? money(engagement.monthly_fee)
    : money(engagement.monthly_fee) / (1 + vatRate);

  const monthlyVat = monthlyExVat * vatRate;
  const monthlyIncVat = monthlyExVat + monthlyVat;

  const totalExVat = billing.reduce(
    (sum, row) => sum + money(row.amount_ex_vat),
    0
  );

  const totalIncVat = billing.reduce(
    (sum, row) => sum + money(row.amount_inc_vat),
    0
  );

  const grouped = new Map<string, any[]>();

  for (const service of services) {
    const category = service.category || "Other Services";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(service);
  }

  const servicePages = paginateServices(grouped);

  const servicePagesHtml = servicePages
    .map((groups, pageIndex) => {
      const groupsHtml = groups
        .map(({ category, services: rows }) => {
          const items = rows
            .map((service) => {
              const scope = scopeText(service);

              return `
                <article class="service-item">
                  <div class="service-heading">
                    <strong>${escapeHtml(service.service_name)}</strong>
                    <span class="included-badge">INCLUDED</span>
                  </div>

                  ${
                    service.description
                      ? `<p class="service-description">${escapeHtml(
                          service.description
                        )}</p>`
                      : ""
                  }

                  ${
                    scope || service.client_facing_note
                      ? `
                        <div class="scope-box">
                          ${
                            scope
                              ? `<span><strong>Scope:</strong> ${escapeHtml(
                                  scope
                                )}</span>`
                              : ""
                          }
                          ${
                            service.client_facing_note
                              ? `<span>${escapeHtml(
                                  service.client_facing_note
                                )}</span>`
                              : ""
                          }
                        </div>
                      `
                      : ""
                  }
                </article>
              `;
            })
            .join("");

          return `
            <section class="service-category">
              <h3>${escapeHtml(category)}</h3>
              ${items}
            </section>
          `;
        })
        .join("");

      return `
        <section class="page">
          ${pageHeader(engagement, "Scope of services")}
          <div class="page-content">
            ${
              pageIndex === 0
                ? `<p class="section-kicker">SCOPE OF SERVICES</p><h2 class="section-title">Services included</h2>`
                : `<p class="continuation-label">SCOPE OF SERVICES · CONTINUED</p>`
            }
            ${groupsHtml}
          </div>
        </section>
      `;
    })
    .join("");

  const billingHtml = billing
    .map(
      (row) => `
        <div class="billing-row">
          <span>${row.sequence_no}</span>
          <strong>${escapeHtml(monthLabel(row.service_period_start))}</strong>
          <span>${escapeHtml(formatDate(row.invoice_date))}</span>
          <span>${escapeHtml(formatDate(row.payment_due_date))}</span>
          <span class="money">${escapeHtml(moneyZA(row.amount_ex_vat))}</span>
          <strong class="money">${escapeHtml(moneyZA(row.amount_inc_vat))}</strong>
        </div>
      `
    )
    .join("");

  const clausePages = paginateClauses(clauses);

  const clausePagesHtml = clausePages
    .map((pageClauses, pageIndex) => {
      const items = pageClauses
        .map(
          (clause: any) => `
            <article class="clause-block">
              <div class="clause-heading">
                <span class="clause-number">${clause.displayNumber}</span>
                <div>
                  <p class="clause-category">${escapeHtml(clause.category)}</p>
                  <h3>${escapeHtml(clause.title)}</h3>
                </div>
              </div>
              <p class="clause-body">${escapeHtml(clause.body)}</p>
            </article>
          `
        )
        .join("");

      return `
        <section class="page legal-page">
          ${pageHeader(engagement, "Terms of engagement")}
          <div class="page-content legal-content">
            ${
              pageIndex === 0
                ? `<p class="section-kicker">TERMS OF ENGAGEMENT</p><h2 class="section-title">Legal terms</h2>`
                : `<p class="continuation-label">TERMS OF ENGAGEMENT · CONTINUED</p>`
            }
            ${items}
          </div>
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(engagement.engagement_number)} - Engagement Letter</title>
<style>
  @page {
    size: A4 portrait;
    margin: 0 16mm 0 16mm;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1f2937;
    font-family: "Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-size: 9.5pt;
    line-height: 1.5;
  }

  h1, h2, h3,
  .brand-word,
  .section-kicker,
  .cover-kicker,
  .clause-category {
    font-family: "Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
    font-weight: 700;
  }

  .page,
  .cover-page {
    width: 100%;
    background: #ffffff;
    break-after: page;
    page-break-after: always;
  }

  .page {
    min-height: calc(297mm - 33mm);
    display: flex;
    flex-direction: column;
  }

  .cover-page {
    min-height: calc(297mm - 33mm);
    display: flex;
    flex-direction: column;
  }

  .cover-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1.6px solid #244b63;
    padding-bottom: 7mm;
  }

  .brand-word {
    font-size: 26pt;
    line-height: 1;
    font-weight: 700;
    color: #183f56;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  .brand-descriptor {
    padding-top: 1.5mm;
    font-size: 7pt;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.07em;
  }

  .cover-body {
    flex: 1;
    padding-top: 34mm;
    max-width: 155mm;
  }

  .cover-kicker,
  .section-kicker {
    margin: 0 0 2.5mm;
    font-size: 8.2pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #64748b;
    text-transform: uppercase;
  }

  .cover-title {
    margin: 4mm 0 3mm;
    font-size: 28pt;
    line-height: 1.08;
    font-weight: 700;
    color: #183f56;
    letter-spacing: -0.01em;
  }

  .cover-rule {
    width: 34mm;
    height: 2px;
    background: #183f56;
    margin-bottom: 13mm;
  }

  .cover-details {
    display: grid;
    gap: 4mm;
  }

  .cover-detail-row {
    display: grid;
    grid-template-columns: 42mm 1fr;
    gap: 7mm;
    font-size: 9pt;
  }

  .cover-detail-row span {
    color: #64748b;
  }

  .page-header {
    margin-top: 5mm;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 3.5mm;
    border-bottom: 0.7px solid #cbd5e1;
    font-size: 8pt;
    color: #64748b;
  }

  .page-header > div {
    display: flex;
    gap: 4mm;
  }

  .page-content {
    flex: 1;
    padding-top: 10mm;
  }

  .continuation-label {
    margin: 0 0 5mm;
    font-family: "Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.10em;
    color: #64748b;
    text-transform: uppercase;
  }

  .section-title {
    margin: 0 0 6mm;
    font-size: 19pt;
    font-weight: 700;
    color: #244b63;
    letter-spacing: -0.01em;
  }

  .body-text {
    margin: 0 0 8mm;
    font-size: 9.8pt;
    line-height: 1.65;
    color: #475569;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border: 0.7px solid #dbe3ef;
    margin-bottom: 7mm;
  }

  .summary-cell {
    min-height: 18mm;
    padding: 4mm;
    border-right: 0.7px solid #dbe3ef;
    border-bottom: 0.7px solid #dbe3ef;
    display: grid;
    gap: 1.5mm;
    font-size: 9pt;
  }

  .summary-cell span {
    color: #64748b;
    font-size: 7.8pt;
  }

  .fee-box {
    padding: 6mm;
    background: #183f56;
    color: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10mm;
    margin-bottom: 7mm;
  }

  .fee-label {
    display: block;
    font-size: 7.8pt;
    letter-spacing: 0.07em;
  }

  .fee-amount {
    display: block;
    margin: 1.5mm 0;
    font-size: 19pt;
  }

  .fee-sub {
    font-size: 7.8pt;
  }

  .fee-right {
    display: grid;
    gap: 2.5mm;
    font-size: 8.7pt;
  }

  .info-box,
  .special-box {
    padding: 4.5mm;
    background: #f8fafc;
    border: 0.7px solid #dbe3ef;
    font-size: 8.8pt;
    line-height: 1.55;
    color: #475569;
    margin-bottom: 5mm;
  }

  .special-box {
    border-left: 2px solid #244b63;
  }

  .service-category {
    margin-bottom: 4.5mm;
    break-inside: auto;
  }

  .service-category h3 {
    margin: 0 0 2mm;
    padding: 2.4mm 4mm;
    background: #183f56;
    color: #ffffff;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    break-after: avoid;
    page-break-after: avoid;
  }

  .service-item {
    padding: 3mm 4mm;
    border-bottom: 0.7px solid #dbe3ef;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .service-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 9.2pt;
  }

  .included-badge {
    padding: 1.2mm 2.2mm;
    background: #eef3f6;
    color: #244b63;
    font-size: 6.8pt;
    font-weight: 800;
  }

  .service-description {
    margin: 1.4mm 0 0;
    font-size: 8.1pt;
    line-height: 1.4;
    color: #64748b;
  }

  .scope-box {
    margin-top: 2mm;
    padding: 2.4mm;
    display: grid;
    gap: 1.2mm;
    background: #f8fafc;
    font-size: 7.8pt;
    color: #475569;
  }

  .billing-header,
  .billing-row,
  .billing-total {
    display: grid;
    grid-template-columns: 8mm 1.3fr 28mm 30mm 25mm 25mm;
    gap: 2mm;
    align-items: center;
    padding: 0 2mm;
  }

  .billing-header {
    min-height: 9mm;
    background: #eef2f7;
    border-bottom: 0.7px solid #cbd5e1;
    font-size: 7pt;
    font-weight: 800;
    text-transform: uppercase;
  }

  .billing-row {
    min-height: 9mm;
    border-bottom: 0.7px solid #e2e8f0;
    font-size: 7.8pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .billing-total {
    min-height: 10mm;
    background: #f8fafc;
    border-top: 0.8px solid #94a3b8;
    font-size: 7.8pt;
  }

  .money {
    text-align: right;
  }

  .legal-content {
    padding-top: 10mm;
  }

  .clause-block {
    margin-bottom: 4.5mm;
    padding-bottom: 4.2mm;
    border-bottom: 0.7px solid #e2e8f0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .clause-heading {
    display: grid;
    grid-template-columns: 10mm 1fr;
    gap: 3.5mm;
    align-items: start;
    margin-bottom: 2mm;
  }

  .clause-number {
    width: 8mm;
    height: 8mm;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #183f56;
    color: #ffffff;
    font-size: 7pt;
    font-weight: 800;
  }

  .clause-category {
    margin: 0 0 0.8mm;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #64748b;
    text-transform: uppercase;
  }

  .clause-heading h3 {
    margin: 0;
    font-size: 11.3pt;
    font-weight: 700;
    color: #244b63;
  }

  .clause-body {
    margin: 0;
    font-size: 8.8pt;
    line-height: 1.45;
    color: #374151;
    white-space: pre-wrap;
  }

  .legal-content {
    padding-bottom: 4mm;
  }

  .signature-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 11mm 10mm;
    margin: 14mm 0 17mm;
  }

  .signature-field {
    display: grid;
    gap: 7mm;
    font-size: 8.5pt;
    color: #64748b;
  }

  .signature-line {
    border-bottom: 0.8px solid #475569;
    min-height: 7mm;
  }

  .practitioner-box {
    padding: 6mm;
    background: #183f56;
    color: #ffffff;
    display: grid;
    gap: 1.5mm;
    text-align: center;
    font-size: 8.5pt;
  }

  .template-version {
    margin-top: 5mm;
    text-align: center;
    font-size: 7.5pt;
    color: #94a3b8;
  }
</style>
</head>
<body>

<section class="cover-page">
  <div class="cover-top">
    <div class="brand-word">BIZZACC</div>
    <div class="brand-descriptor">ACCOUNTING · CONSULTING · TAXATION</div>
  </div>

  <div class="cover-body">
    <p class="cover-kicker">CLIENT ENGAGEMENT</p>
    <h1 class="cover-title">Engagement Letter</h1>
    <div class="cover-rule"></div>

    <div class="cover-details">
      <div class="cover-detail-row">
        <span>Prepared for</span>
        <strong>${escapeHtml(engagement.client_name)}</strong>
      </div>

      ${
        engagement.client_registration_number
          ? `
            <div class="cover-detail-row">
              <span>Registration number</span>
              <strong>${escapeHtml(
                engagement.client_registration_number
              )}</strong>
            </div>
          `
          : ""
      }

      <div class="cover-detail-row">
        <span>Contact</span>
        <strong>${escapeHtml(engagement.contact_name || "-")}</strong>
      </div>

      <div class="cover-detail-row">
        <span>Engagement</span>
        <strong>${escapeHtml(engagement.engagement_number)}</strong>
      </div>

      <div class="cover-detail-row">
        <span>Contract period</span>
        <strong>${escapeHtml(
          `${formatDate(engagement.contract_start_date)} – ${formatDate(
            engagement.contract_end_date
          )}`
        )}</strong>
      </div>
    </div>
  </div>

</section>

<section class="page">
  ${pageHeader(engagement, "Engagement overview")}

  <div class="page-content">
    <p class="section-kicker">WELCOME</p>
    <h2 class="section-title">Our engagement</h2>

    <p class="body-text">
      Thank you for appointing Bizzacc Menlyn (Pty) Ltd. This engagement records
      the professional services, responsibilities, fees, billing arrangements
      and legal terms applicable to our appointment.
    </p>

    <div class="summary-grid">
      <div class="summary-cell">
        <span>Contract start</span>
        <strong>${escapeHtml(formatDate(engagement.contract_start_date))}</strong>
      </div>
      <div class="summary-cell">
        <span>Contract end</span>
        <strong>${escapeHtml(formatDate(engagement.contract_end_date))}</strong>
      </div>
      <div class="summary-cell">
        <span>Contract term</span>
        <strong>${escapeHtml(`${engagement.contract_months} months`)}</strong>
      </div>
      <div class="summary-cell">
        <span>Renewal</span>
        <strong>${escapeHtml(engagement.renewal_method)}</strong>
      </div>
    </div>

    <div class="fee-box">
      <div>
        <span class="fee-label">MONTHLY PROFESSIONAL FEE</span>
        <strong class="fee-amount">${escapeHtml(moneyZA(monthlyExVat))}</strong>
        <span class="fee-sub">Excluding VAT</span>
      </div>

      <div class="fee-right">
        <span>VAT <strong>${escapeHtml(moneyZA(monthlyVat))}</strong></span>
        <span>Monthly total including VAT <strong>${escapeHtml(
          moneyZA(monthlyIncVat)
        )}</strong></span>
      </div>
    </div>

    <div class="info-box">
      <strong>Billing arrangement</strong>
      <p>
        Recurring monthly services are invoiced on the
        <strong>${escapeHtml(engagement.billing_day)}th</strong> of the month
        preceding the service month. Payment must reflect as cleared funds in
        Bizzacc's bank account on or before the
        <strong>${escapeHtml(engagement.payment_due_day)}st</strong> of the
        service month.
      </p>
    </div>

    ${
      engagement.special_terms
        ? `
          <div class="special-box">
            <strong>Special terms</strong>
            <p>${escapeHtml(engagement.special_terms)}</p>
          </div>
        `
        : ""
    }
  </div>

  ${pageFooter(engagement)}
</section>

${servicePagesHtml}

<section class="page">
  ${pageHeader(engagement, "Billing schedule")}

  <div class="page-content">
    <p class="section-kicker">12-MONTH BILLING SCHEDULE</p>
    <h2 class="section-title">Invoice and payment dates</h2>

    <div class="billing-header">
      <span>#</span>
      <span>Service month</span>
      <span>Invoice date</span>
      <span>Payment reflects</span>
      <span class="money">Ex VAT</span>
      <span class="money">Incl. VAT</span>
    </div>

    ${billingHtml}

    <div class="billing-total">
      <span></span>
      <strong>Contract total</strong>
      <span></span>
      <span></span>
      <strong class="money">${escapeHtml(moneyZA(totalExVat))}</strong>
      <strong class="money">${escapeHtml(moneyZA(totalIncVat))}</strong>
    </div>

    <div class="info-box" style="margin-top:8mm;">
      <strong>Important</strong>
      <p>
        The billing schedule forms part of the engagement. The contract does
        not automatically renew for a further twelve months. A new engagement
        or written renewal must be concluded for services after
        ${escapeHtml(formatDate(engagement.contract_end_date))}.
      </p>
    </div>
  </div>

  ${pageFooter(engagement)}
</section>

${clausePagesHtml}

<section class="page">
  ${pageHeader(engagement, "Acceptance")}

  <div class="page-content">
    <p class="section-kicker">ACCEPTANCE</p>
    <h2 class="section-title">Acceptance of engagement</h2>

    <p class="body-text">
      I confirm that I am authorised to accept this engagement on behalf of
      ${escapeHtml(engagement.client_name)}, that I have reviewed the scope,
      fees, billing schedule and terms of engagement, and that the Client
      accepts this engagement.
    </p>

    <div class="signature-grid">
      <div class="signature-field">
        <span>Name</span>
        <div class="signature-line"></div>
      </div>
      <div class="signature-field">
        <span>Capacity</span>
        <div class="signature-line"></div>
      </div>
      <div class="signature-field">
        <span>Signature</span>
        <div class="signature-line"></div>
      </div>
      <div class="signature-field">
        <span>Date</span>
        <div class="signature-line"></div>
      </div>
    </div>

    <div class="practitioner-box">
      <strong>Ferdi van Aswegen</strong>
      <span>Professional Accountant (SA) · SAIPA 28289</span>
      <span>Bizzacc Menlyn (Pty) Ltd</span>
      <span>ferdi_v@bizzacc.co.za · 012 881 6388</span>
    </div>

    <div class="template-version">
      Legal template: ${escapeHtml(engagement.legal_template_version)}
    </div>
  </div>

  ${pageFooter(engagement)}
</section>

</body>
</html>`;
}

async function findLocalChrome() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

async function launchBrowser() {
  const localChrome = await findLocalChrome();

  if (localChrome) {
    return puppeteer.launch({
      executablePath: localChrome,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  const executablePath = await chromium.executablePath();

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: chromium.args,
  });
}

export async function GET(request: Request, context: any) {
  const supabase = getSupabaseAdmin();
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    const engagementId = await getEngagementId(context);
    const token = bearer(request);

    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, organisation_id, access_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || !profile.access_enabled) {
      return NextResponse.json(
        { success: false, error: "Could not load active user profile." },
        { status: 403 }
      );
    }

    const currentProfile = profile as UserProfile;

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select("*")
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { success: false, error: "Engagement not found." },
        { status: 404 }
      );
    }

    if (
      !globalAdmin(currentProfile.role) &&
      currentProfile.organisation_id !== engagement.organisation_id
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    const [servicesResult, clausesResult, billingResult] = await Promise.all([
      supabase
        .from("engagement_services")
        .select("*")
        .eq("engagement_id", engagementId)
        .order("sort_order", { ascending: true }),

      supabase
        .from("engagement_clauses")
        .select("*")
        .eq("engagement_id", engagementId)
        .order("sort_order", { ascending: true }),

      supabase
        .from("engagement_billing_schedule")
        .select("*")
        .eq("engagement_id", engagementId)
        .order("sequence_no", { ascending: true }),
    ]);

    if (servicesResult.error) throw servicesResult.error;
    if (clausesResult.error) throw clausesResult.error;
    if (billingResult.error) throw billingResult.error;

    const html = buildHtml({
      engagement,
      services: servicesResult.data || [],
      clauses: clausesResult.data || [],
      billing: billingResult.data || [],
    });

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "load",
      timeout: 30000,
    });

    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="
          width: 100%;
          margin: 0 16mm;
          padding-top: 2.2mm;
          border-top: 0.6px solid #cbd5e1;
          font-family: 'Century Gothic', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
          font-size: 7px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span>Bizzacc Menlyn (Pty) Ltd · www.bizzacc.co.za</span>
          <span>${escapeHtml(engagement.engagement_number)}</span>
        </div>
      `,
      margin: {
        top: "10mm",
        right: "0mm",
        bottom: "22mm",
        left: "0mm",
      },
    });

    const fileName = `${filenameSafe(
      engagement.client_name || "Client"
    )}-${filenameSafe(
      engagement.engagement_number || "Engagement"
    )}-Engagement-Letter.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("ENGAGEMENT PDF EXPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to export engagement PDF.",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
