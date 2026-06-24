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

// ─── State types ────────────────────────────────────────────────────────────

type PermissionStatus = "default" | "granted" | "denied" | "unavailable";
type SwState = "not-registered" | "registering" | "registered" | "error";
type PushState =
  | "no-subscription"
  | "subscribing"
  | "subscribed"
  | "error"
  | "not-configured";

// Why the browser can't show notifications. null = available.
type NotificationBlock = "ios-needs-pwa" | "insecure" | "iframe" | "no-api" | null;

// Why background push can't work. null = configured (SW + HTTPS + VAPID + pushManager).
type PushBlock = "insecure" | "no-sw" | "no-vapid" | "no-push-manager" | null;

// ─── Constants ──────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SW_URL = "/sw.js";
const SW_SCOPE = "/";

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

/**
 * Synchronous environment probe — runs in render setup, before any async
 * service-worker check. The result drives the user-visible blocking banners.
 */
function readEnvironment(): {
  notificationBlock: NotificationBlock;
  pushBlock: PushBlock;
  permission: PermissionStatus;
  isSecureContext: boolean;
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
  const isInIframe =
    typeof window !== "undefined" && window.self !== window.top;

  let notificationBlock: NotificationBlock = null;
  if (isIOS && !isStandalone && !hasNotificationConstructor) {
    notificationBlock = "ios-needs-pwa";
  } else if (!isSecureContext) {
    notificationBlock = "insecure";
  } else if (!hasNotificationConstructor) {
    notificationBlock = "no-api";
  } else if (isInIframe) {
    notificationBlock = "iframe";
  }

  let pushBlock: PushBlock = null;
  if (!isSecureContext) {
    pushBlock = "insecure";
  } else if (!hasServiceWorkerObject) {
    pushBlock = "no-sw";
  } else if (!VAPID_PUBLIC_KEY) {
    pushBlock = "no-vapid";
  }

  const permission: PermissionStatus = hasNotificationConstructor
    ? (Notification.permission as PermissionStatus)
    : "unavailable";

  return { notificationBlock, pushBlock, permission, isSecureContext };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [permission, setPermission] = useState<PermissionStatus>("default");
  const [swState, setSwState] = useState<SwState>("not-registered");
  const [pushState, setPushState] = useState<PushState>("no-subscription");
  const [lastError, setLastError] = useState<string | null>(null);
  const [notificationBlock, setNotificationBlock] = useState<NotificationBlock>(null);
  const [pushBlock, setPushBlock] = useState<PushBlock>(null);
  const [pushConfigured, setPushConfigured] = useState(false);

  // ─── Mount: sync environment probe + async pushManager probe + restore
  // any existing push subscription. The result populates the capability
  // state that drives the user-facing summary.

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      const env = readEnvironment();
      if (cancelled) return;
      setNotificationBlock(env.notificationBlock);
      setPermission(env.permission);

      // Async refinement: does the active SW registration expose pushManager?
      let resolvedPushBlock: PushBlock = env.pushBlock;
      let resolvedPushConfigured = env.pushBlock === null;
      if (env.isSecureContext && env.pushBlock === null) {
        try {
          const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
          if (reg && !("pushManager" in reg)) {
            resolvedPushBlock = "no-push-manager";
            resolvedPushConfigured = false;
          }
        } catch {
          // ignore
        }
      }

      if (cancelled) return;
      setPushBlock(resolvedPushBlock);
      setPushConfigured(resolvedPushConfigured);
      setSwState(navigator.serviceWorker?.controller ? "registered" : "not-registered");

      // Restore existing push subscription
      if (
        env.notificationBlock === null &&
        env.permission === "granted" &&
        resolvedPushConfigured
      ) {
        try {
          const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
          const sub = reg ? await reg.pushManager.getSubscription() : null;
          if (!cancelled) setPushState(sub ? "subscribed" : "no-subscription");
        } catch {
          if (!cancelled) setPushState("no-subscription");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Production logic: register SW, subscribe, unsubscribe ───────────────
  //
  // Same code paths the rest of the app exercises when it sends a push
  // (the push handler in /api/push/send relies on the subscription this
  // page creates). Not test/dev code — the actual subscription lifecycle.

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
      setPushState("error");
      return false;
    }
    if (!window.isSecureContext) {
      const msg = "Push requires HTTPS or localhost. The current origin is not secure.";
      setLastError(msg);
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
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        setPushState("error");
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
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        setPushState("error");
        return false;
      }

      setPushState("subscribed");
      setPushConfigured(true);
      setPushBlock(null);
      return true;
    } catch (err) {
      const msg = describeError(err);
      console.error("[push] subscribe failed:", err);
      setLastError(`Subscription failed: ${msg}`);
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
        if (pushConfigured) {
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
  }, [pushConfigured, subscribeToPush]);

  const handleTurnOff = useCallback(async () => {
    await unsubscribeFromPush();
  }, [unsubscribeFromPush]);

  // ─── Derived UI flags ─────────────────────────────────────────────────────

  const notificationsReady = notificationBlock === null && permission === "granted";
  const pushReady = notificationsReady && pushConfigured && pushState === "subscribed";

  const isLoading = swState === "registering" || pushState === "subscribing";

  const showIOSInstallPrompt = notificationBlock === "ios-needs-pwa";
  const showFullyUnsupported = notificationBlock === "no-api";
  const showInsecureHint = notificationBlock === "insecure";
  const showIframeHint = notificationBlock === "iframe";

  // ─── Status copy (one line, plain language) ──────────────────────────────

  type StatusState = "ok" | "pending" | "error" | "info";
  const summaryLine = (() => {
    if (permission === "denied") return "Notifications are blocked in your browser.";
    if (showFullyUnsupported) return "Notifications aren't supported here.";
    if (showIOSInstallPrompt)
      return "Install Ralts to your Home Screen to turn on notifications.";
    if (showInsecureHint) return "Notifications need a secure connection.";
    if (showIframeHint) return "Open this page in its own tab to enable notifications.";
    if (permission === "default") return "Notifications are off.";
    if (pushReady) return "Background push is on.";
    if (pushConfigured)
      return "Notifications are on. Tap below to also enable background push.";
    return "Notifications are on.";
  })();

  const summaryState: StatusState =
    permission === "denied" || showFullyUnsupported
      ? "error"
      : pushReady
        ? "ok"
        : notificationsReady
          ? pushConfigured
            ? "pending"
            : "info"
          : showIOSInstallPrompt || showInsecureHint || showIframeHint
            ? "info"
            : "pending";

  // User-facing explanation when push is configured but the VAPID key was
  // missing — phrased in plain language, not technical.
  const pushBlockReason =
    pushBlock === "no-vapid"
      ? "Background push is disabled by the server configuration, but local notifications still work."
      : pushBlock === "insecure"
        ? "Background push needs a secure connection."
        : pushBlock === "no-sw"
          ? "Background push needs a service worker, which this browser doesn't support."
          : pushBlock === "no-push-manager"
            ? "This browser doesn't support background push."
            : null;

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
            {summaryState === "error" ? (
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
              This browser doesn&apos;t expose the Notification API.
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
              Notifications need HTTPS or http://localhost to work.
            </p>
          </div>
        )}

        {showIframeHint && (
          <div className="bg-surface rounded-xl p-5 text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">Open this page in its own tab</p>
            <p className="text-xs text-text-secondary">
              Notifications can&apos;t be requested from inside an iframe.
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
        {permission === "default" && notificationBlock === null && (
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full h-11 bg-accent text-white hover:bg-accent/90"
          >
            {t("settings.enable_notifications")}
          </Button>
        )}

        {permission === "granted" && pushConfigured && pushState !== "subscribed" && (
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

        {/* ─── Plain-language note when push can't work ───────────────── */}
        {notificationsReady && pushBlockReason && pushBlock !== null && (
          <p className="text-[11px] text-text-tertiary text-center px-2">
            {pushBlockReason}
          </p>
        )}

        {/* ─── Subtle success indicator when push is on ───────────────── */}
        {pushReady && (
          <div className="flex items-center gap-1.5 text-xs text-success px-1">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
            Background push is active on this device.
          </div>
        )}
      </div>
    </div>
  );
}
