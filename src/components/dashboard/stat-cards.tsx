"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";

interface StatCardsProps {
  serverRunning: boolean;
  totalPeers: number;
  activePeers: number;
  onlinePeers: number;
  totalRx: number;
  totalTx: number;
}

export function StatCards({
  serverRunning,
  totalPeers,
  activePeers,
  onlinePeers,
  totalRx,
  totalTx,
}: StatCardsProps) {
  const { t } = useTranslation();

  const cards = [
    {
      title: t("dashboard.serverStatus"),
      value: serverRunning ? t("common.online") : t("common.offline"),
      icon: Activity,
      extra: (
        <Badge variant={serverRunning ? "default" : "destructive"}>
          {serverRunning ? t("dashboard.running") : t("dashboard.down")}
        </Badge>
      ),
    },
    {
      title: t("dashboard.totalClients"),
      value: totalPeers.toString(),
      icon: Users,
      description: t("dashboard.onlineNow", { online: onlinePeers, enabled: activePeers }),
    },
    {
      title: t("dashboard.download"),
      value: formatBytes(totalTx),
      icon: ArrowDownToLine,
      description: t("dashboard.totalReceived"),
    },
    {
      title: t("dashboard.upload"),
      value: formatBytes(totalRx),
      icon: ArrowUpFromLine,
      description: t("dashboard.totalSent"),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            )}
            {card.extra && <div className="mt-1">{card.extra}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
