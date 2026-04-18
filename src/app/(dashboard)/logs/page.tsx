"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LogEntry {
  id: string;
  clientId: string;
  event: string;
  ipAddress: string | null;
  details: string | null;
  createdAt: string;
  client: { name: string };
}

interface ClientOption {
  id: string;
  name: string;
}

const eventConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  created:      { variant: "outline" },
  connected:    { variant: "default", className: "bg-green-600 hover:bg-green-700" },
  disconnected: { variant: "destructive" },
  enabled:      { variant: "default", className: "bg-blue-600 hover:bg-blue-700" },
  disabled:     { variant: "secondary" },
  deleted:      { variant: "destructive" },
  handshake:    { variant: "outline" },
  error:        { variant: "destructive" },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [eventFilter, setEventFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ClientOption[]) => setClients(data))
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (eventFilter !== "all") params.set("event", eventFilter);
      if (clientFilter !== "all") params.set("clientId", clientFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalPages(data.totalPages);
      }
    } catch {
      toast.error(t("logs.fetchError"));
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, clientFilter, fromDate, toDate, t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("logs.title")}</h1>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("logs.title")}</h1>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("logs.eventType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("logs.allEvents")}</SelectItem>
            <SelectItem value="created">{t("logs.created")}</SelectItem>
            <SelectItem value="connected">{t("logs.connected")}</SelectItem>
            <SelectItem value="disconnected">{t("logs.disconnected")}</SelectItem>
            <SelectItem value="enabled">{t("logs.enabled")}</SelectItem>
            <SelectItem value="disabled">{t("logs.disabled")}</SelectItem>
            <SelectItem value="deleted">{t("logs.deleted")}</SelectItem>
            <SelectItem value="handshake">{t("logs.handshake")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("logs.allClients")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("logs.allClients")}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="w-[160px]"
          />
          <span className="text-sm text-muted-foreground">{t("common.to")}</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="w-[160px]"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("logs.timestamp")}</TableHead>
              <TableHead>{t("logs.client")}</TableHead>
              <TableHead>{t("logs.event")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("logs.ipAddress")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("logs.details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("logs.noLogs")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const config = eventConfig[log.event] || { variant: "outline" as const };
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.client?.name || (
                        <span className="text-muted-foreground italic text-sm">
                          {t("logs.deletedClient")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className={config.className}>
                        {log.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-sm">
                      {log.ipAddress || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[300px] truncate">
                      {log.details || "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("common.page")} {page} {t("common.of")} {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
