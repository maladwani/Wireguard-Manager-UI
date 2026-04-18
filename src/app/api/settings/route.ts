import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { resolvePublicIP } from "@/lib/public-ip";
import { encrypt } from "@/lib/crypto";

const ALLOWED_KEYS = [
  "endpointHost",
  "serverAddress",
  "listenPort",
  "postUp",
  "postDown",
  "defaultDns",
  "defaultAllowedIPs",
  "defaultMtu",
  "persistentKeepalive",
  "sessionTimeoutDays",
  "passwordMinLength",
  "bcryptRounds",
  // SSO / OIDC settings
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
  // Email / SMTP settings
  "smtpHost",
  "smtpPort",
  "smtpSecure",
  "smtpUser",
  "smtpPassword",
  "smtpFrom",
  // Telegram settings
  "telegramBotToken",
  "telegramChatId",
];

// Keys that must be encrypted at rest
const ENCRYPTED_KEYS = new Set(["ssoClientSecret", "smtpPassword", "telegramBotToken"]);

export async function GET() {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  try {
    const settings = await db.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      // Mask encrypted values so they never leave the server in plain text
      map[s.key] = ENCRYPTED_KEYS.has(s.key) && s.value ? "••••••••" : s.value;
    }

    let resolvedEndpoint: string | null = null;
    if (!map.endpointHost || map.endpointHost === "auto") {
      try {
        resolvedEndpoint = await resolvePublicIP();
      } catch {
        resolvedEndpoint = null;
      }
    }

    return NextResponse.json({ settings: map, resolvedEndpoint });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load settings", details: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  try {
    const body = await req.json();

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      const strValue = String(value);
      // Skip placeholder mask value - don't overwrite the real encrypted secret
      if (ENCRYPTED_KEYS.has(key) && strValue === "••••••••") continue;
      // Encrypt sensitive values before persisting
      const storedValue = ENCRYPTED_KEYS.has(key) && strValue
        ? encrypt(strValue)
        : strValue;
      await db.setting.upsert({
        where: { key },
        update: { value: storedValue },
        create: { key, value: storedValue },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save settings", details: String(err) },
      { status: 500 }
    );
  }
}
