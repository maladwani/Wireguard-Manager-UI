// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import QRCode from "qrcode";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramSettings {
  botToken: string;
  chatId: string;
}

export async function getTelegramSettings(): Promise<TelegramSettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: ["telegramBotToken", "telegramChatId"] } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  let botToken = "";
  if (map.telegramBotToken) {
    try {
      botToken = decrypt(map.telegramBotToken);
    } catch {
      botToken = "";
    }
  }

  return {
    botToken,
    chatId: map.telegramChatId || "",
  };
}

async function telegramRequest(
  botToken: string,
  method: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `${TELEGRAM_API}/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
    cache: "no-store",
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) {
    throw new Error(
      (data.description as string) || `Telegram API error on ${method}`
    );
  }
  return data;
}

export async function testBot(): Promise<{ success: boolean; username?: string; error?: string }> {
  const settings = await getTelegramSettings();

  if (!settings.botToken) {
    return { success: false, error: "Bot token is not configured" };
  }

  try {
    const data = await telegramRequest(settings.botToken, "getMe");
    const result = data.result as Record<string, unknown>;
    return { success: true, username: result.username as string };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function sendTelegramForm(
  botToken: string,
  method: string,
  form: FormData
): Promise<void> {
  const url = `${TELEGRAM_API}/bot${botToken}/${method}`;
  const res = await fetch(url, { method: "POST", body: form, cache: "no-store" });
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) {
    throw new Error((data.description as string) || `Telegram API error on ${method}`);
  }
}

export async function sendClientConfig(
  chatId: string,
  clientName: string,
  configText: string
): Promise<void> {
  const settings = await getTelegramSettings();

  if (!settings.botToken) {
    throw new Error("Telegram is not configured - set the Bot Token in the Settings page");
  }

  // 1️⃣ Generate QR code PNG buffer from the config text
  const qrBuffer: Buffer = await QRCode.toBuffer(configText, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  // 2️⃣ Send QR code as a photo
  const photoForm = new FormData();
  photoForm.append("chat_id", chatId);
  photoForm.append("caption", `WireGuard QRcode - Client: ${clientName}`);
  const qrArrayBuffer = qrBuffer.buffer.slice(
    qrBuffer.byteOffset,
    qrBuffer.byteOffset + qrBuffer.byteLength
  ) as ArrayBuffer;
  photoForm.append("photo", new Blob([qrArrayBuffer], { type: "image/png" }), `${clientName}-qr.png`);
  await sendTelegramForm(settings.botToken, "sendPhoto", photoForm);

  // 3️⃣ Send .conf file as a document
  const docForm = new FormData();
  docForm.append("chat_id", chatId);
  docForm.append("caption", `Config file - ${clientName}.conf`);
  docForm.append("document", new Blob([configText], { type: "text/plain" }), `${clientName}.conf`);
  await sendTelegramForm(settings.botToken, "sendDocument", docForm);
}
