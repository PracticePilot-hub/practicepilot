import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This old CubeChem route is disabled. The CubeChem module now uses saved review prices and upload-supplier instead.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "This old CubeChem route is disabled.",
    },
    { status: 410 }
  );
}