const CACHE_NAME = 'aegis-nex-v1';
const urlsToCache = [
  'index.html',                   // แก้จาก '/' เป็น 'index.html' (หรือจะคง '/' ไว้ก็ได้ แต่ควรมี index.html)
  'index.html',
  'dashboard.html',
  'login.html',
  'register.html',
  'profile.html',
  'withdraw.html',
  'topup.html',
  'transfer.html',
  'history.html',
  'support.html',
  'notification.html',
  'kyc.html',
  'change_password.html',
  'change_pin.html',
  'recovery.html',
  'general_trade_hybrid.html',
  'admin.html',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icons/icon-192.png',        // แก้จาก '/icons/icon-192.png' เป็น 'icons/icon-192.png'
    badge: 'icons/icon-72.png',         // แก้จาก '/icons/icon-72.png' เป็น 'icons/icon-72.png'
    data: {
      url: data.url
    }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});