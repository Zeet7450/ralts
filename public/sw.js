// Ralts service worker — handles push notifications.
// Served as /sw.js. Registered by the notifications settings page.

const CACHE_NAME = "ralts-v1";
const OFFLINE_URL = "/dashboard";

// Install — pre-cache offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .catch(() => {})
  );
  self.clients.claim();
});

// Push — display the incoming notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Ralts",
      body: event.data.text(),
      icon: "/icons/android-chrome-192x192.png",
      badge: "/icons/android-chrome-192x192.png",
    };
  }

  const { title, body, icon, badge, tag, data: notificationData } = data;

  const options = {
    body: body || "",
    icon: icon || "/icons/android-chrome-192x192.png",
    badge: badge || "/icons/android-chrome-192x192.png",
    tag: tag || "ralts-notification",
    data: notificationData || { url: "/dashboard" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [{ action: "open", title: "Open Ralts" }],
  };

  event.waitUntil(self.registration.showNotification(title || "Ralts", options));
});

// Notification click — focus or open Ralts
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && new URL(client.url).origin === self.location.origin) {
            return client.focus();
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});
// v2 build stamp
