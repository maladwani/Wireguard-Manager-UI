"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Settings,
  Network,
  Radio,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { useTranslation } from "@/lib/i18n";
import type { UserRole } from "@/types";
import type { TranslationKey } from "@/components/providers/language-provider";

interface NavItem {
  titleKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { titleKey: "nav.clients", href: "/clients", icon: Network },
  { titleKey: "nav.monitor", href: "/monitor", icon: Radio },
  { titleKey: "nav.users", href: "/users", icon: Users, roles: ["super_admin"] },
  { titleKey: "nav.logs", href: "/logs", icon: ScrollText },
  { titleKey: "nav.settings", href: "/settings", icon: Settings, roles: ["super_admin"] },
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const { t } = useTranslation();

  const filteredItems = navItems.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="flex h-16 items-center gap-2 px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <SheetTitle className="font-bold text-lg">{t("nav.brand")}</SheetTitle>
          </div>
        </SheetHeader>
        <nav className="px-3 py-4 space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.titleKey)}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
