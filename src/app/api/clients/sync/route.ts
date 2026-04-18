import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { parseConfigPeers } from "@/lib/wireguard";
import { encrypt } from "@/lib/crypto";

export interface SyncResult {
  imported: number;
  skipped: number;
  peers: Array<{
    publicKey: string;
    address: string;
    name: string;
    status: "imported" | "skipped";
  }>;
}

export async function POST() {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  try {
    const configPeers = parseConfigPeers();

    if (configPeers.length === 0) {
      return NextResponse.json<SyncResult>({
        imported: 0,
        skipped: 0,
        peers: [],
      });
    }

    // Fetch all existing public keys from DB
    const existing = await db.vPNClient.findMany({
      select: { publicKey: true },
    });
    const existingKeys = new Set(existing.map((c) => c.publicKey));

    const result: SyncResult = { imported: 0, skipped: 0, peers: [] };

    for (const peer of configPeers) {
      const shortKey = peer.publicKey.slice(0, 8);

      if (existingKeys.has(peer.publicKey)) {
        result.skipped++;
        result.peers.push({
          publicKey: peer.publicKey,
          address: peer.allowedIPs,
          name: shortKey,
          status: "skipped",
        });
        continue;
      }

      // Address stored in DB (strip /32 for display, keep full for AllowedIPs)
      const address = peer.allowedIPs;
      const name = `Imported ${shortKey}`;

      // Encrypt empty string to satisfy NOT NULL - private key not available for imported peers
      const privateKeyEncrypted = encrypt("");
      const presharedKeyEncrypted = peer.presharedKey ? encrypt(peer.presharedKey) : null;

      const client = await db.vPNClient.create({
        data: {
          name,
          publicKey: peer.publicKey,
          privateKeyEncrypted,
          presharedKey: presharedKeyEncrypted,
          allowedIPs: "0.0.0.0/0, ::/0",
          address,
          dns: null,
          enabled: true,
        },
      });

      await db.connectionLog.create({
        data: {
          clientId: client.id,
          event: "created",
          details: `Peer imported from wg0.conf (${address})`,
        },
      });

      result.imported++;
      result.peers.push({
        publicKey: peer.publicKey,
        address,
        name,
        status: "imported",
      });
    }

    return NextResponse.json<SyncResult>(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Sync failed", details: String(err) },
      { status: 500 }
    );
  }
}
