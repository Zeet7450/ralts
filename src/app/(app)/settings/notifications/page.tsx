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

// Granular, capability-based states. We no longer conflate "Notification API
// missing" with "Push API missing" — they are independent capabilities and
// the UI must surface each one on its own.
type NotificationSupport =
  | "available" // new Notification() works
  | "no-api" // Notification constructor is not on window
  | "insecure" // window.isSecureContext === false
  | "iframe" // running inside a frame without permission policy
  | "ios-needs-pwa"; // iOS Safari in regular browser tab

type PushSupport =
  | "available" // pushManager.subscribe() can succeed (SW + PushManager + HTTPS + VAPID)
  | "no-vapid" // SW + PushManager + HTTPS, but NEXT_PUBLIC_VAPID_PUBLIC_KEY missing
  | "no-sw" // serviceWorker not exposed
  | "insecure" // not a secure context
  | "no-push-manager"; // browser doesn't expose PushManager at all

type NotificationState = "denied" | "granted" | "default" | "unsupported";
type SwState = "not-registered" | "registering" | "registered" | "error";
type PushState = "no-subscription" | "subscribing" | "subscribed" | "error" | "not-configured";

// VAPID public key — exposed client-side by NEXT_PUBLIC_ prefix
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SW_URL = "/sw.js";
const SW_SCOPE = "/";

type Diagnostic = {
  userAgent: string;
  isSecureContext: boolean;
  isTopLevel: boolean;
  isInIframe: boolean;
  hasNotificationApi: boolean;
  hasServiceWorker: boolean;
  hasPushManagerGlobal: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  vapidKeyPresent: boolean;
  swControllerActive: boolean;
  swScriptUrl: string | null;
  permission: NotificationPermission | "unavailable";
  notificationSupport: NotificationSupport;
  pushSupport: PushSupport;
  notificationSupportReason: string | null;
  pushSupportReason: string | null;
  permissionError: string | null;
  subscribeError: string | null;
  sendError: string | null;
  lastEndpoint: string | null;
};

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
    if (anyErr.name === "AbortError")
      return "Subscription was aborted. Please try again.";
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

function describeNotificationSupport(s: NotificationSupport): string {
  switch (s) {
    case "available":
      return "Available — `new Notification(...)` works";
    case "insecure":
      return "Blocked — not a secure context";
    case "iframe":
      return "Blocked — inside an iframe";
    case "ios-needs-pwa":
      return "Hidden — install as PWA on iOS";
    case "no-api":
      return "Not exposed by this browser";
  }
}

function describePushSupport(s: PushSupport, isSubscribed: boolean): string {
  switch (s) {
    case "available":
      return isSubscribed
        ? "Subscribed — server can send pushes"
        : "Available — not yet subscribed";
    case "no-vapid":
      return "Disabled — NEXT_PUBLIC_VAPID_PUBLIC_KEY missing (local notifications still work)";
    case "insecure":
      return "Blocked — requires HTTPS";
    case "no-sw":
      return "Blocked — no Service Worker";
    case "no-push-manager":
      return "Not supported by this browser";
  }
}

/**
 * Probe the browser's notification capability in order of likelihood so the
 * UI can show the *exact* missing prerequisite instead of a generic message.
 *
 * Rules:
 *  - `'Notification' in window` is the prerequisite for the Notification API.
 *    Chrome, Firefox, Edge, Safari 16+, and Opera all expose it on https or
 *    localhost. If it is missing, the browser (or an in-app WebView) does
 *    NOT support notifications at all.
 *  - `window.isSecureContext` must be true. On Chrome and Firefox the
 *    Notification constructor is on window even on http, but every call is
 *    silently dropped and `requestPermission()` is a no-op that returns
 *    "denied". Treat that as "insecure" — not as "unsupported".
 *  - iOS Safari only exposes `Notification` once the page is launched as an
 *    installed PWA. In regular browser mode `Notification` is undefined —
 *    we treat that as "install the PWA" rather than "unsupported".
 *  - Iframes without an `allow="notifications"` permission policy will fail
 *    silently; the constructor exists but `requestPermission` rejects with
 *    NotAllowedError.
 */
