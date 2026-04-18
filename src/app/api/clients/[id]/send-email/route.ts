import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import {
  generateClientConfig,
  getServerPublicKey,
  getServerEndpoint,
  getSettings,
} from "@/lib/wireguard";
import { sendClientConfig } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const [client, settings] = await Promise.all([
      db.vPNClient.findUnique({ where: { id } }),
      getSettings(),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const to: string = body.to || client.email || "";
    if (!to) {
      return NextResponse.json(
        { error: "No email address - provide one in the request or set one on the client" },
        { status: 400 }
      );
    }

    if (!client.privateKeyEncrypted) {
      return NextResponse.json(
        { error: "This client was imported and has no private key stored - config cannot be sent" },
        { status: 400 }
      );
    }

    const privateKey = decrypt(client.privateKeyEncrypted);
    if (!privateKey) {
      return NextResponse.json(
        { error: "Could not decrypt the client private key - check ENCRYPTION_KEY env var" },
        { status: 500 }
      );
    }

    const presharedKey = client.presharedKey ? decrypt(client.presharedKey) : undefined;

    const configText = generateClientConfig({
      privateKey,
      address: client.address,
      dns: client.dns || settings.defaultDns,
      serverPublicKey: getServerPublicKey(),
      serverEndpoint: await getServerEndpoint(),
      presharedKey,
      allowedIPs: client.allowedIPs,
      mtu: settings.defaultMtu,
      persistentKeepalive: settings.persistentKeepalive,
    });

    await sendClientConfig(to, client.name, configText);

    await db.connectionLog.create({
      data: {
        clientId: id,
        event: "config_sent_email",
        details: `Config emailed to ${to}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
