"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";

interface QRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export function QRDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: QRDialogProps) {
  const [config, setConfig] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    fetch(`/api/clients/${clientId}/qrcode`)
      .then((res) => res.json())
      .then((data) => setConfig(data.config || ""))
      .catch(() => setConfig(""))
      .finally(() => setLoading(false));
  }, [open, clientId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("clients.qrCode")} - {clientName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          {loading ? (
            <Skeleton className="h-64 w-64" />
          ) : config ? (
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={config} size={256} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("clients.qrCodeFailed")}
            </p>
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground">
          {t("clients.qrCodeScan")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
