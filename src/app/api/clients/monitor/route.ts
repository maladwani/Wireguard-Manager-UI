import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getServerStatus } from "@/lib/wireguard";
import { startPoller } from "@/lib/connection-poller";

startPoller();

const HANDSHAKE_TIMEOUT_S = 210;

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";

    const where: Record<string, unknown> = {};
    if (status === "online") where.isOnline = true;
    else if (status === "offline") where.isOnline = false;

    const [clients, liveStatus] = await Promise.all([
      db.vPNClient.findMany({
        where,
        orderBy: [
          { isOnline: "desc" },
          { lastHandshake: "desc" },
        ],
        select: {
          id: true,
          name: true,
          email: true,
          publicKey: true,
          address: true,
          allowedIPs: true,
          dataUsage: true,
          enabled: true,
          isOnline: true,
          lastHandshake: true,
          lastEndpoint: true,
          createdAt: true,
          logs: {
            where: {
              event: { in: ["connected", "disconnected"] },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              event: true,
              ipAddress: true,
              details: true,
              createdAt: true,
            },
          },
        },
      }),
      Promise.resolve(getServerStatus()),
    ]);

    const nowS = Math.floor(Date.now() / 1000);
    const livePeerMap = new Map(
      liveStatus.peers.map((p) => [p.publicKey, p])
    );

    const serialized = clients.map((c) => {
      const livePeer = livePeerMap.get(c.publicKey);

      if (livePeer) {
        const handshakeAge = livePeer.latestHandshake > 0
          ? nowS - livePeer.latestHandshake
          : Infinity;
        const liveOnline = handshakeAge < HANDSHAKE_TIMEOUT_S;
        const totalTransfer = BigInt(livePeer.transferRx) + BigInt(livePeer.transferTx);

        return {
          ...c,
          isOnline: liveOnline,
          lastHandshake: livePeer.latestHandshake > 0
            ? new Date(livePeer.latestHandshake * 1000).toISOString()
            : c.lastHandshake,
          lastEndpoint: livePeer.endpoint || c.lastEndpoint,
          dataUsage: totalTransfer > c.dataUsage
            ? totalTransfer.toString()
            : c.dataUsage.toString(),
          liveTransferRx: livePeer.transferRx,
          liveTransferTx: livePeer.transferTx,
        };
      }

      return {
        ...c,
        dataUsage: c.dataUsage.toString(),
      };
    });

    if (status === "online") {
      serialized.sort((a) => (a.isOnline ? -1 : 1));
    }

    const onlineCount = serialized.filter((c) => c.isOnline).length;
    const totalCount = serialized.length;

    let filteredClients = serialized;
    if (status === "online") {
      filteredClients = serialized.filter((c) => c.isOnline);
    } else if (status === "offline") {
      filteredClients = serialized.filter((c) => !c.isOnline);
    }

    const [dbOnline, dbTotal] = await Promise.all([
      db.vPNClient.count({ where: { isOnline: true } }),
      db.vPNClient.count(),
    ]);

    const actualOnline = Math.max(onlineCount, dbOnline);

    return NextResponse.json({
      clients: filteredClients,
      summary: {
        online: actualOnline,
        offline: dbTotal - actualOnline,
        total: dbTotal,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch monitor data", details: String(err) },
      { status: 500 }
    );
  }
}
