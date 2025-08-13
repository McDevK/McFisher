// McFisher 超简单 Service Worker - 最小化缓存策略
const CACHE_NAME = 'mcfisher-simple-v1.0.0';

// 安装事件 - 立即激活
self.addEventListener('install', event => {
  console.log('SW: Installing');
  self.skipWaiting();
});

// 激活事件 - 清理旧缓存并接管
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch 事件 - 最简单的缓存策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // 图片资源：缓存优先
  if (url.pathname.startsWith('/assets/icons/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              // 简单缓存，不使用clone
              cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          }).catch(() => {
            // 返回1x1透明图
            return new Response(
              new Uint8Array([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
                0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x60, 0x60, 0x00,
                0x02, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00,
                0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
              ]),
              { 
                headers: { 
                  'Content-Type': 'image/png',
                  'Cache-Control': 'max-age=3600'
                } 
              }
            );
          });
        });
      })
    );
    return;
  }

  // 其他资源：直接通过网络
  event.respondWith(fetch(request));
});

// 监听消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
