// Service Worker for caching resources
const CACHE_NAME = 'mcfisher-v1.0.0';
const STATIC_CACHE = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './assets/icons/others/profile.png',
  './assets/icons/others/complete.png',
  './assets/icons/others/settop_on.png',
  './assets/icons/others/settop_off.png',
  './assets/icons/others/spoil.png',
  './assets/icons/others/collection.png'
];

// 安装事件 - 预缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 获取事件 - 缓存策略
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 对图片资源使用缓存优先策略
  if (url.pathname.includes('/assets/icons/')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // 对JSON数据使用网络优先策略
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // 对其他资源使用缓存优先策略
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
