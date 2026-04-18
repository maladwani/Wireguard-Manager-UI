import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { updateClientSchema } from "@/lib/validations";
import { removePeer, addPeer } from "@/lib/wireguard";
import { decrypt } from "@/lib/crypto";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const client = await db.vPNClient.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...client,
      dataUsage: client.dataUsage.toString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch client", details: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const client = await db.vPNClient.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.email !== undefined)
      updateData.email = parsed.data.email || null;
    if (parsed.data.enabled !== undefined)
      updateData.enabled = parsed.data.enabled;
    if (parsed.data.expiresAt !== undefined)
      updateData.expiresAt = parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : null;

    const updated = await db.vPNClient.update({
      where: { id },
      data: updateData,
    });

    // Sync WireGuard peer state when enabled flag changes
    if (parsed.data.enabled !== undefined && parsed.data.enabled !== client.enabled) {
      if (!parsed.data.enabled) {
        removePeer(client.publicKey);
        await db.connectionLog.create({
          data: { clientId: id, event: "disabled", details: "Client disabled by admin" },
        });
      } else {
        const fullClient = await db.vPNClient.findUnique({ where: { id } });
        if (fullClient) {
          const psk = fullClient.presharedKey ? decrypt(fullClient.presharedKey) : undefined;
          addPeer(fullClient.publicKey, fullClient.address, psk);
        }
        await db.connectionLog.create({
          data: { clientId: id, event: "enabled", details: "Client enabled by admin" },
        });
      }
    }

    return NextResponse.json({
      ...updated,
      dataUsage: updated.dataUsage.toString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update client", details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const client = await db.vPNClient.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    removePeer(client.publicKey);

    await db.$executeRaw`
      INSERT INTO "ConnectionLog" ("id", "event", "details", "createdAt")
      VALUES (lower(hex(randomblob(16))), 'deleted', ${'Client "' + client.name + '" (' + client.address + ') deleted by admin'}, datetime('now'))
    `;

    await db.vPNClient.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete client", details: String(err) },
      { status: 500 }
    );
  }
}
