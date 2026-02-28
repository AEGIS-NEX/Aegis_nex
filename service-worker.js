// ============================================================
// AEGIS NEX Service Worker — Full UI Cache Strategy
// ============================================================

const CACHE_VERSION = 'aegis-nex-v2';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/login.html',
  '/register.html',
  '/profile.html',
  '/withdraw.html',
  '/topup.html',
  '/transfer.html',
  '/history.html',
  '/support.html',
  '/notification.html',
  '/kyc.html',
  '/change_password.html',
  '/change_pin.html',
  '/recovery.html',
  '/general_trade_hybrid.html',
  '/trade_parcel.html',
  '/admin.html',
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const NEVER_CACHE_PATTERNS = [
  'supabase.co',
  'supabase.io',
  'realtime',
  'socket'
];

// ============================================================
// INSTALL — Pre-cache Shell Files
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing AEGIS NEX Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        return Promise.allSettled(
          SHELL_URLS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Failed to cache: ${url}`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — Clean up old caches
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(name =>
            name.startsWith('aegis-nex-') &&
            name !== STATIC_CACHE &&
            name !== DYNAMIC_CACHE &&
            name !== IMAGE_CACHE
          )
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Smart Routing Strategy
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (NEVER_CACHE_PATTERNS.some(p => request.url.includes(p))) return;

  // รูปภาพ → Cache First
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // CDN Fonts, CSS, JS → Cache First
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('flaticon.com')
  ) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Shell HTML → Stale-While-Revalidate (เร็ว + ทันสมัย)
  if (SHELL_URLS.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Supabase REST API → Network First เสมอ
  if (url.hostname.includes('supabase')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // อื่นๆ → Network First + Dynamic Cache fallback
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
});

// ============================================================
// STRATEGY 1: Cache First
// ============================================================
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

// ============================================================
// STRATEGY 2: Stale-While-Revalidate
// ============================================================
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) cache.put(request, networkResponse.clone());
      return networkResponse;
    })
    .catch(() => null);
  return cached || fetchPromise;
}

// ============================================================
// STRATEGY 3: Network First
// ============================================================
async function networkFirstStrategy(request, cacheName = null) {
  try {
    const networkResponse = await fetch(request);
    if (cacheName && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', event => {
  let data = { title: 'AEGIS NEX', body: 'มีการแจ้งเตือนใหม่', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) { console.warn('[SW] Push data parse error', e); }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'aegis-notification',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '📦 ดูรายละเอียด' },
      { action: 'close', title: 'ปิด' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});

// ============================================================
// MESSAGE — รับคำสั่งจาก main thread
// ============================================================
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    event.ports[0]?.postMessage({ result: 'CACHE_CLEARED' });
  }
});
