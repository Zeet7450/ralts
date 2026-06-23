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
  Wifi,
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

// VAPID public key — same as VAPID_PUBLIC_KEY env var (safe to expose client-side)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [notificationState, setNotificationState] = useState<NotificationState>("loading");
  const [swState, setSwState] = useState<SwState>("not-registered");
  const [pushState, setPushState] = useState<PushState>("no-subscription");
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean | null>(null);

  // Check if running as installed PWA
  useEffect(() => {
    const checkPWA = () => {
      if (typeof window === "undefined") return;
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isFullScreen = (window as any).navigator?.standalone === true;
      setIsPWAInstalled(isStandalone || isFullScreen || false);
    };
    checkPWA();
    window.matchMedia("(display-mode: standalone)").addEventListener("change", checkPWA);
    return () => window.matchMedia("(display-mode: standalone)").removeEventListener("change", checkPWA);
  }, []);

  // Get current service worker registration status
  const getSwRegistration = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
    try {
      const registration = await navigator.serviceWorker.getRegistration("/custom-sw.js");
      return registration || null;
    } catch {
      return null;
    }
  }, []);

  // Get existing push subscription
  const getExistingSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    const registration = await getSwRegistration();
    if (!registration) return null;
    try {
      return await registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  }, [getSwRegistration]);

  // Check initial state
  useEffect(() => {
    const checkState = async () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setNotificationState("unsupported");
        return;
      }

      setNotificationState(Notification.permission as NotificationState);

      // Check service worker
      setSwState("registering");
      const registration = await getSwRegistration();
      setSwState(registration ? "registered" : "not-registered");

      // Check push subscription only if permission is granted
      if (Notification.permission === "granted") {
        setPushState("subscribing");
        const sub = await getExistingSubscription();
        setPushState(sub ? "subscribed" : "no-subscription");
      }
    };

    checkState();
  }, [getSwRegistration, getExistingSubscription]);

  // Register service worker if not registered
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setSwState("error");
      return null;
    }

    try {
      setSwState("registering");
      const registration = await navigator.serviceWorker.register("/custom-sw.js", { scope: "/" });
      // Wait for it to activate
      await new Promise<void>((resolve) => {
        if (registration.active) {
          resolve();
        } else {
          registration.addEventListener("activate", () => resolve(), { once: true });
        }
      });
      setSwState("registered");
      return registration;
    } catch (err) {
      console.error("Service worker registration failed:", err);
      setSwState("error");
      return null;
    }
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    const registration = await getSwRegistration();
    const swReg = registration || await registerServiceWorker();
    if (!swReg) return false;

    if (!("PushManager" in swReg)) {
      setPushState("error");
      return false;
    }

    try {
      setPushState("subscribing");
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save to backend
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        await subscription.unsubscribe();
        setPushState("error");
        return false;
      }

      setPushState("subscribed");
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      setPushState("error");
      return false;
    }
  }, [getSwRegistration, registerServiceWorker]);

  // Unsubscribe from push
  const unsubscribeFromPush = useCallback(async () => {
    const sub = await getExistingSubscription();
    if (sub) {
      await sub.unsubscribe();
    }
    await fetch("/api/push/subscribe", { method: "DELETE" });
    setPushState("no-subscription");
  }, [getExistingSubscription]);

  // Full enable flow: request permission → register SW → subscribe to push
  const handleEnable = useCallback(async () => {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    setNotificationState("loading");
    try {
      const permission = await Notification.requestPermission();
      setNotificationState(permission as NotificationState);

      if (permission === "granted") {
        const subscribed = await subscribeToPush();
        if (!subscribed) {
          // SW/Push failed but permission was granted — still usable via new Notification()
          // as a fallback when tab is open
        }
      }
    } catch {
      setNotificationState("denied");
    }
  }, [subscribeToPush]);

  // Send test notification via real push pipeline
  const handleSendTestNotification = useCallback(async () => {
    if (Notification.permission !== "granted") return;

    setTestError(null);

    // If push is subscribed, use the real push API
    if (pushState === "subscribed") {
      try {
        const response = await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Ralts",
            body: t("settings.notification_sent"),
            tag: "ralts-test",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          if (data.code === "EXPIRED") {
            // Re-subscribe flow
            setPushState("no-subscription");
            setTestError("Subscription expired. Please enable notifications again.");
            return;
          }
          throw new Error(data.error || "Send failed");
        }

        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
        return;
      } catch (err) {
        console.error("Push send failed:", err);
        setTestError("Push send failed. Trying fallback...");
      }
    }

    // Fallback: use new Notification() when tab is in foreground
    // (this won't work on mobile when tab is backgrounded — that's expected)
    if (Notification.permission === "granted") {
      new Notification("Ralts", {
        body: t("settings.notification_sent"),
        icon: "/icons/android-chrome-192x192.png",
        badge: "/icons/android-chrome-192x192.png",
        tag: "ralts-test",
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  }, [pushState, t]);

  // Re-subscribe if subscription expired
  const handleResubscribe = useCallback(async () => {
    await unsubscribeFromPush();
    await subscribeToPush();
  }, [unsubscribeFromPush, subscribeToPush]);

  const isLoading = notificationState === "loading" || swState === "registering" || pushState === "subscribing";
  const isReady = notificationState === "granted" && swState === "registered" && pushState === "subscribed";

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <h1 className="text-xl font-semibold">{t("settings.notifications")}</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Unsupported state */}
        {notificationState === "unsupported" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Notifications Not Supported</p>
              <p className="text-xs text-text-secondary mt-1">
                Your browser does not support push notifications. Try Chrome or Safari.
              </p>
            </div>
          </div>
        )}

        {/* Denied state */}
        {notificationState === "denied" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <BellOff className="h-6 w-6 text-destructive" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Notifications Blocked</p>
              <p className="text-xs text-text-secondary mt-1">
                Ralts cannot send notifications because permission was denied. Go to your browser settings and allow notifications for this site, then refresh.
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && notificationState === "loading" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto animate-pulse">
              <Bell className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-text-secondary">Checking notification status...</p>
          </div>
        )}

        {/* Default / granted — show the full diagnostic UI */}
        {(notificationState === "default" || notificationState === "granted") && (
          <>
            {/* Diagnostic status card */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Status</p>

              {/* Permission status */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  notificationState === "granted" ? "bg-success/10" : "bg-surface-elevated"
                }`}>
                  {notificationState === "granted" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} />
                  ) : (
                    <Bell className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">Permission</p>
                  <p className="text-xs text-text-secondary capitalize">{notificationState}</p>
                </div>
              </div>

              {/* Service worker status */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  swState === "registered" ? "bg-success/10" : "bg-surface-elevated"
                }`}>
                  {swState === "registered" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} />
                  ) : swState === "registering" ? (
                    <RefreshCw className="h-4 w-4 text-text-tertiary animate-spin" strokeWidth={1.5} />
                  ) : swState === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                  ) : (
                    <WifiOff className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">Service Worker</p>
                  <p className="text-xs text-text-secondary">
                    {swState === "registered" ? "Registered"
                      : swState === "registering" ? "Registering..."
                      : swState === "error" ? "Registration failed"
                      : "Not registered"}
                  </p>
                </div>
                {swState === "not-registered" && (
                  <button
                    onClick={registerServiceWorker}
                    className="text-xs text-accent hover:underline"
                  >
                    Register
                  </button>
                )}
              </div>

              {/* Push subscription status */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  pushState === "subscribed" ? "bg-success/10" : "bg-surface-elevated"
                }`}>
                  {pushState === "subscribed" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} />
                  ) : pushState === "subscribing" ? (
                    <RefreshCw className="h-4 w-4 text-text-tertiary animate-spin" strokeWidth={1.5} />
                  ) : pushState === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                  ) : (
                    <WifiOff className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">Push Subscription</p>
                  <p className="text-xs text-text-secondary">
                    {pushState === "subscribed" ? "Active — will receive push notifications"
                      : pushState === "subscribing" ? "Subscribing..."
                      : pushState === "error" ? "Failed — try again"
                      : "No active subscription"}
                  </p>
                </div>
                {pushState === "error" && (
                  <button
                    onClick={handleResubscribe}
                    className="text-xs text-accent hover:underline"
                  >
                    Retry
                  </button>
                )}
              </div>

              {/* PWA install status */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isPWAInstalled ? "bg-accent/10" : "bg-surface-elevated"
                }`}>
                  {isPWAInstalled ? (
                    <Smartphone className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  ) : (
                    <Monitor className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">App Mode</p>
                  <p className="text-xs text-text-secondary">
                    {isPWAInstalled ? "Installed PWA — notifications most reliable"
                      : "Browser tab — for best results, install to home screen"}
                  </p>
                </div>
              </div>

              {/* Re-subscribe button when subscribed but permission might have issues */}
              {pushState === "no-subscription" && notificationState === "granted" && (
                <button
                  onClick={subscribeToPush}
                  className="w-full text-xs text-accent hover:underline text-center"
                >
                  Re-subscribe to push notifications
                </button>
              )}
            </div>

            {/* Permission action */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  notificationState === "granted" ? "bg-accent/10" : "bg-surface-elevated"
                }`}>
                  <Bell className={`h-5 w-5 ${notificationState === "granted" ? "text-accent" : "text-text-tertiary"}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{t("settings.enable_notifications")}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {notificationState === "granted"
                      ? "Ralts has permission to send you notifications."
                      : "Enable notifications to receive updates from Ralts."}
                  </p>
                </div>
              </div>

              {/* Permission status badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                notificationState === "granted"
                  ? "bg-success/10 text-success"
                  : "bg-surface-elevated text-text-secondary"
              }`}>
                {notificationState === "granted" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Enabled
                  </>
                ) : (
                  <>
                    <BellOff className="h-3 w-3" strokeWidth={1.5} />
                    Not enabled
                  </>
                )}
              </div>

              {/* Action button */}
              {notificationState === "default" && (
                <Button
                  onClick={handleEnable}
                  className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                >
                  Enable Notifications
                </Button>
              )}

              {notificationState === "granted" && (
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
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Test Notification</p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{t("settings.test_notification")}</p>
                    <p className="text-xs text-text-secondary">
                      {pushState === "subscribed"
                        ? "Sends a real push notification to this device."
                        : "Subscribing first, then sending test..."}
                    </p>
                  </div>
                </div>

                {/* Success / error feedback */}
                {testSent && (
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Test notification sent!
                  </div>
                )}
                {testError && (
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={1.5} />
                    <span>{testError}</span>
                  </div>
                )}

                {/* PWA not installed warning */}
                {!isPWAInstalled && pushState === "subscribed" && (
                  <div className="flex items-start gap-2 bg-accent/5 rounded-lg p-3">
                    <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" strokeWidth={1.5} />
                    <p className="text-xs text-text-secondary">
                      For the most reliable notifications on mobile, install Ralts to your home screen
                      (tap the share button → "Add to Home Screen"). Notifications work better as an installed app.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleSendTestNotification}
                  disabled={isLoading}
                  className="w-full h-10"
                >
                  {t("settings.test_notification")}
                </Button>
              </div>
            )}

            {/* How to install PWA */}
            {isPWAInstalled === false && notificationState !== "granted" && (
              <div className="bg-surface rounded-xl p-5 space-y-3">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">For Best Reliability</p>
                <div className="flex items-start gap-2">
                  <Smartphone className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-text-secondary">
                    On mobile, notifications are most reliable when Ralts is installed as a PWA.
                    After enabling above, tap the share button in your browser → "Add to Home Screen".
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
