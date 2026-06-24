"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  AlertCircle,
  CheckCircle2,
  WifiOff,
  RefreshCw,
  Smartphone,
  Monitor,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Capability states ──────────────────────────────────────────────────────
//
// Every capability probe reports a *truthful* state. We never conflate
// missing APIs with environment blocks, and we never default to "error"
// just because nothing is subscribed yet.

type NotificationSupport =
  | "available" // new Notification() works
  | "no-api" // Notification constructor is not on window
  | "insecure" // window.isSecureContext === false
  | "iframe" // running inside a frame without permission policy
  | "ios-needs-pwa"; // iOS Safari in regular browser tab

type PushSupport =
  | "available" // pushManager.subscribe() can succeed (SW + PushManager + HTTPS + VAPID)
  | "no-vapid" // SW + HTTPS, but NEXT_PUBLIC_VAPID_PUBLIC_KEY missing
  | "no-sw" // serviceWorker not exposed
  | "insecure" // not a secure context
  | "no-push-manager"; // browser doesn't expose PushManager on its SW

type PermissionStatus = "default" | "granted" | "denied" | "unavailable";
type SwState = "not-registered" | "registering" | "registered" | "error";
type PushState =
  | "no-subscription"
  | "subscribing"
  | "subscribed"
  | "error"
  | "not-configured";

// VAPID public key — exposed client-side by NEXT_PUBLIC_ prefix
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SW_URL = "/sw.js";
const SW_SCOPE = "/";

// ─── Diagnostic snapshot ────────────────────────────────────────────────────
//
// `liveTests` records the result of an actual `new Notification(...)` call
// the user can trigger from the UI. That is the only way to *prove* the
// local notification path works in the current browser/OS combination —
// capability probes can lie (e.g. SW controller is active but the SW API
// surface looks "missing" because of an SSR/hydration race).

type Diagnostic = {
  capturedAt: string;
  // Environment
  userAgent: string;
  origin: string;
  hostname: string;
  protocol: string;
  href: string;
  isSecureContext: boolean;
  isTopLevel: boolean;
  isInIframe: boolean;
  // API presence (read live from this window)
  typeofNotification: "function" | "undefined" | string;
  typeofServiceWorker: "object" | "undefined" | string;
  typeofNavigatorPushManager:
    | "function"
    | "undefined"
    | string;
  notificationPermissionValue: PermissionStatus;
  // SW state
  swControllerActive: boolean;
  swControllerScriptUrl: string | null;
  swRegistrationExists: boolean;
  swRegistrationPushManager: boolean;
  swRegistrationActive: boolean;
  // App state
  isStandalone: boolean;
  isIOS: boolean;
  vapidKeyPresent: boolean;
  vapidKeyLength: number;
  // Derived support
  notificationSupport: NotificationSupport;
  notificationSupportReason: string | null;
  pushSupport: PushSupport;
  pushSupportReason: string | null;
  // Live-test results (filled when the user clicks "Run live test")
  liveTestRan: boolean;
  liveTestPath: "constructor" | "service-worker" | null;
  liveTestError: string | null;
  liveTestNotificationTitle: string | null;
  // Subscription state
  lastEndpoint: string | null;
  subscribeError: string | null;
  sendError: string | null;
};

// ─── Pure helpers (no React state) ─────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  if (!base64String) return new ArrayBuffer(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & { name?: string; statusCode?: number; status?: number };
    if (anyErr.name === "NotAllowedError")
      return "Permission to subscribe was denied by the browser or user.";
    if (anyErr.name === "AbortError") return "Subscription was aborted. Please try again.";
    if (anyErr.name === "InvalidStateError")
      return "An existing subscription is in an invalid state. Unsubscribing and retrying…";
    if (anyErr.name === "NotSupportedError")
      return "Push notifications are not supported in this browser context.";
    if (anyErr.name === "NotFoundError")
      return "Service worker not registered yet. Please retry in a moment.";
    if (anyErr.name === "SecurityError")
      return "Security error — push requires HTTPS (or localhost) and an active service worker.";
    return err.message || err.name || String(err);
  }
  return String(err);
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

/**
 * Read every capability live from the current window. This is the *single
 * source of truth* for the diagnostic — no lazy useState initializers, no
 * derived state from a separate code path, no risk of mismatch.
 */
