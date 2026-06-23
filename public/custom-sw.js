// Custom service worker for Ralts push notifications
// Handles push events and displays native notifications

const CACHE_NAME = "ralts-v1";
const OFFLINE_URL = "/dashboard";

// Install event — pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(OFFLINE_URL);
    })
  );
  self.skipWaiting();
});

// Activate event — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Push event — display notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // Fallback for plain text push
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
    actions: [
      {
        action: "open",
        title: "Open Ralts",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title || "Ralts", options)
  );
});

// Notification click — open the app to the relevant URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
