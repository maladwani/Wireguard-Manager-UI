"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import {
  Wifi,
  WifiOff,
  Users,
  Radio,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
} from "lucide-react";

interface LogEntry {
  id: string;
  event: string;
  ipAddress: string | null;
  details: string | null;
  createdAt: string;
}

interface MonitorClient {
  id: string;
  name: string;
  email: string | null;
  publicKey: string;
  address: string;
  dataUsage: string;
  enabled: boolean;
  isOnline: boolean;
  lastHandshake: string | null;
  lastEndpoint: string | null;
  createdAt: string;
  logs: LogEntry[];
  liveTransferRx?: number;
  liveTransferTx?: number;
}

interface MonitorData {
  clients: MonitorClient[];
  summary: { online: number; offline: number; total: number };
}

type StatusFilter = "all" | "online" | "offline";

export default function MonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();

  function relativeTime(dateStr: string | null): string {
    if (!dateStr) return t("common.never");
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 0) return t("monitor.justNow");
    if (diff < 60) return t("monitor.sAgo", { n: diff });
    if (diff < 3600) return t("monitor.mAgo", { n: Math.floor(diff / 60) });
    if (diff < 86400) return t("monitor.hAgo", { n: Math.floor(diff / 3600) });
    return t("monitor.dAgo", { n: Math.floor(diff / 86400) });
  }

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch(`/api/clients/monitor?status=${filter}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error(t("monitor.fetchError"));
      }
    } catch {
      toast.error(t("monitor.fetchError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, t]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(() => fetchData(), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("monitor.title")}</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const summary = data?.summary ?? { online: 0, offline: 0, total: 0 };
  const clients = data?.clients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("monitor.title")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className={`shadow-sm cursor-pointer transition-colors ${filter === "online" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter(filter === "online" ? "all" : "online")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common.online")}</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{summary.online}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("monitor.connectedNow")}</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm cursor-pointer transition-colors ${filter === "offline" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter(filter === "offline" ? "all" : "offline")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common.offline")}</CardTitle>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.offline}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("monitor.disconnected")}</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm cursor-pointer transition-colors ${filter === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("monitor.total")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("monitor.allClients")}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4" />
            {t("monitor.clientActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("monitor.noClients")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("monitor.status")}</TableHead>
                    <TableHead>{t("monitor.client")}</TableHead>
                    <TableHead>{t("monitor.address")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("monitor.lastEndpoint")}</TableHead>
                    <TableHead>{t("monitor.lastHandshake")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("monitor.transfer")}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t("monitor.recentActivity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Badge
                          variant={client.isOnline ? "default" : "secondary"}
                          className={client.isOnline ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {client.isOnline ? (
                            <><Wifi className="h-3 w-3 mr-1" /> {t("common.online")}</>
                          ) : (
                            <><WifiOff className="h-3 w-3 mr-1" /> {t("common.offline")}</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{client.name}</div>
                        {client.email && (
                          <div className="text-xs text-muted-foreground">{client.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{client.address}</TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-sm">
                        {client.lastEndpoint || "-"}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="flex items-center gap-1 text-sm cursor-default">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {relativeTime(client.lastHandshake)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {client.lastHandshake
                              ? formatDateTime(client.lastHandshake)
                              : t("monitor.noHandshake")}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {client.liveTransferRx != null && client.liveTransferTx != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1">
                              <ArrowDownToLine className="h-3 w-3 text-blue-500" />
                              {formatBytes(client.liveTransferRx)}
                            </span>
                            <span className="flex items-center gap-1">
                              <ArrowUpFromLine className="h-3 w-3 text-green-500" />
                              {formatBytes(client.liveTransferTx)}
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1">
                            <ArrowDownToLine className="h-3 w-3 text-blue-500" />
                            {formatBytes(parseInt(client.dataUsage || "0"))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="space-y-1 max-w-[260px]">
                          {client.logs.length === 0 ? (
                            <span className="text-xs text-muted-foreground">{t("common.noActivity")}</span>
                          ) : (
                            client.logs.slice(0, 3).map((log) => (
                              <div key={log.id} className="flex items-center gap-1.5 text-xs">
                                <Badge
                                  variant={log.event === "connected" ? "default" : "secondary"}
                                  className={`text-[10px] px-1.5 py-0 ${
                                    log.event === "connected"
                                      ? "bg-green-600 hover:bg-green-700"
                                      : ""
                                  }`}
                                >
                                  {log.event}
                                </Badge>
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {relativeTime(log.createdAt)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
