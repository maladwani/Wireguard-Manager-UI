"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import type { ClientData } from "./client-table";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientData | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSubmit,
}: ClientFormDialogProps) {
  const isEdit = !!client;
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(client?.name || "");
  const [email, setEmail] = useState(client?.email || "");
  const [dns, setDns] = useState(client?.dns || "");
  const [allowedIPs, setAllowedIPs] = useState("");
  const [expiresAt, setExpiresAt] = useState(
    client?.expiresAt ? client.expiresAt.split("T")[0] : ""
  );
  const [enabled, setEnabled] = useState(client?.enabled ?? true);

  useEffect(() => {
    if (!open || isEdit) return;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const s = data.settings || {};
        if (!dns) setDns(s.defaultDns || "1.1.1.1, 8.8.8.8");
        if (!allowedIPs) setAllowedIPs(s.defaultAllowedIPs || "0.0.0.0/0, ::/0");
      })
      .catch(() => {
        if (!dns) setDns("1.1.1.1, 8.8.8.8");
        if (!allowedIPs) setAllowedIPs("0.0.0.0/0, ::/0");
      });
  }, [open, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await onSubmit({
          name,
          email,
          enabled,
          expiresAt: expiresAt || null,
        });
      } else {
        await onSubmit({ name, email, dns, allowedIPs, expiresAt: expiresAt || undefined });
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("clients.editClient") : t("clients.addNewClient")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">{t("clients.name")}</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("clients.clientName")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">{t("clients.emailOptional")}</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("clients.emailPlaceholder")}
            />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-dns">{t("clients.dns")}</Label>
                <Input
                  id="client-dns"
                  value={dns}
                  onChange={(e) => setDns(e.target.value)}
                  placeholder="1.1.1.1, 8.8.8.8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-allowed-ips">{t("clients.allowedIPs")}</Label>
                <Input
                  id="client-allowed-ips"
                  value={allowedIPs}
                  onChange={(e) => setAllowedIPs(e.target.value)}
                  placeholder="0.0.0.0/0, ::/0"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="client-expires">{t("clients.expiryDate")}</Label>
            <Input
              id="client-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          {isEdit && (
            <div className="flex items-center justify-between">
              <Label htmlFor="client-enabled">{t("common.enabled")}</Label>
              <Switch
                id="client-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
