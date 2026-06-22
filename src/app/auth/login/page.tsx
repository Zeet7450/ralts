"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  // Auto-trigger demo login if ?demo=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true") {
      setEmail("verrel.gunawan555@gmail.com");
      const timer = setTimeout(() => {
        handleSubmit(new Event("submit") as unknown as React.FormEvent);
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Access denied");
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image
              src="/icons/android-chrome-192x192.png"
              alt="Ralts logo"
              fill
              className="object-contain"
              sizes="40px"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">RALTS</h1>
        </div>
        <p className="text-sm text-text-secondary">Your personal command center</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-surface rounded-xl p-6">
        {success ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-accent" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Check your email</p>
              <p className="text-sm text-text-secondary mt-1">
                We sent a magic link to <span className="text-text-primary">{email}</span>
              </p>
            </div>
            <button
              onClick={() => { setSuccess(false); setEmail(""); }}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-background border-border"
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-10 bg-accent text-white hover:bg-accent-hover active:bg-accent-active"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="text-xs">Sending...</span>
              ) : (
                "Continue with email"
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-text-tertiary mt-6 text-center">
        This app is private. Access is by invitation only.
      </p>
    </div>
  );
}