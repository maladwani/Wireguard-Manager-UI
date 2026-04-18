"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientTable, type ClientData } from "@/components/clients/client-table";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { QRDialog } from "@/components/clients/qr-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useTranslation } from "@/lib/i18n";
import type { UserRole } from "@/types";

export default function ClientsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;
  const canWrite = userRole === "super_admin" || userRole === "admin";
  const { t } = useTranslation();

  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientData | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrClient, setQrClient] = useState<ClientData | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteClient, setDeleteClient] = useState<ClientData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        setClients(await res.json());
      }
    } catch {
      toast.error(t("clients.fetchError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleCreate = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || t("clients.createError"));
      throw new Error(err.error);
    }
    toast.success(t("clients.createSuccess"));
    fetchClients();
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editClient) return;
    const res = await fetch(`/api/clients/${editClient.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || t("clients.updateError"));
      throw new Error(err.error);
    }
    toast.success(t("clients.updateSuccess"));
    fetchClients();
  };

  const handleDelete = async () => {
    if (!deleteClient) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/clients/${deleteClient.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t("clients.deleteError"));
        return;
      }
      toast.success(t("clients.deleteSuccess"));
      setDeleteOpen(false);
      fetchClients();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDownload = async (client: ClientData) => {
    try {
      const res = await fetch(`/api/clients/${client.id}/config`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${client.name}.conf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("clients.configDownloaded"));
    } catch {
      toast.error(t("clients.configDownloadError"));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("clients.title")}</h1>
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("clients.title")}</h1>
        {canWrite && (
          <Button onClick={() => { setEditClient(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("clients.addClient")}
          </Button>
        )}
      </div>

      <ClientTable
        clients={clients}
        onEdit={(c) => { setEditClient(c); setFormOpen(true); }}
        onDelete={(c) => { setDeleteClient(c); setDeleteOpen(true); }}
        onQrCode={(c) => { setQrClient(c); setQrOpen(true); }}
        onDownload={handleDownload}
      />

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editClient}
        onSubmit={editClient ? handleEdit : handleCreate}
      />

      {qrClient && (
        <QRDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          clientId={qrClient.id}
          clientName={qrClient.name}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("clients.deleteClient")}
        description={t("clients.deleteConfirm").replace("{name}", deleteClient?.name || "")}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
