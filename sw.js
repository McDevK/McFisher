// Service Worker for caching resources
// 升级缓存版本以便发布后立刻生效
const CACHE_NAME = 'mcfisher-v1.0.2';
const STATIC_CACHE = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './performance.js',
  './assets/icons/others/profile.webp',
  './assets/icons/others/complete.webp',
  './assets/icons/button/settop_on.webp',
  './assets/icons/button/settop_off.webp',
  './assets/icons/button/spoil.webp',
  './assets/icons/button/setting.webp',
  './assets/icons/others/collection.webp'
];

// 安装事件 - 预缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_CACHE);
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
  // 强制跳过等待，立即激活
  self.skipWaiting();
});

// 监听来自页面的消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch 事件 - 缓存策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 仅处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // JSON数据：网络优先，降级到缓存
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(request); // Fallback to cache
      })
    );
    return;
  }

  // 核心静态资源（HTML, CSS, JS）：网络优先，确保更新
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request).then(networkResponse => {
        // 只有网络请求成功才缓存
        if (networkResponse && networkResponse.status === 200) {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        // 网络失败时才使用缓存
        return caches.match(request);
      })
    );
    return;
  }

  // 图片资源：缓存优先（图片不常变动）
  if (url.pathname.startsWith('/assets/icons/') || url.pathname.startsWith('/assets/images/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          // Fallback for offline or network errors
          return new Response(null, { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }
});