"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Download,
  Edit,
  MoreHorizontal,
  QrCode,
  Trash2,
  Mail,
  Send,
  Loader2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatBytes, formatDate } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import type { UserRole } from "@/types";

export interface ClientData {
  id: string;
  name: string;
  email: string | null;
  publicKey: string;
  allowedIPs: string;
  address: string;
  dns: string | null;
  dataUsage: string;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
}

interface ClientTableProps {
  clients: ClientData[];
  onEdit: (client: ClientData) => void;
  onDelete: (client: ClientData) => void;
  onQrCode: (client: ClientData) => void;
  onDownload: (client: ClientData) => void;
}

function useClientStatus() {
  const { t } = useTranslation();
  return (client: ClientData): {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    key: string;
  } => {
    if (!client.enabled) return { label: t("common.disabled"), variant: "secondary", key: "disabled" };
    if (client.expiresAt && new Date(client.expiresAt) < new Date())
      return { label: t("common.expired"), variant: "destructive", key: "expired" };
    return { label: t("common.active"), variant: "default", key: "active" };
  };
}

export function ClientTable({
  clients,
  onEdit,
  onDelete,
  onQrCode,
  onDownload,
}: ClientTableProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;
  const canWrite = userRole === "super_admin" || userRole === "admin";
  const { t } = useTranslation();
  const getClientStatus = useClientStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Email send dialog
  const [emailDialogClient, setEmailDialogClient] = useState<ClientData | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Telegram send dialog
  const [telegramDialogClient, setTelegramDialogClient] = useState<ClientData | null>(null);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [sendingTelegram, setSendingTelegram] = useState(false);

  // Integration config (whether SMTP/Telegram are configured + default chat ID)
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [defaultChatId, setDefaultChatId] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings || {};
        setSmtpConfigured(!!s.smtpHost);
        setDefaultChatId(s.telegramChatId || "");
      })
      .catch(() => {});
  }, []);

  function openEmailDialog(client: ClientData) {
    if (!smtpConfigured) {
      toast.warning(t("clients.sendEmailNotConfigured"));
      return;
    }
    setEmailTo(client.email || "");
    setEmailDialogClient(client);
  }

  function openTelegramDialog(client: ClientData) {
    const hasToken = true; // We only know the setting is there; let API validate
    if (!hasToken && !defaultChatId) {
      toast.warning(t("clients.sendTelegramNotConfigured"));
      return;
    }
    setTelegramChatId(defaultChatId);
    setTelegramDialogClient(client);
  }

  async function sendEmail() {
    if (!emailDialogClient || !emailTo) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/clients/${emailDialogClient.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(t("clients.sendEmailSuccess").replace("{email}", emailTo));
      setEmailDialogClient(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("clients.sendEmailError"));
    } finally {
      setSendingEmail(false);
    }
  }

  async function sendTelegram() {
    if (!telegramDialogClient || !telegramChatId) return;
    setSendingTelegram(true);
    try {
      const res = await fetch(`/api/clients/${telegramDialogClient.id}/send-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: telegramChatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(t("clients.sendTelegramSuccess"));
      setTelegramDialogClient(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("clients.sendTelegramError"));
    } finally {
      setSendingTelegram(false);
    }
  }

  const filtered = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === "all") return matchesSearch;
    const status = getClientStatus(c);
    return matchesSearch && status.key === statusFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={t("clients.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("clients.statusFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("clients.allStatus")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="disabled">{t("common.disabled")}</SelectItem>
            <SelectItem value="expired">{t("common.expired")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("clients.name")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("clients.email")}</TableHead>
              <TableHead>{t("clients.ipAddress")}</TableHead>
              <TableHead>{t("dashboard.status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("clients.dataUsage")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("clients.expires")}</TableHead>
              {canWrite && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 7 : 6}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("clients.noClients")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => {
                const status = getClientStatus(client);
                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {client.email || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {client.address.replace("/32", "")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatBytes(parseInt(client.dataUsage || "0"))}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {client.expiresAt
                        ? formatDate(client.expiresAt)
                        : t("common.never")}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onDownload(client)}>
                              <Download className="mr-2 h-4 w-4" />
                              {t("clients.downloadConfig")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onQrCode(client)}>
                              <QrCode className="mr-2 h-4 w-4" />
                              {t("clients.showQrCode")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEdit(client)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEmailDialog(client)}>
                              <Mail className="mr-2 h-4 w-4" />
                              {t("clients.sendViaEmail")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTelegramDialog(client)}>
                              <Send className="mr-2 h-4 w-4" />
                              {t("clients.sendViaTelegram")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => onDelete(client)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {/* Send via Email dialog */}
      <Dialog open={!!emailDialogClient} onOpenChange={(o) => !o && setEmailDialogClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clients.sendEmailDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("clients.sendEmailLabel")}</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                disabled={sendingEmail}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogClient(null)} disabled={sendingEmail}>
              {t("common.cancel")}
            </Button>
            <Button onClick={sendEmail} disabled={sendingEmail || !emailTo}>
              {sendingEmail ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {sendingEmail ? t("clients.sendEmailSending") : t("clients.sendEmailSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send via Telegram dialog */}
      <Dialog open={!!telegramDialogClient} onOpenChange={(o) => !o && setTelegramDialogClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clients.sendTelegramDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("clients.sendTelegramLabel")}</Label>
              <Input
                placeholder="123456789"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                disabled={sendingTelegram}
              />
              <p className="text-xs text-muted-foreground">{t("clients.sendTelegramHelp")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTelegramDialogClient(null)} disabled={sendingTelegram}>
              {t("common.cancel")}
            </Button>
            <Button onClick={sendTelegram} disabled={sendingTelegram || !telegramChatId}>
              {sendingTelegram ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sendingTelegram ? t("clients.sendTelegramSending") : t("clients.sendTelegramSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
