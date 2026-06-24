import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const API_PREFIX = "/api/";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate session server-side
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith(API_PREFIX);

  // API routes must never be redirected to the login page — they must return
  // JSON. The route handler will return its own 401 if it needs auth.
  // Following the redirect from a POST /api/push/subscribe to /auth/login
  // produces a 405 INVALID_REQUEST_METHOD and swallows the real error.
  if (isApiRoute) {
    return supabaseResponse;
  }

  // If no valid session and trying to access a protected page, redirect to login
  const isProtectedPage = !pathname.startsWith("/auth");
  if (!user && isProtectedPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    // Preserve the intended destination for post-login redirect
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If has session and trying to access auth pages, redirect to dashboard
  if (user && pathname.startsWith("/auth")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}