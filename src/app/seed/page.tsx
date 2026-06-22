"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SeedPage() {
  const router = useRouter();

  useEffect(() => {
    // Data is already seeded in the database.
    // Redirect to login with demo=true to auto-trigger magic link for verrel.gunawan555@gmail.com
    router.replace("/auth/login?demo=true");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-4xl font-bold tracking-tight text-text-primary">RALTS</div>
        <p className="text-sm text-text-secondary">Personal command center</p>
        <div className="bg-surface rounded-xl p-6 space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-text-secondary">Signing you in...</p>
        </div>
      </div>
    </div>
  );
}
