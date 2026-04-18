import { NextRequest, NextResponse } from "next/server";
import { checkLoginAttempts } from "@/lib/login-attempts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json({ blocked: false, remainingAttempts: 5, retryAfterMs: 0 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const status = await checkLoginAttempts(email, ip);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ blocked: false, remainingAttempts: 5, retryAfterMs: 0 });
  }
}