function readLiveCapabilities(): {
  notificationSupport: NotificationSupport;
  notificationSupportReason: string | null;
  pushSupport: PushSupport;
  pushSupportReason: string | null;
  permission: PermissionStatus;
  swControllerActive: boolean;
  swControllerScriptUrl: string | null;
  typeofNotification: string;
  typeofServiceWorker: string;
  typeofNavigatorPushManager: string;
  notificationPermissionValue: PermissionStatus;
  isSecureContext: boolean;
  isTopLevel: boolean;
  isInIframe: boolean;
} {
  const isIOS = isIOSDevice();
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean })?.standalone === true);

  const typeofNotification =
    typeof window !== "undefined" ? typeof window.Notification : "undefined";
  const typeofServiceWorker =
    typeof navigator !== "undefined" ? typeof navigator.serviceWorker : "undefined";
  // PushManager is a *property of ServiceWorkerRegistration*, not navigator.
  // We check it via a one-shot getRegistration so the diagnostic is honest.
  const hasNotificationConstructor = typeof window.Notification === "function";
  const hasServiceWorkerObject =
    typeof navigator !== "undefined" && typeof navigator.serviceWorker === "object";
  const isSecureContext =
    typeof window !== "undefined" ? window.isSecureContext : false;
  const isTopLevel =
    typeof window !== "undefined" ? window.self === window.top : true;
  const isInIframe = !isTopLevel;

  // Permission
  const notificationPermissionValue: PermissionStatus = hasNotificationConstructor
    ? (Notification.permission as PermissionStatus)
    : "unavailable";

  // Notification support ladder (priority order matters):
  //
  //   1. iOS Safari regular tab → "ios-needs-pwa"
  //   2. Not secure context (non-localhost http://) → "insecure"
  //   3. Secure context but Notification constructor missing → "no-api"
  //   4. iframe without allow="notifications" → "iframe"
  //   5. otherwise → "available"
  let notificationSupport: NotificationSupport = "available";
  let notificationSupportReason: string | null = null;
  if (isIOS && !isStandalone && !hasNotificationConstructor) {
    notificationSupport = "ios-needs-pwa";
    notificationSupportReason =
      "iOS Safari only exposes the Notification API when Ralts is launched from the Home Screen.";
  } else if (!isSecureContext) {
    notificationSupport = "insecure";
    notificationSupportReason = `Notifications require a secure context (HTTPS or http://localhost). The current origin (${window.location.origin}) is not secure, so the Notification and ServiceWorker APIs are intentionally hidden by the browser.`;
  } else if (!hasNotificationConstructor) {
    notificationSupport = "no-api";
    notificationSupportReason =
      "This browser does not expose the Notification constructor. Use a modern Chrome, Firefox, Edge, or Safari.";
  } else if (isInIframe) {
    notificationSupport = "iframe";
    notificationSupportReason =
      'Notifications cannot be requested from inside an iframe unless the parent grants `allow="notifications"`.';
  }

  // SW controller + pushManager check happens *after* we know about the SW
  // registration. We resolve it inside the useEffect (it can be async). Here
  // we just stub defaults that the useEffect will overwrite.
  const swControllerActive =
    typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
  const swControllerScriptUrl =
    typeof navigator !== "undefined"
      ? navigator.serviceWorker?.controller?.scriptURL ?? null
      : null;

  // Push support ladder (priority order matches notification):
  //   1. Not secure context → "insecure"
  //   2. No serviceWorker API → "no-sw"
  //   3. PushManager not on a real registration → "no-push-manager"
  //   4. No VAPID public key → "no-vapid"
  //   5. otherwise → "available"
  //
  // We don't *yet* know whether the active registration has pushManager —
  // that probe is async and lives in the useEffect.
  let pushSupport: PushSupport = "available";
  let pushSupportReason: string | null = null;
  if (!isSecureContext) {
    pushSupport = "insecure";
    pushSupportReason = `Push requires HTTPS or localhost. The current origin (${window.location.origin}) is not secure.`;
  } else if (!hasServiceWorkerObject) {
    pushSupport = "no-sw";
    pushSupportReason = "Service Worker API is not exposed by this browser.";
  } else if (!VAPID_PUBLIC_KEY) {
    pushSupport = "no-vapid";
    pushSupportReason =
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured — server-push is disabled, but local notifications still work.";
  }

  // navigator.pushManager does not exist as a property. We surface the raw
  // typeof so the diagnostic panel is honest (it'll be "undefined" on every
  // browser, with a note explaining where PushManager actually lives).
  const typeofNavigatorPushManager =
    typeof navigator !== "undefined" && (navigator as unknown as { PushManager?: unknown })
      .PushManager !== undefined
      ? typeof (navigator as unknown as { PushManager?: unknown }).PushManager
      : "undefined";

  return {
    notificationSupport,
    notificationSupportReason,
    pushSupport,
    pushSupportReason,
    permission: notificationPermissionValue,
    swControllerActive,
    swControllerScriptUrl,
    typeofNotification,
    typeofServiceWorker,
    typeofNavigatorPushManager,
    notificationPermissionValue,
    isSecureContext,
    isTopLevel,
    isInIframe,
  };
}

function describeNotificationSupport(s: NotificationSupport): string {
  switch (s) {
    case "available":
      return "Available — `new Notification(...)` works in this browser";
    case "insecure":
      return "Blocked — current origin is not a secure context";
    case "iframe":
      return "Blocked — inside an iframe without `allow=\"notifications\"`";
    case "ios-needs-pwa":
      return "Hidden — install Ralts to Home Screen on iOS";
    case "no-api":
      return "Not exposed by this browser";
  }
}

