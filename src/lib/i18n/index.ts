export { en, type Dictionary } from "./en";
export { ar } from "./ar";
export { useTranslation } from "./use-translation";

export type Locale = "en" | "ar";

export const locales: Record<Locale, { label: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", dir: "ltr" },
  ar: { label: "العربية", dir: "rtl" },
};
