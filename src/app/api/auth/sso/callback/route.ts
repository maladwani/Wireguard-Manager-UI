import { NextRequest, NextResponse } from "next/server";
import {
  getSSOConfig,
  discoverOIDC,
  exchangeCode,
  validateIdToken,
  extractEmail,
  extractName,
  extractRole,
  issueBridgeToken,
} from "@/lib/sso";
import { db } from "@/lib/db";

function getRedirectUri(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}/api/auth/sso/callback`;
}

function errorRedirect(req: NextRequest, message: string): NextResponse {
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("sso_error", message);
  const res = NextResponse.redirect(loginUrl);
  res.cookies.delete("sso_state");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  // IdP returned an error
  if (errorParam) {
    return errorRedirect(req, errorDesc || errorParam);
  }

  if (!code || !returnedState) {
    return errorRedirect(req, "Missing code or state parameter");
  }

  // Verify state cookie
  const stateCookie = req.cookies.get("sso_state")?.value;
  if (!stateCookie) {
    return errorRedirect(req, "SSO session expired - please try again");
  }

  let storedState: { state: string; nonce: string; ts: number };
  try {
    storedState = JSON.parse(stateCookie);
  } catch {
    return errorRedirect(req, "Invalid SSO session cookie");
  }

  if (storedState.state !== returnedState) {
    return errorRedirect(req, "State mismatch - possible CSRF attack");
  }

  // Check cookie freshness (5 min window)
  if (Date.now() - storedState.ts > 5 * 60 * 1000) {
    return errorRedirect(req, "SSO session expired - please try again");
  }

  try {
    const config = await getSSOConfig();
    if (!config.enabled) {
      return errorRedirect(req, "SSO is disabled");
    }

    const redirectUri = getRedirectUri(req);
    const discovery = await discoverOIDC(config.issuerUrl);
    const tokens = await exchangeCode(discovery, config, code, redirectUri);
    const claims = await validateIdToken(
      tokens.id_token,
      discovery,
      config,
      storedState.nonce
    );

    const email = extractEmail(claims);
    const name = extractName(claims);
    const role = extractRole(claims, config);

    // Find or create user
    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      if (!config.autoCreateUsers) {
        return errorRedirect(
          req,
          `User "${email}" does not exist. Auto-provisioning is disabled - contact your administrator.`
        );
      }

      user = await db.user.create({
        data: {
          name,
          email,
          hashedPassword: "", // SSO users have no local password
          role,
        },
      });

      await db.connectionLog.create({
        data: {
          event: "user_created",
          details: `SSO user created: ${email} (role: ${role})`,
        },
      });
    }

    // Issue bridge token (30 seconds)
    const bridgeToken = await issueBridgeToken(user.id);

    // Clear state cookie and redirect to SSO complete page
    const completeUrl = new URL("/login/sso-complete", req.url);
    completeUrl.searchParams.set("t", bridgeToken);

    const response = NextResponse.redirect(completeUrl);
    response.cookies.delete("sso_state");
    return response;
  } catch (err) {
    console.error("[SSO callback]", err);
    return errorRedirect(
      req,
      err instanceof Error ? err.message : "SSO authentication failed"
    );
  }
}
