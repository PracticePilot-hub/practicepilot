import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SAGE_CLIENT_ID;
  const redirectUri = process.env.SAGE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing SAGE_CLIENT_ID or SAGE_REDIRECT_URI in .env.local" },
      { status: 500 }
    );
  }

  const authUrl = new URL("https://www.sageone.com/oauth2/auth/central");

  authUrl.searchParams.set("filter", "apiv3.1");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authUrl.toString());
}