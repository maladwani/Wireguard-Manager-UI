"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Network,
  Radio,
  ScrollText,
  Settings,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { UserRole } from "@/types";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const { t } = useTranslation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full max-w-sm justify-start text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline-flex">{t("common.search")}</span>
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("nav.searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("common.noResults")}</CommandEmpty>
          <CommandGroup heading={t("nav.navigation")}>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/"))}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("nav.dashboard")}
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/clients"))}
            >
              <Network className="mr-2 h-4 w-4" />
              {t("nav.clients")}
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/monitor"))}
            >
              <Radio className="mr-2 h-4 w-4" />
              {t("nav.connectionMonitor")}
            </CommandItem>
            {role === "super_admin" && (
              <CommandItem
                onSelect={() => runCommand(() => router.push("/users"))}
              >
                <Users className="mr-2 h-4 w-4" />
                {t("nav.users")}
              </CommandItem>
            )}
            <CommandItem
              onSelect={() => runCommand(() => router.push("/logs"))}
            >
              <ScrollText className="mr-2 h-4 w-4" />
              {t("nav.logs")}
            </CommandItem>
            {role === "super_admin" && (
              <CommandItem
                onSelect={() => runCommand(() => router.push("/settings"))}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t("nav.settings")}
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
