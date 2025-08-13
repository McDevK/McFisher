// Service Worker for aggressive caching and performance
const CACHE_NAME = 'mcfisher-v1.0.3';
const STATIC_CACHE = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './performance.js'
];

// 核心图标（立即缓存）
const CRITICAL_IMAGES = [
  './assets/icons/others/profile.webp',
  './assets/icons/others/complete.webp',
  './assets/icons/button/settop_on.webp',
  './assets/icons/button/settop_off.webp',
  './assets/icons/button/spoil.webp',
  './assets/icons/button/setting.png',
  './assets/icons/others/collection.webp'
];

// 安装事件 - 立即缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // 缓存静态资源
      caches.open(CACHE_NAME).then(cache => {
        console.log('SW: Caching static assets');
        return cache.addAll(STATIC_CACHE);
      }),
      // 缓存关键图标
      caches.open(CACHE_NAME + '-images').then(cache => {
        console.log('SW: Caching critical images');
        return cache.addAll(CRITICAL_IMAGES);
      })
    ]).catch(error => {
      console.error('SW: Install failed', error);
    })
  );
  
  // 立即激活，跳过等待
  self.skipWaiting();
});

// 激活事件 - 清理旧缓存并接管页面
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheName.startsWith('mcfisher-v1.0.3')) {
            console.log('SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activated and claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch 事件 - 智能缓存策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // JSON数据：网络优先，5秒超时
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      Promise.race([
        fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, response.clone());
            });
          }
          return response;
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // 核心静态资源：缓存优先，网络更新
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          // 后台更新缓存
          fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {});
          
          return cachedResponse;
        }
        
        // 缓存未命中，从网络获取
        return fetch(request).then(networkResponse => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 图片资源：积极缓存，长期有效
  if (url.pathname.startsWith('/assets/icons/') || url.pathname.startsWith('/assets/images/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 图片未缓存，获取并永久缓存
        return fetch(request).then(networkResponse => {
          if (networkResponse.ok) {
            const cacheKey = url.pathname.includes('/fishes/') ? 
              CACHE_NAME + '-fishes' : CACHE_NAME + '-images';
            
            caches.open(cacheKey).then(cache => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => {
          // 网络失败时返回占位图
          return new Response(
            '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#ddd"/><text x="20" y="25" text-anchor="middle" font-size="12" fill="#999">?</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        });
      })
    );
    return;
  }
});

// 监听来自页面的消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // 预缓存鱼类图片
  if (event.data && event.data.action === 'preload-fish') {
    const fishNames = event.data.fishNames || [];
    const cachePromises = fishNames.map(name => {
      const url = `./assets/icons/fishes/${name}.webp`;
      return fetch(url).then(response => {
        if (response.ok) {
          return caches.open(CACHE_NAME + '-fishes').then(cache => {
            return cache.put(url, response);
          });
        }
      }).catch(() => {}); // 忽略失败
    });
    
    Promise.all(cachePromises).then(() => {
      console.log(`SW: Preloaded ${fishNames.length} fish images`);
    });
  }
});