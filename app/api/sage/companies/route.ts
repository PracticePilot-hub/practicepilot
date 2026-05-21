import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.SAGE_API_KEY;
  const username = process.env.SAGE_USERNAME;
  const password = process.env.SAGE_PASSWORD;

  if (!apiKey || !username || !password) {
    return NextResponse.json(
      { error: "Missing SAGE_API_KEY, SAGE_USERNAME, or SAGE_PASSWORD in .env.local" },
      { status: 500 }
    );
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const url = `https://accounting.sageone.co.za/api/2.0.0/Company/Get?apikey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  return NextResponse.json({
    status: response.status,
    ok: response.ok,
    raw: text,
  });
}