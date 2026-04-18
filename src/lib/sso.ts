// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { randomBytes } from "crypto";
export { issueBridgeToken, verifyBridgeToken } from "@/lib/sso-bridge";

export interface SSOConfig {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  autoCreateUsers: boolean;
  defaultRole: string;
  roleAttr: string;
  adminRole: string;
}

export interface OIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

const SSO_KEYS = [
  "ssoEnabled",
  "ssoProviderName",
  "ssoIssuerUrl",
  "ssoClientId",
  "ssoClientSecret",
  "ssoScopes",
  "ssoAutoCreateUsers",
  "ssoDefaultRole",
  "ssoRoleAttr",
  "ssoAdminRole",
] as const;

export async function getSSOConfig(): Promise<SSOConfig> {
  const rows = await db.setting.findMany({
    where: { key: { in: [...SSO_KEYS] } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  let clientSecret = "";
  if (map.ssoClientSecret) {
    try {
      clientSecret = decrypt(map.ssoClientSecret);
    } catch {
      clientSecret = "";
    }
  }

  return {
    enabled: map.ssoEnabled === "true",
    providerName: map.ssoProviderName || "SSO",
    issuerUrl: (map.ssoIssuerUrl || "").replace(/\/$/, ""),
    clientId: map.ssoClientId || "",
    clientSecret,
    scopes: map.ssoScopes || "openid email profile",
    autoCreateUsers: map.ssoAutoCreateUsers !== "false",
    defaultRole: map.ssoDefaultRole || "admin",
    roleAttr: map.ssoRoleAttr || "",
    adminRole: map.ssoAdminRole || "",
  };
}

export async function saveSSOConfig(
  partial: Partial<Omit<SSOConfig, "clientSecret">> & { clientSecret?: string }
): Promise<void> {
  const upserts: { key: string; value: string }[] = [];

  if (partial.enabled !== undefined)
    upserts.push({ key: "ssoEnabled", value: String(partial.enabled) });
  if (partial.providerName !== undefined)
    upserts.push({ key: "ssoProviderName", value: partial.providerName });
  if (partial.issuerUrl !== undefined)
    upserts.push({ key: "ssoIssuerUrl", value: partial.issuerUrl });
  if (partial.clientId !== undefined)
    upserts.push({ key: "ssoClientId", value: partial.clientId });
  if (partial.clientSecret !== undefined && partial.clientSecret !== "") {
    upserts.push({ key: "ssoClientSecret", value: encrypt(partial.clientSecret) });
  }
  if (partial.scopes !== undefined)
    upserts.push({ key: "ssoScopes", value: partial.scopes });
  if (partial.autoCreateUsers !== undefined)
    upserts.push({ key: "ssoAutoCreateUsers", value: String(partial.autoCreateUsers) });
  if (partial.defaultRole !== undefined)
    upserts.push({ key: "ssoDefaultRole", value: partial.defaultRole });
  if (partial.roleAttr !== undefined)
    upserts.push({ key: "ssoRoleAttr", value: partial.roleAttr });
  if (partial.adminRole !== undefined)
    upserts.push({ key: "ssoAdminRole", value: partial.adminRole });

  for (const { key, value } of upserts) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

// OIDC Discovery
export async function discoverOIDC(issuerUrl: string): Promise<OIDCDiscovery> {
  const base = issuerUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/.well-known/openid-configuration`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `OIDC discovery failed: ${res.status} ${res.statusText} at ${base}/.well-known/openid-configuration`
    );
  }
  return res.json() as Promise<OIDCDiscovery>;
}

// Build the authorization redirect URL + generate state/nonce
export async function buildAuthorizationUrl(
  discovery: OIDCDiscovery,
  config: SSOConfig,
  redirectUri: string
): Promise<{ url: string; state: string; nonce: string }> {
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  return { url: url.toString(), state, nonce };
}

// Exchange authorization code for tokens
export async function exchangeCode(
  discovery: OIDCDiscovery,
  config: SSOConfig,
  code: string,
  redirectUri: string
): Promise<{ id_token: string; access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const tokens = await res.json();
  if (!tokens.id_token) throw new Error("No id_token in token response");
  return tokens as { id_token: string; access_token: string };
}

// Validate ID token and extract claims
export async function validateIdToken(
  idToken: string,
  discovery: OIDCDiscovery,
  config: SSOConfig,
  nonce: string
): Promise<Record<string, unknown>> {
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: discovery.issuer,
    audience: config.clientId,
  });

  // Verify nonce
  if (payload.nonce !== nonce) {
    throw new Error("Nonce mismatch - possible replay attack");
  }

  return payload as Record<string, unknown>;
}

// Extract user email from claims
export function extractEmail(claims: Record<string, unknown>): string {
  const email = (claims.email as string) || (claims.sub as string) || "";
  if (!email) throw new Error("No email or sub claim in ID token");
  return email.toLowerCase();
}

// Extract display name from claims
export function extractName(claims: Record<string, unknown>): string {
  return (
    (claims.name as string) ||
    (claims.preferred_username as string) ||
    (claims.given_name as string) ||
    (claims.email as string) ||
    "SSO User"
  );
}

// Determine user role from claims
export function extractRole(
  claims: Record<string, unknown>,
  config: SSOConfig
): string {
  if (!config.roleAttr || !config.adminRole) return config.defaultRole;

  // Support nested claim path e.g. "realm_access.roles"
  const parts = config.roleAttr.split(".");
  let value: unknown = claims;
  for (const part of parts) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[part];
    } else {
      value = undefined;
      break;
    }
  }

  const roles: string[] = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string"
    ? [value]
    : [];

  return roles.includes(config.adminRole) ? "super_admin" : config.defaultRole;
}

