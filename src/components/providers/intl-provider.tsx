"use client";

import { NextIntlClientProvider } from "next-intl";
import en from "@/lib/i18n/locales/en.json";
import id from "@/lib/i18n/locales/id.json";
import zh from "@/lib/i18n/locales/zh.json";
import { useLocaleStore } from "@/stores/locale-store";

const messages = { en, id, zh };

export function IntlProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = useLocaleStore();

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale as keyof typeof messages] || messages.en}>
      {children}
    </NextIntlClientProvider>
  );
}
