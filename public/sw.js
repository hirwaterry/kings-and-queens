// public/sw.js  —  Friend of a Week Service Worker

const CACHE_NAME = "fow-v2";
const ICON_192   = "/icons/web-app-manifest-192x192.png";
const ICON_96    = "/icons/favicon-96x96.png";

const STATIC_ASSETS = [
  "/game/",
  "/game/21days",
  "/game/live",
  "/game/leaderboard",
  ICON_192,
  "/icons/web-app-manifest-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("supabase")) return;
  if (event.request.url.includes("dicebear")) return;
  if (event.request.url.includes("youtube")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push handler ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "Friend of a Week 👑",
    body: "Your daily challenge is waiting for you!",
    type: "challenge_reminder",
    url: "/game/21days",
  };
  try { data = { ...data, ...event.data.json() }; } catch (_) {}

  const actions = data.type === "streak_warning"
    ? [{ action: "log_now", title: "🔥 Save My Streak" }, { action: "dismiss", title: "Later" }]
    : [{ action: "log_now", title: "✍️ Log Now" }, { action: "snooze_1h", title: "⏰ Remind in 1h" }];

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: ICON_192,
      badge: ICON_96,
      tag: `fow-${data.type}`,
      requireInteraction: data.type === "streak_warning",
      vibrate: data.type === "streak_warning" ? [200, 100, 200, 100, 400] : [200, 100, 200],
      data: { url: data.url },
      actions,
    })
  );
});

// ── Notification click ────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const { action } = event;
  const { url } = event.notification.data || {};
  event.notification.close();

  if (action === "dismiss") return;

  if (action === "snooze_1h") {
    event.waitUntil(new Promise((resolve) => {
      setTimeout(async () => {
        await self.registration.showNotification("Still here for you 🙏", {
          body: "Your 21-Day Challenge is waiting. Just 5 minutes!",
          icon: ICON_192,
          badge: ICON_96,
          data: { url: "/game/21days" },
          actions: [{ action: "log_now", title: "Log Now" }],
        });
        resolve(undefined);
      }, 60 * 60 * 1000);
    }));
    return;
  }

  const target = url || "/game/21days";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cls) => {
      const existing = cls.find((c) => c.url.includes(target));
      if (existing) { existing.focus(); return; }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});