function describePushSupport(s: PushSupport, isSubscribed: boolean): string {
  switch (s) {
    case "available":
      return isSubscribed
        ? "Active — server can deliver pushes even when the app is closed"
        : "Available — not yet subscribed";
    case "no-vapid":
      return "Disabled — NEXT_PUBLIC_VAPID_PUBLIC_KEY missing (local notifications still work)";
    case "insecure":
      return "Blocked — current origin is not a secure context";
    case "no-sw":
      return "Blocked — Service Worker API not exposed by this browser";
    case "no-push-manager":
      return "Not supported by this browser's service worker";
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [permission, setPermission] = useState<PermissionStatus>("default");
  const [swState, setSwState] = useState<SwState>("not-registered");
  const [pushState, setPushState] = useState<PushState>("no-subscription");
  const [lastError, setLastError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testKind, setTestKind] = useState<"local" | "sw" | "push" | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean | null>(null);
  const [diag, setDiag] = useState<Diagnostic | null>(null);

  // Refs that always read latest values inside async callbacks
  const pushStateRef = useRef(pushState);
  useEffect(() => {
    pushStateRef.current = pushState;
  }, [pushState]);

  // ─── Single source of truth: rebuild the full diagnostic on mount + on
  // explicit user request ("Run live test"). We deliberately do NOT split
  // capability probes across multiple useState initializers because that
  // left the previous version internally inconsistent (e.g. `swControllerActive:
  // true` paired with `hasServiceWorker: false`).

  const buildDiagnostic = useCallback(async (): Promise<Diagnostic> => {
    const live = readLiveCapabilities();

    // Async probes: SW registration + its pushManager.
    let swRegistrationExists = false;
    let swRegistrationPushManager = false;
    let swRegistrationActive = false;
    if (live.isSecureContext && live.swControllerActive) {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
        if (reg) {
          swRegistrationExists = true;
          swRegistrationPushManager = "pushManager" in reg;
          swRegistrationActive = Boolean(reg.active);
        }
      } catch {
        // ignore
      }
    }

    // Refine pushSupport with the pushManager probe result.
    let pushSupport: PushSupport = live.pushSupport;
    let pushSupportReason: string | null = live.pushSupportReason;
    if (pushSupport === "available" && !swRegistrationPushManager) {
      // We had SW + secure context + VAPID, but the registration doesn't expose
      // pushManager — that means the browser doesn't support Push.
      pushSupport = "no-push-manager";
      pushSupportReason =
        "The active service-worker registration does not expose `pushManager`. This browser does not support the Push API.";
    }

    return {
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      origin: window.location.origin,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      href: window.location.href,
      isSecureContext: live.isSecureContext,
      isTopLevel: live.isTopLevel,
      isInIframe: live.isInIframe,
      typeofNotification: live.typeofNotification,
      typeofServiceWorker: live.typeofServiceWorker,
      typeofNavigatorPushManager: live.typeofNavigatorPushManager,
      notificationPermissionValue: live.notificationPermissionValue,
      swControllerActive: live.swControllerActive,
      swControllerScriptUrl: live.swControllerScriptUrl,
      swRegistrationExists,
      swRegistrationPushManager,
      swRegistrationActive,
      isStandalone:
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean })?.standalone === true,
      isIOS: isIOSDevice(),
      vapidKeyPresent: Boolean(VAPID_PUBLIC_KEY),
      vapidKeyLength: VAPID_PUBLIC_KEY.length,
      notificationSupport: live.notificationSupport,
      notificationSupportReason: live.notificationSupportReason,
      pushSupport,
      pushSupportReason,
      liveTestRan: false,
      liveTestPath: null,
      liveTestError: null,
      liveTestNotificationTitle: null,
      lastEndpoint: null,
      subscribeError: null,
      sendError: null,
    };
  }, []);

  // PWA install mode detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkPWA = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isFullScreen = (window.navigator as Navigator & { standalone?: boolean })?.standalone === true;
      setIsPWAInstalled(isStandalone || isFullScreen);
    };
    checkPWA();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", checkPWA);
    return () => mq.removeEventListener("change", checkPWA);
  }, []);

  // Build the diagnostic once on mount. Subsequent updates come from
  // `setDiag` calls in subscribeToPush / handleSendTestNotification.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const d = await buildDiagnostic();
      if (cancelled) return;
      setDiag(d);
      setPermission(d.notificationPermissionValue);
      setSwState(d.swControllerActive ? "registered" : "not-registered");

      // Check for an existing push subscription if push is available.
      if (d.pushSupport === "available" && d.swRegistrationPushManager) {
        try {
          const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
          const sub = reg ? await reg.pushManager.getSubscription() : null;
          if (!cancelled) {
            setPushState(sub ? "subscribed" : "no-subscription");
            if (sub) setDiag((p) => (p ? { ...p, lastEndpoint: sub.endpoint } : p));
          }
        } catch {
          if (!cancelled) setPushState("no-subscription");
        }
      } else if (d.pushSupport === "no-vapid") {
        setPushState("not-configured");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildDiagnostic]);

  // Register service worker
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === "undefined") return null;
    if (typeof navigator === "undefined" || typeof navigator.serviceWorker !== "object") {
      setSwState("error");
      setLastError(
        "Service workers are not supported in this browser. Local notifications still work; only server push is disabled."
      );
      return null;
    }
    if (!window.isSecureContext) {
      setSwState("error");
      setLastError(
        "Service workers require a secure context (HTTPS or localhost). The current origin is not secure."
      );
      return null;
    }
    try {
      setSwState("registering");
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });

      await new Promise<void>((resolve) => {
        if (registration.active) return resolve();
        const onStateChange = () => {
          if (registration.active) {
            registration.removeEventListener("updatefound", onStateChange);
            resolve();
          }
        };
        registration.addEventListener("updatefound", onStateChange);
        setTimeout(resolve, 3000);
      });

      setSwState("registered");
      setLastError(null);

      // Refresh diagnostic with the new SW registration.
      const fresh = await buildDiagnostic();
      setDiag(fresh);
      return registration;
    } catch (err) {
      const msg = describeError(err);
      console.error("[push] service worker registration failed:", err);
      setLastError(`Service worker registration failed: ${msg}`);
      setSwState("error");
      return null;
    }
  }, [buildDiagnostic]);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      const msg =
        "VAPID public key is not configured. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to your Vercel environment and redeploy. Local notifications still work — only server push is disabled.";
      setLastError(msg);
      setDiag((p) => (p ? { ...p, vapidKeyPresent: false, subscribeError: msg } : p));
      setPushState("error");
      return false;
    }
    if (!window.isSecureContext) {
      const msg = "Push requires HTTPS or localhost. The current origin is not secure.";
      setLastError(msg);
      setDiag((p) => (p ? { ...p, subscribeError: msg } : p));
      setPushState("error");
      return false;
    }

    let reg = await navigator.serviceWorker.getRegistration(SW_SCOPE).catch(() => null);
    if (!reg) reg = await registerServiceWorker();
    if (!reg) {
      setPushState("error");
      return false;
    }
    if (!("pushManager" in reg)) {
      const msg = "Push API is not supported by this browser's service worker.";
      setLastError(msg);
      setDiag((p) => (p ? { ...p, subscribeError: msg } : p));
      setPushState("error");
      return false;
    }

    try {
      setPushState("subscribing");
      setLastError(null);

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          // ignore
        }
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      if (applicationServerKey.byteLength === 0) {
        const msg = "VAPID public key decoded to zero bytes — check NEXT_PUBLIC_VAPID_PUBLIC_KEY.";
        setLastError(msg);
        setDiag((p) => (p ? { ...p, subscribeError: msg } : p));
        setPushState("error");
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
        redirect: "manual",
      });

      if (response.type === "opaqueredirect") {
        const msg =
          "Server redirected the request — your session is no longer valid. Refresh the page, sign in again, then retry.";
        setLastError(msg);
        setDiag((p) => (p ? { ...p, subscribeError: msg } : p));
        setPushState("error");
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        return false;
      }

      if (!response.ok) {
        let body: { error?: string; code?: string } = {};
        try {
          body = (await response.json()) as { error?: string; code?: string };
        } catch {
          // ignore
        }
        const detail = body.error || `HTTP ${response.status}`;
        setLastError(`Saving subscription failed: ${detail}`);
        setDiag((p) =>
          p ? { ...p, subscribeError: `HTTP ${response.status} — ${detail}` } : p
        );
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        setPushState("error");
        return false;
      }

      setDiag((p) =>
        p ? { ...p, lastEndpoint: subscription.endpoint, subscribeError: null } : p
      );
      setPushState("subscribed");
      return true;
    } catch (err) {
      const msg = describeError(err);
      console.error("[push] subscribe failed:", err);
      setLastError(`Subscription failed: ${msg}`);
      setDiag((p) => (p ? { ...p, subscribeError: msg } : p));
      setPushState("error");
      return false;
    }
  }, [registerServiceWorker]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) await sub.unsubscribe();
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    }
    try {
      await fetch("/api/push/subscribe", { method: "DELETE", redirect: "manual" });
    } catch {
      // ignore
    }
    setDiag((p) => (p ? { ...p, lastEndpoint: null } : p));
    setPushState("no-subscription");
  }, []);

  const handleEnable = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setLastError("Notification API is not exposed in this browser context.");
      return;
    }
    setLastError(null);
    try {
      const permissionPromise = Notification.requestPermission();
      const timeoutPromise = new Promise<NotificationPermission>((resolve) =>
        setTimeout(() => resolve("default" as NotificationPermission), 15_000)
      );
      const permission = await Promise.race([permissionPromise, timeoutPromise]);
      setPermission(permission as PermissionStatus);
      if (permission === "granted") {
        // Only attempt push if push support is fully available.
        if (diag?.pushSupport === "available") {
          await subscribeToPush();
        }
      } else if (permission === "denied") {
        setLastError(
          "Notification permission was denied. Open your browser settings, allow notifications for this site, then refresh."
        );
      }
    } catch (err) {
      const msg = describeError(err);
      console.error("[notifications] requestPermission failed:", err);
      setLastError(`Permission request failed: ${msg}`);
    }
  }, [diag, subscribeToPush]);

  const handleResubscribe = useCallback(async () => {
    await unsubscribeFromPush();
    if (diag?.pushSupport === "available") {
      await subscribeToPush();
    }
  }, [unsubscribeFromPush, subscribeToPush, diag]);

  /**
   * Three distinct test paths. The user must always know which one fired.
   *
   *   1. "local"      — `new Notification(...)` from page JS. Works on every
   *                     supported browser *only while the page is open*.
   *   2. "sw"         — `serviceWorkerRegistration.showNotification(...)`.
   *                     Works while the page is closed on most browsers, but
   *                     does NOT require a server push — the SW fires it.
   *   3. "push"       — server → Web Push endpoint → SW push event →
   *                     SW showNotification. Works while the app/browser
   *                     is closed, where the platform supports it.
   *
   * The button label on the page tells the user exactly which one they got.
   */
  const handleSendTest = useCallback(
    async (kind: "auto" | "local" | "sw" | "push" = "auto") => {
      setTestError(null);
      setTestSent(false);
      setTestKind(null);

      if (typeof window === "undefined") return;
      if (permission !== "granted") {
        setTestError("Notification permission is required first.");
        return;
      }

      const title = "Ralts";
      const bodyText = t("settings.notification_sent");
      const localTag = "ralts-test-local";

      // ─── Decide which path to use ──────────────────────────────────────
      const pushReady = pushStateRef.current === "subscribed";
      let path: "local" | "sw" | "push";

      if (kind === "auto") {
        path = pushReady ? "push" : "sw";
      } else {
        path = kind;
      }

      // ─── PUSH path ─────────────────────────────────────────────────────
      if (path === "push") {
        try {
          const response = await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, body: bodyText, tag: "ralts-test" }),
            redirect: "manual",
          });

          if (response.type === "opaqueredirect") {
            // Auth lost — fall back to SW path so the test still proves
            // *something* works.
            setTestKind("sw");
            await fireSwNotification(title, bodyText, localTag);
            setTestSent(true);
            setTimeout(() => setTestSent(false), 3000);
            return;
          }

          if (response.ok) {
            setTestKind("push");
            setTestSent(true);
            setTimeout(() => setTestSent(false), 3000);
            return;
          }

          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          if (data.code === "EXPIRED") {
            setPushState("no-subscription");
            setTestError("Subscription expired. Please re-enable push first.");
            return;
          }
          const detail = data.error || `HTTP ${response.status}`;
          setTestError(`Server push failed: ${detail}`);
          setDiag((p) => (p ? { ...p, sendError: `HTTP ${response.status} — ${detail}` } : p));
          return;
        } catch (err) {
          setTestError(`Network error: ${describeError(err)}`);
          setDiag((p) => (p ? { ...p, sendError: describeError(err) } : p));
          return;
        }
      }

      // ─── SW path ───────────────────────────────────────────────────────
      if (path === "sw") {
        try {
          await fireSwNotification(title, bodyText, localTag);
          setTestKind("sw");
          setTestSent(true);
          setTimeout(() => setTestSent(false), 3000);
        } catch (err) {
          // SW path failed — try plain `new Notification` as a last resort.
          try {
            new Notification(title, { body: bodyText, tag: localTag });
            setTestKind("local");
            setTestSent(true);
            setTimeout(() => setTestSent(false), 3000);
          } catch (e2) {
            setTestError(`Local notification failed: ${describeError(e2)}`);
            setDiag((p) =>
              p ? { ...p, sendError: describeError(e2) } : p
            );
          }
        }
        return;
      }

      // ─── LOCAL path ────────────────────────────────────────────────────
      if (path === "local") {
        try {
          new Notification(title, { body: bodyText, tag: localTag });
          setTestKind("local");
          setTestSent(true);
          setTimeout(() => setTestSent(false), 3000);
        } catch (err) {
          setTestError(`Local notification failed: ${describeError(err)}`);
          setDiag((p) => (p ? { ...p, sendError: describeError(err) } : p));
        }
      }
    },
    [permission, t]
  );

  const fireSwNotification = async (
    title: string,
    bodyText: string,
    tag: string
  ): Promise<void> => {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (!reg) throw new Error("No service worker registration");
    await reg.showNotification(title, {
      body: bodyText,
      tag,
      icon: "/icons/android-chrome-192x192.png",
      badge: "/icons/android-chrome-192x192.png",
    });
  };

  /**
   * Run the live test once and capture the result. This is what actually
   * proves the local notification path works in this browser — far more
   * trustworthy than `"Notification" in window`, which can report `false`
   * during SSR/hydration race conditions even when the API is fully usable.
   */
  const runLiveTest = useCallback(async () => {
    setTestError(null);
    setTestSent(false);
    setTestKind(null);

    if (typeof window === "undefined") return;
    if (permission !== "granted") {
      setTestError("Grant notification permission first.");
      return;
    }

    const title = "Ralts live test";
    const bodyText = `Captured ${new Date().toLocaleTimeString()}`;
    const tag = "ralts-live-test";

    // Prefer the SW path so the result is comparable across browser states.
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, { body: bodyText, tag });
        setDiag((p) =>
          p
            ? {
                ...p,
                liveTestRan: true,
                liveTestPath: "service-worker",
                liveTestError: null,
                liveTestNotificationTitle: title,
              }
            : p
        );
        setTestKind("sw");
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
        return;
      }
    } catch (err) {
      // SW path not available — fall through to the plain constructor.
      setDiag((p) =>
        p
          ? { ...p, liveTestRan: true, liveTestPath: "constructor", liveTestError: describeError(err) }
          : p
      );
    }

    try {
      new Notification(title, { body: bodyText, tag });
      setDiag((p) =>
        p
          ? {
              ...p,
              liveTestRan: true,
              liveTestPath: "constructor",
              liveTestError: null,
              liveTestNotificationTitle: title,
            }
          : p
      );
      setTestKind("local");
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (err) {
      setTestError(`Live test failed: ${describeError(err)}`);
      setDiag((p) =>
        p ? { ...p, liveTestError: describeError(err) } : p
      );
    }
  }, [permission]);

  const refreshDiagnostic = useCallback(async () => {
    const d = await buildDiagnostic();
    setDiag(d);
  }, [buildDiagnostic]);

  // ─── Derived UI flags ─────────────────────────────────────────────────────

  const notificationsReady =
    diag?.notificationSupport === "available" && permission === "granted";
  const pushReady =
    notificationsReady && diag?.pushSupport === "available" && pushState === "subscribed";

  const isLoading = swState === "registering" || pushState === "subscribing";

  const showIOSInstallPrompt = diag?.notificationSupport === "ios-needs-pwa";
  const showFullyUnsupported = diag?.notificationSupport === "no-api";
  const showInsecureHint = diag?.notificationSupport === "insecure";
  const showIframeHint = diag?.notificationSupport === "iframe";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <h1 className="text-xl font-semibold">{t("settings.notifications")}</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {showFullyUnsupported && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Notifications Not Supported</p>
              <p className="text-xs text-text-secondary mt-1">
                {diag?.notificationSupportReason ?? "This browser does not expose the Notification API."}
              </p>
            </div>
          </div>
        )}

        {showIOSInstallPrompt && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <Smartphone className="h-6 w-6 text-accent" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                Install Ralts to use notifications
              </p>
              <p className="text-xs text-text-secondary mt-1">
                On iPhone and iPad, the Notification API is only exposed when Ralts is launched from
                the Home Screen. Tap the share button in Safari → &quot;Add to Home Screen&quot;, then
                open Ralts from the Home Screen and return here.
              </p>
            </div>
          </div>
        )}

        {showInsecureHint && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6 text-warning" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">HTTPS required</p>
              <p className="text-xs text-text-secondary mt-1 break-words">
                {diag?.notificationSupportReason ??
                  "Notifications require a secure context (HTTPS or http://localhost)."}
              </p>
              <p className="text-[11px] text-text-tertiary mt-2 break-all">
                origin: <span className="font-mono">{diag?.origin}</span>
              </p>
            </div>
          </div>
        )}

        {showIframeHint && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6 text-warning" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Cannot request from an iframe</p>
              <p className="text-xs text-text-secondary mt-1">
                {diag?.notificationSupportReason ??
                  'Open this page in its own tab, or ask the embedding site to grant `allow="notifications"`.'}
              </p>
            </div>
          </div>
        )}

        {permission === "denied" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <BellOff className="h-6 w-6 text-destructive" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Notifications Blocked</p>
              <p className="text-xs text-text-secondary mt-1">
                Ralts cannot send notifications because permission was denied. Open your browser
                settings, allow notifications for this site, then come back and refresh.
              </p>
            </div>
          </div>
        )}

        {(diag?.notificationSupport === "available" ||
          showIOSInstallPrompt ||
          showInsecureHint ||
          showIframeHint) && (
          <>
            {/* ─── TRUTHFUL STATUS CARD ────────────────────────────────────
             *
             * Every row shows one specific capability with its exact
             * current state. No more "everything is error" because the
             * subscription row defaults to red when push isn't active. */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </p>

              <StatusRow
                label="Permission"
                value={
                  permission === "granted"
                    ? "Granted — site can show notifications"
                    : permission === "default"
                      ? "Not yet asked — click Enable below"
                      : permission === "denied"
                        ? "Denied at browser level"
                        : "Unavailable (no Notification API)"
                }
                state={
                  permission === "granted"
                    ? "ok"
                    : permission === "denied"
                      ? "error"
                      : "pending"
                }
              />

              <StatusRow
                label="Local notification (Notification API)"
                value={describeNotificationSupport(diag?.notificationSupport ?? "no-api")}
                state={
                  diag?.notificationSupport === "available"
                    ? diag?.liveTestRan
                      ? diag.liveTestError
                        ? "error"
                        : "ok"
                      : "pending"
                    : diag?.notificationSupport === "ios-needs-pwa"
                      ? "info"
                      : "error"
                }
              />

              <StatusRow
                label="Service worker"
                value={
                  diag?.swRegistrationActive
                    ? "Registered, active, controlling the page"
                    : diag?.swRegistrationExists
                      ? "Registered (not yet controlling)"
                      : diag?.swControllerActive
                        ? "A service worker is controlling this page from a previous session"
                        : "Not registered"
                }
                state={
                  diag?.swRegistrationActive
                    ? "ok"
                    : diag?.swControllerActive
                      ? "info"
                      : "pending"
                }
                action={
                  diag && !diag.swRegistrationActive
                    ? { label: "Register", onClick: registerServiceWorker }
                    : undefined
                }
              />

              <StatusRow
                label="Real background push (server → browser)"
                value={describePushSupport(
                  diag?.pushSupport ?? "no-sw",
                  pushState === "subscribed"
                )}
                state={
                  pushState === "subscribed"
                    ? "ok"
                    : diag?.pushSupport === "available"
                      ? "pending"
                      : diag?.pushSupport === "no-vapid"
                        ? "info"
                        : "error"
                }
                action={
                  diag?.pushSupport === "available" &&
                  (pushState === "error" || pushState === "no-subscription")
                    ? { label: "Subscribe", onClick: handleResubscribe }
                    : undefined
                }
              />

              <StatusRow
                label="App Mode"
                value={
                  isPWAInstalled === null
                    ? "Checking..."
                    : isPWAInstalled
                      ? "Installed PWA — background push most reliable"
                      : "Browser tab — install for best results"
                }
                state={isPWAInstalled ? "info" : "pending"}
                icon={
                  isPWAInstalled ? (
                    <Smartphone className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  ) : (
                    <Monitor className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                  )
                }
              />

              {lastError && (
                <div className="flex items-start gap-2 bg-destructive/10 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-destructive break-words">{lastError}</p>
                </div>
              )}
            </div>

            {/* ─── PERMISSION ACTION CARD ────────────────────────────────── */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    notificationsReady ? "bg-accent/10" : "bg-surface-elevated"
                  }`}
                >
                  <Bell
                    className={`h-5 w-5 ${
                      notificationsReady ? "text-accent" : "text-text-tertiary"
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {t("settings.enable_notifications")}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {notificationsReady
                      ? "Ralts has permission to show notifications."
                      : "Enable notifications to receive updates from Ralts."}
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  pushReady
                    ? "bg-success/10 text-success"
                    : notificationsReady
                      ? diag?.pushSupport === "available"
                        ? "bg-warning/10 text-warning"
                        : "bg-accent/10 text-accent"
                      : "bg-surface-elevated text-text-secondary"
                }`}
              >
                {pushReady ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Real background push active
                  </>
                ) : notificationsReady ? (
                  diag?.pushSupport === "available" ? (
                    <>
                      <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                      Local notifications only — Subscribe to enable real push
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                      Local notifications only — real push not configured
                    </>
                  )
                ) : (
                  <>
                    <BellOff className="h-3 w-3" strokeWidth={1.5} />
                    Not enabled
                  </>
                )}
              </div>

              {permission === "default" && (
                <Button
                  onClick={handleEnable}
                  disabled={isLoading || diag?.notificationSupport !== "available"}
                  className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                >
                  Enable Notifications
                </Button>
              )}

              {permission === "granted" &&
                diag?.pushSupport === "available" &&
                pushState !== "subscribed" && (
                  <Button
                    onClick={handleResubscribe}
                    disabled={isLoading}
                    className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                  >
                    {pushState === "subscribing" ? "Subscribing..." : "Activate Real Push"}
                  </Button>
                )}

              {permission === "granted" && (
                <p className="text-xs text-text-tertiary text-center">
                  To disable, revoke permission in your browser settings.
                </p>
              )}
            </div>

            {/* ─── TEST NOTIFICATION ───────────────────────────────────────
             *
             * Three buttons, each labelled with exactly what it does:
             *   1. Send local test (page JS only — works while app is open)
             *   2. Send SW test (service-worker showNotification — also page-open)
             *   3. Send real push (server → push event → SW — works while closed) */}
            {permission === "granted" && (
              <div className="bg-surface rounded-xl p-5 space-y-4">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Test Notification
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {t("settings.test_notification")}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {pushReady
                        ? "Real push is subscribed — the server will deliver a push to this device (works while the app is closed, where supported)."
                        : diag?.pushSupport === "available"
                          ? "Real push is available but not subscribed. Use the buttons below to verify what works in this browser right now."
                          : "Real push is not configured — only local + service-worker notifications are available."}
                    </p>
                  </div>
                </div>

                {testSent && (
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    {testKind === "push" && "Sent a real push. It will arrive even when the app is closed."}
                    {testKind === "sw" && "Fired a notification from the service worker. Works while the page is closed (no real push needed)."}
                    {testKind === "local" && "Fired a local notification from page JS. Only works while this tab is open."}
                  </div>
                )}
                {testError && (
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={1.5} />
                    <span>{testError}</span>
                  </div>
                )}

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSendTest("local")}
                    disabled={isLoading || permission !== "granted"}
                    className="w-full h-10 justify-start text-left"
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-xs font-medium">Send local test (Notification API)</span>
                      <span className="text-[10px] text-text-tertiary font-normal">
                        Page-JS only · only works while this tab is open
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSendTest("sw")}
                    disabled={isLoading || permission !== "granted"}
                    className="w-full h-10 justify-start text-left"
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-xs font-medium">Send service-worker test</span>
                      <span className="text-[10px] text-text-tertiary font-normal">
                        Uses the SW to show the notification · works while the app is closed
                      </span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleSendTest("push")}
                    disabled={isLoading || !pushReady}
                    className="w-full h-10 bg-accent text-white hover:bg-accent/90 justify-start text-left"
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-xs font-medium">
                        Send real background push {pushReady ? "" : "(subscribe first)"}
                      </span>
                      <span className="text-[10px] text-white/80 font-normal">
                        Server → push endpoint → SW · works while the app is closed
                      </span>
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {/* ─── DIAGNOSTICS ─────────────────────────────────────────────
             *
             * Every line is a live read of `window`, `navigator`, or the
             * service-worker registration. Nothing is derived or memoised
             * across renders. Refresh = re-runs every probe. */}
            {diag && (
              <details className="bg-surface rounded-xl p-5 space-y-2" open>
                <summary className="text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer">
                  Diagnostics (live, captured {diag.capturedAt})
                </summary>
                <div className="text-[11px] text-text-tertiary space-y-1 break-words pt-2 font-mono">
                  <div>
                    <b>Origin:</b> {diag.origin} ({diag.protocol}//{diag.hostname})
                  </div>
                  <div>
                    <b>URL:</b> {diag.href}
                  </div>
                  <div>
                    <b>UA:</b> {diag.userAgent}
                  </div>
                  <div>
                    <b>Secure context:</b> {String(diag.isSecureContext)} · Top-level:{" "}
                    {String(diag.isTopLevel)} · Iframe: {String(diag.isInIframe)}
                  </div>
                  <div>
                    <b>typeof window.Notification:</b> {diag.typeofNotification}
                  </div>
                  <div>
                    <b>typeof navigator.serviceWorker:</b> {diag.typeofServiceWorker}
                  </div>
                  <div>
                    <b>typeof navigator.PushManager:</b> {diag.typeofNavigatorPushManager} (this is
                    expected to be "undefined" — PushManager lives on
                    ServiceWorkerRegistration.pushManager, not on navigator)
                  </div>
                  <div>
                    <b>SW controller active:</b> {String(diag.swControllerActive)}
                    {diag.swControllerScriptUrl ? ` (${diag.swControllerScriptUrl})` : ""}
                  </div>
                  <div>
                    <b>SW registration exists:</b> {String(diag.swRegistrationExists)} · pushManager:{" "}
                    {String(diag.swRegistrationPushManager)} · active:{" "}
                    {String(diag.swRegistrationActive)}
                  </div>
                  <div>
                    <b>Notification.permission:</b> {diag.notificationPermissionValue}
                  </div>
                  <div>
                    <b>VAPID key:</b>{" "}
                    {diag.vapidKeyPresent
                      ? `present (${diag.vapidKeyLength} chars)`
                      : "MISSING — push is disabled"}
                  </div>
                  <div>
                    <b>Standalone:</b> {String(diag.isStandalone)} · iOS: {String(diag.isIOS)}
                  </div>
                  <div>
                    <b>Notification support:</b> {diag.notificationSupport}
                    {diag.notificationSupportReason ? ` — ${diag.notificationSupportReason}` : ""}
                  </div>
                  <div>
                    <b>Push support:</b> {diag.pushSupport}
                    {diag.pushSupportReason ? ` — ${diag.pushSupportReason}` : ""}
                  </div>
                  <div>
                    <b>Last endpoint:</b>{" "}
                    {diag.lastEndpoint
                      ? `${diag.lastEndpoint.slice(0, 80)}${diag.lastEndpoint.length > 80 ? "…" : ""}`
                      : "—"}
                  </div>
                  <div>
                    <b>Live test:</b>{" "}
                    {diag.liveTestRan
                      ? diag.liveTestError
                        ? `failed via ${diag.liveTestPath} — ${diag.liveTestError}`
                        : `succeeded via ${diag.liveTestPath}`
                      : "not run"}
                  </div>
                  {diag.subscribeError && <div><b>Subscribe error:</b> {diag.subscribeError}</div>}
                  {diag.sendError && <div><b>Send error:</b> {diag.sendError}</div>}
                </div>
                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runLiveTest}
                    disabled={permission !== "granted" || isLoading}
                  >
                    Run live test
                  </Button>
                  <Button variant="outline" size="sm" onClick={refreshDiagnostic}>
                    Refresh diagnostics
                  </Button>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  state,
  action,
  icon,
}: {
  label: string;
  value: string;
  state: "ok" | "pending" | "error" | "info";
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}) {
  const bg =
    state === "ok"
      ? "bg-success/10"
      : state === "error"
        ? "bg-destructive/10"
        : state === "info"
          ? "bg-accent/10"
          : "bg-surface-elevated";
  const defaultIcon =
    state === "ok" ? (
      <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} />
    ) : state === "error" ? (
      <AlertCircle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
    ) : state === "pending" ? (
      <RefreshCw className="h-4 w-4 text-text-tertiary animate-spin" strokeWidth={1.5} />
    ) : (
      <WifiOff className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
    );

  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
        {icon ?? defaultIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-secondary">{value}</p>
      </div>
      {action && (
        <button onClick={action.onClick} className="text-xs text-accent hover:underline shrink-0">
          {action.label}
        </button>
      )}
    </div>
  );
}