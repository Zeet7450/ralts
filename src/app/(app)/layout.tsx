"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const { setUser, setLoading } = useAuthStore();
  const { locale } = useLocaleStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Sync locale to cookie for server-side i18n
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
  }, [locale]);

  useEffect(() => {
    // Get initial session locally (fast, no network round-trip on first load)
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email || "" });
          setLoading(false);
        } else {
          // No local session — redirect to login
          setUser(null);
          setLoading(false);
          router.replace("/auth/login");
          return;
        }
      } catch {
        setUser(null);
        setLoading(false);
        router.replace("/auth/login");
        return;
      } finally {
        setIsInitializing(false);
      }
    };

    getInitialSession();

    // Subscribe to auth state changes (handles token refresh, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setLoading(false);
        router.replace("/auth/login");
        return;
      }

      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || "" });
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase, setUser, setLoading]);

  // Show loading gate while initializing — prevents flash of login or app content
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}