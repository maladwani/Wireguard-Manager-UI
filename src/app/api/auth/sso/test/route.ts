import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { discoverOIDC } from "@/lib/sso";

export async function POST(req: Request) {
  const { error } = await requireRole(["super_admin"]);
  if (error) return error;

  try {
    const { issuerUrl } = await req.json();

    if (!issuerUrl || typeof issuerUrl !== "string") {
      return NextResponse.json(
        { error: "issuerUrl is required" },
        { status: 400 }
      );
    }

    const discovery = await discoverOIDC(issuerUrl.trim().replace(/\/$/, ""));

    return NextResponse.json({
      success: true,
      issuer: discovery.issuer,
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      jwksUri: discovery.jwks_uri,
      userinfoEndpoint: discovery.userinfo_endpoint ?? null,
      endSessionEndpoint: discovery.end_session_endpoint ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Discovery failed",
      },
      { status: 200 } // return 200 so the UI can show the error message
    );
  }
}
