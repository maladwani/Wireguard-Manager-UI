import { NextRequest, NextResponse } from "next/server";
import { getSSOConfig, discoverOIDC, buildAuthorizationUrl } from "@/lib/sso";

function getRedirectUri(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}/api/auth/sso/callback`;
}

export async function GET(req: NextRequest) {
  try {
    const config = await getSSOConfig();

    if (!config.enabled) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (!config.issuerUrl || !config.clientId || !config.clientSecret) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("sso_error", "SSO is not fully configured");
      return NextResponse.redirect(loginUrl);
    }

    const redirectUri = getRedirectUri(req);
    const discovery = await discoverOIDC(config.issuerUrl);
    const { url, state, nonce } = await buildAuthorizationUrl(
      discovery,
      config,
      redirectUri
    );

    // Store state + nonce in a short-lived httpOnly cookie
    const statePayload = JSON.stringify({ state, nonce, ts: Date.now() });
    const response = NextResponse.redirect(url);
    response.cookies.set("sso_state", statePayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[SSO start]", err);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "sso_error",
      err instanceof Error ? err.message : "SSO initialization failed"
    );
    return NextResponse.redirect(loginUrl);
  }
}
