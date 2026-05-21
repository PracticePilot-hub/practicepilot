import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: "Sage callback error", details: error },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "No Sage authorization code received." },
      { status: 400 }
    );
  }

  return NextResponse.redirect(new URL("/accounting-system", req.url));
}