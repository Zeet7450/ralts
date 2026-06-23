"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Bell, BellOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationState = "unsupported" | "denied" | "granted" | "default" | "loading";

export default function NotificationSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [notificationState, setNotificationState] = useState<NotificationState>("loading");
  const [isEnabled, setIsEnabled] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const checkNotificationSupport = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission as NotificationState;
  }, []);

  useEffect(() => {
    const permission = checkNotificationSupport();
    setNotificationState(permission);
    setIsEnabled(permission === "granted");
  }, [checkNotificationSupport]);

  const handleRequestPermission = async () => {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    setNotificationState("loading");

    try {
      const permission = await Notification.requestPermission();
      setNotificationState(permission as NotificationState);
      setIsEnabled(permission === "granted");

      if (permission === "granted") {
        // Send a test notification immediately after permission is granted
        new Notification("Ralts", {
          body: t("settings.notification_sent"),
          icon: "/icons/android-chrome-192x192.png",
          badge: "/icons/android-chrome-192x192.png",
          tag: "ralts-test",
        });
        setTestSent(true);
      }
    } catch {
      setNotificationState("denied");
      setIsEnabled(false);
    }
  };

  const handleSendTestNotification = () => {
    if (Notification.permission !== "granted") return;

    new Notification("Ralts", {
      body: t("settings.notification_sent"),
      icon: "/icons/android-chrome-192x192.png",
      badge: "/icons/android-chrome-192x192.png",
      tag: "ralts-test",
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleRevokePermission = () => {
    // Browser does not allow revoking permission programmatically.
    // The user must go to browser settings.
    // We just update our UI state to reflect that the toggle is off.
    setIsEnabled(false);
  };

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
                Your browser does not support push notifications. Try using a modern browser like Chrome or Safari.
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
                Ralts cannot send notifications because permission was denied. Please go to your browser settings and allow notifications for this site to enable them.
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {notificationState === "loading" && (
          <div className="bg-surface rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto animate-pulse">
              <Bell className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-text-secondary">Checking notification status...</p>
          </div>
        )}

        {/* Enabled / default state */}
        {(notificationState === "default" || notificationState === "granted") && (
          <>
            {/* Permission card */}
            <div className="bg-surface rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isEnabled ? "bg-accent/10" : "bg-surface-elevated"
                }`}>
                  <Bell className={`h-5 w-5 ${isEnabled ? "text-accent" : "text-text-tertiary"}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{t("settings.enable_notifications")}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {isEnabled
                      ? "Ralts has permission to send you notifications."
                      : "Enable notifications to receive updates from Ralts."}
                  </p>
                </div>
              </div>

              {/* Permission status badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isEnabled
                  ? "bg-success/10 text-success"
                  : "bg-surface-elevated text-text-secondary"
              }`}>
                {isEnabled ? (
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
              {notificationState === "default" && !isEnabled && (
                <Button
                  onClick={handleRequestPermission}
                  className="w-full h-10 bg-accent text-white hover:bg-accent/90"
                >
                  Enable Notifications
                </Button>
              )}

              {isEnabled && (
                <div className="space-y-2">
                  <p className="text-xs text-text-tertiary text-center">
                    To disable notifications, revoke permission in your browser settings.
                  </p>
                </div>
              )}
            </div>

            {/* Test notification */}
            {isEnabled && (
              <div className="bg-surface rounded-xl p-5 space-y-4">
                <p className="text-xs font-medium text-text-secondary">TEST NOTIFICATION</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{t("settings.test_notification")}</p>
                    <p className="text-xs text-text-secondary">Send a test notification to verify it works.</p>
                  </div>
                </div>
                {testSent && (
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    Test notification sent!
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={handleSendTestNotification}
                  className="w-full h-10"
                >
                  {t("settings.test_notification")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}