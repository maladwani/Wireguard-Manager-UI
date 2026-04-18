"use client";

import { useContext } from "react";
import { LanguageContext, type LanguageContextType } from "@/components/providers/language-provider";

export function useTranslation(): LanguageContextType {
  return useContext(LanguageContext);
}
