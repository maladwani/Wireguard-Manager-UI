// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const rows = await db.setting.findMany({
    where: {
      key: { in: ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPassword", "smtpFrom"] },
    },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  let password = "";
  if (map.smtpPassword) {
    try {
      password = decrypt(map.smtpPassword);
    } catch {
      password = "";
    }
  }

  return {
    host: map.smtpHost || "",
    port: parseInt(map.smtpPort || "587", 10),
    secure: map.smtpSecure === "true",
    user: map.smtpUser || "",
    password,
    from: map.smtpFrom || map.smtpUser || "",
  };
}

function createTransporter(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user
      ? { user: settings.user, pass: settings.password }
      : undefined,
  });
}

export async function testSmtp(): Promise<{ success: boolean; error?: string }> {
  const settings = await getSmtpSettings();

  if (!settings.host) {
    return { success: false, error: "SMTP host is not configured" };
  }

  try {
    const transporter = createTransporter(settings);
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendClientConfig(
  to: string,
  clientName: string,
  configText: string
): Promise<void> {
  const settings = await getSmtpSettings();

  if (!settings.host) {
    throw new Error("SMTP is not configured - set SMTP settings in the Settings page");
  }

  const transporter = createTransporter(settings);

  await transporter.sendMail({
    from: settings.from ? `"WireGuard Manager" <${settings.from}>` : settings.from,
    to,
    subject: `WireGuard config for ${clientName}`,
    text: [
      `Hello,`,
      ``,
      `Your WireGuard VPN configuration for profile "${clientName}" is attached to this email.`,
      ``,
      `Import the attached .conf file into your WireGuard client to connect.`,
      ``,
      `- WireGuard Manager`,
    ].join("\n"),
    attachments: [
      {
        filename: `${clientName}.conf`,
        content: configText,
        contentType: "text/plain",
      },
    ],
  });
}
