import { NextResponse } from "next/server";
import { getSSOConfig } from "@/lib/sso";

// Public endpoint - no auth required (login page needs to know if SSO is enabled)
export async function GET() {
  try {
    const config = await getSSOConfig();
    return NextResponse.json({
      enabled: config.enabled,
      providerName: config.enabled ? config.providerName : null,
    });
  } catch {
    return NextResponse.json({ enabled: false, providerName: null });
  }
}
