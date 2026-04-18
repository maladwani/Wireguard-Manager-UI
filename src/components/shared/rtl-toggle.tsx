"use client";

import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";

export function RTLToggle() {
  const { setLocale, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors focus-visible:outline-none">
        <Languages className="h-4 w-4" />
        <span className="sr-only">{t("common.toggleDirection")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale("en")}>
          {t("common.english")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("ar")}>
          {t("common.arabic")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
