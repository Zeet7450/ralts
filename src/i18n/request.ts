import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "id", "zh"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale ?? "en";

  if (!locales.includes(locale as Locale)) notFound();

  return {
    locale,
    timeZone: "Asia/Jakarta",
    messages: (await import(`../lib/i18n/locales/${locale}.json`)).default,
  };
});
