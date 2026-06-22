"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function CallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setError(error?.message || "Authentication failed");
        return;
      }

      router.replace("/dashboard");
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-8">
        <div className="relative w-7 h-7">
          <Image
            src="/icons/android-chrome-192x192.png"
            alt="Ralts"
            fill
            className="object-contain"
            sizes="28px"
          />
        </div>
        <span className="text-base font-semibold text-text-primary tracking-tight">RALTS</span>
      </div>

      {error ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => router.replace("/auth/login")}
            className="text-sm text-accent hover:underline"
          >
            Go back to login
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" strokeWidth={1.5} />
          <p className="text-sm text-text-secondary">Signing you in...</p>
        </div>
      )}
    </div>
  );
}