// Service Worker for complete image preloading and caching
const CACHE_NAME = 'mcfisher-v1.1.0';

// 核心静态文件
const STATIC_CACHE = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './performance.js'
];

// 所有图片资源（一次性缓存）
const ALL_IMAGES = [
  // 按钮图标
  './assets/icons/button/complete.webp',
  './assets/icons/button/filter.webp',
  './assets/icons/button/setting.png',
  './assets/icons/button/settop_off.webp',
  './assets/icons/button/settop_on.webp',
  './assets/icons/button/spoil.webp',
  
  // 其他图标
  './assets/icons/others/collection.webp',
  './assets/icons/others/profile.webp',
  
  // 收藏品图标
  './assets/icons/current/大地蓝票.webp',
  './assets/icons/current/大地红票.webp',
  
  // 技能图标
  './assets/icons/skill/Precision Hookset.webp',
  './assets/icons/skill/Powerful Hookset.webp',
  
  // 杆型图标
  './assets/icons/type/heavy.webp',
  './assets/icons/type/light.webp',
  './assets/icons/type/middle.webp',
  
  // 天气图标
  './assets/icons/weather/晴朗.png',
  './assets/icons/weather/碧空.png',
  './assets/icons/weather/阴云.png',
  './assets/icons/weather/薄雾.png',
  './assets/icons/weather/小雨.png',
  './assets/icons/weather/暴雨.png',
  './assets/icons/weather/雷雨.png',
  './assets/icons/weather/打雷.png',
  './assets/icons/weather/小雪.png',
  './assets/icons/weather/暴雪.png',
  './assets/icons/weather/微风.png',
  './assets/icons/weather/强风.png',
  './assets/icons/weather/热浪.png',
  './assets/icons/weather/扬沙.png',
  './assets/icons/weather/妖雾.png',
  
  // 鱼饵图标
  './assets/icons/bait/下沉诱饵鱼.webp',
  './assets/icons/bait/乌鸦拟饵.webp',
  './assets/icons/bait/单环刺螠.webp',
  './assets/icons/bait/复合亮片.webp',
  './assets/icons/bait/小虾肉笼.webp',
  './assets/icons/bait/弓角.webp',
  './assets/icons/bait/彩虹勺形鱼饵.webp',
  './assets/icons/bait/摇蚊.webp',
  './assets/icons/bait/旋转亮片.webp',
  './assets/icons/bait/极地磷虾.webp',
  './assets/icons/bait/毛球拟饵.webp',
  './assets/icons/bait/气球虫.webp',
  './assets/icons/bait/沙壁虎.webp',
  './assets/icons/bait/沙毛虫.webp',
  './assets/icons/bait/沙蚕.webp',
  './assets/icons/bait/沙蛭.webp',
  './assets/icons/bait/沟鼠尾巴.webp',
  './assets/icons/bait/浮游虫.webp',
  './assets/icons/bait/滚石.webp',
  './assets/icons/bait/漂浮诱饵蛙.webp',
  './assets/icons/bait/漂浮诱饵鱼.webp',
  './assets/icons/bait/潮虫.webp',
  './assets/icons/bait/火萤.webp',
  './assets/icons/bait/白银勺形鱼饵.webp',
  './assets/icons/bait/石蚕.webp',
  './assets/icons/bait/磷虾肉笼.webp',
  './assets/icons/bait/秘银勺形鱼饵.webp',
  './assets/icons/bait/羽毛拟饵.webp',
  './assets/icons/bait/花蝇.webp',
  './assets/icons/bait/虾虎丸子.webp',
  './assets/icons/bait/蛀虫.webp',
  './assets/icons/bait/蛾蛹.webp',
  './assets/icons/bait/蜜虫.webp',
  './assets/icons/bait/蝲蛄丸子.webp',
  './assets/icons/bait/螃蟹丸子.webp',
  './assets/icons/bait/血蚯蚓.webp',
  './assets/icons/bait/重铁板钩.webp',
  './assets/icons/bait/铁板钩.webp',
  './assets/icons/bait/陆行鸟拟饵.webp',
  './assets/icons/bait/雉鸡拟饵.webp',
  './assets/icons/bait/鲈鱼丸子.webp',
  './assets/icons/bait/鲱鱼丸子.webp',
  './assets/icons/bait/黄油虫.webp',
  './assets/icons/bait/黄铜勺形鱼饵.webp',
  
  // 地图图标
  './assets/icons/map/不悔战泉.webp',
  './assets/icons/map/东永恒川.webp',
  './assets/icons/map/丰饶神井.webp',
  './assets/icons/map/二分石沿岸地.webp',
  './assets/icons/map/伊修加德大云海.webp',
  './assets/icons/map/低语河谷.webp',
  './assets/icons/map/兀尔德恩惠地.webp',
  './assets/icons/map/利姆萨·罗敏萨上层甲板.webp',
  './assets/icons/map/利姆萨·罗敏萨下层甲板.webp',
  './assets/icons/map/剑峰山麓.webp',
  './assets/icons/map/北鲜血滨.webp',
  './assets/icons/map/十二神大圣堂.webp',
  './assets/icons/map/南鲜血滨.webp',
  './assets/icons/map/叶脉水系.webp',
  './assets/icons/map/和风流地沿岸.webp',
  './assets/icons/map/哈希瓦河上游.webp',
  './assets/icons/map/哈希瓦河下游.webp',
  './assets/icons/map/哈希瓦河东支流.webp',
  './assets/icons/map/哈希瓦河中游.webp',
  './assets/icons/map/哥布林血流.webp',
  './assets/icons/map/嘈杂川.webp',
  './assets/icons/map/圣人旅道.webp',
  './assets/icons/map/圣人泪.webp',
  './assets/icons/map/塔赫托特尔湖.webp',
  './assets/icons/map/太阳海岸.webp',
  './assets/icons/map/奥修昂火炬.webp',
  './assets/icons/map/妖精领溪谷.webp',
  './assets/icons/map/宇格拉姆河.webp',
  './assets/icons/map/守炬埠头.webp',
  './assets/icons/map/尼姆河.webp',
  './assets/icons/map/巨龙首营地水库.webp',
  './assets/icons/map/帕拉塔安息地.webp',
  './assets/icons/map/常影区.webp',
  './assets/icons/map/幻影群岛北岸.webp',
  './assets/icons/map/幻影群岛南岸.webp',
  './assets/icons/map/库尔札斯河.webp',
  './assets/icons/map/愚者瀑布.webp',
  './assets/icons/map/执掌峡谷.webp',
  './assets/icons/map/披雪大冰壁.webp',
  './assets/icons/map/接雨草树林.webp',
  './assets/icons/map/接雨草沼泽地.webp',
  './assets/icons/map/撒沟厉沙丘.webp',
  './assets/icons/map/撒沟厉沙海.webp',
  './assets/icons/map/无赖川.webp',
  './assets/icons/map/早霜顶.webp',
  './assets/icons/map/月滴洞.webp',
  './assets/icons/map/月牙湾.webp',
  './assets/icons/map/枯骨北泉.webp',
  './assets/icons/map/枯骨南泉.webp',
  './assets/icons/map/橡树原.webp',
  './assets/icons/map/歌咏裂谷.webp',
  './assets/icons/map/歌咏裂谷北部.webp',
  './assets/icons/map/永夏岛北.webp',
  './assets/icons/map/污流上游.webp',
  './assets/icons/map/污流下游.webp',
  './assets/icons/map/涟漪小川.webp',
  './assets/icons/map/火墙.webp',
  './assets/icons/map/火蜥蜴河.webp',
  './assets/icons/map/登天路溪谷.webp',
  './assets/icons/map/白银集市.webp',
  './assets/icons/map/盛夏滩沿岸.webp',
  './assets/icons/map/盲铁坑道.webp',
  './assets/icons/map/石绿湖东北岸.webp',
  './assets/icons/map/石绿湖浅滩.webp',
  './assets/icons/map/石绿湖西北岸.webp',
  './assets/icons/map/砂盐滩.webp',
  './assets/icons/map/秋瓜湖畔.webp',
  './assets/icons/map/空心穴.webp',
  './assets/icons/map/纠缠沼泽林.webp',
  './assets/icons/map/纠缠沼泽林源流.webp',
  './assets/icons/map/红茶川水系上游.webp',
  './assets/icons/map/红茶川水系下游.webp',
  './assets/icons/map/红螳螂瀑布.webp',
  './assets/icons/map/罗塔诺海（船尾）.webp',
  './assets/icons/map/罗塔诺海（船首）.webp',
  './assets/icons/map/翡翠湖滨.webp',
  './assets/icons/map/船舶墓场.webp',
  './assets/icons/map/花蜜栈桥.webp',
  './assets/icons/map/荣耀溪.webp',
  './assets/icons/map/莫拉比湾西岸.webp',
  './assets/icons/map/莫拉比造船厂.webp',
  './assets/icons/map/萌芽池.webp',
  './assets/icons/map/萨普沙产卵地.webp',
  './assets/icons/map/落翠底.webp',
  './assets/icons/map/落魔崖.webp',
  './assets/icons/map/蓝雾涌泉.webp',
  './assets/icons/map/蔓根沼.webp',
  './assets/icons/map/西永恒川.webp',
  './assets/icons/map/西风岬.webp',
  './assets/icons/map/调查队冰洞.webp',
  './assets/icons/map/足迹谷.webp',
  './assets/icons/map/轻声谷.webp',
  './assets/icons/map/遗孀泪.webp',
  './assets/icons/map/遗忘绿洲.webp',
  './assets/icons/map/邪嗣.webp',
  './assets/icons/map/酿酒师灯塔.webp',
  './assets/icons/map/银泪湖北岸.webp',
  './assets/icons/map/镜池.webp',
  './assets/icons/map/隐秘港.webp',
  './assets/icons/map/隐秘瀑布.webp',
  './assets/icons/map/雨燕塔殖民地.webp',
  './assets/icons/map/雪松原沿岸地.webp',
  './assets/icons/map/青磷泉.webp',
  './assets/icons/map/静语庄园.webp',
  './assets/icons/map/骷髅谷沿岸地.webp',
  './assets/icons/map/黄昏湾.webp',
  
  // 鱼类图标（前100个最常见的）
  './assets/icons/fishes/豹鱼.webp',
  './assets/icons/fishes/金鱼.webp',
  './assets/icons/fishes/金鳍蝶.webp',
  './assets/icons/fishes/钓鮟鱇.webp',
  './assets/icons/fishes/钢盔鲎.webp',
  './assets/icons/fishes/铜镜.webp',
  './assets/icons/fishes/铜鱼.webp',
  './assets/icons/fishes/铠甲琵琶鱼.webp',
  './assets/icons/fishes/银鱼.webp',
  './assets/icons/fishes/银鲨.webp',
  './assets/icons/fishes/锤头鲨.webp',
  './assets/icons/fishes/锯鲛.webp',
  './assets/icons/fishes/长吻鳄鳝.webp',
  './assets/icons/fishes/阿巴拉提亚公鱼.webp',
  './assets/icons/fishes/隆头鱼.webp',
  './assets/icons/fishes/雀鳝.webp',
  './assets/icons/fishes/雷神鱼.webp',
  './assets/icons/fishes/雷纹鱼.webp',
  './assets/icons/fishes/震雷鱼.webp',
  './assets/icons/fishes/飞沙鱼.webp',
  './assets/icons/fishes/飞蝠鲼.webp',
  './assets/icons/fishes/马兹拉雅枪鱼.webp',
  './assets/icons/fishes/骨舌鱼.webp',
  './assets/icons/fishes/骨蝲蛄.webp',
  './assets/icons/fishes/魔梭鱼.webp',
  './assets/icons/fishes/鲢鱼.webp',
  './assets/icons/fishes/鹦鹉螺.webp',
  './assets/icons/fishes/麻希鲯鳅.webp',
  './assets/icons/fishes/黄金鳅.webp',
  './assets/icons/fishes/黄铜泥鳅.webp',
  './assets/icons/fishes/黑蝶贝.webp',
  './assets/icons/fishes/黑鬼鱼.webp',
  './assets/icons/fishes/黑鲶鱼.webp',
  './assets/icons/fishes/黑鳎.webp',
  './assets/icons/fishes/黑鳗.webp',
  './assets/icons/fishes/龙门鱼.webp'
];

