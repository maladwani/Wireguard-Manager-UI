"use client";

import { useEffect, useState } from "react";
import { StatCards } from "@/components/dashboard/stat-cards";
import { BandwidthChart } from "@/components/dashboard/bandwidth-chart";
import { RecentPeers } from "@/components/dashboard/recent-peers";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import type { WgPeer, BandwidthSnapshot, WgServerStatus } from "@/types";

interface ServerStatusResponse extends WgServerStatus {
  clientCount: number;
  activeClients: number;
  onlineClients: number;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<ServerStatusResponse | null>(null);
  const [bandwidthData, setBandwidthData] = useState<BandwidthSnapshot[]>([]);
  const [bandwidthRangeHours, setBandwidthRangeHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchAll() {
      try {
        const [statusRes, bwRes] = await Promise.all([
          fetch("/api/wireguard/status"),
          fetch(`/api/bandwidth?hours=${bandwidthRangeHours}`),
        ]);

        if (statusRes.ok) {
          setStatus(await statusRes.json());
        }
        if (bwRes.ok) {
          const raw: { timestamp: string; rx: number; tx: number }[] = await bwRes.json();
          setBandwidthData(
            raw.map((s) => ({
              timestamp: new Date(s.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              rx: s.rx,
              tx: s.tx,
            }))
          );
        }
      } catch {
        // Server may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [bandwidthRangeHours]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[380px]" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const peers: WgPeer[] = status?.peers || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
      <StatCards
        serverRunning={status?.running ?? false}
        totalPeers={status?.clientCount ?? 0}
        activePeers={status?.activeClients ?? 0}
        onlinePeers={status?.onlineClients ?? 0}
        totalRx={status?.totalTransferRx ?? 0}
        totalTx={status?.totalTransferTx ?? 0}
      />
      <BandwidthChart
        data={bandwidthData}
        selectedRangeHours={bandwidthRangeHours}
        onRangeChange={setBandwidthRangeHours}
      />
      <RecentPeers peers={peers} />
    </div>
  );
}
