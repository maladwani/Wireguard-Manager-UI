import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { generateClientConfig, getServerPublicKey, getServerEndpoint, getSettings } from "@/lib/wireguard";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const [client, settings] = await Promise.all([
      db.vPNClient.findUnique({ where: { id } }),
      getSettings(),
    ]);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const privateKey = decrypt(client.privateKeyEncrypted);
    const presharedKey = client.presharedKey
      ? decrypt(client.presharedKey)
      : undefined;

    const config = generateClientConfig({
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

    return new NextResponse(config, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${client.name}.conf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate config", details: String(err) },
      { status: 500 }
    );
  }
}