function detectNotificationSupport(): {
  support: NotificationSupport;
  reason: string | null;
} {
  if (typeof window === "undefined") {
    return { support: "no-api", reason: "window is undefined (SSR)." };
  }
  const isIOS = isIOSDevice();
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean })?.standalone === true;

  // iOS Safari in regular browser tab: Notification is intentionally undefined
  // until installed as a PWA. Don't say "unsupported" — tell the user how to
  // fix it.
  if (isIOS && !isStandalone && !("Notification" in window)) {
    return {
      support: "ios-needs-pwa",
      reason:
        "iOS Safari only exposes the Notification API when Ralts is launched from the Home Screen.",
    };
  }

  if (!("Notification" in window)) {
    return {
      support: "no-api",
      reason:
        "This browser does not expose the Notification constructor. Use a modern Chrome, Firefox, Edge, or Safari.",
    };
  }

  if (!window.isSecureContext) {
    return {
      support: "insecure",
      reason:
        "Notifications require a secure context (HTTPS or http://localhost). The current origin is not secure, so notifications will be silently blocked.",
    };
  }

  if (window.self !== window.top) {
    // We're in an iframe. Notifications from inside iframes require an
    // `allow="notifications"` permission policy on the embedding <iframe>.
    return {
      support: "iframe",
      reason:
        'Notifications cannot be requested from inside an iframe unless the parent grants `allow="notifications"`.',
    };
  }

  return { support: "available", reason: null };
}

/**
 * Push support is independent from notification support. Push needs:
 *  - Secure context (HTTPS or localhost)
 *  - serviceWorker in navigator
 *  - PushManager on the serviceWorker registration
 *  - A non-empty VAPID public key
 * If any of those are missing we still keep local notifications available —
 * we just can't subscribe to a server push.
 */
