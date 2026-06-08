import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/crm/tasks/generate`, {
      method: "POST",
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Daily task generation completed.",
      result: data,
    });
  } catch (error: any) {
    console.error("Daily task generation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Daily task generation failed.",
      },
      { status: 500 }
    );
  }
}