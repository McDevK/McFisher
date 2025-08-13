// 性能优化模块
(function() {
  'use strict';

  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 图片压缩和转换
  const ImageOptimizer = {
    // 检测WebP支持
    supportsWebP: false,
    
    async checkWebPSupport() {
      return new Promise((resolve) => {
        const webP = new Image();
        webP.onload = webP.onerror = () => {
          this.supportsWebP = (webP.height === 2);
          resolve(this.supportsWebP);
        };
        webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
      });
    },

    // 创建WebP版本的图片URL（如果支持）
    getOptimizedImageSrc(originalSrc) {
      if (!this.supportsWebP || !originalSrc.endsWith('.webp')) {
        return originalSrc;
      }
      
      // 已经是WebP版本
      return originalSrc;
    },

    // 预加载图片并转换格式
    async preloadAndOptimize(src) {
      const optimizedSrc = this.getOptimizedImageSrc(src);
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(optimizedSrc);
        img.onerror = () => {
          // WebP失败，回退到原格式
          if (optimizedSrc !== src) {
            const fallbackImg = new Image();
            fallbackImg.onload = () => resolve(src);
            fallbackImg.onerror = reject;
            fallbackImg.src = src;
          } else {
            reject();
          }
        };
        img.src = optimizedSrc;
      });
    }
  };

  // 虚拟列表优化
  const VirtualList = {
    container: null,
    items: [],
    itemHeight: 80,
    visibleStart: 0,
    visibleEnd: 20,
    
    init(container, items) {
      this.container = container;
      this.items = items;
      this.setupScrollHandler();
      this.render();
    },
    
    setupScrollHandler() {
      if (!this.container) return;
      
      const scrollHandler = throttle(() => {
        this.updateVisibleRange();
        this.render();
      }, 16); // 60fps
      
      this.container.addEventListener('scroll', scrollHandler, { passive: true });
    },
    
    updateVisibleRange() {
      if (!this.container) return;
      
      const scrollTop = this.container.scrollTop;
      const containerHeight = this.container.clientHeight;
      const totalItems = this.items.length;
      
      const visibleCount = Math.ceil(containerHeight / this.itemHeight);
      const overscan = 5;
      
      this.visibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - overscan);
      this.visibleEnd = Math.min(totalItems, this.visibleStart + visibleCount + overscan * 2);
    },
    
    render() {
      // 这个方法需要由外部实现，因为渲染逻辑是应用特定的
      if (this.onRender) {
        this.onRender(this.visibleStart, this.visibleEnd);
      }
    }
  };

  // 内存管理
  const MemoryManager = {
    imageCache: new Map(),
    maxCacheSize: 100,
    
    cacheImage(src, element) {
      if (this.imageCache.size >= this.maxCacheSize) {
        // 删除最旧的缓存
        const firstKey = this.imageCache.keys().next().value;
        this.imageCache.delete(firstKey);
      }
      this.imageCache.set(src, { element, timestamp: Date.now() });
    },
    
    getCachedImage(src) {
      return this.imageCache.get(src);
    },
    
    clearOldCache() {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5分钟
      
      for (const [src, data] of this.imageCache.entries()) {
        if (now - data.timestamp > maxAge) {
          this.imageCache.delete(src);
        }
      }
    }
  };

  // 网络优化
  const NetworkOptimizer = {
    // 批量请求图片
    async batchLoadImages(sources, maxConcurrency = 6) {
      const results = [];
      
      for (let i = 0; i < sources.length; i += maxConcurrency) {
        const batch = sources.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(src => 
          ImageOptimizer.preloadAndOptimize(src).catch(() => null)
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // 小延迟避免阻塞主线程
        if (i + maxConcurrency < sources.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      return results;
    },
    
    // 智能预加载策略
    smartPreload(fishList) {
      const priorityFish = fishList.filter(f => f.active).slice(0, 10);
      const normalFish = fishList.filter(f => !f.active).slice(0, 20);
      
      // 优先加载活跃的鱼
      const prioritySources = priorityFish.map(f => `./assets/icons/fishes/${f.name}.webp`);
      const normalSources = normalFish.map(f => `./assets/icons/fishes/${f.name}.webp`);
      
      // 先加载优先级高的
      this.batchLoadImages(prioritySources, 8).then(() => {
        // 然后加载普通的
        setTimeout(() => {
          this.batchLoadImages(normalSources, 4);
        }, 500);
      });
    }
  };

  // 初始化性能优化
  async function initPerformanceOptimizations() {
    // 检测WebP支持
    await ImageOptimizer.checkWebPSupport();
    
    // 定期清理内存
    setInterval(() => {
      MemoryManager.clearOldCache();
    }, 60000); // 每分钟清理一次
    
    // 监听网络状态
    if ('connection' in navigator) {
      const connection = navigator.connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        // 慢网络下减少并发数
        NetworkOptimizer.batchLoadImages = function(sources, maxConcurrency = 2) {
          return NetworkOptimizer.batchLoadImages.call(this, sources, maxConcurrency);
        };
      }
    }
    
    console.log('Performance optimizations initialized:', {
      webpSupported: ImageOptimizer.supportsWebP,
      connection: navigator.connection?.effectiveType || 'unknown'
    });
  }

  // 导出到全局
  window.PerformanceOptimizer = {
    ImageOptimizer,
    VirtualList,
    MemoryManager,
    NetworkOptimizer,
    debounce,
    throttle,
    init: initPerformanceOptimizations
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPerformanceOptimizations);
  } else {
    initPerformanceOptimizations();
  }

})();
