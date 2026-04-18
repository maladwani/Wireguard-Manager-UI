import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getServerStatus } from "@/lib/wireguard";
import { startPoller } from "@/lib/connection-poller";
import { db } from "@/lib/db";

startPoller();

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const [status, clientCount, activeClients, onlineClients, clientRecords] =
      await Promise.all([
        getServerStatus(),
        db.vPNClient.count(),
        db.vPNClient.count({ where: { enabled: true } }),
        db.vPNClient.count({ where: { isOnline: true } }),
        db.vPNClient.findMany({
          select: { publicKey: true, name: true, address: true },
        }),
      ]);

    const clientMap: Record<string, { name: string; address: string }> = {};
    for (const c of clientRecords) {
      clientMap[c.publicKey] = { name: c.name, address: c.address };
    }

    const peers = status.peers.map((p) => ({
      ...p,
      clientName: clientMap[p.publicKey]?.name || null,
      clientAddress: clientMap[p.publicKey]?.address || null,
    }));

    return NextResponse.json({
      ...status,
      peers,
      clientCount,
      activeClients,
      onlineClients,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to get server status", details: String(err) },
      { status: 500 }
    );
  }
}