function detectPushSupport(opts: {
  hasServiceWorker: boolean;
  hasPushManagerGlobal: boolean;
}): { support: PushSupport; reason: string | null } {
  if (typeof window === "undefined") {
    return { support: "no-sw", reason: "SSR." };
  }
  if (!window.isSecureContext) {
    return {
      support: "insecure",
      reason: "Push requires HTTPS or localhost.",
    };
  }
  if (!opts.hasServiceWorker) {
    return {
      support: "no-sw",
      reason: "Service Worker API is not exposed by this browser.",
    };
  }
  if (!opts.hasPushManagerGlobal) {
    return {
      support: "no-push-manager",
      reason:
        "Push API is not exposed by this browser. Local notifications will still work.",
    };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      support: "no-vapid",
      reason:
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured — server-push is disabled, but local notifications will still work.",
    };
  }
  return { support: "available", reason: null };
}

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [notificationSupport, setNotificationSupport] =
    useState<NotificationSupport>(() => {
      if (typeof window === "undefined") return "available";
      return detectNotificationSupport().support;
    });
  const [notificationSupportReason, setNotificationSupportReason] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
    return detectNotificationSupport().reason;
  });
  const [pushSupport, setPushSupport] = useState<PushSupport>(() => {
    if (typeof window === "undefined") return "available";
    const hasServiceWorker = "serviceWorker" in navigator;
    const hasPushManagerGlobal =
      "PushManager" in (window as unknown as { PushManager?: unknown });
    return detectPushSupport({ hasServiceWorker, hasPushManagerGlobal }).support;
  });

  const [permission, setPermission] = useState<NotificationState>("default");
  const [swState, setSwState] = useState<SwState>(() => {
    if (typeof window === "undefined") return "not-registered";
    const hasServiceWorker = "serviceWorker" in navigator;
    const hasPushManagerGlobal =
      "PushManager" in (window as unknown as { PushManager?: unknown });
    const { support } = detectPushSupport({ hasServiceWorker, hasPushManagerGlobal });
    return support === "available" ? "registering" : "not-registered";
  });
  const [pushState, setPushState] = useState<PushState>(() => {
    if (typeof window === "undefined") return "no-subscription";
    const hasServiceWorker = "serviceWorker" in navigator;
    const hasPushManagerGlobal =
      "PushManager" in (window as unknown as { PushManager?: unknown });
    const { support } = detectPushSupport({ hasServiceWorker, hasPushManagerGlobal });
    return support === "no-vapid" ? "not-configured" : "no-subscription";
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean | null>(null);
  const [diag, setDiag] = useState<Diagnostic | null>(null);

  // Refs that always read latest values inside async callbacks
  const pushStateRef = useRef(pushState);
  useEffect(() => {
    pushStateRef.current = pushState;
  }, [pushState]);
  const pushSupportRef = useRef(pushSupport);
  useEffect(() => {
    pushSupportRef.current = pushSupport;
  }, [pushSupport]);

  // Detect PWA install mode
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

  const updateDiag = useCallback((patch: Partial<Diagnostic>) => {
    setDiag((prev) => ({ ...(prev ?? makeEmptyDiag()), ...patch }));
  }, []);

  const getSwRegistration = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
    try {
      return (await navigator.serviceWorker.getRegistration(SW_SCOPE)) || null;
    } catch {
      return null;
    }
  }, []);

  const getExistingSubscription =
    useCallback(async (): Promise<PushSubscription | null> => {
      const reg = await getSwRegistration();
      if (!reg || !("pushManager" in reg)) return null;
      try {
        return await reg.pushManager.getSubscription();
      } catch {
        return null;
      }
    }, [getSwRegistration]);

  // Async follow-ups: register the SW (when push is configured) and read the
  // existing subscription. Synchronous capability detection is handled in the
  // lazy useState initializers above.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If push isn't configured we don't even attempt SW registration — local
    // notifications still work via the Notification API.
    if (pushSupport !== "available") return;

    let cancelled = false;
    (async () => {
      const reg = await getSwRegistration();
      if (cancelled) return;
      setSwState(reg ? "registered" : "not-registered");

      if (Notification.permission === "granted") {
        setPushState("subscribing");
        const sub = await getExistingSubscription();
        if (cancelled) return;
        setPushState(sub ? "subscribed" : "no-subscription");
        if (sub) updateDiag({ lastEndpoint: sub.endpoint });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushSupport, getSwRegistration, getExistingSubscription, updateDiag]);

  // Register service worker if missing
  const registerServiceWorker =
    useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
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

        // Wait for activation so pushManager is ready
        await new Promise<void>((resolve) => {
          if (registration.active) {
            resolve();
            return;
          }
          const onStateChange = () => {
            if (registration.active) {
              registration.removeEventListener("updatefound", onStateChange);
              resolve();
            }
          };
          registration.addEventListener("updatefound", onStateChange);
          // Safety timeout — proceed anyway after 3s
          setTimeout(resolve, 3000);
        });

        setSwState("registered");
        setLastError(null);
        updateDiag({
          swControllerActive: Boolean(navigator.serviceWorker?.controller),
          swScriptUrl: navigator.serviceWorker?.controller?.scriptURL ?? registration.active?.scriptURL ?? null,
        });
        return registration;
      } catch (err) {
        const msg = describeError(err);
        console.error("[push] service worker registration failed:", err);
        setLastError(`Service worker registration failed: ${msg}`);
        setSwState("error");
        return null;
      }
    }, [updateDiag]);

  // Subscribe to push — with stale subscription cleanup and full diagnostics
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      const msg =
        "VAPID public key is not configured. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to your Vercel environment and redeploy. Local notifications still work — only server push is disabled.";
      setLastError(msg);
      updateDiag({ vapidKeyPresent: false, subscribeError: msg });
      setPushState("error");
      return false;
    }
    updateDiag({ vapidKeyPresent: true });

    if (!window.isSecureContext) {
      const msg = "Push requires HTTPS or localhost. The current origin is not secure.";
      setLastError(msg);
      updateDiag({ subscribeError: msg });
      setPushState("error");
      return false;
    }

    let reg = await getSwRegistration();
    if (!reg) {
      reg = await registerServiceWorker();
    }
    if (!reg) {
      setPushState("error");
      return false;
    }

    if (!("PushManager" in reg)) {
      const msg = "Push API is not supported by this browser's service worker.";
      setLastError(msg);
      updateDiag({ subscribeError: msg });
      setPushState("error");
      return false;
    }

    try {
      setPushState("subscribing");
      setLastError(null);

      // Clear stale subscription first to guarantee a fresh one
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          // Ignore — we'll overwrite on the server side anyway
        }
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      // Reject an empty key before calling subscribe() — produces a clearer error
      if (applicationServerKey.byteLength === 0) {
        const msg = "VAPID public key decoded to zero bytes — check NEXT_PUBLIC_VAPID_PUBLIC_KEY.";
        setLastError(msg);
        updateDiag({ subscribeError: msg });
        setPushState("error");
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Redirect: "manual" prevents the browser from following any 30x and
      // re-POSTing the body to /auth/login (which would return 405 and hide
      // the real auth failure).
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
        redirect: "manual",
      });

      // 'opaqueredirect' is what fetch returns when manual redirect handling
      // blocks the 30x — treat that as auth failure.
      if (response.type === "opaqueredirect") {
        const msg =
          "Server redirected the request — your session is no longer valid. Refresh the page, sign in again, then retry.";
        setLastError(msg);
        updateDiag({ subscribeError: msg });
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
          // non-JSON error body
        }
        const detail = body.error || `HTTP ${response.status}`;
        setLastError(`Saving subscription failed: ${detail}`);
        updateDiag({ subscribeError: `HTTP ${response.status} — ${detail}` });
        // Roll back the browser-side subscription
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        setPushState("error");
        return false;
      }

      updateDiag({ lastEndpoint: subscription.endpoint });
      setPushState("subscribed");
      return true;
    } catch (err) {
      const msg = describeError(err);
      console.error("[push] subscribe failed:", err);
      setLastError(`Subscription failed: ${msg}`);
      updateDiag({ subscribeError: msg });
      setPushState("error");
      return false;
    }
  }, [getSwRegistration, registerServiceWorker, updateDiag]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const sub = await getExistingSubscription();
      if (sub) await sub.unsubscribe();
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    }
    try {
      await fetch("/api/push/subscribe", { method: "DELETE", redirect: "manual" });
    } catch {
      // ignore — server row may not exist
    }
    updateDiag({ lastEndpoint: null });
    setPushState("no-subscription");
  }, [getExistingSubscription, updateDiag]);

  const handleEnable = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Capability gate — show the real reason instead of silently doing nothing.
    if (notificationSupport !== "available") {
      setLastError(
        notificationSupportReason ??
          "Notifications are not available in this browser context."
      );
      return;
    }

    setLastError(null);
    try {
      // Promise.race so an unresponsive permission prompt can't hang the UI forever.
      const permissionPromise = Notification.requestPermission();
      const timeoutPromise = new Promise<NotificationPermission>((resolve) =>
        setTimeout(() => resolve("default" as NotificationPermission), 15_000)
      );
      const permission = await Promise.race([permissionPromise, timeoutPromise]);
      setPermission(permission as NotificationState);
      if (permission === "granted") {
        // Only attempt push subscription if push is actually configured.
        if (pushSupport === "available") {
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
      setPermission("denied");
    }
  }, [notificationSupport, notificationSupportReason, pushSupport, subscribeToPush]);

  const handleResubscribe = useCallback(async () => {
    await unsubscribeFromPush();
    if (pushSupport === "available") {
      await subscribeToPush();
    }
  }, [unsubscribeFromPush, subscribeToPush, pushSupport]);

  /**
   * Fire a local notification using the browser's Notification API. Tries the
   * ServiceWorkerRegistration.showNotification path first when a SW is
   * registered (so the notification persists even if the tab is closed),
   * then falls back to `new Notification(...)`.
   *
   * This is what makes "Test Notification" work on supported browsers
   * regardless of whether push is configured — Chrome, Firefox, Edge, and
   * Safari 16+ all support this without a service worker or VAPID keys.
   */
  const fireLocalNotification = useCallback(
    (title: string, bodyText: string, tag: string) => {
      try {
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller &&
          typeof ServiceWorkerRegistration !== "undefined" &&
          typeof (ServiceWorkerRegistration.prototype as { showNotification?: unknown })
            .showNotification === "function"
        ) {
          navigator.serviceWorker.ready
            .then((reg) => reg.showNotification(title, { body: bodyText, tag }))
            .catch((err) => {
              console.warn("[notifications] SW showNotification failed, falling back", err);
              new Notification(title, { body: bodyText, tag });
            });
        } else {
          new Notification(title, { body: bodyText, tag });
        }
      } catch (err) {
        const msg = describeError(err);
        console.error("[notifications] local notification failed:", err);
        setTestError(`Local notification failed: ${msg}`);
        updateDiag({ sendError: msg });
      }
    },
    [updateDiag]
  );

  /**
   * Test notification path. The previous version only allowed a real push,
   * which meant "Test Notification" was unusable when push wasn't configured.
   * We now:
   *   1. Try the server push if push is subscribed.
   *   2. Fall back to a local Notification when permission is granted but
   *      server push is unavailable or not configured. This is the "make
   *      local desktop notification work again" requirement.
   *   3. Surface every failure with the real underlying reason.
   */
  const handleSendTestNotification = useCallback(async () => {
    setTestError(null);
    setTestSent(false);

    if (typeof window === "undefined") return;

    if (permission !== "granted") {
      setTestError("Notification permission is required first.");
      return;
    }

    const title = "Ralts";
    const bodyText = t("settings.notification_sent");
    const localTag = "ralts-test-local";
    const tag = "ralts-test";

    // First choice: live server push (only when subscribed AND push is configured).
    const canUseServerPush =
      pushSupport === "available" && pushStateRef.current === "subscribed";

    if (canUseServerPush) {
      const liveSub = await getExistingSubscription();
      if (!liveSub) {
        setPushState("no-subscription");
        // Fall through to local fallback.
      } else {
        try {
          const response = await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, body: bodyText, tag }),
            redirect: "manual",
          });

          if (response.type === "opaqueredirect") {
            // Auth lost — fall back to a local notification so the user can
            // still verify the Notification API works.
            fireLocalNotification(title, bodyText, localTag);
            setTestSent(true);
            setTimeout(() => setTestSent(false), 3000);
            return;
          }

          if (response.ok) {
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
          setTestError(`Server error: ${detail}`);
          updateDiag({ sendError: `HTTP ${response.status} — ${detail}` });
          return;
        } catch (err) {
          setTestError(`Network error: ${describeError(err)}`);
          updateDiag({ sendError: describeError(err) });
          return;
        }
      }
    }

    // Fallback: local notification via the Notification API. This works on
    // any supported browser (Chrome, Firefox, Edge, Safari 16+) without
    // needing VAPID or a service worker.
    fireLocalNotification(title, bodyText, localTag);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }, [permission, pushSupport, t, getExistingSubscription, updateDiag, fireLocalNotification]);

  // ─── Derived UI flags ─────────────────────────────────────────────────────

  const notificationsReady =
    notificationSupport === "available" && permission === "granted";
  const pushReady =
    notificationsReady &&
    pushSupport === "available" &&
    pushState === "subscribed";

  const isLoading =
    swState === "registering" || pushState === "subscribing";

  const showIOSInstallPrompt =
    notificationSupport === "ios-needs-pwa";
  const showFullyUnsupported =
    notificationSupport === "no-api";
  const showInsecureHint = notificationSupport === "insecure";
  const showIframeHint = notificationSupport === "iframe";

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
                {notificationSupportReason ?? "This browser does not expose the Notification API."}
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
                On iPhone and iPad, the Notification API is only exposed when Ralts is launched
                from the Home Screen. Tap the share button in Safari → &quot;Add to Home
                Screen&quot;, then open Ralts from the Home Screen and return here.
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
              <p className="text-xs text-text-secondary mt-1">
                Notifications require a secure context. The current origin is{" "}
                <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : "—"}</span>{" "}
                — open the HTTPS version of this URL (or use http://localhost during development).
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
                {notificationSupportReason ??
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
                settings (usually under Privacy → Notifications or Site Settings), allow
                notifications for this site, then come back and refresh.
              </p>
            </div>
          </div>
        )}

        {permission === "default" && notificationSupport === "available" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto animate-pulse">
              <Bell className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-text-secondary">
              Tap <span className="font-medium text-text-primary">Enable Notifications</span> below
              to grant permission.
            </p>
          </div>
        )}

        {(notificationSupport === "available" ||
          // On iOS we still want to render the test-instructions and diagnostics
          // even though the Notification API itself is hidden.
          showIOSInstallPrompt) && (
          <>
            {/* Diagnostic status card */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </p>

              <StatusRow
                label="Notification API"
                value={describeNotificationSupport(notificationSupport)}
                state={
                  notificationSupport === "available"
                    ? "ok"
                    : notificationSupport === "ios-needs-pwa"
                      ? "info"
                      : "error"
                }
              />

              <StatusRow
                label="Push (server)"
                value={describePushSupport(pushSupport, pushState === "subscribed")}
                state={
                  pushSupport === "available"
                    ? pushState === "subscribed"
                      ? "ok"
                      : "pending"
                    : pushSupport === "no-vapid"
                      ? "info"
                      : "error"
                }
                action={
                  pushSupport === "available" &&
                  (pushState === "error" || pushState === "no-subscription")
                    ? { label: "Subscribe", onClick: handleResubscribe }
                    : undefined
                }
              />

              <StatusRow
                label="Permission"
                value={
                  permission === "granted"
                    ? "Granted"
                    : permission === "default"
                      ? "Not yet asked"
                      : permission === "denied"
                        ? "Denied at browser level"
                        : "Unavailable"
                }
                state={permission === "granted" ? "ok" : permission === "denied" ? "error" : "pending"}
              />

              {/* PWA install status — informational only */}
              <StatusRow
                label="App Mode"
                value={
                  isPWAInstalled === null
                    ? "Checking..."
                    : isPWAInstalled
                      ? "Installed PWA — notifications most reliable"
                      : "Browser tab — install to home screen for best results"
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
                  <AlertCircle
                    className="h-4 w-4 text-destructive mt-0.5 shrink-0"
                    strokeWidth={1.5}
                  />
                  <p className="text-xs text-destructive break-words">{lastError}</p>
                </div>
              )}
            </div>

            {/* Permission action card */}
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
                      ? "Ralts has permission to send you notifications."
                      : "Enable notifications to receive updates from Ralts."}
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  pushReady
                    ? "bg-success/10 text-success"
                    : notificationsReady
                      ? "bg-warning/10 text-warning"
                      : "bg-surface-elevated text-text-secondary"
                }`}
              >
                {pushReady ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Push enabled
                  </>
                ) : notificationsReady ? (
                  <>
                    <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                    Local notifications only
                  </>
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
                  disabled={isLoading || notificationSupport !== "available"}
                  className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                >
                  Enable Notifications
                </Button>
              )}

              {permission === "granted" &&
                pushSupport === "available" &&
                pushState !== "subscribed" && (
                  <Button
                    onClick={handleResubscribe}
                    disabled={isLoading}
                    className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                  >
                    {pushState === "subscribing" ? "Subscribing..." : "Activate Push"}
                  </Button>
                )}

              {permission === "granted" && (
                <p className="text-xs text-text-tertiary text-center">
                  To disable, revoke permission in your browser settings.
                </p>
              )}
            </div>

            {/* Test notification — works for local OR push */}
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
                        ? "Sends a real server push to this device."
                        : pushSupport === "available"
                          ? "Sends a local notification immediately. Activate Push above to test server delivery."
                          : "Sends a local notification — server push is disabled because NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured."}
                    </p>
                  </div>
                </div>

                {testSent && (
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Test notification sent. It may take a few seconds to arrive.
                  </div>
                )}
                {testError && (
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={1.5} />
                    <span>{testError}</span>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleSendTestNotification}
                  disabled={isLoading || permission !== "granted"}
                  className="w-full h-10"
                >
                  {pushReady
                    ? "Send test push"
                    : "Send test notification"}
                </Button>
              </div>
            )}

            {/* Diagnostics — exact reason for any failure */}
            {diag && (
              <details className="bg-surface rounded-xl p-5 space-y-2">
                <summary className="text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer">
                  Diagnostics
                </summary>
                <div className="text-[11px] text-text-tertiary space-y-1 break-words pt-2 font-mono">
                  <div>UA: {diag.userAgent}</div>
                  <div>
                    Secure context: {String(diag.isSecureContext)} · Top-level:{" "}
                    {String(diag.isTopLevel)} · Iframe: {String(diag.isInIframe)}
                  </div>
                  <div>
                    Notification API: {String(diag.hasNotificationApi)} · ServiceWorker:{" "}
                    {String(diag.hasServiceWorker)} · PushManager (global):{" "}
                    {String(diag.hasPushManagerGlobal)}
                  </div>
                  <div>
                    VAPID key present: {String(diag.vapidKeyPresent)} · SW script:{" "}
                    {diag.swScriptUrl ?? "—"}
                  </div>
                  <div>
                    SW controller active: {String(diag.swControllerActive)} · Standalone:{" "}
                    {String(diag.isStandalone)}
                  </div>
                  <div>
                    Notification support: <b>{diag.notificationSupport}</b>
                    {diag.notificationSupportReason ? ` — ${diag.notificationSupportReason}` : ""}
                  </div>
                  <div>
                    Push support: <b>{diag.pushSupport}</b>
                    {diag.pushSupportReason ? ` — ${diag.pushSupportReason}` : ""}
                  </div>
                  <div>Permission: {String(diag.permission)}</div>
                  {diag.permissionError && <div>Permission error: {diag.permissionError}</div>}
                  {diag.subscribeError && <div>Subscribe error: {diag.subscribeError}</div>}
                  {diag.sendError && <div>Send error: {diag.sendError}</div>}
                  {diag.lastEndpoint && (
                    <div>
                      Endpoint: {diag.lastEndpoint.slice(0, 80)}
                      {diag.lastEndpoint.length > 80 ? "…" : ""}
                    </div>
                  )}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function makeEmptyDiag(): Diagnostic {
  return {
    userAgent: "",
    isSecureContext: false,
    isTopLevel: true,
    isInIframe: false,
    hasNotificationApi: false,
    hasServiceWorker: false,
    hasPushManagerGlobal: false,
    isStandalone: false,
    isIOS: false,
    vapidKeyPresent: false,
    swControllerActive: false,
    swScriptUrl: null,
    permission: "unavailable",
    notificationSupport: "no-api",
    pushSupport: "no-sw",
    notificationSupportReason: null,
    pushSupportReason: null,
    permissionError: null,
    subscribeError: null,
    sendError: null,
    lastEndpoint: null,
  };
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