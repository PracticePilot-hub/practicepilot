// Path: app/api/paia/manuals/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart npm run dev."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("paia_manuals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ manuals: data ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load PAIA manuals." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const entityName = String(body.entity_name ?? "").trim();

    if (!entityName) {
      return NextResponse.json(
        { error: "Entity name is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("paia_manuals")
      .insert({
        manual_name:
          String(body.manual_name ?? "").trim() || `${entityName} PAIA Manual`,
        entity_name: entityName,
        entity_registration_number: clean(body.entity_registration_number),
        vat_number: clean(body.vat_number),
        entity_type: clean(body.entity_type),
        industry: clean(body.industry),

        information_officer_name: clean(body.information_officer_name),
        information_officer_position: clean(body.information_officer_position),
        information_officer_email: clean(body.information_officer_email),
        information_officer_telephone: clean(
          body.information_officer_telephone
        ),

        physical_address: clean(body.physical_address),
        postal_address: clean(body.postal_address),
        telephone: clean(body.telephone),
        email: clean(body.email),
        website: clean(body.website),

        date_compiled:
          body.date_compiled || new Date().toISOString().slice(0, 10),
        next_review_date: body.next_review_date || null,
        version_number: "1.0",
        status: "draft",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ manual: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create PAIA manual." },
      { status: 500 }
    );
  }
}