import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Handle demo mode auto-login (set by /api/seed)
  const demoSeeded = request.cookies.get("demo-seeded")?.value;
  if (demoSeeded) {
    // Already seeded — let normal auth flow handle it via session cookies
    return await updateSession(request);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api/auth/check|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)",
  ],
};
