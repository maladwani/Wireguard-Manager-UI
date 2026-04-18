"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import type { UserRole } from "@/types";

const roleVariants: Record<UserRole, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "secondary",
  auditor: "outline",
};

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation();

  const roleKey = `roles.${role}` as const;
  const variant = roleVariants[role] || "outline";
  const label = t(roleKey as Parameters<typeof t>[0]) || role;

  return <Badge variant={variant}>{label}</Badge>;
}
