// McFisher 移动端脚本 - 基于桌面端优化
// 复用桌面端的核心逻辑，但针对移动端进行UI优化

(function() {
  'use strict';

  // 时间系统（复用桌面端）
  const MS_PER_EORZEA_MINUTE = 70000 / 60;
  const MS_PER_EORZEA_HOUR = MS_PER_EORZEA_MINUTE * 60;
  const MS_PER_EORZEA_DAY = MS_PER_EORZEA_HOUR * 24;

  // 状态管理
  const state = {
    fish: [],
    spots: [],
    filtered: [],
    selectedFishId: null,
    searchText: '',
    filters: {
      version: new Set(),
      rarity: new Set(),
      condition: new Set(),
      status: new Set(),
      collect: new Set()
    },
    completed: new Set(),
    pinned: new Set(),
    loot: [] // 移动端14个槽位
  };

  // DOM元素缓存
  const el = {};

  // 工具函数
  const fmt2 = n => String(n).padStart(2, '0');
  const fmtTime = (bell, minute) => `${fmt2(bell)}:${fmt2(minute)}`;
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  function getEorzeaNow() {
    const localNow = Date.now();
    const eorzeaMs = localNow * 20.571428571428573;
    const eorzeaDays = Math.floor(eorzeaMs / MS_PER_EORZEA_DAY);
    const msInDay = eorzeaMs % MS_PER_EORZEA_DAY;
    const bell = Math.floor(msInDay / MS_PER_EORZEA_HOUR);
    const minute = Math.floor((msInDay % MS_PER_EORZEA_HOUR) / MS_PER_EORZEA_MINUTE);
    return { bell, minute, msInDay, eorzeaMs };
  }

  function msToEtTimePrecise(ms) {
    if (ms <= 0) return '';
    const eorzeaMs = ms * 20.571428571428573;
    const totalMinutes = Math.floor(eorzeaMs / MS_PER_EORZEA_MINUTE);
    const bell = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${bell}:${fmt2(minute)}`;
  }

  // 天气系统数据（复用桌面端）
  const WEATHER_DATA = {
    'Limsa Lominsa Lower Decks': [30, 10, 10, 20, 15, 4, 0, 1, 0, 0, 0, 10],
    'Limsa Lominsa Upper Decks': [30, 10, 10, 20, 15, 4, 0, 1, 0, 0, 0, 10],
    'Middle La Noscea': [23, 5, 12, 12, 26, 12, 0, 10, 0, 0, 0, 0],
    'Lower La Noscea': [20, 5, 10, 10, 20, 15, 0, 15, 0, 0, 0, 5],
    'Eastern La Noscea': [5, 5, 25, 30, 15, 10, 0, 10, 0, 0, 0, 0],
    'Western La Noscea': [10, 5, 10, 15, 30, 15, 0, 10, 0, 0, 0, 5],
    'Upper La Noscea': [30, 15, 10, 15, 15, 15, 0, 0, 0, 0, 0, 0],
    'Outer La Noscea': [30, 5, 5, 10, 25, 10, 0, 15, 0, 0, 0, 0],
    'Mist': [20, 10, 10, 20, 20, 10, 0, 10, 0, 0, 0, 0],
    'New Gridania': [5, 5, 10, 10, 20, 20, 10, 10, 5, 5, 0, 0],
    'Old Gridania': [5, 5, 10, 10, 20, 20, 10, 10, 5, 5, 0, 0],
    'Central Shroud': [5, 5, 10, 10, 20, 20, 10, 10, 5, 5, 0, 0],
    'East Shroud': [5, 5, 10, 10, 25, 15, 10, 10, 5, 5, 0, 0],
    'South Shroud': [5, 10, 10, 15, 20, 15, 10, 10, 0, 5, 0, 0],
    'North Shroud': [5, 5, 10, 10, 20, 20, 10, 15, 0, 5, 0, 0],
    'The Lavender Beds': [5, 5, 10, 10, 20, 20, 10, 15, 0, 5, 0, 0],
    'Ul\'dah - Steps of Nald': [40, 0, 0, 0, 0, 0, 8, 0, 0, 15, 25, 12],
    'Ul\'dah - Steps of Thal': [40, 0, 0, 0, 0, 0, 8, 0, 0, 15, 25, 12],
    'Western Thanalan': [40, 0, 0, 0, 0, 0, 8, 0, 0, 15, 25, 12],
    'Central Thanalan': [15, 0, 0, 0, 0, 0, 5, 0, 0, 20, 30, 30],
    'Eastern Thanalan': [40, 0, 0, 0, 0, 0, 5, 0, 0, 5, 40, 10],
    'Southern Thanalan': [20, 0, 0, 0, 0, 0, 10, 0, 0, 20, 30, 20],
    'Northern Thanalan': [5, 0, 0, 0, 0, 0, 5, 0, 0, 10, 75, 5],
    'The Goblet': [40, 0, 0, 0, 0, 0, 10, 0, 0, 10, 25, 15],
    'Ishgard': [20, 0, 0, 0, 0, 0, 0, 0, 20, 30, 0, 30],
    'Coerthas Central Highlands': [20, 0, 0, 0, 0, 0, 0, 0, 20, 30, 0, 30],
    'Coerthas Western Highlands': [20, 0, 0, 0, 0, 0, 0, 0, 20, 30, 0, 30],
    'The Sea of Clouds': [30, 10, 10, 20, 10, 10, 0, 10, 0, 0, 0, 0],
    'Azys Lla': [35, 0, 0, 0, 0, 0, 0, 0, 35, 30, 0, 0],
    'The Dravanian Forelands': [10, 10, 15, 20, 20, 10, 0, 15, 0, 0, 0, 0],
    'The Dravanian Hinterlands': [10, 10, 15, 20, 15, 15, 0, 15, 0, 0, 0, 0],
    'The Churning Mists': [10, 10, 15, 20, 15, 15, 0, 10, 0, 0, 0, 5],
    'Idyllshire': [10, 10, 15, 20, 15, 15, 0, 10, 0, 0, 0, 5]
  };

  const WEATHER_NAMES_CN = ['晴朗', '碧空', '阴云', '薄雾', '小雨', '暴雨', '雷雨', '打雷', '小雪', '暴雪', '微风', '强风', '热浪', '扬沙', '妖雾'];
  const WEATHER_NAMES_EN = ['Clear Skies', 'Fair Skies', 'Clouds', 'Fog', 'Rain', 'Showers', 'Thunder', 'Thunderstorms', 'Snow', 'Blizzards', 'Wind', 'Gales', 'Heat Waves', 'Dust Storms', 'Gloom'];

  // 地图名称映射
  const MAP_NAMES = {
    '利姆萨·罗敏萨下层甲板': 'Limsa Lominsa Lower Decks',
    '利姆萨·罗敏萨上层甲板': 'Limsa Lominsa Upper Decks',
    '中拉诺西亚': 'Middle La Noscea',
    '拉诺西亚低地': 'Lower La Noscea',
    '东拉诺西亚': 'Eastern La Noscea',
    '西拉诺西亚': 'Western La Noscea',
    '拉诺西亚高地': 'Upper La Noscea',
    '拉诺西亚外地': 'Outer La Noscea',
    '薄雾村': 'Mist',
    '格里达尼亚新街': 'New Gridania',
    '格里达尼亚旧街': 'Old Gridania',
    '黑衣森林中央林区': 'Central Shroud',
    '黑衣森林东部林区': 'East Shroud',
    '黑衣森林南部林区': 'South Shroud',
    '黑衣森林北部林区': 'North Shroud',
    '薰衣草苗圃': 'The Lavender Beds',
    '乌尔达哈现世回廊': 'Ul\'dah - Steps of Nald',
    '乌尔达哈来生回廊': 'Ul\'dah - Steps of Thal',
    '西萨纳兰': 'Western Thanalan',
    '中萨纳兰': 'Central Thanalan',
    '东萨纳兰': 'Eastern Thanalan',
    '南萨纳兰': 'Southern Thanalan',
    '北萨纳兰': 'Northern Thanalan',
    '高脚孤丘': 'The Goblet',
    '伊修加德': 'Ishgard',
    '库尔札斯中央高地': 'Coerthas Central Highlands',
    '库尔札斯西部高地': 'Coerthas Western Highlands',
    '翻云雾海': 'The Sea of Clouds',
    '龙堡参天高地': 'The Dravanian Forelands',
    '龙堡内陆低地': 'The Dravanian Hinterlands',
    '翻云雾海': 'The Churning Mists',
    '田园郡': 'Idyllshire'
  };

  // 鱼类特殊区域覆盖
  const FISH_ZONE_OVERRIDES = {
    '求雨鱼': 'Lower La Noscea'
  };

  // 计算天气值
  function calculateWeatherValue(ms) {
    const unixMs = Math.floor(ms / 1000) * 1000;
    const bell = Math.floor(unixMs / MS_PER_EORZEA_HOUR);
    const increment = (bell + 8 - (bell % 8)) % 24;
    let totalDays = Math.floor(unixMs / MS_PER_EORZEA_DAY);
    const calcBase = totalDays * 100 + increment;
    const step1 = ((calcBase << 11) ^ calcBase) >>> 0;
    const step2 = ((step1 >>> 8) ^ step1) >>> 0;
    return step2 % 100;
  }

  function nearestIntervalStart(ms) {
    const unixMs = Math.floor(ms / 1000) * 1000;
    const bell = Math.floor(unixMs / MS_PER_EORZEA_HOUR);
    const increment = (bell + 8 - (bell % 8)) % 24;
    let totalDays = Math.floor(unixMs / MS_PER_EORZEA_DAY);
    return totalDays * MS_PER_EORZEA_DAY + increment * MS_PER_EORZEA_HOUR;
  }

  function pickWeatherByValue(zone, value) {
    const rates = WEATHER_DATA[zone];
    if (!rates) return null;
    let sum = 0;
    for (let i = 0; i < rates.length; i++) {
      sum += rates[i];
      if (value < sum) {
        return { index: i, name: WEATHER_NAMES_CN[i] };
      }
    }
    return { index: rates.length - 1, name: WEATHER_NAMES_CN[rates.length - 1] };
  }

  // 天气预测
  function getWeatherForTime(zone, ms) {
    const value = calculateWeatherValue(ms);
    return pickWeatherByValue(zone, value);
  }

  // 解析鱼类对应的天气区域
  function resolveZoneKeyForFish(fishName) {
    if (FISH_ZONE_OVERRIDES[fishName]) {
      return FISH_ZONE_OVERRIDES[fishName];
    }
    
    if (!state.spots || state.spots.length === 0) return null;
    
    const fishSpots = state.spots.filter(spot => 
      spot.fish && spot.fish.includes && spot.fish.includes(fishName)
    );
    
    if (fishSpots.length === 0) return null;
    
    for (const spot of fishSpots) {
      const map = spot.level2;
      const zoneKey = MAP_NAMES[map];
      if (zoneKey && WEATHER_DATA[zoneKey]) {
        return zoneKey;
      }
    }
    
    // 模糊匹配
    for (const spot of fishSpots) {
      const map = spot.level2;
      for (const [cnName, enName] of Object.entries(MAP_NAMES)) {
        if (map && map.includes(cnName.substring(0, 3)) && WEATHER_DATA[enName]) {
          return enName;
        }
      }
    }
    
    return null;
  }

  // 时间窗口计算
  function getAppearanceWindowCountdown(timeLabel, now) {
    const { msInDay } = now;
    
    if (!timeLabel || timeLabel === '全天可钓') {
      return { 
        klass: 'all-day', 
        text: '全天可钓', 
        msLeft: Number.POSITIVE_INFINITY,
        progress: 0
      };
    }
    
    const timeMatch = timeLabel.match(/ET\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) {
      return { 
        klass: 'unknown', 
        text: '时间解析错误', 
        msLeft: Number.POSITIVE_INFINITY,
        progress: 0
      };
    }
    
    const [, startH, startM, endH, endM] = timeMatch.map(Number);
    const startMs = startH * MS_PER_EORZEA_HOUR + startM * MS_PER_EORZEA_MINUTE;
    const endMs = endH * MS_PER_EORZEA_HOUR + endM * MS_PER_EORZEA_MINUTE;
    
    let nextStart, nextEnd;
    if (startMs <= endMs) {
      // 同一天内
      if (msInDay >= startMs && msInDay < endMs) {
        // 当前正在窗口期
        const remaining = endMs - msInDay;
        const total = endMs - startMs;
        const progress = ((msInDay - startMs) / total) * 100;
        return {
          klass: 'active',
          text: `剩余 ${msToEtTimePrecise(remaining)}`,
          msLeft: remaining,
          progress: Math.max(0, Math.min(100, progress))
        };
      } else if (msInDay < startMs) {
        // 今天还未开始
        const timeToStart = startMs - msInDay;
        return {
          klass: 'pending',
          text: `${msToEtTimePrecise(timeToStart)} 后开始`,
          msLeft: timeToStart,
          progress: 0
        };
      } else {
        // 今天已结束，明天开始
        const timeToStart = MS_PER_EORZEA_DAY - msInDay + startMs;
        return {
          klass: 'pending',
          text: `${msToEtTimePrecise(timeToStart)} 后开始`,
          msLeft: timeToStart,
          progress: 0
        };
      }
    } else {
      // 跨天
      if (msInDay >= startMs || msInDay < endMs) {
        // 当前正在窗口期
        const remaining = msInDay >= startMs ? 
          (MS_PER_EORZEA_DAY - msInDay + endMs) : 
          (endMs - msInDay);
        const total = MS_PER_EORZEA_DAY - startMs + endMs;
        const elapsed = msInDay >= startMs ? 
          (msInDay - startMs) : 
          (MS_PER_EORZEA_DAY - startMs + msInDay);
        const progress = (elapsed / total) * 100;
        return {
          klass: 'active',
          text: `剩余 ${msToEtTimePrecise(remaining)}`,
          msLeft: remaining,
          progress: Math.max(0, Math.min(100, progress))
        };
      } else {
        // 等待开始
        const timeToStart = startMs - msInDay;
        return {
          klass: 'pending',
          text: `${msToEtTimePrecise(timeToStart)} 后开始`,
          msLeft: timeToStart,
          progress: 0
        };
      }
    }
  }

  // 天气倒计时
  function getWeatherRequirementCountdown(zoneKey, weatherNames, now) {
    if (!weatherNames || weatherNames.length === 0) {
      return {
        klass: 'no-weather',
        text: '无天气要求',
        msLeft: Number.POSITIVE_INFINITY,
        progress: 0
      };
    }

    const weatherSet = new Set(weatherNames);
    const currentMs = now.eorzeaMs;
    const currentWeather = getWeatherForTime(zoneKey, currentMs);
    
    if (currentWeather && weatherSet.has(currentWeather.name)) {
      // 当前天气符合，计算剩余时间
      const currentIntervalStart = nearestIntervalStart(currentMs);
      const nextIntervalStart = currentIntervalStart + 8 * MS_PER_EORZEA_HOUR;
      const remaining = nextIntervalStart - currentMs;
      
      // 检查后续窗口期，计算累积时间
      let totalRemaining = remaining;
      let checkMs = nextIntervalStart;
      const maxCheck = 10; // 最多检查10个窗口
      
      for (let i = 0; i < maxCheck; i++) {
        const nextWeather = getWeatherForTime(zoneKey, checkMs);
        if (nextWeather && weatherSet.has(nextWeather.name)) {
          totalRemaining += 8 * MS_PER_EORZEA_HOUR;
          checkMs += 8 * MS_PER_EORZEA_HOUR;
        } else {
          break;
        }
      }
      
      const progress = ((8 * MS_PER_EORZEA_HOUR - remaining) / (8 * MS_PER_EORZEA_HOUR)) * 100;
      return {
        klass: 'active',
        text: `剩余 ${msToEtTimePrecise(totalRemaining)}`,
        msLeft: totalRemaining,
        progress: Math.max(0, Math.min(100, progress))
      };
    }
    
    // 查找下一个匹配的天气窗口
    let checkMs = currentMs;
    const maxSearchHours = 24 * 7; // 最多搜索7天
    
    for (let hours = 0; hours < maxSearchHours; hours += 8) {
      checkMs = nearestIntervalStart(currentMs) + hours * MS_PER_EORZEA_HOUR;
      const weather = getWeatherForTime(zoneKey, checkMs);
      
      if (weather && weatherSet.has(weather.name)) {
        const timeToStart = checkMs - currentMs;
        return {
          klass: 'pending',
          text: `${msToEtTimePrecise(timeToStart)} 后开始`,
          msLeft: timeToStart,
          progress: 0
        };
      }
    }
    
    return {
      klass: 'no-upcoming',
      text: '一周内无合适天气',
      msLeft: Number.POSITIVE_INFINITY,
      progress: 0
    };
  }

  // 综合天气和时间倒计时
  function getWeatherAndTimeCountdown(zoneKey, weatherLabel, timeLabel, now) {
    const weatherNames = weatherLabel ? 
      weatherLabel.split(/[;|]/).map(w => w.trim()).filter(w => w && w !== '无') : 
      [];
    
    if (weatherNames.length === 0) {
      return getAppearanceWindowCountdown(timeLabel, now);
    }
    
    if (!timeLabel || timeLabel === '全天可钓') {
      return getWeatherRequirementCountdown(zoneKey, weatherNames, now);
    }
    
    // 需要同时满足时间和天气条件
    const timeMatch = timeLabel.match(/ET\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) {
      return getWeatherRequirementCountdown(zoneKey, weatherNames, now);
    }
    
    const [, startH, startM, endH, endM] = timeMatch.map(Number);
    const startMs = startH * MS_PER_EORZEA_HOUR + startM * MS_PER_EORZEA_MINUTE;
    const endMs = endH * MS_PER_EORZEA_HOUR + endM * MS_PER_EORZEA_MINUTE;
    const weatherSet = new Set(weatherNames);
    
    const currentMs = now.eorzeaMs;
    const { msInDay } = now;
    const currentWeather = getWeatherForTime(zoneKey, currentMs);
    
    // 检查当前是否满足条件
    const isTimeValid = (startMs <= endMs) ? 
      (msInDay >= startMs && msInDay < endMs) :
      (msInDay >= startMs || msInDay < endMs);
    const isWeatherValid = currentWeather && weatherSet.has(currentWeather.name);
    
    if (isTimeValid && isWeatherValid) {
      // 计算当前窗口剩余时间
      const currentIntervalStart = nearestIntervalStart(currentMs);
      const nextIntervalStart = currentIntervalStart + 8 * MS_PER_EORZEA_HOUR;
      const weatherRemaining = nextIntervalStart - currentMs;
      
      let timeRemaining;
      if (startMs <= endMs) {
        timeRemaining = endMs - msInDay;
      } else {
        timeRemaining = msInDay >= startMs ? 
          (MS_PER_EORZEA_DAY - msInDay + endMs) : 
          (endMs - msInDay);
      }
      
      const actualRemaining = Math.min(weatherRemaining, timeRemaining);
      const total = Math.min(8 * MS_PER_EORZEA_HOUR, 
        startMs <= endMs ? (endMs - startMs) : (MS_PER_EORZEA_DAY - startMs + endMs));
      const elapsed = Math.min(8 * MS_PER_EORZEA_HOUR, total) - actualRemaining;
      const progress = (elapsed / Math.min(8 * MS_PER_EORZEA_HOUR, total)) * 100;
      
      return {
        klass: 'active',
        text: `剩余 ${msToEtTimePrecise(actualRemaining)}`,
        msLeft: actualRemaining,
        progress: Math.max(0, Math.min(100, progress))
      };
    }
    
    // 查找下一个同时满足时间和天气的窗口
    let searchMs = currentMs;
    const maxSearchDays = 7;
    
    for (let day = 0; day < maxSearchDays; day++) {
      const dayStart = Math.floor(searchMs / MS_PER_EORZEA_DAY) * MS_PER_EORZEA_DAY + day * MS_PER_EORZEA_DAY;
      
      // 检查这一天的所有8小时天气窗口
      for (let hour = 0; hour < 24; hour += 8) {
        const weatherWindowStart = dayStart + hour * MS_PER_EORZEA_HOUR;
        const weather = getWeatherForTime(zoneKey, weatherWindowStart);
        
        if (weather && weatherSet.has(weather.name)) {
          // 天气符合，检查时间窗口
          const dayMs = (weatherWindowStart % MS_PER_EORZEA_DAY);
          let timeWindowStart;
          
          if (startMs <= endMs) {
            // 时间窗口在同一天
            if (dayMs <= startMs) {
              timeWindowStart = dayStart + startMs;
            } else if (dayMs < endMs) {
              timeWindowStart = weatherWindowStart;
            } else {
              continue; // 这个天气窗口不在时间范围内
            }
          } else {
            // 时间窗口跨天
            if (dayMs >= startMs || dayMs < endMs) {
              timeWindowStart = weatherWindowStart;
            } else if (dayMs < startMs) {
              timeWindowStart = dayStart + startMs;
            } else {
              continue;
            }
          }
          
          if (timeWindowStart >= searchMs) {
            const timeToStart = timeWindowStart - searchMs;
            return {
              klass: 'pending',
              text: `${msToEtTimePrecise(timeToStart)} 后开始`,
              msLeft: timeToStart,
              progress: 0
            };
          }
        }
      }
    }
    
    return {
      klass: 'no-upcoming',
      text: '一周内无合适窗口',
      msLeft: Number.POSITIVE_INFINITY,
      progress: 0
    };
  }

  // 获取鱼类倒计时
  function getFishCountdown(fish, now) {
    const timeLabel = fish.time;
    const weatherLabel = fish.weather;
    
    const zoneKey = resolveZoneKeyForFish(fish.name);
    if (!zoneKey) return getAppearanceWindowCountdown(timeLabel || '全天可钓', now);
    return getWeatherAndTimeCountdown(zoneKey, weatherLabel, timeLabel, now);
  }

  // 图片预加载（移动端无需预加载，Service Worker已缓存）
  function preloadCriticalImages() {
    console.log('移动端：图片已通过Service Worker预缓存');
    return Promise.resolve();
  }

  // 数据加载
  async function loadFishData() {
    const t = Date.now();
    const res = await fetch(`./assets/fishbook/fish.json`, { cache: 'default' });
    if (!res.ok) throw new Error('Failed to load fish.json');
    state.fish = await res.json();

    // 初始化筛选选项
    const allVersions = [...new Set(state.fish.map(f => f.version).filter(Boolean))].sort((a, b) => parseFloat(b) - parseFloat(a));
    const allRarities = [...new Set(state.fish.map(f => f.rarity).filter(Boolean))];
    const presentRarity = new Set(allRarities);
    
    if (el.filterVersion) {
      el.filterVersion.innerHTML = allVersions.map(v => `<button class="chip active" data-key="version" data-value="${v}">${v}</button>`).join('');
      state.filters.version = new Set(allVersions);
    }
    
    if (el.filterRarity) {
      const all = ['鱼皇', '鱼王', '普通鱼'];
      el.filterRarity.innerHTML = all.map(r => `<button class="chip ${presentRarity.has(r) ? 'active' : ''}" data-key="rarity" data-value="${r}">${r}</button>`).join('');
      state.filters.rarity = new Set(all.filter(r => presentRarity.has(r)));
    }
    
    if (el.filterCondition) {
      el.filterCondition.innerHTML = `<button class="chip active" data-key="condition" data-value="限时">限时</button><button class="chip active" data-key="condition" data-value="常驻">常驻</button>`;
      state.filters.condition = new Set(['限时', '常驻']);
    }
    
    if (el.filterStatus) {
      el.filterStatus.innerHTML = `<button class="chip active" data-key="status" data-value="已完成">已完成</button><button class="chip active" data-key="status" data-value="未完成">未完成</button>`;
      state.filters.status = new Set(['已完成', '未完成']);
    }
    
    if (el.filterCollect) {
      const all = ['收藏品', '普通鱼'];
      const presentCollect = new Set();
      state.fish.forEach(f => {
        const c = String(f.collectable || '无').trim();
        if (c !== '无') presentCollect.add('收藏品');
        else presentCollect.add('普通鱼');
      });
      el.filterCollect.innerHTML = all.map(c => `<button class="chip ${presentCollect.has(c) ? 'active' : ''}" data-key="collect" data-value="${c}">${c}</button>`).join('');
      state.filters.collect = new Set(all.filter(c => presentCollect.has(c)));
    }

    // 加载钓场数据
    try {
      const rs = await fetch(`./assets/fishbook/spots.json`, { cache: 'default' });
      if (rs.ok) state.spots = await rs.json();
    } catch (e) { state.spots = []; }
    
    applyFilter();
    renderFishList();
    updateFishingProgress();
  }

  // 筛选逻辑
  function applyFilter() {
    const q = state.searchText.trim();
    state.filtered = state.fish.filter(fish => {
      // 搜索文本
      if (q && !fish.name.includes(q)) return false;
      
      // 版本筛选
      if (!state.filters.version.has(fish.version)) return false;
      
      // 种类筛选
      if (!state.filters.rarity.has(fish.rarity)) return false;
      
      // 条件筛选
      const isLimited = fish.time && fish.time !== '全天可钓';
      const condition = isLimited ? '限时' : '常驻';
      if (!state.filters.condition.has(condition)) return false;
      
      // 完成状态筛选
      const isCompleted = state.completed.has(fish.name);
      const status = isCompleted ? '已完成' : '未完成';
      if (!state.filters.status.has(status)) return false;
      
      // 收藏品筛选
      const isCollectable = String(fish.collectable || '无').trim() !== '无';
      const collectType = isCollectable ? '收藏品' : '普通鱼';
      if (!state.filters.collect.has(collectType)) return false;
      
      return true;
    });
  }

  // 渲染天气标签（移动端用图标）
  function renderWeatherTags(cnList) {
    const s = String(cnList || '').trim();
    if (!s || s === '无') return '';
    const parts = s.split(/[;|]/).map(t => t.trim()).filter(t => t && t !== '无');
    if (parts.length === 0) return '';
    return parts.map(p => `<img class="weather-icon" src="./assets/icons/weather/${p}.png" alt="${p}" title="${p}" data-tip="${p}" onerror="this.style.display='none'"/>`).join('');
  }

  // 渲染鱼类列表（移动端优化）
  function renderFishList() {
    if (!state.filtered.length) {
      el.fishList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>没有找到符合条件的鱼类</p>
        </div>
      `;
      return;
    }

    const now = getEorzeaNow();
    const fishWithCountdown = state.filtered.map(fish => {
      const cd = getFishCountdown(fish, now);
      return { ...fish, ...cd };
    });

    // 移动端排序：置顶 > 活跃 > 待定 > 已完成，然后按时间排序
    fishWithCountdown.sort((a, b) => {
      const aId = a.name, bId = b.name;
      const aPinned = state.pinned.has(aId), bPinned = state.pinned.has(bId);
      const aCompleted = state.completed.has(aId), bCompleted = state.completed.has(bId);
      const aActive = a.klass === 'active', bActive = b.klass === 'active';

      if (aPinned !== bPinned) return bPinned - aPinned;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;
      if (aActive !== bActive) return bActive - aActive;
      
      const timeBucketA = Number.isFinite(a.msLeft) ? Math.floor(a.msLeft / 1000) : Number.POSITIVE_INFINITY;
      const timeBucketB = Number.isFinite(b.msLeft) ? Math.floor(b.msLeft / 1000) : Number.POSITIVE_INFINITY;
      if (timeBucketA !== timeBucketB) return timeBucketA - timeBucketB;
      
      return a.name.localeCompare(b.name);
    });

    const pinnedIds = Array.from(state.pinned);
    const hasPinned = pinnedIds.length > 0;
    let pinnedCount = 0;

    const html = fishWithCountdown.map((fish, index) => {
      const id = fish.name;
      const iconUrl = `./assets/icons/fishes/${fish.name}.webp`;
      const activeClass = fish.klass === 'active' ? 'active' : fish.klass === 'pending' ? 'pending' : '';
      const isCompleted = state.completed.has(id);
      const isPinned = state.pinned.has(id);
      const isCollectable = String(fish.collectable || '无').trim() !== '无';
      
      if (isPinned && !isCompleted) pinnedCount++;
      
      const progress = Number.isFinite(fish.progress) ? fish.progress : 0;
      const collectIcon = isCollectable ? `<img class="collect-badge" src="./assets/icons/others/collection.webp" alt="收藏品" title="收藏品" onerror="this.style.display='none'"/>` : '';
      const weatherTag = renderWeatherTags(fish.weather);
      
      // 移动端简化显示：只显示图标、名称、收藏品标记、倒计时
      const needSeparator = hasPinned && pinnedCount === index && !isPinned;
      const separator = needSeparator ? '<div class="pin-separator"></div>' : '';
      
      return `
        ${separator}
        <div class="fish-item ${activeClass}" data-id="${id}">
          <div class="fish-info">
            <img class="fish-icon" src="${iconUrl}" alt="${fish.name}" onerror="this.style.display='none'" />
            <div class="fish-name">
              <span class="fish-name-text">${fish.name}</span>
              ${collectIcon}
            </div>
            ${weatherTag}
          </div>
          <div class="countdown ${fish.klass}">
            <div class="progress" style="--progress:${progress}%"></div>
            <div class="countdown-text">${fish.text}</div>
          </div>
        </div>
      `;
    }).join('');

    el.fishList.innerHTML = html;

    // 绑定点击事件：显示详情浮窗
    el.fishList.querySelectorAll('.fish-item').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedFishId = item.getAttribute('data-id');
        openDetailModal();
      });
    });
  }

  // 打开详情浮窗
  function openDetailModal() {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (modal && body) {
      modal.classList.remove('hidden');
      modal.classList.add('show');
      renderFishDetailInModal(body);
    }
  }

  // 在浮窗中渲染鱼类详情
  function renderFishDetailInModal(container) {
    if (!state.selectedFishId) {
      container.innerHTML = '<p>请选择一条鱼类查看详情</p>';
      return;
    }
    
    const fish = state.fish.find(f => f.name === state.selectedFishId);
    if (!fish) {
      container.innerHTML = '<p>未找到该鱼类信息</p>';
      return;
    }

    // 复用桌面端的详情渲染逻辑，但适配移动端
    const iconUrl = `./assets/icons/fishes/${fish.name}.webp`;
    const id = fish.name;
    const isCompleted = state.completed.has(id);
    const isPinned = state.pinned.has(id);
    const isCollectable = String(fish.collectable || '无').trim() !== '无';
    
    const collectBadge = isCollectable ? `<img class="collect-badge" src="./assets/icons/others/collection.webp" alt="收藏品" title="收藏品：${fish.collectable}" onerror="this.style.display='none'"/>` : '';
    const completeIconUrl = './assets/icons/button/complete.webp';
    const pinIconUrl = isPinned ? './assets/icons/button/settop_on.webp' : './assets/icons/button/settop_off.webp';

    const timeText = fish.time && /全天可钓/.test(fish.time) ? '全天可钓' : (fish.time || '—');
    const weatherText = fish.weather && fish.weather !== '无' ? fish.weather.split(/[;|]/).map(w => w.trim()).filter(w => w && w !== '无').map(w => `<span class="tag tag-weather">${w}</span>`).join('') : '无';

    container.innerHTML = `
      <div class="detail-container">
        <div class="detail-card detail-header">
          <img class="fish-icon" src="${iconUrl}" alt="${fish.name}" style="width: 48px; height: 48px;" onerror="this.style.display='none'" />
          <div class="detail-title">${fish.name}${collectBadge}</div>
          <div class="detail-actions">
            <button class="spoil-btn ${(state.loot || []).includes(fish.name) ? 'on' : ''}" title="战利品">
              <img src="./assets/icons/button/spoil.webp" alt="战利品" onerror="this.style.display='none'" />
            </button>
            <button class="complete-btn ${isCompleted ? 'done' : ''}" data-id="${id}" title="标记完成">
              <img src="${completeIconUrl}" alt="完成" onerror="this.style.display='none'" />
            </button>
            <button class="pin-btn ${isPinned ? 'on' : ''}" data-id="${id}" title="置顶">
              <img src="${pinIconUrl}" alt="置顶" onerror="this.style.display='none'" />
            </button>
          </div>
        </div>
        <div class="detail-card">
          <div class="section-title">基本信息</div>
          <div class="basic-info">
            <div class="field-row"><span class="tag">时间</span> <span class="tag tag-time">${timeText}</span></div>
            <div class="field-row"><span class="tag">天气</span> ${weatherText}</div>
            ${fish.rod ? `<div class="field-row"><span class="tag">杆型</span> ${fish.rod}</div>` : ''}
            ${fish.hook ? `<div class="field-row"><span class="tag">拉杆</span> ${fish.hook}</div>` : ''}
            <div class="field-row"><span class="tag">收藏品</span> ${fish.collectable || '无'}</div>
          </div>
        </div>
      </div>
    `;

    // 绑定按钮事件
    bindDetailActionsInModal(container, fish);
  }

  // 绑定详情浮窗中的按钮事件
  function bindDetailActionsInModal(container, fish) {
    const completeBtn = container.querySelector('.complete-btn');
    const pinBtn = container.querySelector('.pin-btn');
    const spoilBtn = container.querySelector('.spoil-btn');
    const id = fish.name;

    if (completeBtn) {
      completeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.completed.has(id)) {
          state.completed.delete(id);
          try { localStorage.removeItem('mcfisher-completed-' + id); } catch(_){ }
        } else {
          state.completed.add(id);
          try { localStorage.setItem('mcfisher-completed-' + id, '1'); } catch(_){ }
        }
        updateFishingProgress();
        renderFishList();
        renderFishDetailInModal(container); // 重新渲染按钮状态
      });
    }

    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.pinned.has(id)) {
          state.pinned.delete(id);
          try { localStorage.removeItem('mcfisher-pinned-' + id); } catch(_){ }
        } else {
          state.pinned.add(id);
          try { localStorage.setItem('mcfisher-pinned-' + id, '1'); } catch(_){ }
        }
        renderFishList();
        renderFishDetailInModal(container); // 重新渲染按钮状态
      });
    }

    if (spoilBtn) {
      spoilBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        spoilBtn.classList.toggle('on', toggleLoot(fish.name));
        renderLootGrid();
      });
    }
  }

  // 战利品管理（移动端14个槽位）
  const MOBILE_LOOT_KEY = 'mcfisher-loot-mobile';

  function loadLoot() {
    try {
      const saved = localStorage.getItem(MOBILE_LOOT_KEY);
      state.loot = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(state.loot)) state.loot = [];
      // 移动端限制14个槽位
      state.loot = state.loot.slice(0, 14);
    } catch (e) {
      state.loot = [];
    }
  }

  function saveLoot() {
    try {
      localStorage.setItem(MOBILE_LOOT_KEY, JSON.stringify(state.loot));
    } catch (e) {}
  }

  function toggleLoot(fishName) {
    const index = state.loot.indexOf(fishName);
    if (index >= 0) {
      state.loot.splice(index, 1);
      saveLoot();
      return false;
    } else {
      if (state.loot.length >= 14) {
        alert('战利品已满');
        return false;
      }
      state.loot.push(fishName);
      saveLoot();
      return true;
    }
  }

  function renderLootGrid() {
    const grid = document.getElementById('lootGrid');
    if (!grid) return;

    const slots = grid.querySelectorAll('.cert-loot-item');
    
    // 清空所有槽位
    slots.forEach(slot => {
      slot.innerHTML = '';
      slot.classList.remove('filled');
    });

    // 填充战利品
    for (let i = 0; i < Math.min(state.loot.length, 14); i++) {
      const name = state.loot[i];
      const src = `./assets/icons/fishes/${name}.webp`;
      slots[i].innerHTML = `<img draggable="true" src="${src}" alt="${name}" title="${name}" data-name="${name}" onerror="this.style.display='none'"/>`;
      slots[i].classList.add('filled');
    }

    // 移动端拖拽支持（简化版）
    if (!grid.dataset.bound) {
      slots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
          const img = slot.querySelector('img');
          if (img) {
            const fishName = img.dataset.name;
            if (fishName && confirm(`确定要移除 ${fishName} 吗？`)) {
              const lootIndex = state.loot.indexOf(fishName);
              if (lootIndex >= 0) {
                state.loot.splice(lootIndex, 1);
                saveLoot();
                renderLootGrid();
              }
            }
          }
        });
      });
      grid.dataset.bound = 'true';
    }
  }

  // 更新捕鱼进度
  function updateFishingProgress() {
    const el_progress = document.getElementById('userProgress');
    if (!el_progress) return;

    const counts = { '鱼皇': 0, '鱼王': 0, '普通鱼': 0 };
    const completed = { '鱼皇': 0, '鱼王': 0, '普通鱼': 0 };

    state.fish.forEach(fish => {
      const rarity = fish.rarity || '普通鱼';
      if (counts.hasOwnProperty(rarity)) {
        counts[rarity]++;
        if (state.completed.has(fish.name)) {
          completed[rarity]++;
        }
      }
    });

    const parts = [];
    const hasEmperor = counts['鱼皇'] > 0;

    if (hasEmperor) {
      if (counts['鱼皇'] > 0) parts.push(`鱼皇 ${completed['鱼皇']}/${counts['鱼皇']}`);
      if (counts['鱼王'] > 0) parts.push(`鱼王 ${completed['鱼王']}/${counts['鱼王']}`);
    } else {
      if (counts['鱼王'] > 0) parts.push(`鱼王 ${completed['鱼王']}/${counts['鱼王']}`);
      if (counts['普通鱼'] > 0) parts.push(`普通鱼 ${completed['普通鱼']}/${counts['普通鱼']}`);
    }

    el_progress.textContent = parts.join(' ');
  }

  // 时间更新
  function updateEorzeaClock() {
    const now = getEorzeaNow();
    el.eorzeaTimeValue.textContent = fmtTime(now.bell, now.minute);
    if (el.localTimeValue) {
      const d = new Date();
      const hh = fmt2(d.getHours());
      const mm = fmt2(d.getMinutes());
      el.localTimeValue.textContent = `${hh}:${mm}`;
    }
  }

  // 设置事件监听
  function setupEvents() {
    // DOM元素缓存
    el.eorzeaTimeValue = document.getElementById('eorzeaTimeValue');
    el.localTimeValue = document.getElementById('localTimeValue');
    el.themeToggle = document.getElementById('themeToggle');
    el.settingsToggle = document.getElementById('settingsToggle');
    el.searchInput = document.getElementById('searchInput');
    el.filterBtn = document.getElementById('filterBtn');
    el.filterModal = document.getElementById('filterModal');
    el.filterClose = document.getElementById('filterClose');
    el.fishList = document.getElementById('fishList');
    
    // 筛选元素
    el.filterVersion = document.getElementById('filterVersion');
    el.filterRarity = document.getElementById('filterRarity');
    el.filterCondition = document.getElementById('filterCondition');
    el.filterStatus = document.getElementById('filterStatus');
    el.filterCollect = document.getElementById('filterCollect');

    // 主题切换
    if (el.themeToggle) {
      el.themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        try { localStorage.setItem('mcfisher-theme', newTheme); } catch(_) {}
      });
    }

    // 设置按钮
    if (el.settingsToggle) {
      el.settingsToggle.addEventListener('click', () => {
        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.top = '72px';
        menu.style.right = '18px';
        menu.style.background = 'var(--ff14-primary)';
        menu.style.border = '2px solid var(--ff14-border)';
        menu.style.borderRadius = '12px';
        menu.style.boxShadow = '0 14px 34px rgba(0,0,0,.28)';
        menu.style.padding = '12px';
        menu.style.zIndex = '2147483647';
        menu.style.minWidth = '180px';
        menu.style.opacity = '1';
        menu.style.backdropFilter = 'none';
        menu.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <button id="mcf-export" class="btn btn-primary">导出本地数据</button>
            <button id="mcf-import" class="btn btn-secondary">导入本地数据</button>
          </div>
        `;
        document.body.appendChild(menu);
        const close = () => menu.remove();
        setTimeout(() => document.addEventListener('click', (ev) => {
          if (!menu.contains(ev.target) && ev.target !== el.settingsToggle) close();
        }, { once: true }), 0);
        menu.querySelector('#mcf-export').onclick = () => { exportLocalData(); close(); };
        menu.querySelector('#mcf-import').onclick = () => { const f = document.getElementById('importDataInput'); if (f) f.click(); close(); };
      });
    }

    // 导入数据
    const importInput = document.getElementById('importDataInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) importLocalData(file);
        importInput.value = '';
      });
    }

    // 搜索
    if (el.searchInput) {
      el.searchInput.addEventListener('input', debounce((e) => {
        state.searchText = e.target.value || '';
        applyFilter();
        renderFishList();
      }, 300));
    }

    // 筛选按钮
    if (el.filterBtn && el.filterModal) {
      el.filterBtn.addEventListener('click', () => {
        el.filterModal.classList.remove('hidden');
      });
    }

    if (el.filterClose) {
      el.filterClose.addEventListener('click', () => {
        el.filterModal.classList.add('hidden');
      });
    }

    // 筛选芯片点击
    if (el.filterModal) {
      el.filterModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip')) {
          const key = e.target.dataset.key;
          const value = e.target.dataset.value;
          
          if (state.filters[key]) {
            if (state.filters[key].has(value)) {
              // 确保至少有一个激活
              if (state.filters[key].size > 1) {
                state.filters[key].delete(value);
                e.target.classList.remove('active');
                e.target.classList.add('deny');
              }
            } else {
              state.filters[key].add(value);
              e.target.classList.add('active');
              e.target.classList.remove('deny');
            }
            
            applyFilter();
            renderFishList();
          }
        }
      });
    }

    // 详情浮窗关闭
    const detailModalClose = document.getElementById('detailModalClose');
    const detailModal = document.getElementById('detailModal');
    if (detailModalClose && detailModal) {
      detailModalClose.addEventListener('click', () => {
        detailModal.classList.remove('show');
        detailModal.classList.add('hidden');
      });
      
      detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
          detailModal.classList.remove('show');
          detailModal.classList.add('hidden');
        }
      });
    }

    // 个人信息和头像
    setupProfileEvents();
  }

  // 个人信息事件设置
  function setupProfileEvents() {
    // 证件头可折叠/展开
    const profilePanel = document.getElementById('userProfile');
    const profileHeader = document.getElementById('userProfileHeader');
    if (profilePanel && profileHeader) {
      const COLL_KEY = 'mcfisher-profile-collapsed-mobile';
      
      // 移动端默认折叠
      try {
        const saved = localStorage.getItem(COLL_KEY);
        const shouldCollapse = (saved == null) ? true : saved === '1';
        profilePanel.classList.toggle('collapsed', shouldCollapse);
      } catch (_) {
        profilePanel.classList.add('collapsed');
      }
      
      profileHeader.addEventListener('click', () => {
        const willCollapse = !profilePanel.classList.contains('collapsed');
        profilePanel.classList.toggle('collapsed', willCollapse);
        try { localStorage.setItem(COLL_KEY, willCollapse ? '1' : '0'); } catch(_) {}
      });
    }

    // 圆形头像上传
    const avatarMobile = document.getElementById('userAvatarMobile');
    const avatarFileMobile = document.getElementById('avatarFileMobile');
    if (avatarMobile && avatarFileMobile) {
      avatarMobile.addEventListener('click', () => {
        avatarFileMobile.click();
      });
      
      avatarFileMobile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          openAvatarModal(file, true); // true表示移动端圆形裁剪
        }
      });
    }

    // 证件字段编辑
    const editableFields = ['userNickname', 'userWorld', 'userCertId', 'userIssueDate'];
    editableFields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('blur', () => {
          try { localStorage.setItem('mcfisher-' + fieldId.replace('user', '').toLowerCase(), el.textContent || ''); } catch(_) {}
        });
      }
    });
  }

  // 头像裁剪浮窗（简化移动端版本）
  function openAvatarModal(file, isMobile = true) {
    // 简化实现：直接读取并设置头像
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURL = e.target.result;
      if (isMobile) {
        const avatarMobile = document.getElementById('userAvatarMobile');
        if (avatarMobile) {
          avatarMobile.src = dataURL;
          try { localStorage.setItem('mcfisher-user-avatar-mobile', dataURL); } catch(_) {}
        }
      }
    };
    reader.readAsDataURL(file);
  }

  // 导入导出功能
  const EXPORT_KEYS = [
    'mcfisher-theme',
    'mcfisher-nickname',
    'mcfisher-user-avatar-mobile',
    'mcfisher-certid',
    'mcfisher-issuedate',
    'mcfisher-world',
    'mcfisher-profile-collapsed-mobile'
  ];

  function exportLocalData() {
    const data = {};
    // 固定键
    for (const k of EXPORT_KEYS) {
      try { data[k] = localStorage.getItem(k); } catch(_) {}
    }
    // 前缀类键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('mcfisher-completed-') || key.startsWith('mcfisher-pinned-') || key.startsWith('mcfisher-loot-')) {
        try { data[key] = localStorage.getItem(key); } catch(_) {}
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mcfisher-mobile-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function importLocalData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || '{}'));
        Object.keys(obj).forEach(k => {
          try { localStorage.setItem(k, obj[k]); } catch(_) {}
        });
        loadPreferences();
        renderFishList();
        alert('数据已导入');
      } catch (e) {
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
  }

  // 加载用户偏好设置
  function loadPreferences() {
    // 主题
    try {
      const theme = localStorage.getItem('mcfisher-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', theme);
    } catch(_) {}

    // 完成状态
    state.completed.clear();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mcfisher-completed-')) {
        const fishName = key.replace('mcfisher-completed-', '');
        state.completed.add(fishName);
      }
    }

    // 置顶状态
    state.pinned.clear();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mcfisher-pinned-')) {
        const fishName = key.replace('mcfisher-pinned-', '');
        state.pinned.add(fishName);
      }
    }

    // 证件信息
    const fields = [
      { id: 'userNickname', key: 'mcfisher-nickname', default: '渔夫' },
      { id: 'userWorld', key: 'mcfisher-world', default: '未设置' },
      { id: 'userCertId', key: 'mcfisher-certid', default: 'FF14-001' },
      { id: 'userIssueDate', key: 'mcfisher-issuedate', default: new Date().toISOString().split('T')[0] }
    ];

    fields.forEach(({ id, key, default: def }) => {
      const el = document.getElementById(id);
      if (el) {
        try {
          const saved = localStorage.getItem(key);
          el.textContent = saved || def;
        } catch(_) {
          el.textContent = def;
        }
      }
    });

    // 移动端头像
    try {
      const avatarMobile = document.getElementById('userAvatarMobile');
      const savedAvatar = localStorage.getItem('mcfisher-user-avatar-mobile');
      if (avatarMobile && savedAvatar) {
        avatarMobile.src = savedAvatar;
      }
    } catch(_) {}

    // 战利品
    loadLoot();
    renderLootGrid();
  }

  // 初始化
  async function init() {
    loadPreferences();
    setupEvents();
    updateEorzeaClock();
    setInterval(updateEorzeaClock, 1000);

    try {
      preloadCriticalImages();
      await loadFishData();
      console.log('移动端应用初始化完成');
      
      // 每隔5分钟刷新数据
      setInterval(() => {
        loadFishData().catch(e => console.warn('数据刷新失败:', e));
      }, 5 * 60 * 1000);
      
    } catch (err) {
      console.error('移动端初始化失败:', err);
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #f5ecd7; background: #181411;">
          <h2>加载失败</h2>
          <p>请检查网络连接并刷新页面</p>
          <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 10px;">重新加载</button>
        </div>
      `;
    }
  }

  // 启动应用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
