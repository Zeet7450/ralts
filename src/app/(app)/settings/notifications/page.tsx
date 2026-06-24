"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Capability states ──────────────────────────────────────────────────────
//
// The capability ladder drives both the user-facing copy (a one-line summary)
// and the optional "why this is blocked" banner. The diagnostic panel at the
// bottom of the page reads the same fields, so the surface UI and the
// developer diagnostics cannot drift apart.

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
  | "no-push-manager" // browser doesn't expose PushManager on its SW
  | "insecure"; // origin is not a secure context

type PermissionStatus = "default" | "granted" | "denied" | "unavailable";
type SwState = "not-registered" | "registering" | "registered" | "error";
type PushState =
  | "no-subscription"
  | "subscribing"
  | "subscribed"
  | "error"
  | "not-configured";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SW_URL = "/sw.js";
const SW_SCOPE = "/";

// ─── Diagnostic snapshot (collapsed Advanced panel) ─────────────────────────

type Diagnostic = {
  capturedAt: string;
  userAgent: string;
  origin: string;
  hostname: string;
  protocol: string;
  isSecureContext: boolean;
  isTopLevel: boolean;
  isInIframe: boolean;
  typeofNotification: "function" | "undefined" | string;
  typeofServiceWorker: "object" | "undefined" | string;
  notificationPermissionValue: PermissionStatus;
  swControllerActive: boolean;
  swRegistrationExists: boolean;
  swRegistrationPushManager: boolean;
  swRegistrationActive: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  vapidKeyPresent: boolean;
  vapidKeyLength: number;
  notificationSupport: NotificationSupport;
  notificationSupportReason: string | null;
  pushSupport: PushSupport;
  pushSupportReason: string | null;
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
    if (err.name === "NotAllowedError")
      return "Permission to subscribe was denied by the browser or user.";
    if (err.name === "AbortError") return "Subscription was aborted. Please try again.";
    if (err.name === "InvalidStateError")
      return "An existing subscription is in an invalid state. Unsubscribing and retrying…";
    if (err.name === "NotSupportedError")
      return "Push notifications are not supported in this browser context.";
    if (err.name === "NotFoundError")
      return "Service worker not registered yet. Please retry in a moment.";
    if (err.name === "SecurityError")
      return "Security error — push requires HTTPS (or localhost) and an active service worker.";
    return err.message || err.name || String(err);
  }
  return String(err);
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function readLiveCapabilities(): {
  notificationSupport: NotificationSupport;
  notificationSupportReason: string | null;
  pushSupport: PushSupport;
  pushSupportReason: string | null;
  permission: PermissionStatus;
  swControllerActive: boolean;
  typeofNotification: string;
  typeofServiceWorker: string;
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

  const hasNotificationConstructor =
    typeof window !== "undefined" && typeof window.Notification === "function";
  const hasServiceWorkerObject =
    typeof navigator !== "undefined" && typeof navigator.serviceWorker === "object";
  const isSecureContext =
    typeof window !== "undefined" ? window.isSecureContext : false;
  const isTopLevel =
    typeof window !== "undefined" ? window.self === window.top : true;
  const isInIframe = !isTopLevel;

  const notificationPermissionValue: PermissionStatus = hasNotificationConstructor
    ? (Notification.permission as PermissionStatus)
    : "unavailable";

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

  const swControllerActive =
    typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);

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

  return {
    notificationSupport,
    notificationSupportReason,
    pushSupport,
    pushSupportReason,
    permission: notificationPermissionValue,
    swControllerActive,
    typeofNotification:
      typeof window !== "undefined" ? typeof window.Notification : "undefined",
    typeofServiceWorker:
      typeof navigator !== "undefined" ? typeof navigator.serviceWorker : "undefined",
    notificationPermissionValue,
    isSecureContext,
    isTopLevel,
    isInIframe,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [permission, setPermission] = useState<PermissionStatus>("default");
  const [swState, setSwState] = useState<SwState>("not-registered");
  const [pushState, setPushState] = useState<PushState>("no-subscription");
  const [lastError, setLastError] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diagnostic | null>(null);

  // ─── Diagnostic: built once on mount. The collapsed Advanced panel at the
  // bottom of the page reads the same snapshot, so the user-facing summary
  // and the diagnostic never drift.

  const buildDiagnostic = useCallback(async (): Promise<Diagnostic> => {
    const live = readLiveCapabilities();

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

    let pushSupport: PushSupport = live.pushSupport;
    let pushSupportReason: string | null = live.pushSupportReason;
    if (pushSupport === "available" && !swRegistrationPushManager) {
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
      isSecureContext: live.isSecureContext,
      isTopLevel: live.isTopLevel,
      isInIframe: live.isInIframe,
      typeofNotification: live.typeofNotification,
      typeofServiceWorker: live.typeofServiceWorker,
      notificationPermissionValue: live.notificationPermissionValue,
      swControllerActive: live.swControllerActive,
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
      lastEndpoint: null,
      subscribeError: null,
      sendError: null,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const d = await buildDiagnostic();
      if (cancelled) return;
      setDiag(d);
      setPermission(d.notificationPermissionValue);
      setSwState(d.swControllerActive ? "registered" : "not-registered");

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

  // ─── Production logic: register SW, subscribe, unsubscribe ───────────────
  //
  // These are the same code paths the rest of the app exercises when it sends
  // a push (the push handler in /api/push/send relies on the subscription this
  // page creates). They are NOT test/dev code — they are the actual
  // subscription lifecycle.

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
      return registration;
    } catch (err) {
      const msg = describeError(err);
      console.error("[push] service worker registration failed:", err);
      setLastError(`Service worker registration failed: ${msg}`);
      setSwState("error");
      return null;
    }
  }, []);

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

  // ─── User actions ─────────────────────────────────────────────────────────

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

  const handleTurnOff = useCallback(async () => {
    await unsubscribeFromPush();
  }, [unsubscribeFromPush]);

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

  // ─── Status copy (one line, plain language) ──────────────────────────────

  type StatusState = "ok" | "pending" | "error" | "info";
  const summaryLine = (() => {
    if (permission === "denied") return "Notifications are blocked in your browser.";
    if (showFullyUnsupported) return "Notifications aren't supported here.";
    if (showIOSInstallPrompt)
      return "Install Ralts to your Home Screen to turn on notifications.";
    if (showInsecureHint) return "Notifications need a secure connection.";
    if (showIframeHint) return "Open this page in its own tab to enable notifications.";
    if (!diag) return "Checking…";
    if (!notificationsReady) return "Notifications are off.";
    if (pushReady) return "Background push is on.";
    if (diag.pushSupport === "available")
      return "Notifications are on. Tap below to also enable background push.";
    return "Notifications are on.";
  })();

  const summaryState: StatusState =
    permission === "denied" || showFullyUnsupported
      ? "error"
      : pushReady
        ? "ok"
        : notificationsReady
          ? diag?.pushSupport === "available"
            ? "pending"
            : "info"
          : showIOSInstallPrompt || showInsecureHint || showIframeHint
            ? "info"
            : "pending";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <h1 className="text-xl font-semibold">{t("settings.notifications")}</h1>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* ─── Status ──────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-xl px-4 py-4 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              summaryState === "ok"
                ? "bg-success/10 text-success"
                : summaryState === "error"
                  ? "bg-destructive/10 text-destructive"
                  : summaryState === "info"
                    ? "bg-accent/10 text-accent"
                    : "bg-surface-elevated text-text-tertiary"
            }`}
          >
            {summaryState === "ok" ? (
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            ) : summaryState === "error" ? (
              <BellOff className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{summaryLine}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {pushReady
                ? "You'll get a heads-up even when the app isn't open."
                : notificationsReady
                  ? "You'll get a heads-up while this tab is open."
                  : "Get a heads-up when something needs your attention."}
            </p>
          </div>
        </div>

        {/* ─── Blocking banners (only when nothing else can render) ────── */}
        {showFullyUnsupported && (
          <div className="bg-surface rounded-xl p-5 text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">Notifications Not Supported</p>
            <p className="text-xs text-text-secondary">
              {diag?.notificationSupportReason ?? "This browser doesn't expose the Notification API."}
            </p>
          </div>
        )}

        {showIOSInstallPrompt && (
          <div className="bg-surface rounded-xl p-5 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <Smartphone className="h-5 w-5 text-accent" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-text-primary">
              Install Ralts to your Home Screen
            </p>
            <p className="text-xs text-text-secondary">
              On iPhone and iPad, notifications only work when Ralts is launched from the Home
              Screen. Open the share menu in Safari and choose &quot;Add to Home Screen&quot;, then
              return here.
            </p>
          </div>
        )}

        {showInsecureHint && (
          <div className="bg-surface rounded-xl p-5 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-5 w-5 text-warning" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-text-primary">A secure connection is required</p>
            <p className="text-xs text-text-secondary break-words">
              {diag?.notificationSupportReason ??
                "Notifications need HTTPS or http://localhost to work."}
            </p>
          </div>
        )}

        {showIframeHint && (
          <div className="bg-surface rounded-xl p-5 text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">Open this page in its own tab</p>
            <p className="text-xs text-text-secondary">
              {diag?.notificationSupportReason ??
                "Notifications can't be requested from inside an iframe."}
            </p>
          </div>
        )}

        {permission === "denied" &&
          !showFullyUnsupported &&
          !showIOSInstallPrompt && (
            <div className="bg-surface rounded-xl p-5 text-center space-y-2">
              <p className="text-sm font-medium text-text-primary">Notifications are blocked</p>
              <p className="text-xs text-text-secondary">
                Permission was denied. Open your browser settings, allow notifications for this
                site, then refresh.
              </p>
            </div>
          )}

        {/* ─── ONE primary action ─────────────────────────────────────── */}
        {permission === "default" && diag?.notificationSupport === "available" && (
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full h-11 bg-accent text-white hover:bg-accent/90"
          >
            {t("settings.enable_notifications")}
          </Button>
        )}

        {permission === "granted" &&
          diag?.pushSupport === "available" &&
          pushState !== "subscribed" && (
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              className="w-full h-11 bg-accent text-white hover:bg-accent/90"
            >
              {pushState === "subscribing" ? "Activating…" : "Enable background push"}
            </Button>
          )}

        {/* ─── Subtle Turn off link (only when something is on) ───────── */}
        {notificationsReady && (
          <button
            type="button"
            onClick={handleTurnOff}
            disabled={isLoading}
            className="w-full text-center text-xs text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
          >
            Turn off notifications
          </button>
        )}

        {/* ─── Error surfaced from a failed subscribe/register ─────────── */}
        {lastError && (
          <div className="flex items-start gap-2 bg-destructive/10 rounded-lg p-3">
            <AlertCircle
              className="h-4 w-4 text-destructive mt-0.5 shrink-0"
              strokeWidth={1.5}
            />
            <p className="text-xs text-destructive break-words">{lastError}</p>
          </div>
        )}

        {/* ─── Subtle success indicator when push is on ───────────────── */}
        {pushReady && (
          <div className="flex items-center gap-1.5 text-xs text-success px-1">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
            Background push is active on this device.
          </div>
        )}

        {/* ─── Advanced · diagnostics (collapsed, no buttons) ──────────── */}
        {diag && (
          <details className="bg-surface rounded-xl px-4 py-3 mt-6">
            <summary className="text-xs font-medium text-text-tertiary uppercase tracking-wider cursor-pointer select-none">
              Advanced · diagnostics
            </summary>
            <div className="pt-3 text-[11px] text-text-tertiary space-y-1 break-words font-mono border-t border-border mt-3">
              <div>
                <b>Origin:</b> {diag.origin} ({diag.protocol}
                {"//"}
                {diag.hostname})
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
                <b>Notification support:</b> {diag.notificationSupport}
                {diag.notificationSupportReason ? ` — ${diag.notificationSupportReason}` : ""}
              </div>
              <div>
                <b>Push support:</b> {diag.pushSupport}
                {diag.pushSupportReason ? ` — ${diag.pushSupportReason}` : ""}
              </div>
              <div>
                <b>SW controller active:</b> {String(diag.swControllerActive)}
              </div>
              <div>
                <b>SW registration:</b> {String(diag.swRegistrationExists)} · pushManager:{" "}
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
              {diag.lastEndpoint && (
                <div>
                  <b>Endpoint:</b> {diag.lastEndpoint.slice(0, 80)}
                  {diag.lastEndpoint.length > 80 ? "…" : ""}
                </div>
              )}
              {diag.subscribeError && (
                <div>
                  <b>Subscribe error:</b> {diag.subscribeError}
                </div>
              )}
              {diag.sendError && (
                <div>
                  <b>Send error:</b> {diag.sendError}
                </div>
              )}
              <div>
                <b>Captured:</b> {diag.capturedAt}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
