// 图片预加载器 - 减少闪烁和提升性能
class ImagePreloader {
  constructor() {
    this.cache = new Map();
    this.preloadQueue = [];
    this.isPreloading = false;
    this.maxConcurrent = 6;
    this.activeRequests = 0;
  }

  // 预加载单张图片
  async preloadImage(src) {
    if (this.cache.has(src)) {
      return this.cache.get(src);
    }

    const promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, true);
        resolve(true);
      };
      img.onerror = () => {
        this.cache.set(src, false);
        resolve(false);
      };
      img.src = src;
    });

    this.cache.set(src, promise);
    return promise;
  }

  // 批量预加载（控制并发）
  async preloadBatch(imageList) {
    const results = [];
    
    for (let i = 0; i < imageList.length; i += this.maxConcurrent) {
      const batch = imageList.slice(i, i + this.maxConcurrent);
      const batchPromises = batch.map(src => this.preloadImage(src));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 小延迟避免阻塞主线程
      if (i + this.maxConcurrent < imageList.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  // 智能预加载策略
  async smartPreload(fishData) {
    if (!fishData || fishData.length === 0) return;

    // 按优先级分组
    const activeFish = fishData.filter(f => f.active).slice(0, 10);
    const pendingFish = fishData.filter(f => f.pending && !f.active).slice(0, 8);
    const regularFish = fishData.filter(f => !f.active && !f.pending).slice(0, 12);

    // 构建预加载列表
    const priorityImages = activeFish.map(f => `./assets/icons/fishes/${f.name}.webp`);
    const secondaryImages = pendingFish.map(f => `./assets/icons/fishes/${f.name}.webp`);
    const regularImages = regularFish.map(f => `./assets/icons/fishes/${f.name}.webp`);

    // 分层预加载
    try {
      await this.preloadBatch(priorityImages);
      console.log(`预加载优先级图片: ${priorityImages.length}张`);
      
      setTimeout(() => {
        this.preloadBatch(secondaryImages).then(() => {
          console.log(`预加载次要图片: ${secondaryImages.length}张`);
        });
      }, 100);
      
      setTimeout(() => {
        this.preloadBatch(regularImages).then(() => {
          console.log(`预加载普通图片: ${regularImages.length}张`);
        });
      }, 500);
      
    } catch (error) {
      console.warn('图片预加载失败:', error);
    }
  }

  // 检查图片是否已缓存
  isImageCached(src) {
    const result = this.cache.get(src);
    return result === true;
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取缓存统计
  getCacheStats() {
    const total = this.cache.size;
    const loaded = Array.from(this.cache.values()).filter(v => v === true).length;
    const failed = Array.from(this.cache.values()).filter(v => v === false).length;
    
    return {
      total,
      loaded,
      failed,
      pending: total - loaded - failed
    };
  }
}

// 全局图片预加载器实例
window.imagePreloader = new ImagePreloader();

// 图片组件优化
class OptimizedImage {
  static create(src, alt = '', className = '') {
    const img = document.createElement('img');
    img.className = className;
    img.alt = alt;
    
    // 先设置占位
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.15s ease';
    
    // 检查是否已预加载
    if (window.imagePreloader.isImageCached(src)) {
      img.src = src;
      img.style.opacity = '1';
    } else {
      // 异步加载
      window.imagePreloader.preloadImage(src).then(() => {
        img.src = src;
        img.style.opacity = '1';
      });
    }
    
    return img;
  }
}

// 导出优化图片组件
window.OptimizedImage = OptimizedImage;
