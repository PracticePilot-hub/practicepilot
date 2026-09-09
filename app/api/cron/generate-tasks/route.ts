import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifyCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured.
  if (!secret) return true;

  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorised cron request." },
        { status: 401 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin;

    const response = await fetch(`${origin}/api/crm/tasks/generate`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const responseText = await response.text();

    let result: any = {};
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: `Task generator returned an invalid response (${response.status}).`,
          },
          { status: 500 }
        );
      }
    }

    if (!response.ok || result?.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || "Daily CRM work generation failed.",
          generator: result,
        },
        { status: response.ok ? 500 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      run_type: "daily_recurring_work_generation",
      ran_at: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("Daily CRM work generation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Daily CRM work generation failed.",
      },
      { status: 500 }
    );
  }
}
