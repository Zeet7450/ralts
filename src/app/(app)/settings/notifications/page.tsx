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
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationState = "unsupported" | "denied" | "granted" | "default" | "loading";
type SwState = "not-registered" | "registering" | "registered" | "error";
type PushState = "no-subscription" | "subscribing" | "subscribed" | "error";

// VAPID public key — exposed client-side by NEXT_PUBLIC_ prefix
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SW_URL = "/sw.js";
const SW_SCOPE = "/";

// Detail diagnostic info for every failure point — printed to console AND shown
// in the UI so the user sees the real underlying cause, not a generic message.
type Diagnostic = {
  userAgent: string;
  isSecureContext: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isIOSPWAEligible: boolean;
  vapidKeyPresent: boolean;
  swControllerActive: boolean;
  swScriptUrl: string | null;
  permission: NotificationPermission | "unavailable";
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

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [notificationState, setNotificationState] = useState<NotificationState>("loading");
  const [swState, setSwState] = useState<SwState>("not-registered");
  const [pushState, setPushState] = useState<PushState>("no-subscription");
  const [lastError, setLastError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean | null>(null);
  const [diag, setDiag] = useState<Diagnostic | null>(() => {
    // Seed the diagnostic snapshot from the browser environment so the UI
    // can render even before the async state-detection effect runs.
    if (typeof window === "undefined") return null;
    const isIOS = isIOSDevice();
    const hasNotification = "Notification" in window;
    return {
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      hasNotification,
      hasServiceWorker: "serviceWorker" in navigator,
      hasPushManager: "PushManager" in (window as unknown as { PushManager?: unknown }),
      isStandalone:
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean })?.standalone === true,
      isIOS,
      isIOSPWAEligible: isIOS,
      vapidKeyPresent: Boolean(VAPID_PUBLIC_KEY),
      swControllerActive: Boolean(navigator.serviceWorker?.controller),
      swScriptUrl: navigator.serviceWorker?.controller?.scriptURL ?? null,
      permission: hasNotification ? Notification.permission : "unavailable",
      permissionError: null,
      subscribeError: null,
      sendError: null,
      lastEndpoint: null,
    };
  });

  // Refs that always read latest values inside async callbacks
  const pushStateRef = useRef(pushState);
  useEffect(() => {
    pushStateRef.current = pushState;
  }, [pushState]);

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

  // Initial state detection — captures every failure reason for diagnostics
  useEffect(() => {
    let cancelled = false;

    const checkState = async () => {
      if (typeof window === "undefined") return;

      // Distinguish three "unsupported" cases so the UI can give the right
      // remediation instead of a generic message:
      //   1. Notification API missing entirely (old desktop browsers, some in-app WebViews)
      //   2. Notification present but PushManager missing
      //   3. iOS Safari in regular browser mode — Notification is only
      //      exposed once the site is installed as a PWA. Don't say
      //      "unsupported"; say "install to home screen".
      const hasNotification = "Notification" in window;
      const hasServiceWorker = "serviceWorker" in navigator;

      if (!hasNotification || !hasServiceWorker) {
        if (!cancelled) {
          setNotificationState("unsupported");
          updateDiag({
            permissionError: !hasNotification
              ? "Notification API is not exposed by this browser."
              : "Service Worker API is not exposed by this browser.",
          });
        }
        return;
      }

      if (!cancelled) {
        setNotificationState(Notification.permission as NotificationState);
      }

      setSwState("registering");
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
    };

    checkState();
    return () => {
      cancelled = true;
    };
  }, [getSwRegistration, getExistingSubscription, updateDiag]);

  // Register service worker if missing
  const registerServiceWorker =
    useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        setSwState("error");
        setLastError(
          "Service workers are not supported in this browser. Use a modern Chrome, Firefox, Edge, or Safari."
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
        "VAPID public key is not configured. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to your Vercel environment and redeploy.";
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
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }
    setNotificationState("loading");
    setLastError(null);
    try {
      // Promise.race so an unresponsive permission prompt can't hang the UI forever.
      const permissionPromise = Notification.requestPermission();
      const timeoutPromise = new Promise<NotificationPermission>((resolve) =>
        setTimeout(() => resolve("default" as NotificationPermission), 15_000)
      );
      const permission = await Promise.race([permissionPromise, timeoutPromise]);
      setNotificationState(permission as NotificationState);
      if (permission === "granted") {
        await subscribeToPush();
      } else if (permission === "denied") {
        setLastError(
          "Notification permission was denied. Open your browser settings, allow notifications for this site, then refresh."
        );
      }
    } catch (err) {
      setLastError(`Permission request failed: ${describeError(err)}`);
      setNotificationState("denied");
    }
  }, [subscribeToPush]);

  const handleResubscribe = useCallback(async () => {
    await unsubscribeFromPush();
    await subscribeToPush();
  }, [unsubscribeFromPush, subscribeToPush]);

  const handleSendTestNotification = useCallback(async () => {
    setTestError(null);
    setTestSent(false);

    if (typeof window === "undefined" || Notification.permission !== "granted") {
      setTestError("Notification permission is required first.");
      return;
    }

    // Only send real push when we have a confirmed live subscription
    if (pushStateRef.current !== "subscribed") {
      setTestError(
        "Push subscription is not active yet. Retry the subscription first, then send the test."
      );
      return;
    }

    // Re-verify the subscription is actually live before sending
    const liveSub = await getExistingSubscription();
    if (!liveSub) {
      setPushState("no-subscription");
      setTestError("Subscription is gone. Please re-enable push first.");
      return;
    }

    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Ralts",
          body: t("settings.notification_sent"),
          tag: "ralts-test",
        }),
        redirect: "manual",
      });

      if (response.type === "opaqueredirect") {
        setTestError(
          "Server redirected the request — your session is no longer valid. Refresh the page and sign in again."
        );
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
    } catch (err) {
      setTestError(`Network error: ${describeError(err)}`);
      updateDiag({ sendError: describeError(err) });
    }
  }, [t, getExistingSubscription, updateDiag]);

  const isLoading =
    notificationState === "loading" || swState === "registering" || pushState === "subscribing";
  const isFullyReady =
    notificationState === "granted" && swState === "registered" && pushState === "subscribed";

  // Decide whether we should show an iOS-specific "install first" prompt rather
  // than the generic "unsupported" message.
  const showIOSInstallPrompt =
    diag?.isIOS === true && diag.isStandalone === false && diag.hasNotification === false;

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
        {notificationState === "unsupported" && !showIOSInstallPrompt && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Notifications Not Supported</p>
              <p className="text-xs text-text-secondary mt-1">
                Your browser does not expose the Notification API. Use a modern Chrome, Firefox,
                Edge, or Safari 16.4+.
              </p>
              {diag?.permissionError && (
                <p className="text-[11px] text-text-tertiary mt-2 break-words">
                  Reason: {diag.permissionError}
                </p>
              )}
            </div>
          </div>
        )}

        {showIOSInstallPrompt && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <Smartphone className="h-6 w-6 text-accent" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Install Ralts to use push</p>
              <p className="text-xs text-text-secondary mt-1">
                On iPhone and iPad, push notifications only work when Ralts is added to your Home
                Screen. Tap the share button in Safari → &quot;Add to Home Screen&quot; — then open
                Ralts from the Home Screen and return here.
              </p>
            </div>
          </div>
        )}

        {notificationState === "denied" && (
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

        {isLoading && notificationState === "loading" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto animate-pulse">
              <Bell className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-text-secondary">Checking notification status...</p>
          </div>
        )}

        {(notificationState === "default" || notificationState === "granted" || showIOSInstallPrompt) && (
          <>
            {/* Diagnostic status card */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </p>

              {/* Permission status */}
              <StatusRow
                label="Permission"
                value={
                  notificationState === "granted"
                    ? "Granted"
                    : notificationState === "default"
                      ? "Not yet asked"
                      : notificationState
                }
                state={notificationState === "granted" ? "ok" : "pending"}
              />

              {/* Service worker status */}
              <StatusRow
                label="Service Worker"
                value={
                  swState === "registered"
                    ? diag?.swControllerActive
                      ? "Registered and controlling"
                      : "Registered (waiting to control)"
                    : swState === "registering"
                      ? "Registering..."
                      : swState === "error"
                        ? "Registration failed"
                        : "Not registered"
                }
                state={
                  swState === "registered"
                    ? diag?.swControllerActive
                      ? "ok"
                      : "pending"
                    : swState === "registering"
                      ? "pending"
                      : "error"
                }
                action={
                  swState === "not-registered" || swState === "error"
                    ? { label: "Register", onClick: registerServiceWorker }
                    : undefined
                }
              />

              {/* Push subscription status */}
              <StatusRow
                label="Push Subscription"
                value={
                  pushState === "subscribed"
                    ? "Active — device will receive pushes"
                    : pushState === "subscribing"
                      ? "Subscribing..."
                      : pushState === "error"
                        ? "Failed — see error below"
                        : "No active subscription"
                }
                state={
                  pushState === "subscribed"
                    ? "ok"
                    : pushState === "subscribing"
                      ? "pending"
                      : "error"
                }
                action={
                  pushState === "error" || pushState === "no-subscription"
                    ? { label: "Retry", onClick: handleResubscribe }
                    : undefined
                }
              />

              {/* PWA install status */}
              <StatusRow
                label="App Mode"
                value={
                  isPWAInstalled === null
                    ? "Checking..."
                    : isPWAInstalled
                      ? "Installed PWA — notifications most reliable"
                      : diag?.isIOS
                        ? "Browser tab — install to Home Screen for push to work"
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
                    notificationState === "granted" ? "bg-accent/10" : "bg-surface-elevated"
                  }`}
                >
                  <Bell
                    className={`h-5 w-5 ${
                      notificationState === "granted" ? "text-accent" : "text-text-tertiary"
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {t("settings.enable_notifications")}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {notificationState === "granted"
                      ? "Ralts has permission to send you notifications."
                      : "Enable notifications to receive updates from Ralts."}
                  </p>
                </div>
              </div>

              {/* Permission status badge — only "Enabled" when actually subscribed */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  isFullyReady
                    ? "bg-success/10 text-success"
                    : notificationState === "granted"
                      ? "bg-warning/10 text-warning"
                      : "bg-surface-elevated text-text-secondary"
                }`}
              >
                {isFullyReady ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Enabled
                  </>
                ) : notificationState === "granted" ? (
                  <>
                    <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                    Permission granted — subscription not active
                  </>
                ) : (
                  <>
                    <BellOff className="h-3 w-3" strokeWidth={1.5} />
                    Not enabled
                  </>
                )}
              </div>

              {notificationState === "default" && (
                <Button
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                >
                  Enable Notifications
                </Button>
              )}

              {notificationState === "granted" && !isFullyReady && (
                <Button
                  onClick={handleResubscribe}
                  disabled={isLoading}
                  className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                >
                  {pushState === "subscribing" ? "Subscribing..." : "Activate Push"}
                </Button>
              )}

              {notificationState === "granted" && isFullyReady && (
                <div className="space-y-2">
                  <p className="text-xs text-text-tertiary text-center">
                    To disable, revoke permission in your browser settings.
                  </p>
                </div>
              )}
            </div>

            {/* Test notification */}
            {notificationState === "granted" && (
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
                      {pushState === "subscribed"
                        ? "Sends a real push to this device."
                        : "Activate push first, then send a test."}
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

                {!isPWAInstalled && pushState === "subscribed" && (
                  <div className="flex items-start gap-2 bg-accent/5 rounded-lg p-3">
                    <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" strokeWidth={1.5} />
                    <p className="text-xs text-text-secondary">
                      For the most reliable notifications on mobile, install Ralts to your home
                      screen (tap the share button → &quot;Add to Home Screen&quot;). Notifications
                      work better as an installed app.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleSendTestNotification}
                  disabled={isLoading || pushState !== "subscribed"}
                  className="w-full h-10"
                >
                  {pushState === "subscribed"
                    ? t("settings.test_notification")
                    : "Activate push to send a test"}
                </Button>
              </div>
            )}

            {diag && (
              <details className="bg-surface rounded-xl p-5 space-y-2">
                <summary className="text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer">
                  Diagnostics
                </summary>
                <div className="text-[11px] text-text-tertiary space-y-1 break-words pt-2">
                  <div>UA: {diag.userAgent}</div>
                  <div>
                    Secure context: {String(diag.isSecureContext)} · Permission: {String(diag.permission)}
                  </div>
                  <div>
                    Notification API: {String(diag.hasNotification)} · ServiceWorker:{" "}
                    {String(diag.hasServiceWorker)} · PushManager: {String(diag.hasPushManager)}
                  </div>
                  <div>
                    VAPID key present: {String(diag.vapidKeyPresent)} · SW script:{" "}
                    {diag.swScriptUrl ?? "—"}
                  </div>
                  <div>
                    SW controller active: {String(diag.swControllerActive)} · Standalone:{" "}
                    {String(diag.isStandalone)}
                  </div>
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

            {isPWAInstalled === false && notificationState !== "granted" && (
              <div className="bg-surface rounded-xl p-5 space-y-3">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  For Best Reliability
                </p>
                <div className="flex items-start gap-2">
                  <Smartphone
                    className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0"
                    strokeWidth={1.5}
                  />
                  <p className="text-xs text-text-secondary">
                    On mobile, notifications are most reliable when Ralts is installed as a PWA.
                    After enabling above, tap the share button in your browser → &quot;Add to Home
                    Screen&quot;.
                  </p>
                </div>
              </div>
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
    hasNotification: false,
    hasServiceWorker: false,
    hasPushManager: false,
    isStandalone: false,
    isIOS: false,
    isIOSPWAEligible: false,
    vapidKeyPresent: false,
    swControllerActive: false,
    swScriptUrl: null,
    permission: "unavailable",
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