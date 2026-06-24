import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DEMO_EMAIL = "verrel.gunawan555@gmail.com";
const DEMO_PASSWORD = "demo-password-ralts-2024";
const DEMO_USER_ID = "a4b5c6d7-e8f9-0a1b-2c3d-4e5f6a7b8c9d";

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-dev-secret");
  if (secret !== process.env.DEV_SECRET_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = getServiceClient();
  const now = new Date();

  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const dateStr = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().split("T")[0];
  const futureStr = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  try {
    // 1. Ensure demo user exists
    let userId = DEMO_USER_ID;
    try {
      const { data: authUser } = await serviceClient.auth.admin.createUser({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Verrel Gunawan" },
      });
      if (authUser?.user) userId = authUser.user.id;
    } catch {
      // User may already exist — try to get by ID
      try {
        const { data: existing } = await serviceClient.auth.admin.getUserById(DEMO_USER_ID);
        if (existing?.user) userId = existing.user.id;
      } catch { /* ignore */ }
    }

    // 2. Transactions (30 days)
    const transactions = [
      { id: crypto.randomUUID(), user_id: userId, amount: 38000, type: "expense", category: "Food", description: "Nasi padang lunch", date: dateStr(0), created_at: daysAgo(0) },
      { id: crypto.randomUUID(), user_id: userId, amount: 95000, type: "expense", category: "Transport", description: "GoRide to campus", date: dateStr(0), created_at: daysAgo(0) },
      { id: crypto.randomUUID(), user_id: userId, amount: 8500000, type: "income", category: "Salary", description: "Monthly salary PT Astra", date: dateStr(1), created_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, amount: 127000, type: "expense", category: "Bills", description: "Phone plan", date: dateStr(1), created_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, amount: 42000, type: "expense", category: "Food", description: "Groceries at Alfamart", date: dateStr(1), created_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, amount: 65000, type: "expense", category: "Food", description: "Coffee at Kopi Oey + snacks", date: dateStr(2), created_at: daysAgo(2) },
      { id: crypto.randomUUID(), user_id: userId, amount: 280000, type: "expense", category: "Shopping", description: "USB-C hub for laptop", date: dateStr(2), created_at: daysAgo(2) },
      { id: crypto.randomUUID(), user_id: userId, amount: 50000, type: "income", category: "Freelance", description: "Bug fix on client Next.js project", date: dateStr(3), created_at: daysAgo(3) },
      { id: crypto.randomUUID(), user_id: userId, amount: 75000, type: "expense", category: "Entertainment", description: "Spotify + YouTube Premium", date: dateStr(3), created_at: daysAgo(3) },
      { id: crypto.randomUUID(), user_id: userId, amount: 185000, type: "expense", category: "Food", description: "Team celebration dinner", date: dateStr(3), created_at: daysAgo(3) },
      { id: crypto.randomUUID(), user_id: userId, amount: 25000, type: "expense", category: "Food", description: "Goride + lunch", date: dateStr(4), created_at: daysAgo(4) },
      { id: crypto.randomUUID(), user_id: userId, amount: 150000, type: "expense", category: "Health", description: "Gym weekly pass", date: dateStr(4), created_at: daysAgo(4) },
      { id: crypto.randomUUID(), user_id: userId, amount: 35000, type: "expense", category: "Food", description: "Morning coffee + breakfast", date: dateStr(5), created_at: daysAgo(5) },
      { id: crypto.randomUUID(), user_id: userId, amount: 175000, type: "expense", category: "Bills", description: "Internet WiFi", date: dateStr(5), created_at: daysAgo(5) },
      { id: crypto.randomUUID(), user_id: userId, amount: 220000, type: "expense", category: "Shopping", description: "Uniqlo shirt + socks", date: dateStr(6), created_at: daysAgo(6) },
      { id: crypto.randomUUID(), user_id: userId, amount: 55000, type: "expense", category: "Food", description: "Weekly groceries", date: dateStr(6), created_at: daysAgo(6) },
      { id: crypto.randomUUID(), user_id: userId, amount: 85000, type: "expense", category: "Transport", description: "Grab to client office", date: dateStr(7), created_at: daysAgo(7) },
      { id: crypto.randomUUID(), user_id: userId, amount: 75000, type: "expense", category: "Food", description: "Client lunch meeting", date: dateStr(7), created_at: daysAgo(7) },
      { id: crypto.randomUUID(), user_id: userId, amount: 45000, type: "expense", category: "Food", description: "Dinner", date: dateStr(8), created_at: daysAgo(8) },
      { id: crypto.randomUUID(), user_id: userId, amount: 120000, type: "expense", category: "Health", description: "Vitamin supplements", date: dateStr(9), created_at: daysAgo(9) },
      { id: crypto.randomUUID(), user_id: userId, amount: 1500000, type: "income", category: "Freelance", description: "Landing page project - UMKM client", date: dateStr(10), created_at: daysAgo(10) },
      { id: crypto.randomUUID(), user_id: userId, amount: 38000, type: "expense", category: "Food", description: "Lunch", date: dateStr(10), created_at: daysAgo(10) },
      { id: crypto.randomUUID(), user_id: userId, amount: 320000, type: "expense", category: "Shopping", description: "Mechanical keyboard switches", date: dateStr(12), created_at: daysAgo(12) },
      { id: crypto.randomUUID(), user_id: userId, amount: 55000, type: "expense", category: "Food", description: "Groceries", date: dateStr(12), created_at: daysAgo(12) },
      { id: crypto.randomUUID(), user_id: userId, amount: 85000, type: "expense", category: "Transport", description: "Fuel", date: dateStr(14), created_at: daysAgo(14) },
      { id: crypto.randomUUID(), user_id: userId, amount: 180000, type: "expense", category: "Bills", description: "Electricity bill", date: dateStr(14), created_at: daysAgo(14) },
      { id: crypto.randomUUID(), user_id: userId, amount: 65000, type: "expense", category: "Food", description: "Dinner with friends", date: dateStr(16), created_at: daysAgo(16) },
      { id: crypto.randomUUID(), user_id: userId, amount: 750000, type: "expense", category: "Shopping", description: "Monitor stand + cable management", date: dateStr(18), created_at: daysAgo(18) },
      { id: crypto.randomUUID(), user_id: userId, amount: 42000, type: "expense", category: "Food", description: "Groceries", date: dateStr(18), created_at: daysAgo(18) },
      { id: crypto.randomUUID(), user_id: userId, amount: 95000, type: "expense", category: "Entertainment", description: "Steam game - Hades II", date: dateStr(21), created_at: daysAgo(21) },
      { id: crypto.randomUUID(), user_id: userId, amount: 650000, type: "expense", category: "Bills", description: "Motorcycle insurance + tax", date: dateStr(21), created_at: daysAgo(21) },
      { id: crypto.randomUUID(), user_id: userId, amount: 8500000, type: "income", category: "Salary", description: "Monthly salary PT Astra", date: dateStr(23), created_at: daysAgo(23) },
      { id: crypto.randomUUID(), user_id: userId, amount: 48000, type: "expense", category: "Food", description: "Team lunch", date: dateStr(23), created_at: daysAgo(23) },
      { id: crypto.randomUUID(), user_id: userId, amount: 120000, type: "expense", category: "Shopping", description: "Notebook + pens for journaling", date: dateStr(25), created_at: daysAgo(25) },
      { id: crypto.randomUUID(), user_id: userId, amount: 38000, type: "expense", category: "Food", description: "Lunch", date: dateStr(25), created_at: daysAgo(25) },
      { id: crypto.randomUUID(), user_id: userId, amount: 150000, type: "expense", category: "Health", description: "Dental checkup", date: dateStr(28), created_at: daysAgo(28) },
      { id: crypto.randomUUID(), user_id: userId, amount: 55000, type: "expense", category: "Food", description: "Groceries", date: dateStr(28), created_at: daysAgo(28) },
      { id: crypto.randomUUID(), user_id: userId, amount: 500000, type: "income", category: "Freelance", description: "Logo design for coffee shop", date: dateStr(30), created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, amount: 85000, type: "expense", category: "Transport", description: "Grab to campus", date: dateStr(30), created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, amount: 2000000, type: "income", category: "Savings", description: "Emergency fund top-up", date: dateStr(10), created_at: daysAgo(10) },
    ];

    // 3. Budgets
    const currentMonth = now.toISOString().slice(0, 7);
    const budgets = [
      { id: crypto.randomUUID(), user_id: userId, category: "Food", month: currentMonth, amount: 2500000, created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, category: "Transport", month: currentMonth, amount: 600000, created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, category: "Bills", month: currentMonth, amount: 800000, created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, category: "Shopping", month: currentMonth, amount: 1000000, created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, category: "Health", month: currentMonth, amount: 400000, created_at: daysAgo(30) },
      { id: crypto.randomUUID(), user_id: userId, category: "Entertainment", month: currentMonth, amount: 300000, created_at: daysAgo(30) },
    ];

    // 4. Savings goals
    const savingsGoals = [
      { id: crypto.randomUUID(), user_id: userId, name: "6-month emergency fund", target_amount: 30000000, current_amount: 14750000, deadline: new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString(), created_at: daysAgo(90) },
      { id: crypto.randomUUID(), user_id: userId, name: "New laptop fund", target_amount: 18000000, current_amount: 6200000, deadline: new Date(now.getFullYear(), now.getMonth() + 3, 15).toISOString(), created_at: daysAgo(60) },
      { id: crypto.randomUUID(), user_id: userId, name: "Bali trip", target_amount: 8000000, current_amount: 8000000, deadline: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString(), created_at: daysAgo(45) },
    ];

    // 5. Tasks
    const tasks = [
      { id: crypto.randomUUID(), user_id: userId, title: "Fix authentication redirect bug", description: "Users getting logged out on finance page. Investigate Supabase session refresh.", checklist: [{ id: crypto.randomUUID(), text: "Reproduce the issue", done: true }, { id: crypto.randomUUID(), text: "Check middleware session logic", done: false }, { id: crypto.randomUUID(), text: "Deploy fix", done: false }], due_date: new Date(now.getTime() - 2 * 86400000).toISOString(), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(5), updated_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, title: "Submit project proposal draft", description: "Capstone proposal for Dr. Wijaya. Need timeline and tech stack.", checklist: [], due_date: new Date(now.getTime() - 86400000).toISOString(), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(7), updated_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, title: "Review PR #42 — dark mode toggle", description: "Check accessibility contrast ratios on the new theme switcher.", checklist: [{ id: crypto.randomUUID(), text: "Test in light mode", done: true }, { id: crypto.randomUUID(), text: "Test in dark mode", done: true }, { id: crypto.randomUUID(), text: "Check contrast ratios", done: false }], due_date: new Date(now.getTime() + 5 * 3600000).toISOString(), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(1), updated_at: daysAgo(0) },
      { id: crypto.randomUUID(), user_id: userId, title: "Write weekly reflection", description: "Review this week's progress — shipped dashboard and fixed notification bug.", checklist: [], due_date: new Date(now.getTime() + 8 * 3600000).toISOString(), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, title: "Pay electricity bill", description: "PLN token purchase before cutoff.", checklist: [], due_date: new Date(now.getTime() + 3 * 3600000).toISOString(), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
      { id: crypto.randomUUID(), user_id: userId, title: "Finalize RALTS pitch deck", description: "Prepare slides for internship interview. Focus on PWA offline capabilities.", checklist: [{ id: crypto.randomUUID(), text: "Overview slide", done: true }, { id: crypto.randomUUID(), text: "Tech stack slide", done: false }, { id: crypto.randomUUID(), text: "Demo recording", done: false }, { id: crypto.randomUUID(), text: "Future roadmap", done: false }], due_date: futureStr(3), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(3), updated_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, title: "Set up GitHub Actions CI/CD", description: "Auto-deploy to Vercel on merge to main. Include lint and type checks.", checklist: [], due_date: futureStr(7), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(3), updated_at: daysAgo(3) },
      { id: crypto.randomUUID(), user_id: userId, title: "Update portfolio case study", description: "Add RALTS to projects with screenshots and tech stack.", checklist: [], due_date: futureStr(10), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(10), updated_at: daysAgo(10) },
      { id: crypto.randomUUID(), user_id: userId, title: "Doctor appointment", description: "Annual health check at Siloam Hospital. Fasting required.", checklist: [], due_date: futureStr(12), reminder_times: [], is_completed: false, completed_at: null, created_at: daysAgo(5), updated_at: daysAgo(5) },
      { id: crypto.randomUUID(), user_id: userId, title: "Ship dashboard redesign", description: "New dashboard with activity feed and module shortcuts.", checklist: [], due_date: daysAgo(3), reminder_times: [], is_completed: true, completed_at: daysAgo(2), created_at: daysAgo(8), updated_at: daysAgo(2) },
      { id: crypto.randomUUID(), user_id: userId, title: "Fix notification bug on iOS", description: "Push notifications not showing when app is in foreground.", checklist: [], due_date: daysAgo(4), reminder_times: [], is_completed: true, completed_at: daysAgo(3), created_at: daysAgo(6), updated_at: daysAgo(3) },
      { id: crypto.randomUUID(), user_id: userId, title: "Update Figma components", description: "Sync design tokens with new spacing system.", checklist: [], due_date: daysAgo(5), reminder_times: [], is_completed: true, completed_at: daysAgo(4), created_at: daysAgo(10), updated_at: daysAgo(4) },
      { id: crypto.randomUUID(), user_id: userId, title: "Set up Supabase project", description: "Initialize RALTS, configure auth and database schemas.", checklist: [], due_date: daysAgo(14), reminder_times: [], is_completed: true, completed_at: daysAgo(14), created_at: daysAgo(21), updated_at: daysAgo(14) },
    ];

    // 6. Ideas
    const ideas = [
      { id: crypto.randomUUID(), user_id: userId, title: "Habit tracker app for Android", description: "Minimal habit tracker with streak system and offline-first sync. One-time paid app targeting users who want simplicity.", tech_stack: ["Kotlin", "Room DB", "Jetpack Compose", "WorkManager"], tags: ["android", "productivity", "health"], status: "active", last_activity_at: daysAgo(1), created_at: daysAgo(14), updated_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, title: "Personal finance API wrapper", description: "Unified dashboard aggregating BCA, Mandiri, OVO, GoPay into one view. Solves real pain of juggling multiple finance apps.", tech_stack: ["Node.js", "Express", "PostgreSQL", "Redis"], tags: ["fintech", "api", "automation"], status: "active", last_activity_at: daysAgo(0), created_at: daysAgo(7), updated_at: daysAgo(0) },
      { id: crypto.randomUUID(), user_id: userId, title: "Markdown blog engine with live preview", description: "Static site generator for developers who write in MDX but deploy anywhere. Built-in dark mode and image optimization.", tech_stack: ["Next.js", "MDX", "Vercel", "Cloudflare Pages"], tags: ["web", "writing", "developer-tools"], status: "in-progress", last_activity_at: daysAgo(3), created_at: daysAgo(21), updated_at: daysAgo(3) },
      { id: crypto.randomUUID(), user_id: userId, title: "Local-first to-do app with CRDT sync", description: "Offline-capable todo using Yjs for conflict-free sync. No accounts — data stays on device unless user opts in.", tech_stack: ["React", "Yjs", "IndexedDB", "Electron"], tags: ["productivity", "local-first", "sync"], status: "active", last_activity_at: daysAgo(10), created_at: daysAgo(30), updated_at: daysAgo(10) },
      { id: crypto.randomUUID(), user_id: userId, title: "CLI time tracker for freelancers", description: "Terminal tool to track billable hours. Outputs CSV summaries for invoicing. Supports tags, notes, daily/weekly totals.", tech_stack: ["Rust", "SQLite", "Clap"], tags: ["devtools", "productivity", "cli"], status: "completed", last_activity_at: daysAgo(25), created_at: daysAgo(45), updated_at: daysAgo(25) },
      { id: crypto.randomUUID(), user_id: userId, title: "Campus lost-and-found platform", description: "Web app for university students to report and claim lost items. QR codes, notifications, admin verification.", tech_stack: ["Next.js", "Supabase", "QR Code API"], tags: ["social", "university", "full-stack"], status: "active", last_activity_at: daysAgo(18), created_at: daysAgo(40), updated_at: daysAgo(18) },
      { id: crypto.randomUUID(), user_id: userId, title: "Recipe bookmarker with meal planning", description: "Save recipes from any URL, organize into weekly plans, generate shopping lists. Auto-parses ingredients.", tech_stack: ["React", "Puppeteer", "PostgreSQL", "OpenAI"], tags: ["lifestyle", "food", "automation"], status: "archived", last_activity_at: daysAgo(60), created_at: daysAgo(90), updated_at: daysAgo(60) },
      { id: crypto.randomUUID(), user_id: userId, title: "Auto-generated weekly report from git history", description: "CLI reads git commits and JIRA tickets to generate weekly progress reports. Exports to PDF or Markdown.", tech_stack: ["Node.js", "simple-git", "JIRA API", "Handlebars"], tags: ["developer-tools", "automation", "git"], status: "in-progress", last_activity_at: daysAgo(5), created_at: daysAgo(12), updated_at: daysAgo(5) },
    ];

    // 7. Reflections
    const reflections = [
      { id: crypto.randomUUID(), user_id: userId, type: "weekly", period_start: new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0], period_end: new Date(now.getTime() - 1 * 86400000).toISOString().split("T")[0], content: "This week felt genuinely productive. Shipped the new dashboard with the activity feed — it's satisfying to see all module data connected. Fixed the notification bug that was nagging for days. Auth redirect issue still unresolved, need to tackle that Monday.\n\nFinance: tracked every expense, down to the last kopi oey. Food budget is going to be tight with team dinner and client lunches. Should reassess that limit.\n\nNext week: fix auth bug, finalize pitch deck for internship demo, start meal planning app.", status: "written", created_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: userId, type: "weekly", period_start: new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0], period_end: new Date(now.getTime() - 8 * 86400000).toISOString().split("T")[0], content: "Mixed week. Made good progress on markdown blog engine — live preview working. Got sidetracked by Supabase Edge Functions research, didn't finish CI/CD pipeline.\n\nCompleted capstone proposal and submitted. Dr. Wijaya's feedback was positive, just need to tighten timeline in section 3.\n\nHealth: went to gym 4 times. Lowest streak in a while but better than zero.\n\nReflection: Need to stop starting side projects when I'm supposed to be finishing. Recipe bookmarker archived — scope creep from day one.", status: "written", created_at: daysAgo(8) },
      { id: crypto.randomUUID(), user_id: userId, type: "monthly", period_start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0], period_end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0], content: "June 2026: Solid month for building. RALTS went from concept to deployed PWA. The offline-first approach with Supabase is working better than expected.\n\nBiggest W: Shipped RALTS v1. Fixed auth middleware issues. Got dashboard activity feed working with real data from all modules.\n\nBiggest L: Spent too much time on recipe bookmarker before archiving it. Should have killed it after week 1.\n\nFinance: Salary from Astra covers essentials. Freelance income from landing page project was a nice surprise. Emergency fund at 49% — stay disciplined.\n\nIdeas: 8 active. Most promising is the personal finance API wrapper — solves a real problem I have reconciling BCA and Mandiri apps every month.\n\nJuly goals: Land internship interview, get RALTS in front of 5 real users, hit 60% on emergency fund.", status: "written", created_at: daysAgo(20) },
      { id: crypto.randomUUID(), user_id: userId, type: "weekly", period_start: new Date(now.getTime() - 21 * 86400000).toISOString().split("T")[0], period_end: new Date(now.getTime() - 15 * 86400000).toISOString().split("T")[0], content: "Lower-output week. Finished capstone proposal and submitted. Exploratory coding on CLI time tracker — functional but error handling needs work.\n\nFinance tracking getting better. Started categorizing expenses immediately instead of batch-adding at end of day.\n\nNoticed social media consumption in evenings is too high. Going to try phone-down hour 8-9pm starting next week.", status: "written", created_at: daysAgo(15) },
    ];

    // 8. Clear existing data and insert fresh
    const tables = ["transactions", "tasks", "ideas", "category_budgets", "savings_goals", "reflections"];
    for (const table of tables) {
      await serviceClient.from(table).delete().eq("user_id", userId);
    }

    const insert = async (table: string, data: unknown[]) => {
      await serviceClient.from(table).insert(data);
    };

    await Promise.all([
      insert("transactions", transactions),
      insert("tasks", tasks),
      insert("ideas", ideas),
      insert("category_budgets", budgets),
      insert("savings_goals", savingsGoals),
      insert("reflections", reflections),
    ]);

    // 9. Create session for demo user using the SAME @supabase/ssr cookie shape
    // the rest of the app expects. Writing legacy cookie names here caused
    // subsequent API calls (e.g. /api/push/subscribe) to be treated as
    // unauthenticated by the middleware.
    const cookieStore = await cookies();
    const projectRef =
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    const authCookieName = `sb-${projectRef}-auth-token`;

    const { data: sessionData, error: signInError } = await serviceClient.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signInError || !sessionData?.session) {
      return NextResponse.json(
        { error: "Could not establish session. Did you set SUPABASE_SERVICE_ROLE_KEY?", details: signInError?.message },
        { status: 500 }
      );
    }

    const { session } = sessionData;

    // @supabase/ssr stores the session as a single chunked cookie containing
    // the base64url-encoded JSON `[access_token, refresh_token, ...]`.
    // We mirror that exact format so createServerClient() can read it back.
    const cookieValue = JSON.stringify([
      session.access_token,
      session.refresh_token,
      null, // provider token (null for password sign-in)
      null, // provider refresh token
      session.expires_in ?? 3600,
      session.expires_at,
      "authenticated",
      session.user?.id,
    ]);

    cookieStore.set(authCookieName, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    cookieStore.set("demo-seeded", "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.redirect(new URL("/dashboard", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  } catch (e) {
    console.error("Seed error:", e);
    return NextResponse.json({ error: "Seed failed", details: String(e) }, { status: 500 });
  }
}
