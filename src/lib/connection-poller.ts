import { db } from "@/lib/db";
import { getServerStatus, removePeer } from "@/lib/wireguard";

const HANDSHAKE_TIMEOUT_S = 210;
const POLL_INTERVAL_MS = 30_000;
const BANDWIDTH_SNAPSHOT_INTERVAL = 60_000;
const BANDWIDTH_RETENTION_HOURS = 48;

let pollerStarted = false;
let lastBandwidthSnapshot = 0;

export function startPoller(): void {
  if (pollerStarted) return;
  pollerStarted = true;
  console.log("[poller] Connection monitor started (every 30s)");
  setInterval(pollConnections, POLL_INTERVAL_MS);
  setTimeout(pollConnections, 2000);
  cleanupOldBandwidthLogs();
}

async function enforceExpiry(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db.vPNClient.findMany({
      where: { enabled: true, expiresAt: { not: null, lte: now } },
      select: { id: true, publicKey: true },
    });

    for (const client of expired) {
      removePeer(client.publicKey);
      await db.vPNClient.update({
        where: { id: client.id },
        data: { enabled: false, isOnline: false },
      });
      await db.connectionLog.create({
        data: {
          clientId: client.id,
          event: "disconnected",
          details: "Client subscription expired",
        },
      });
      console.log(`[poller] Client ${client.id} expired and removed from WireGuard`);
    }
  } catch (err) {
    console.error("[poller] Error enforcing expiry:", err);
  }
}

async function pollConnections(): Promise<void> {
  try {
    await enforceExpiry();
    const status = getServerStatus();
    const nowS = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();

    const peerMap = new Map(
      status.peers.map((p) => [p.publicKey, p])
    );

    const clients = await db.vPNClient.findMany({
      select: {
        id: true,
        publicKey: true,
        isOnline: true,
        dataUsage: true,
      },
    });

    for (const client of clients) {
      const peer = peerMap.get(client.publicKey);

      if (peer) {
        const handshakeAge = peer.latestHandshake > 0
          ? nowS - peer.latestHandshake
          : Infinity;
        const isActive = handshakeAge < HANDSHAKE_TIMEOUT_S;
        const totalTransfer = BigInt(peer.transferRx) + BigInt(peer.transferTx);

        if (isActive && !client.isOnline) {
          await db.$transaction([
            db.vPNClient.update({
              where: { id: client.id },
              data: {
                isOnline: true,
                lastHandshake: new Date(peer.latestHandshake * 1000),
                lastEndpoint: peer.endpoint || null,
                dataUsage: totalTransfer,
              },
            }),
            db.connectionLog.create({
              data: {
                clientId: client.id,
                event: "connected",
                ipAddress: peer.endpoint || null,
                details: "Handshake detected",
              },
            }),
          ]);
        } else if (!isActive && client.isOnline) {
          await db.$transaction([
            db.vPNClient.update({
              where: { id: client.id },
              data: {
                isOnline: false,
                lastHandshake: peer.latestHandshake > 0
                  ? new Date(peer.latestHandshake * 1000)
                  : undefined,
                dataUsage: totalTransfer,
              },
            }),
            db.connectionLog.create({
              data: {
                clientId: client.id,
                event: "disconnected",
                ipAddress: peer.endpoint || null,
                details: `No handshake for ${HANDSHAKE_TIMEOUT_S}s`,
              },
            }),
          ]);
        } else {
          await db.vPNClient.update({
            where: { id: client.id },
            data: {
              lastHandshake: peer.latestHandshake > 0
                ? new Date(peer.latestHandshake * 1000)
                : undefined,
              lastEndpoint: peer.endpoint || undefined,
              dataUsage: totalTransfer > client.dataUsage
                ? totalTransfer
                : undefined,
            },
          });
        }

        peerMap.delete(client.publicKey);
      } else if (client.isOnline) {
        await db.$transaction([
          db.vPNClient.update({
            where: { id: client.id },
            data: { isOnline: false },
          }),
          db.connectionLog.create({
            data: {
              clientId: client.id,
              event: "disconnected",
              details: "Peer removed from interface",
            },
          }),
        ]);
      }
    }

    if (nowMs - lastBandwidthSnapshot >= BANDWIDTH_SNAPSHOT_INTERVAL) {
      lastBandwidthSnapshot = nowMs;
      await db.bandwidthLog.create({
        data: {
          rx: BigInt(status.totalTransferRx),
          tx: BigInt(status.totalTransferTx),
        },
      });
    }
  } catch (err) {
    console.error("[poller] Error polling connections:", err);
  }
}

async function cleanupOldBandwidthLogs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - BANDWIDTH_RETENTION_HOURS * 3600_000);
    await db.bandwidthLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  } catch {
    // ignore cleanup errors on startup
  }
}
