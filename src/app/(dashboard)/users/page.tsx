"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserTable, type UserData } from "@/components/users/user-table";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useTranslation } from "@/lib/i18n";

export default function UsersPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      toast.error(t("users.fetchError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || t("users.createError"));
      throw new Error(err.error);
    }
    toast.success(t("users.createSuccess"));
    fetchUsers();
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editUser) return;
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || t("users.updateError"));
      throw new Error(err.error);
    }
    toast.success(t("users.updateSuccess"));
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t("users.deleteError"));
        return;
      }
      toast.success(t("users.deleteSuccess"));
      setDeleteOpen(false);
      fetchUsers();
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <Button onClick={() => { setEditUser(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("users.addUser")}
        </Button>
      </div>

      <UserTable
        users={users}
        currentUserId={session?.user?.id || ""}
        onEdit={(u) => { setEditUser(u); setFormOpen(true); }}
        onDelete={(u) => { setDeleteUser(u); setDeleteOpen(true); }}
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editUser}
        onSubmit={editUser ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("users.deleteUser")}
        description={t("users.deleteConfirm").replace("{name}", deleteUser?.name || "")}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