// 安装事件 - 预缓存所有图片
self.addEventListener('install', event => {
  console.log('SW: Installing with complete image preloading');
  
  event.waitUntil(
    Promise.all([
      // 缓存静态文件
      caches.open(CACHE_NAME + '-static').then(cache => {
        console.log('SW: Caching static files');
        return cache.addAll(STATIC_CACHE);
      }),
      
      // 分批缓存所有图片（避免一次性请求过多）
      cacheBatchImages()
    ]).then(() => {
      console.log('SW: All resources cached successfully');
    }).catch(error => {
      console.error('SW: Install failed', error);
    })
  );
  
  // 立即激活
  self.skipWaiting();
});

// 分批缓存图片函数
async function cacheBatchImages() {
  const batchSize = 20; // 每批20张图片
  const imageCache = await caches.open(CACHE_NAME + '-images');
  
  for (let i = 0; i < ALL_IMAGES.length; i += batchSize) {
    const batch = ALL_IMAGES.slice(i, i + batchSize);
    
    try {
      await imageCache.addAll(batch);
      console.log(`SW: Cached batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ALL_IMAGES.length/batchSize)}`);
      
      // 短暂延迟，避免阻塞主线程
      if (i + batchSize < ALL_IMAGES.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn(`SW: Failed to cache batch starting at ${i}:`, error);
      
      // 单个缓存失败的图片
      for (const img of batch) {
        try {
          await imageCache.add(img);
        } catch (e) {
          console.warn(`SW: Failed to cache image: ${img}`);
        }
      }
    }
  }
}

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheName.startsWith('mcfisher-v1.1.0')) {
            console.log('SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activated and ready');
      return self.clients.claim();
    })
  );
});

// Fetch 事件 - 缓存优先策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // JSON数据：网络优先，快速超时
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      Promise.race([
        fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME + '-data').then(cache => {
              cache.put(request, response.clone());
            });
          }
          return response;
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // 所有其他资源：缓存优先（图片已预缓存，立即返回）
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 缓存未命中，从网络获取
      return fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          const cacheKey = url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') ?
            CACHE_NAME + '-static' : CACHE_NAME + '-images';
          
          caches.open(cacheKey).then(cache => {
            cache.put(request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // 网络失败时返回占位图
        if (url.pathname.includes('/assets/icons/')) {
          return new Response(
            '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#ddd"/><text x="20" y="25" text-anchor="middle" font-size="12" fill="#999">?</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('Network Error', { status: 503 });
      });
    })
  );
});

// 监听页面消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});