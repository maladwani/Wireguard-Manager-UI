import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createClientSchema } from "@/lib/validations";
import { encrypt } from "@/lib/crypto";
import {
  generateKeyPair,
  generatePresharedKey,
  addPeer,
  getNextAvailableIP,
  getSettings,
} from "@/lib/wireguard";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const clients = await db.vPNClient.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        publicKey: true,
        allowedIPs: true,
        address: true,
        dns: true,
        dataUsage: true,
        expiresAt: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const serialized = clients.map((c) => ({
      ...c,
      dataUsage: c.dataUsage.toString(),
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch clients", details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, dns, allowedIPs, expiresAt } = parsed.data;
    const settings = await getSettings();

    const { privateKey, publicKey } = generateKeyPair();
    const presharedKey = generatePresharedKey();
    const address = await getNextAvailableIP();

    addPeer(publicKey, address, presharedKey);

    const client = await db.vPNClient.create({
      data: {
        name,
        email: email || null,
        publicKey,
        privateKeyEncrypted: encrypt(privateKey),
        presharedKey: encrypt(presharedKey),
        allowedIPs: allowedIPs || settings.defaultAllowedIPs,
        address,
        dns: dns || settings.defaultDns,
        endpoint: null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await db.connectionLog.create({
      data: {
        clientId: client.id,
        event: "created",
        details: `Client "${name}" created`,
      },
    });

    return NextResponse.json(
      { ...client, dataUsage: client.dataUsage.toString() },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create client", details: String(err) },
      { status: 500 }
    );
  }
}
