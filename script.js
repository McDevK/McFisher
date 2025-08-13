// McFisher - 钓鱼笔记（桌面端）
(function() {
  'use strict';

  // ---------- 常量：艾欧泽亚时间 ----------
  const EORZEA_HOUR_MS = 175000; // 1 ET 小时 = 175秒
  const EORZEA_MINUTE_MS = EORZEA_HOUR_MS / 60;
  const EORZEA_DAY_MS = 24 * EORZEA_HOUR_MS;

  // ---------- 状态 ----------
  const state = {
    theme: 'dark',
    fish: [], // 来自 assets/fishbook/fish.json
    spots: [], // 来自 assets/fishbook/spots.json
    fishZoneKeyByName: new Map(), // 鱼名 -> 天气区 key
    filtered: [],
    selectedFishId: null,
    searchText: '',
    completed: new Set(),
    pinned: new Set(),
    loot: [], // 战利品：鱼名数组，按用户添加顺序
    filters: {
      versions: new Set(),
      rarity: new Set(['鱼皇','鱼王','普通鱼']),
      condition: new Set(['常驻','限时']),
      completion: new Set(['未完成','已完成']),
      collect: new Set(['普通鱼','收藏品'])
    }
  };

  // ---------- DOM ----------
  const el = {
    themeToggle: document.getElementById('themeToggle'),
    settingsToggle: document.getElementById('settingsToggle'),
    eorzeaTimeValue: document.getElementById('eorzeaTimeValue'),
    localTimeValue: document.getElementById('localTimeValue'),
    fishSearch: document.getElementById('fishSearch'),
    fishList: document.getElementById('fishList'),
    fishDetail: document.getElementById('fishDetail'),
    filterBtn: document.getElementById('filterBtn'),
    filterModal: document.getElementById('filterModal'),
    filterClose: document.getElementById('filterClose'),
    filterVersions: document.getElementById('filterVersions'),
    filterRarity: document.getElementById('filterRarity'),
    filterCondition: document.getElementById('filterCondition'),
    filterCompletion: document.getElementById('filterCompletion'),
    filterCollect: document.getElementById('filterCollect'),
    userProfile: document.getElementById('userProfile'),
    userAvatar: document.getElementById('userAvatar'),
    avatarFile: document.getElementById('avatarFile'),
    userNickname: document.getElementById('userNickname')
  };

  // 导入/导出：需要持久化的键集合
  const EXPORT_KEYS = [
    'mcfisher-theme',
    'mcfisher-user-nickname',
    'mcfisher-user-avatar',
    'mcfisher-user-avatar-mobile',
    'mcfisher-cert-id',
    'mcfisher-issue-date',
    'mcfisher-user-world',
    'mcfisher-user-title',
    // 完成、置顶、战利品、其他以前缀匹配（在导出函数中处理）
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
    a.href = url; a.download = 'mcfisher-backup.json';
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
        // 重新载入状态
        loadPreferences();
        renderFishList();
        renderFishDetail();
        alert('数据已导入');
      } catch (e) {
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
  }

  // ---------- 时间/格式化 ----------
  function getEorzeaNow(nowMs) {
    const ms = nowMs ?? Date.now();
    const bell = Math.floor(ms / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((ms % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const msIntoMinute = Math.floor(ms % EORZEA_MINUTE_MS);
    return { bell, minute, msIntoMinute };
  }

  // ---------- 战利品（证件） ----------
  const LOOT_KEY = 'mcfisher-loot';
  function loadLoot() {
    try {
      const raw = localStorage.getItem(LOOT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) state.loot = arr.filter(Boolean).map(String);
      else state.loot = [];
    } catch (_) { state.loot = []; }
  }
  function saveLoot() {
    try { localStorage.setItem(LOOT_KEY, JSON.stringify(state.loot || [])); } catch (_) {}
  }
  function renderLootGrid() {
    const grid = document.querySelector('.cert-loot-grid');
    if (!grid) return;
    const slots = Array.from(grid.querySelectorAll('.cert-loot-item'));
    // 清空
    slots.forEach((s, i) => { s.classList.remove('filled','drag-over'); s.innerHTML = ''; s.dataset.slot = String(i); });
    const n = Math.min(slots.length, state.loot.length);
    for (let i = 0; i < n; i++) {
      const name = state.loot[i];
      const src = `./assets/icons/fishes/${name}.webp`;
      slots[i].innerHTML = `<img draggable="true" src="${src}" alt="${name}" title="${name}" data-name="${name}" onerror="this.style.display='none'"/>`;
      slots[i].classList.add('filled');
    }

    // 点击移除 + 拖拽排序（仅绑定一次）
    if (!grid.dataset.bound) {
      grid.addEventListener('click', (e) => {
        const img = e.target && e.target.closest && e.target.closest('img');
        if (!img || !img.dataset || !img.dataset.name) return;
        removeLoot(img.dataset.name);
      });
      grid.addEventListener('dragstart', (e) => {
        const img = e.target && e.target.closest && e.target.closest('img');
        if (!img) return;
        const name = img.dataset.name || '';
        grid.dataset.dragFrom = String(state.loot.indexOf(name));
        if (e.dataTransfer) { e.dataTransfer.setData('text/plain', name); e.dataTransfer.effectAllowed = 'move'; }
        const slot = img.parentElement;
        if (slot && slot.classList) slot.classList.add('dragging');
      });
      grid.addEventListener('dragend', (e) => {
        const slot = e.target && e.target.closest && e.target.closest('.cert-loot-item');
        if (slot && slot.classList) slot.classList.remove('dragging');
      });
      // 触摸长按开始拖拽（移动端兼容）
      let touchTimer = null;
      grid.addEventListener('touchstart', (e) => {
        const img = e.target && e.target.closest && e.target.closest('img');
        if (!img) return;
        const name = img.dataset.name || '';
        touchTimer = setTimeout(() => {
          grid.dataset.dragFrom = String(state.loot.indexOf(name));
        }, 120);
      }, { passive: true });
      grid.addEventListener('touchend', () => { if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; } }, { passive: true });
      grid.addEventListener('dragover', (e) => {
        const slot = e.target && e.target.closest && e.target.closest('.cert-loot-item');
        if (!slot) return;
        e.preventDefault();
        slot.classList.add('drag-over');
      });
      grid.addEventListener('dragleave', (e) => {
        const slot = e.target && e.target.closest && e.target.closest('.cert-loot-item');
        if (!slot) return;
        slot.classList.remove('drag-over');
      });
      grid.addEventListener('drop', (e) => {
        const slot = e.target && e.target.closest && e.target.closest('.cert-loot-item');
        if (!slot) return;
        e.preventDefault();
        slot.classList.remove('drag-over');
        const draggingEl = grid.querySelector('.cert-loot-item.dragging');
        if (draggingEl) draggingEl.classList.remove('dragging');
        const from = parseInt(grid.dataset.dragFrom || '-1', 10);
        const to = parseInt(slot.dataset.slot || '-1', 10);
        if (Number.isNaN(from) || Number.isNaN(to) || from < 0 || to < 0 || from === to) return;
        const item = state.loot.splice(from, 1)[0];
        state.loot.splice(Math.min(to, state.loot.length), 0, item);
        saveLoot();
        renderLootGrid();
      });
      grid.dataset.bound = '1';
    }
  }
  function addLoot(name) {
    if (!name) return;
    const grid = document.querySelector('.cert-loot-grid');
    if (!grid) return;
    const capacity = grid.querySelectorAll('.cert-loot-item').length || 0;
    if (state.loot.includes(name)) { removeLoot(name); return; }
    if ((state.loot.length || 0) >= capacity) { alert('战利品已满'); return; }
    state.loot.push(name);
    saveLoot();
    renderLootGrid();
  }
  function removeLoot(name) {
    const idx = state.loot.indexOf(name);
    if (idx >= 0) {
      state.loot.splice(idx, 1);
      saveLoot();
      renderLootGrid();
    }
  }

  function fmt2(v) { return String(v).padStart(2, '0'); }
  function fmtTime(bell, minute) { return `${fmt2(bell)}:${fmt2(minute)}`; }

  function parseEtTimeStr(str) {
    if (!str) return null;
    const s = String(str).trim().replace(/\uFF1A/g, ':');
    const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mi = Math.max(0, Math.min(59, parseInt(m[2], 10)));
    return { h, m: mi };
  }

  function formatMsFull(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hh = fmt2(Math.floor(totalSec / 3600));
    const mm = fmt2(Math.floor((totalSec % 3600) / 60));
    const ss = fmt2(totalSec % 60);
    return `${hh}:${mm}:${ss}`;
  }

  function msToEtTime(targetBell, targetMinute) {
    const now = Date.now();
    const bell = Math.floor(now / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((now % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const curMin = bell * 60 + minute;
    const tgtMin = targetBell * 60 + targetMinute;
    const deltaMin = (tgtMin - curMin + 1440) % 1440;
    return deltaMin * EORZEA_MINUTE_MS;
  }

  // 更精确：考虑当前ET分钟的已过毫秒，避免3秒步进
  function msToEtTimePrecise(targetBell, targetMinute, nowMs) {
    const now = nowMs ?? Date.now();
    const bell = Math.floor(now / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((now % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const msIntoMinute = Math.floor(now % EORZEA_MINUTE_MS);
    const curMin = bell * 60 + minute;
    const tgtMin = targetBell * 60 + targetMinute;
    const deltaMin = (tgtMin - curMin + 1440) % 1440;
    let ms = deltaMin * EORZEA_MINUTE_MS - msIntoMinute;
    if (ms <= 0) ms += EORZEA_DAY_MS; // 目标是当前分钟起点且已过，则跳到下一天
    return ms;
  }

  function splitEtRangeMaybe(str) {
    if (!str) return ['', ''];
    const s = String(str).trim().replace(/\uFF1A/g, ':');
    const m = s.match(/^(\d{1,2}:\d{1,2})(?:\s*[\-–—]\s*(\d{1,2}:\d{1,2}))?$/);
    if (m) return [m[1], m[2] || ''];
    return [s, ''];
  }

  // ---------- 工具：防抖 ----------
  function debounce(fn, wait) {
    let timerId = null;
    return function debounced(...args) {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function renderWeatherTags(cnList, opts = {}) {
    const s = String(cnList || '').trim();
    if (!s || s === '无') return '';
    const parts = s.split(/[;|]/).map(t => t.trim()).filter(t => t && t !== '无');
    if (parts.length === 0) return '';
    if (opts.mode === 'icon') {
      return parts.map(p => {
        const src = `./assets/icons/weather/${p}.png`;
        return `<img class="weather-icon" src="${src}" alt="${p}" title="${p}" onerror="this.style.display='none'"/>`;
      }).join('');
    }
    return parts.map(p => `<span class="tag tag-weather">${p}</span>`).join('');
  }

  // 仅基于出现时间窗口判断（不考虑天气）
  function getAppearanceWindowCountdown(timeLabel, nowMs) {
    if (!timeLabel || /全天可钓/.test(String(timeLabel))) {
      return { active: true, msLeft: Infinity, text: '全天可钓' };
    }
    let appearStr = '', disappearStr = '';
    // 兼容 "ET hh:mm - hh:mm" 或 "hh:mm - hh:mm"
    const norm = String(timeLabel).trim().replace(/^ET\s*/i, '');
    [appearStr, disappearStr] = splitEtRangeMaybe(norm);
    const appear = parseEtTimeStr(appearStr);
    const disappear = parseEtTimeStr(disappearStr);
    if (!appear && !disappear) return { active: false, msLeft: 0, text: '未知' };

    const now = nowMs ?? Date.now();
    const { bell, minute, msIntoMinute } = getEorzeaNow(now);
    const curMin = bell * 60 + minute;

    let startMin = appear ? (appear.h * 60 + appear.m) : 0;
    let endMin = disappear ? (disappear.h * 60 + disappear.m) : 1440;
    if (endMin <= startMin) endMin += 1440; // 跨日

    let relCur = curMin;
    if (curMin < (startMin % 1440)) relCur += (curMin <= (endMin % 1440) ? 0 : 1440);

    if (relCur >= startMin && relCur < endMin) {
      let msLeft = (endMin - relCur) * EORZEA_MINUTE_MS - msIntoMinute;
      if (msLeft <= 0) msLeft = 1; // 防止显示为0导致排序异常
      return { active: true, msLeft, text: `可钓剩余 ${formatMsFull(msLeft)}` };
    }
    const wait = msToEtTimePrecise(appear ? appear.h : 0, appear ? appear.m : 0, now);
    return { active: false, msLeft: wait, text: `距离可钓 ${formatMsFull(wait)}` };
  }

  // ---------- 天气系统（复用 McFATE/McWeather 规则） ----------
  const WEATHER_DATA = {
    uldah: [{ name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 25 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }],
    westernThanalan: [{ name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 25 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }],
    centralThanalan: [{ name: 'dustStorms', chance: 15 }, { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }],
    easternThanalan: [{ name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }, { name: 'showers', chance: 15 }],
    southernThanalan: [{ name: 'heatWaves', chance: 20 }, { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }],
    northernThanalan: [{ name: 'clearSkies', chance: 5 }, { name: 'fairSkies', chance: 15 }, { name: 'clouds', chance: 30 }, { name: 'fog', chance: 50 }],
    gridania: [{ name: 'rain', chance: 20 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 }],
    centralShroud: [{ name: 'thunder', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 }],
    eastShroud: [{ name: 'thunder', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 }],
    southShroud: [{ name: 'fog', chance: 5 }, { name: 'thunderstorms', chance: 5 }, { name: 'thunder', chance: 15 }, { name: 'fog', chance: 5 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 30 }, { name: 'clearSkies', chance: 30 }],
    northShroud: [{ name: 'fog', chance: 5 }, { name: 'showers', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 5 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 30 }, { name: 'clearSkies', chance: 30 }],
    limsaLominsa: [{ name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 30 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 }],
    middleLaNoscea: [{ name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 }],
    lowerLaNoscea: [{ name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 }],
    easternLaNoscea: [{ name: 'fog', chance: 5 }, { name: 'clearSkies', chance: 45 }, { name: 'fairSkies', chance: 30 }, { name: 'clouds', chance: 10 }, { name: 'rain', chance: 5 }, { name: 'showers', chance: 5 }],
    westernLaNoscea: [{ name: 'fog', chance: 10 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'gales', chance: 10 }],
    upperLaNoscea: [{ name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'fog', chance: 10 }, { name: 'thunder', chance: 10 }, { name: 'thunderstorms', chance: 10 }],
    outerLaNoscea: [{ name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'fog', chance: 15 }, { name: 'rain', chance: 15 }],
    coerthasCentralHighlands: [{ name: 'blizzard', chance: 20 }, { name: 'snow', chance: 40 }, { name: 'fairSkies', chance: 10 }, { name: 'clearSkies', chance: 5 }, { name: 'clouds', chance: 15 }, { name: 'fog', chance: 10 }],
    morDhona: [{ name: 'clouds', chance: 15 }, { name: 'fog', chance: 15 }, { name: 'gloom', chance: 30 }, { name: 'clearSkies', chance: 15 }, { name: 'fairSkies', chance: 25 }]
  };

  const MAP_NAMES = {
    '西萨纳兰': 'westernThanalan',
    '中萨纳兰': 'centralThanalan',
    '东萨纳兰': 'easternThanalan',
    '南萨纳兰': 'southernThanalan',
    '北萨纳兰': 'northernThanalan',
    '乌尔达哈': 'uldah',
    '黑衣森林中部林区': 'centralShroud',
    '黑衣森林东部林区': 'eastShroud',
    '黑衣森林南部林区': 'southShroud',
    '黑衣森林北部林区': 'northShroud',
    '格里达尼亚': 'gridania',
    '格里达尼亚旧街': 'gridania',
    '格里达尼亚新街': 'gridania',
    '中拉诺西亚': 'middleLaNoscea',
    '拉诺西亚低地': 'lowerLaNoscea',
    '东拉诺西亚': 'easternLaNoscea',
    '西拉诺西亚': 'westernLaNoscea',
    '拉诺西亚高地': 'upperLaNoscea',
    '拉诺西亚外地': 'outerLaNoscea',
    '利姆萨·罗敏萨': 'limsaLominsa',
    '库尔札斯中央高地': 'coerthasCentralHighlands',
    '摩杜纳': 'morDhona'
  };

  const WEATHER_NAMES_CN = {
    clearSkies: '碧空',
    fairSkies: '晴朗',
    clouds: '阴云',
    fog: '薄雾',
    rain: '小雨',
    showers: '暴雨',
    wind: '微风',
    gales: '强风',
    thunder: '打雷',
    thunderstorms: '雷雨',
    snow: '小雪',
    blizzard: '暴雪',
    gloom: '妖雾',
    heatWaves: '热浪',
    dustStorms: '扬沙'
  };
  const WEATHER_NAMES_EN = {};
  Object.keys(WEATHER_NAMES_CN).forEach(k => { WEATHER_NAMES_EN[WEATHER_NAMES_CN[k]] = k; });

  // 个别缺失于钓场表但众所周知的鱼类 → 区域兜底映射
  const FISH_ZONE_OVERRIDES = {
    '巨鲨': 'limsaLominsa', // 利姆萨·罗敏萨上层甲板
    '水晶刺鱼': 'morDhona'  // 摩杜纳
  };

  function calculateWeatherValue(unixMs) {
    const ms = Math.floor(unixMs);
    const bell = Math.floor(ms / EORZEA_HOUR_MS) % 24;
    const increment = (bell + 8 - (bell % 8)) % 24;
    const totalDays = Math.floor(ms / (24 * EORZEA_HOUR_MS));
    const calcBase = totalDays * 100 + increment;
    const step1 = ((calcBase << 11) ^ calcBase) >>> 0;
    const step2 = ((step1 >>> 8) ^ step1) >>> 0;
    return step2 % 100;
  }
  function nearestIntervalStart(unixMs) {
    const bell = Math.floor(unixMs / EORZEA_HOUR_MS);
    const alignedBell = bell - (bell % 8);
    return alignedBell * EORZEA_HOUR_MS;
  }
  function pickWeatherByValue(zoneKey, value) {
    const table = WEATHER_DATA[zoneKey] || [];
    let cursor = 0;
    for (let i = 0; i < table.length; i++) { cursor += table[i].chance; if (value < cursor) return table[i]; }
    return table[table.length - 1] || { name: 'clearSkies', chance: 100 };
  }

  function getWeatherRequirementCountdown(zoneKey, weatherCNList, nowMs) {
    if (!zoneKey || !weatherCNList) return { active: false, msLeft: 0, text: '未知' };
    const req = String(weatherCNList).trim();
    if (!req || req === '无') return { active: true, msLeft: Infinity, text: '可钓中' };
    const allow = req.split(/[;|]/).map(s => WEATHER_NAMES_EN[String(s).trim()]).filter(Boolean);
    if (!allow.length) return { active: false, msLeft: 0, text: '未知' };
    const now = nowMs ?? Date.now();
    const curStart = nearestIntervalStart(now);
    const curWeather = pickWeatherByValue(zoneKey, calculateWeatherValue(curStart));
    if (allow.includes(curWeather.name)) {
      // 累计连续满足天气的多个8小时区间
      const E8 = 8 * EORZEA_HOUR_MS;
      let end = curStart + E8;
      let guard = 0;
      while (guard < 2000) {
        const nextStart = end;
        const w = pickWeatherByValue(zoneKey, calculateWeatherValue(nextStart));
        if (!allow.includes(w.name)) break;
        end += E8;
        guard++;
      }
      const msLeft = Math.max(0, end - now);
      return { active: true, msLeft, text: `可钓剩余 ${formatMsFull(msLeft)}` };
    }
    let t = curStart + 8 * EORZEA_HOUR_MS;
    let guard = 0;
    while (guard < 2000) {
      const w = pickWeatherByValue(zoneKey, calculateWeatherValue(t));
      if (allow.includes(w.name)) {
        const msLeft = Math.max(0, t - now);
        return { active: false, msLeft, text: `距离可钓 ${formatMsFull(msLeft)}` };
      }
      t += 8 * EORZEA_HOUR_MS; guard++;
    }
    return { active: false, msLeft: 0, text: '等待中' };
  }

  // 时间+天气联合（寻找两者交集的首次区间）
  function getWeatherAndTimeCountdown(zoneKey, weatherCNList, timeLabel, nowMs) {
    const timeReq = String(timeLabel || '').trim();
    const hasTime = !!timeReq && !/^(无)?$/.test(timeReq) && !/全天可钓/.test(timeReq);
    const hasWeather = !!weatherCNList && weatherCNList !== '无';
    if (!hasWeather) return getAppearanceWindowCountdown(timeLabel, nowMs);
    if (!hasTime) return getWeatherRequirementCountdown(zoneKey, weatherCNList, nowMs);

    // 需要联合查找交集
    // 解析时间窗口
    const norm = timeReq.replace(/^ET\s*/i, '');
    const [aStr, dStr] = splitEtRangeMaybe(norm);
    const a = parseEtTimeStr(aStr);
    const d = parseEtTimeStr(dStr);
    if (!a && !d) return getWeatherRequirementCountdown(zoneKey, weatherCNList, nowMs);
    const startMin = (a ? a.h * 60 + a.m : 0) % 1440;
    const endMinRaw = d ? d.h * 60 + d.m : 1440;
    const endMin = endMinRaw <= startMin ? endMinRaw + 1440 : endMinRaw;

    const allow = String(weatherCNList).split(/[;|]/).map(s => WEATHER_NAMES_EN[String(s).trim()]).filter(Boolean);
    const now = nowMs ?? Date.now();
    const E8 = 8 * EORZEA_HOUR_MS;

    function inWindow(tMs) {
      const bell = Math.floor(tMs / EORZEA_HOUR_MS) % 24;
      const minute = Math.floor((tMs % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
      let cur = bell * 60 + minute;
      let s = startMin, e = endMin;
      if (e <= s) e += 1440;
      if (cur < (s % 1440)) cur += (cur <= (e % 1440) ? 0 : 1440);
      return cur >= s && cur < e;
    }

    const curStart = nearestIntervalStart(now);
    let cursor = curStart; let guard = 0;
    while (guard < 4000) {
      const w = pickWeatherByValue(zoneKey, calculateWeatherValue(cursor));
      const intStart = cursor; const intEnd = cursor + E8;
      const has = allow.includes(w.name);
      if (has) {
        // 连续满足：向后合并连续天气区间，计算与时间窗口的交集
        let mergedStart = intStart;
        let mergedEnd = intEnd;
        let fwd = intEnd; let g2 = 0;
        while (g2 < 2000) {
          const w2 = pickWeatherByValue(zoneKey, calculateWeatherValue(fwd));
          if (!allow.includes(w2.name)) break;
          mergedEnd += E8; fwd += E8; g2++;
        }
        // 计算 merged 区间与未来几天内时间窗口的交集，找第一个落在 now 之后的点
        for (let day = 0; day < 5; day++) {
          // 将时间窗口映射到实际毫秒：找到窗口起点
          const startMs = now + msToEtTimePrecise((startMin/60)|0, startMin % 60, now) + day * EORZEA_DAY_MS;
          const endMs = startMs + (endMin - startMin) * EORZEA_MINUTE_MS;
          const interStart = Math.max(mergedStart, startMs);
          const interEnd = Math.min(mergedEnd, endMs);
          if (interStart < interEnd) {
            if (now >= interStart && now < interEnd) {
              const msLeft = interEnd - now;
              return { active: true, msLeft, text: `可钓剩余 ${formatMsFull(msLeft)}` };
            }
            if (now < interStart) {
              return { active: false, msLeft: interStart - now, text: `距离可钓 ${formatMsFull(interStart - now)}` };
            }
          }
        }
      }
      cursor += E8; guard++;
    }
    return { active: false, msLeft: 0, text: '等待中' };
  }

  function resolveZoneKeyForFish(fishName) {
    if (state.fishZoneKeyByName.has(fishName)) return state.fishZoneKeyByName.get(fishName);
    // 兜底优先
    if (FISH_ZONE_OVERRIDES[fishName]) {
      const z = FISH_ZONE_OVERRIDES[fishName];
      state.fishZoneKeyByName.set(fishName, z);
      return z;
    }
    // 建立映射：优先匹配二级地图，再匹配一级地图
    for (const s of state.spots) {
      if (Array.isArray(s.fish) && s.fish.includes(fishName)) {
        let key2 = MAP_NAMES[s.level2];
        let key1 = MAP_NAMES[s.level1];
        // 模糊匹配：若找不到精确映射，则尝试包含关系
        if (!key2 && typeof s.level2 === 'string') {
          const k = Object.keys(MAP_NAMES).find(n => s.level2.includes(n));
          if (k) key2 = MAP_NAMES[k];
        }
        if (!key1 && typeof s.level1 === 'string') {
          const k1 = Object.keys(MAP_NAMES).find(n => s.level1.includes(n));
          if (k1) key1 = MAP_NAMES[k1];
        }
        const z = key2 || key1 || null;
        state.fishZoneKeyByName.set(fishName, z);
        return z;
      }
    }
    state.fishZoneKeyByName.set(fishName, null);
    return null;
  }

  // 根据鱼名查找鱼对象
  function findFishByName(name) {
    return state.fish.find(f => f && f.name === name);
  }

  // 将常用图标预加载到内存中（减少首次滚动加载延迟）
  const imageCache = new Map();
  function preloadImage(src) {
    if (!src || imageCache.has(src)) return;
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
    imageCache.set(src, img);
  }

  function getFishCountdown(fish) {
    const timeLabel = (!fish.time || fish.time === '无') ? '' : fish.time;
    const weatherLabel = (!fish.weather || fish.weather === '无') ? '' : fish.weather;
    // 统一 now，避免不同函数内取时间不一致
    const now = Date.now();
    if (!weatherLabel) return getAppearanceWindowCountdown(timeLabel || '全天可钓', now);
    const zoneKey = resolveZoneKeyForFish(fish.name);
    if (!zoneKey) return getAppearanceWindowCountdown(timeLabel || '全天可钓', now);
    return getWeatherAndTimeCountdown(zoneKey, weatherLabel, timeLabel, now);
  }

  // 预加载关键图片（Service Worker已缓存，此函数确保立即可用）
  function preloadCriticalImages() {
    // Service Worker已经预缓存了所有图片，直接返回成功
    console.log('关键图片已通过Service Worker预缓存');
    return Promise.resolve();
  }



  // 智能图片预加载
  function preloadFishImages(fishData) {
    if (window.imagePreloader && fishData) {
      window.imagePreloader.smartPreload(fishData);
    }
  }



  // ---------- 数据加载与渲染 ----------
  async function loadFishData() {
    const t = Date.now();
    const res = await fetch(`./assets/fishbook/fish.json`, { cache: 'default' });
    if (!res.ok) throw new Error('Failed to load fish.json');
    state.fish = await res.json();
    
    // 异步预加载前20条鱼的图片
    preloadFishImages(state.fish);
    // 初始化可用选项（按数据）
    const presentRarities = new Set(state.fish.map(f => String(f.rarity || '普通鱼')));
    const presentConditions = new Set(state.fish.map(f => (f.time && /全天可钓/.test(String(f.time))) ? '常驻' : '限时'));
    const presentCollect = new Set(state.fish.map(f => (String(f.collectable || '无').trim() !== '无') ? '收藏品' : '普通鱼'));
    // 初始化版本筛选选项
    try {
      const versions = Array.from(new Set(state.fish.map(f => String(f.version ?? '')).filter(Boolean)));
      versions.sort((a,b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return nb - na;
        return b.localeCompare(a, 'zh-Hans-CN');
      });
      state.filters.versions = new Set(versions);
      if (el.filterVersions) {
        el.filterVersions.innerHTML = versions.map(v => `<button class="chip active" data-key="version" data-value="${v}">${v}</button>`).join('');
      }
    } catch(_) {}

    // 依据数据生成其它分组的默认激活态（存在的为激活，不存在的为未激活）
    if (el.filterRarity) {
      const all = ['鱼皇','鱼王','普通鱼'];
      el.filterRarity.innerHTML = all.map(r => `<button class="chip ${presentRarities.has(r) ? 'active' : ''}" data-key="rarity" data-value="${r}">${r}</button>`).join('');
      state.filters.rarity = new Set(all.filter(r => presentRarities.has(r)));
    }
    if (el.filterCondition) {
      const all = ['常驻','限时'];
      el.filterCondition.innerHTML = all.map(c => `<button class="chip ${presentConditions.has(c) ? 'active' : ''}" data-key="condition" data-value="${c}">${c}</button>`).join('');
      state.filters.condition = new Set(all.filter(c => presentConditions.has(c)));
    }
    if (el.filterCollect) {
      const all = ['普通鱼','收藏品'];
      el.filterCollect.innerHTML = all.map(c => `<button class="chip ${presentCollect.has(c) ? 'active' : ''}" data-key="collect" data-value="${c}">${c}</button>`).join('');
      state.filters.collect = new Set(all.filter(c => presentCollect.has(c)));
    }
    // 加载钓场 → 用于天气区映射
    try {
      const rs = await fetch(`./assets/fishbook/spots.json`, { cache: 'force-cache' });
      if (rs.ok) state.spots = await rs.json();
    } catch (e) { state.spots = []; }
    applyFilter();
    renderFishList();
    updateFishingProgress();
  }

  function applyFilter() {
    const q = state.searchText.trim();
    const nowStamp = Date.now();
    const nowList = state.fish.map(f => {
      const cd = (function computeCd(fish){
        const timeLabel = (!fish.time || fish.time === '无') ? '' : fish.time;
        const weatherLabel = (!fish.weather || fish.weather === '无') ? '' : fish.weather;
        if (!weatherLabel) return getAppearanceWindowCountdown(timeLabel || '全天可钓', nowStamp);
        const zoneKey = resolveZoneKeyForFish(fish.name);
        if (!zoneKey) return getAppearanceWindowCountdown(timeLabel || '全天可钓', nowStamp);
        return getWeatherAndTimeCountdown(zoneKey, weatherLabel, timeLabel, nowStamp);
      })(f);
      return { fish: f, cd };
    });
    const filteredByTime = nowList.filter(x => x.cd.active || x.cd.msLeft > 0);
    const keyword = q.toLowerCase();
    state.filtered = filteredByTime.filter(({ fish }) => {
      // 关键字
      if (keyword) {
        const hay = [
          fish.name,
          fish.weather,
          ...(Array.isArray(fish.methods) ? fish.methods.flatMap(m => [m.bait, m.smallFish, m.value]) : [])
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      // 组合筛选
      const fv = state.filters;
      const id = String(fish.id || fish.name);
      // 版本
      const ver = String(fish.version ?? '');
      if (fv.versions.size && ver && !fv.versions.has(ver)) return false;
      // 种类
      const r = String(fish.rarity || '普通鱼');
      if (!fv.rarity.has(r)) return false;
      // 条件
      const cond = (fish.time && /全天可钓/.test(String(fish.time))) ? '常驻' : '限时';
      if (!fv.condition.has(cond)) return false;
      // 完成
      const comp = state.completed.has(id) ? '已完成' : '未完成';
      if (!fv.completion.has(comp)) return false;
      // 收藏品
      const coll = (String(fish.collectable || '无').trim() !== '无') ? '收藏品' : '普通鱼';
      if (!fv.collect.has(coll)) return false;
      return true;
    });
  }

  function updateFishingProgress() {
    try {
      const elProgress = document.getElementById('userProgress');
      if (!elProgress) return;
      const totals = { '鱼皇': 0, '鱼王': 0, '普通鱼': 0 };
      const done = { '鱼皇': 0, '鱼王': 0, '普通鱼': 0 };
      const toCategory = (r) => (r === '鱼皇' || r === '鱼王' || r === '普通鱼') ? r : '普通鱼';
      for (const f of state.fish) {
        if (!f) continue;
        const r = toCategory(String(f.rarity || '普通鱼'));
        totals[r]++;
        const id = String(f.id || f.name);
        if (state.completed.has(id)) done[r]++;
      }
      const parts = [];
      const hasEmperor = totals['鱼皇'] > 0;
      if (hasEmperor) {
        if (totals['鱼皇'] > 0) parts.push(`鱼皇 ${done['鱼皇']}/${totals['鱼皇']}`);
        if (totals['鱼王'] > 0) parts.push(`鱼王 ${done['鱼王']}/${totals['鱼王']}`);
      } else {
        if (totals['鱼王'] > 0) parts.push(`鱼王 ${done['鱼王']}/${totals['鱼王']}`);
        if (totals['普通鱼'] > 0) parts.push(`普通鱼 ${done['普通鱼']}/${totals['普通鱼']}`);
      }
      elProgress.textContent = parts.join(' ');
    } catch (_) { /* ignore */ }
  }

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

    // 排序：可钓中的优先（按剩余时间升序，以"秒"为粒度避免毫秒级抖动），再按距离可钓升序
    const renderNow = Date.now();
    const rows = state.filtered.map(({ fish }) => {
      const cd = (function computeCd(f){
        const timeLabel = (!f.time || f.time === '无') ? '' : f.time;
        const weatherLabel = (!f.weather || f.weather === '无') ? '' : f.weather;
        if (!weatherLabel) return getAppearanceWindowCountdown(timeLabel || '全天可钓', renderNow);
        const zoneKey = resolveZoneKeyForFish(f.name);
        if (!zoneKey) return getAppearanceWindowCountdown(timeLabel || '全天可钓', renderNow);
        return getWeatherAndTimeCountdown(zoneKey, weatherLabel, timeLabel, renderNow);
      })(fish);
      const id = String(fish.id || fish.name);
      const isCompleted = state.completed.has(id);
      const timeStr = String(fish.time || '').trim();
      const showTime = !!timeStr && timeStr !== '无' && !/全天可钓/.test(timeStr);
      const timeTag = showTime ? `<span class="tag tag-time">${timeStr}</span>` : '';
      const weatherTag = renderWeatherTags(fish.weather, { mode: 'icon' });
      const klass = cd.active ? 'active' : 'pending';
      const progress = (!isCompleted && cd.active && Number.isFinite(cd.msLeft))
        ? Math.max(0, Math.min(100, (1 - (cd.msLeft / (8 * EORZEA_HOUR_MS))) * 100))
        : 0;
      const hasWeatherLimit = !!String(fish.weather || '').trim() && String(fish.weather).trim() !== '无';
      const hasTimeLimit = !!timeStr && timeStr !== '无' && !/全天可钓/.test(timeStr);
      const isRestricted = hasWeatherLimit || hasTimeLimit;
      const activeClass = isCompleted ? 'completed' : ((cd.active && isRestricted) ? 'active' : '');
      const iconUrl = `./assets/icons/fishes/${fish.name}.webp`;
      const timeBucket = Number.isFinite(cd.msLeft) ? Math.floor(cd.msLeft / 1000) : Number.POSITIVE_INFINITY;
      const isCollectable = String(fish.collectable || '无').trim() !== '无';
      const collectIcon = isCollectable ? `<img class=\"collect-badge\" src=\"./assets/icons/others/collection.webp\" alt=\"collectable\" title=\"Collectable\" loading=\"lazy\" onerror=\"this.style.display='none'\"/>` : '';
      const completeIconUrl = './assets/icons/button/complete.webp';
      const isPinned = state.pinned.has(id);
      const pinIconUrl = isPinned ? './assets/icons/button/settop_on.webp' : './assets/icons/button/settop_off.webp';
      const html = `
        <div class="fish-item ${activeClass}" data-id="${id}">
          <div class="fish-info">
            <button class="complete-btn ${isCompleted ? 'done' : ''}" data-id="${id}" title="标记完成">
              <img src="${completeIconUrl}" alt="完成" onerror="this.style.display='none'" />
            </button>
            <button class="pin-btn ${isPinned ? 'on' : ''}" data-id="${id}" title="置顶">
              <img src="${pinIconUrl}" alt="置顶" onerror="this.style.display='none'" />
            </button>
            <img class="fish-icon" src="${iconUrl}" alt="${fish.name}" style="opacity: 1;" onerror="this.style.display='none'" />
            <div class="fish-name"><span class="fish-name-text">${fish.name}</span>${collectIcon}</div>
            <div class="fish-tags">${timeTag}${weatherTag}</div>
          </div>
          <div class="countdown ${klass}">
            <div class="progress" style="--progress:${progress}%"></div>
            <span class="countdown-text">${isCompleted ? '已完成' : (cd.text === '未知' && fish.weather && fish.weather !== '无' ? '等待中' : cd.text)}</span>
          </div>
        </div>`;
      const sortKey = isCompleted ? 3 : (isPinned ? -1 : (cd.active ? 0 : 1));
      return { id, html, sortKey, timeBucket: isCompleted ? Number.POSITIVE_INFINITY : timeBucket, name: fish.name, isActive: cd.active };
    });

    rows.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      if (a.timeBucket !== b.timeBucket) return a.timeBucket - b.timeBucket;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

    const pinnedRows = rows.filter(r => r.sortKey === -1);
    // 置顶区内也需要将"不可钓"排到后面：先按是否可钓，再按剩余/等待时间、名称
    pinnedRows.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.timeBucket !== b.timeBucket) return a.timeBucket - b.timeBucket;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
    const normalRows = rows.filter(r => r.sortKey !== -1 && r.sortKey !== 3);
    const completedRows = rows.filter(r => r.sortKey === 3);
    const parts = [];
    if (pinnedRows.length) parts.push(pinnedRows.map(r => r.html).join(''), '<hr class="pin-separator"/>');
    parts.push(normalRows.map(r => r.html).join(''));
    if (completedRows.length) parts.push(completedRows.map(r => r.html).join(''));
    el.fishList.innerHTML = parts.join('');

    // 绑定完成按钮
    el.fishList.querySelectorAll('.complete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (state.completed.has(id)) {
          state.completed.delete(id);
          try { localStorage.removeItem('mcfisher-completed-' + id); } catch(_){}
        } else {
          state.completed.add(id);
          try { localStorage.setItem('mcfisher-completed-' + id, '1'); } catch(_){}
          // 动效
          btn.classList.add('animate');
          setTimeout(() => btn.classList.remove('animate'), 300);
        }
        updateFishingProgress();
        renderFishList();
      });
    });

    // 绑定置顶按钮
    el.fishList.querySelectorAll('.pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (state.pinned.has(id)) {
          state.pinned.delete(id);
          try { localStorage.removeItem('mcfisher-pinned-' + id); } catch(_){}
        } else {
          state.pinned.add(id);
          try { localStorage.setItem('mcfisher-pinned-' + id, '1'); } catch(_){}
        }
        renderFishList();
      });
    });

    // 绑定点击事件：显示详情（桌面端在右侧，移动端上浮窗）
    el.fishList.querySelectorAll('.fish-item').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedFishId = item.getAttribute('data-id');
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
        if (isMobile) {
          const modal = document.getElementById('detailModal');
          const body = document.getElementById('detailModalBody');
          if (modal && body) {
            renderFishDetail();
            // 将详情内容复制到浮窗（避免重复渲染复杂逻辑，这里复用已渲染DOM）
            const src = document.getElementById('fishDetail');
            body.innerHTML = src.innerHTML;
            // 为浮窗内的按钮重新绑定事件
            bindDetailActionsIn(body, state.fish.find(f => String(f.id || f.name) === String(state.selectedFishId)));
            modal.classList.remove('hidden');
            modal.classList.add('show');
            // 确保视图滚动到顶部
            body.scrollTop = 0;
          }
        } else {
          renderFishDetail();
        }
      });
    });
  }

  function bindDetailActionsIn(container, fish) {
    if (!container || !fish) return;
    const completeBtn = container.querySelector('.detail-header .complete-btn');
    const pinBtn = container.querySelector('.detail-header .pin-btn');
    const spoilBtn = container.querySelector('.detail-header .spoil-btn');
    const id = String(fish.id || fish.name);
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
        renderFishList();
        renderFishDetail();
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
        renderFishDetail();
      });
    }
    if (spoilBtn) {
      spoilBtn.classList.toggle('on', (state.loot || []).includes(fish.name));
      spoilBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const exists = (state.loot || []).includes(fish.name);
        addLoot(fish.name); // 已存在时会移除
        spoilBtn.classList.toggle('on', !exists);
      });
    }
  }

  function renderFishDetail() {
    const fish = state.fish.find(f => String(f.id || f.name) === String(state.selectedFishId));
    if (!fish) {
      el.fishDetail.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-info-circle"></i>
          <p>点击左侧的鱼，查看详细信息</p>
        </div>`;
      return;
    }

    const methods = Array.isArray(fish.methods) ? fish.methods : [];
    const iconUrl = `./assets/icons/fishes/${encodeURIComponent(fish.name)}.webp`;
    const rodIconMap = { '轻杆': 'light.webp', '中杆': 'middle.webp', '鱼王杆': 'heavy.webp' };
    const hookIconMap = { '精准提钩': 'Precision Hookset.webp', '强力提钩': 'Powerful Hookset.webp' };

    function rodIconFor(name) { return rodIconMap[name] ? `./assets/icons/type/${rodIconMap[name]}` : ''; }
    function hookIconFor(name) { return hookIconMap[name] ? `./assets/icons/skill/${hookIconMap[name]}` : ''; }

    function renderMethodChain(m) {
      const chainParts = [];
      function withIndicators(iconSrc, fishNode, titleText) {
        const rodName = fishNode && fishNode.rod ? fishNode.rod : '';
        const hookName = fishNode && fishNode.hook ? fishNode.hook : '';
        const leftCol = `<div class=\"indicator-col\">${rodName ? `<img class=\"rod-icon meta-icon\" src=\"${rodIconFor(rodName)}\" alt=\"${rodName}\" loading=\"lazy\"/>` : ''}${hookName ? `<img class=\"hook-icon meta-icon\" src=\"${hookIconFor(hookName)}\" alt=\"${hookName}\" loading=\"lazy\"/>` : ''}</div>`;
        const t = titleText || '';
        return `${leftCol}<img class=\"bait-icon\" src=\"${iconSrc}\" title=\"${t}\" alt=\"${t}\" data-tip=\"${t}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/>`;
      }

      // 直接鱼饵 → 目标鱼
      if (m.type === 'bait') {
        const baitIcon = m.bait ? `./assets/icons/bait/${m.bait}.webp` : '';
        if (baitIcon) chainParts.push(`<img class=\"bait-icon\" src=\"${baitIcon}\" title=\"${m.bait}\" alt=\"${m.bait}\" data-tip=\"${m.bait}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/>`);
        chainParts.push(`<span class=\"chain-arrow\">›</span>`);
        chainParts.push(withIndicators(iconUrl, fish, fish.name));
        return `<div class=\"method-chain\">${chainParts.join('')}</div>`;
      }

      // 递归展开小钓大：从当前方法的 smallFish 开始向上追溯到基础鱼饵
      if (m.type === 'mooch') {
        const baits = [];
        const fishesSeq = [];
        if (m.bait) baits.push(m.bait);
        if (m.smallFish) fishesSeq.push(m.smallFish);
        let currentName = m.smallFish;
        const visited = new Set();
        let guard = 0;
        while (currentName && guard < 10) {
          if (visited.has(currentName)) break; // 防循环
          visited.add(currentName);
          const currentFish = findFishByName(currentName);
          if (!currentFish) break;
          const nextMooch = (currentFish.methods || []).find(x => x && x.type === 'mooch' && x.smallFish);
          if (nextMooch && nextMooch.smallFish) {
            if (nextMooch.bait) baits.unshift(nextMooch.bait);
            fishesSeq.unshift(nextMooch.smallFish);
            currentName = nextMooch.smallFish;
          } else {
            break;
          }
          guard++;
        }
        // 渲染：对每个小鱼，尽量配上对应的鱼饵；若最外层缺少鱼饵，也继续展示小鱼
        for (let i = 0; i < fishesSeq.length; i++) {
          if (i < baits.length) {
            const baitIcon = `./assets/icons/bait/${baits[i]}.webp`;
            chainParts.push(`<img class=\"bait-icon\" src=\"${baitIcon}\" title=\"${baits[i]}\" alt=\"${baits[i]}\" data-tip=\"${baits[i]}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/>`);
            chainParts.push(`<span class=\"chain-arrow\">›</span>`);
          }
          const fishNameNode = fishesSeq[i];
          const fishNode = findFishByName(fishNameNode);
          const fishIcon = `./assets/icons/fishes/${fishNameNode}.webp`;
          chainParts.push(withIndicators(fishIcon, fishNode, fishNameNode));
          chainParts.push(`<span class=\"chain-arrow\">›</span>`);
        }
        // 目标鱼
        chainParts.push(withIndicators(iconUrl, fish, fish.name));
        return `<div class=\"method-chain\">${chainParts.join('')}</div>`;
      }

      // 未知类型兜底
      return '';
    }

    // 按钮事件绑定（桌面端容器）
    // 注意：必须在内容插入到 DOM 之后再绑定事件，否则选择器查询不到按钮，导致点击无效
    // 先不要绑定，等 HTML 注入后在末尾绑定（见本函数最后）
    const methodLines = methods.map(m => renderMethodChain(m)).filter(Boolean);
    // 计算该鱼涉及的所有地图（按 spots 中映射）
    const maps = [];
    for (const s of state.spots) {
      if (Array.isArray(s.fish) && s.fish.includes(fish.name)) {
        const mapName = s.spot || '';
        if (mapName && !maps.includes(mapName)) maps.push(mapName);
      }
    }
    // 构建：地图 -> 可用鱼集合（同一地图多个钓点合并）
    const mapToFishSet = {};
    for (const s of state.spots) {
      const mapName = s.spot || '';
      if (!mapName) continue;
      if (!mapToFishSet[mapName]) mapToFishSet[mapName] = new Set();
      if (Array.isArray(s.fish)) s.fish.forEach(n => mapToFishSet[mapName].add(n));
    }

    function computeFishesSeqForMethod(m) {
      const fishesSeq = [];
      if (m && m.type === 'mooch') {
        if (m.smallFish) fishesSeq.push(m.smallFish);
        let currentName = m.smallFish;
        const visited = new Set();
        let guard = 0;
        while (currentName && guard < 10) {
          if (visited.has(currentName)) break;
          visited.add(currentName);
          const currentFish = findFishByName(currentName);
          if (!currentFish) break;
          const nextMooch = (currentFish.methods || []).find(x => x && x.type === 'mooch' && x.smallFish);
          if (nextMooch && nextMooch.smallFish) {
            fishesSeq.unshift(nextMooch.smallFish);
            currentName = nextMooch.smallFish;
          } else {
            break;
          }
          guard++;
        }
      }
      return fishesSeq;
    }

    function filterMethodsForMap(mapName) {
      const available = mapToFishSet[mapName] || new Set();
      const out = [];
      for (const m of methods) {
        if (!m) continue;
        if (m.type === 'bait') { out.push(m); continue; }
        const seq = computeFishesSeqForMethod(m);
        const ok = seq.every(n => available.has(n));
        if (ok) out.push(m);
      }
      // 若严格筛选为空，回退显示全部钓法，避免数据不全导致"无"
      return out.length ? out : methods.slice();
    }

    // —— 计算用于比较不同钓场推荐优劣的向量（和 renderForMap 内一致） ——
    function getSpotSetFor(mapName, fishName) {
      const set = new Set();
      for (const s of state.spots) {
        const mn = s.spot || '';
        if (mn !== mapName) continue;
        if (Array.isArray(s.fish) && s.fish.includes(fishName)) set.add(s);
      }
      return set;
    }
    function countInterfBaitOnSpots(spotSet, baitName, expectedFishName) {
      const set = new Set();
      spotSet.forEach((s) => {
        if (!Array.isArray(s.fish)) return;
        for (const fname of s.fish) {
          const fo = findFishByName(fname); if (!fo) continue;
          const ds = (fo.methods || []).filter(x => x && x.type === 'bait' && x.bait);
          if (ds.some(x => x.bait === baitName)) set.add(fname);
        }
      });
      set.delete(expectedFishName);
      return set.size;
    }
    function countInterfMoochOnSpots(spotSet, smallFishName, expectedFishName) {
      const set = new Set();
      spotSet.forEach((s) => {
        if (!Array.isArray(s.fish)) return;
        for (const fname of s.fish) {
          const fo = findFishByName(fname); if (!fo) continue;
          const ms = (fo.methods || []).filter(x => x && x.type === 'mooch' && x.smallFish);
          if (ms.some(x => x.smallFish === smallFishName)) set.add(fname);
        }
      });
      set.delete(expectedFishName);
      return set.size;
    }
    function minInterfBaitForFish(mapName, fishName, spotSetForThisFish) {
      const fo = findFishByName(fishName);
      if (!fo) return Number.POSITIVE_INFINITY;
      const baitMethods = (fo.methods || []).filter(x => x && x.type === 'bait' && x.bait);
      if (!baitMethods.length) return 0;
      let best = Number.POSITIVE_INFINITY;
      for (const bm of baitMethods) {
        const c = countInterfBaitOnSpots(spotSetForThisFish, bm.bait || '', fishName);
        if (c < best) best = c;
      }
      return best;
    }
    function buildFullChainAll(m) {
      const seq = []; const bts = [];
      if (m && m.type === 'mooch') {
        let cur = m.smallFish || ''; let cb = m.bait || '';
        if (cur) { seq.unshift(cur); bts.unshift(cb || ''); }
        const visited = new Set(); let guard = 0;
        while (cur && guard < 10) {
          if (visited.has(cur)) break; visited.add(cur);
          const cf = findFishByName(cur); if (!cf) break;
          const nm = (cf.methods || []).find(x => x && x.type === 'mooch' && x.smallFish);
          if (nm && nm.smallFish) { cur = nm.smallFish; seq.unshift(cur); bts.unshift(nm.bait || ''); }
          else break;
          guard++;
        }
      }
      return { seq, baits: bts };
    }
    function cmpVec(a, b) {
      const maxEven = Math.max(Math.ceil((a||[]).length / 2), Math.ceil((b||[]).length / 2));
      for (let k = 0; k < maxEven; k++) {
        const ai = 2*k < (a||[]).length ? a[2*k] : 0;
        const bi = 2*k < (b||[]).length ? b[2*k] : 0;
        if (ai !== bi) return ai - bi;
      }
      if ((a||[]).length !== (b||[]).length) return (a||[]).length - (b||[]).length;
      const maxOdd = Math.max(Math.floor((a||[]).length / 2), Math.floor((b||[]).length / 2));
      for (let k = 0; k < maxOdd; k++) {
        const ai = 2*k+1 < (a||[]).length ? a[2*k+1] : 0;
        const bi = 2*k+1 < (b||[]).length ? b[2*k+1] : 0;
        if (ai !== bi) return ai - bi;
      }
      return 0;
    }
    function computeBestVectorForMap(mapName) {
      const list = filterMethodsForMap(mapName);
      let best = null;
      for (const m of list) {
        let v = [Number.POSITIVE_INFINITY];
        if (m.type === 'bait') {
          const spotSetFinal = getSpotSetFor(mapName, fish.name);
          v = [countInterfBaitOnSpots(spotSetFinal, m.bait || '', fish.name)];
        } else if (m.type === 'mooch') {
          const { seq } = buildFullChainAll(m);
          const vec = [];
          for (let i = seq.length - 1; i >= 0; i--) {
            const nextTarget = (i === seq.length - 1) ? fish.name : seq[i+1];
            const spotSetForNext = getSpotSetFor(mapName, nextTarget);
            vec.push(countInterfMoochOnSpots(spotSetForNext, seq[i], nextTarget));
            vec.push(minInterfBaitForFish(mapName, seq[i], spotSetForNext));
          }
          v = vec;
        }
        if (!best || cmpVec(v, best) < 0) best = v;
      }
      return best || [Number.POSITIVE_INFINITY];
    }
    // 计算各钓场评分并取 Top 3
    const scoredMaps = maps.map(m => ({ name: m, vec: computeBestVectorForMap(m) }));
    scoredMaps.sort((a,b) => cmpVec(a.vec, b.vec));
    const mapsToShow = scoredMaps.slice(0, 3).map(x => x.name);

    function renderForMap(mapName) {
      const list = filterMethodsForMap(mapName);
      if (!list.length) return '<div class="empty-state"><p>无</p></div>';
      // 通用推荐（支持 bait 和 mooch）：构造干扰向量并做字典序最小比较
      function getSpotSet(mapName, fishName) {
        const set = new Set();
        for (const s of state.spots) {
          const mn = s.spot || '';
          if (mn !== mapName) continue;
          if (Array.isArray(s.fish) && s.fish.includes(fishName)) set.add(s);
        }
        return set;
      }
      function countInterfBaitOnSpots(spotSet, baitName, expectedFishName) {
        const set = new Set();
        spotSet.forEach((s) => {
          if (!Array.isArray(s.fish)) return;
          for (const fname of s.fish) {
            const fo = findFishByName(fname); if (!fo) continue;
            const ds = (fo.methods || []).filter(x => x && x.type === 'bait' && x.bait);
            if (ds.some(x => x.bait === baitName)) set.add(fname);
          }
        });
        set.delete(expectedFishName);
        return set.size;
      }
      function countInterfMoochOnSpots(spotSet, smallFishName, expectedFishName) {
        const set = new Set();
        spotSet.forEach((s) => {
          if (!Array.isArray(s.fish)) return;
          for (const fname of s.fish) {
            const fo = findFishByName(fname); if (!fo) continue;
            const ms = (fo.methods || []).filter(x => x && x.type === 'mooch' && x.smallFish);
            if (ms.some(x => x.smallFish === smallFishName)) set.add(fname);
          }
        });
        set.delete(expectedFishName);
        return set.size;
      }
      function minInterfBaitForFish(mapName, fishName, spotSetForThisFish) {
        const fo = findFishByName(fishName);
        if (!fo) return Number.POSITIVE_INFINITY;
        const baitMethods = (fo.methods || []).filter(x => x && x.type === 'bait' && x.bait);
        if (!baitMethods.length) return 0;
        let best = Number.POSITIVE_INFINITY;
        for (const bm of baitMethods) {
          const c = countInterfBaitOnSpots(spotSetForThisFish, bm.bait || '', fishName);
          if (c < best) best = c;
        }
        return best;
      }
      function buildFullChain(m) {
        const seq = []; const bts = [];
        if (m && m.type === 'mooch') {
          let cur = m.smallFish || ''; let cb = m.bait || '';
          if (cur) { seq.unshift(cur); bts.unshift(cb || ''); }
          const visited = new Set(); let guard = 0;
          while (cur && guard < 10) {
            if (visited.has(cur)) break; visited.add(cur);
            const cf = findFishByName(cur); if (!cf) break;
            const nm = (cf.methods || []).find(x => x && x.type === 'mooch' && x.smallFish);
            if (nm && nm.smallFish) { cur = nm.smallFish; seq.unshift(cur); bts.unshift(nm.bait || ''); }
            else break;
            guard++;
          }
        }
        return { seq, baits: bts };
      }
      function vectorForRanking(m) {
        if (!m) return [Number.POSITIVE_INFINITY];
        if (m.type === 'bait') {
          const spotSetFinal = getSpotSet(mapName, fish.name);
          return [countInterfBaitOnSpots(spotSetFinal, m.bait || '', fish.name)];
        }
        if (m.type === 'mooch') {
          const { seq, baits } = buildFullChain(m);
          const vec = [];
          for (let i = seq.length - 1; i >= 0; i--) {
            const nextTarget = (i === seq.length - 1) ? fish.name : seq[i+1];
            const spotSetForNext = getSpotSet(mapName, nextTarget);
            vec.push(countInterfMoochOnSpots(spotSetForNext, seq[i], nextTarget));
            // 对获取小鱼的鱼饵选择最优（干扰鱼最少），仅在将要钓到 nextTarget 的地点集合中评估
            const bestBaitInterf = minInterfBaitForFish(mapName, seq[i], spotSetForNext);
            vec.push(bestBaitInterf);
          }
          return vec;
        }
        return [Number.POSITIVE_INFINITY];
      }
      function vectorForDisplay(m) {
        if (!m) return [Number.POSITIVE_INFINITY];
        if (m.type === 'bait') {
          const spotSetFinal = getSpotSet(mapName, fish.name);
          return [countInterfBaitOnSpots(spotSetFinal, m.bait || '', fish.name)];
        }
        if (m.type === 'mooch') {
          const { seq, baits } = buildFullChain(m);
          const vec = [];
          for (let i = seq.length - 1; i >= 0; i--) {
            const nextTarget = (i === seq.length - 1) ? fish.name : seq[i+1];
            const spotSetForNext = getSpotSet(mapName, nextTarget);
            vec.push(countInterfMoochOnSpots(spotSetForNext, seq[i], nextTarget));
            const actualBait = baits[i] || '';
            vec.push(actualBait ? countInterfBaitOnSpots(spotSetForNext, actualBait, seq[i]) : 0);
          }
          return vec;
        }
        return [Number.POSITIVE_INFINITY];
      }
      function cmpVec(a, b) {
        // 先比较所有"mooch 段"（偶数位：0,2,4,...)，忽略鱼饵段，符合方案A
        const maxEven = Math.max(Math.ceil(a.length / 2), Math.ceil(b.length / 2));
        for (let k = 0; k < maxEven; k++) {
          const ai = 2 * k < a.length ? a[2 * k] : 0;
          const bi = 2 * k < b.length ? b[2 * k] : 0;
          if (ai !== bi) return ai - bi;
        }
        // mooch 段完全一致时，再用链路长度裁决（更短优先）
        if (a.length !== b.length) return a.length - b.length;
        // 若仍相等，最后才比较鱼饵段（奇数位）
        const maxOdd = Math.max(Math.floor(a.length / 2), Math.floor(b.length / 2));
        for (let k = 0; k < maxOdd; k++) {
          const ai = 2 * k + 1 < a.length ? a[2 * k + 1] : 0;
          const bi = 2 * k + 1 < b.length ? b[2 * k + 1] : 0;
          if (ai !== bi) return ai - bi;
        }
        return 0;
      }
      const vectorMap = new Map();
      const vectorMapDisplay = new Map();
      let recommendedList = []; let bestVec = null;
      for (const m of list) {
        const v = vectorForRanking(m); vectorMap.set(m, v);
        vectorMapDisplay.set(m, vectorForDisplay(m));
        if (!bestVec || cmpVec(v, bestVec) < 0) { bestVec = v; recommendedList = [m]; }
        else if (cmpVec(v, bestVec) === 0) { recommendedList.push(m); }
      }
      const recommendHeader = recommendedList.length ? `<div class=\"subsection-title\">推荐钓法 <span class=\"recommend-badge\">干扰鱼最少</span></div>` : '';
      const recommendBlock = recommendedList.length ? `<div class=\"method-list\">${recommendedList.map(x=>renderMethodChain(x)).join('')}</div>` : '';
      // 取该 spot 对应的 level2 作为地图标题
      const mapMeta = (state.spots.find(s => (s.spot||'') === mapName) || {});
      const mapTitle = mapMeta.level2 || '';
      const mapImgSrc = `./assets/icons/map/${mapName}.webp`;
      const allHeader = `<button class=\"toggle-chip\" id=\"toggleAllBtn\" aria-expanded=\"false\"><span class=\"arrow\">▶</span> 全部钓法</button>`;
      const allBlock = `<div class=\"all-block collapsed\" id=\"allMethods\"><div class=\"method-list\">${list.map(x=>renderMethodChain(x)).join('')}</div></div>`;
      const mapBlock = `<div class=\"spot-map\">${mapTitle ? `<div class=\"spot-map-title\">地点：${mapTitle}</div>` : ''}<img class=\"spot-map-img\" src=\"${mapImgSrc}\" alt=\"${mapTitle || mapName}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/></div>`;
      return recommendHeader + recommendBlock + allHeader + allBlock + mapBlock;
    }

    const timeText = fish.time && /全天可钓/.test(fish.time) ? '全天可钓' : (fish.time || '—');
    const weatherTags = renderWeatherTags(fish.weather);

    const id = String(fish.id || fish.name);
    const isCompleted = state.completed.has(id);
    const isPinned = state.pinned.has(id);
    const isCollectable = String(fish.collectable || '无').trim() !== '无';
    const collectBadge = isCollectable ? `<img class=\"collect-badge\" src=\"./assets/icons/others/collection.webp\" alt=\"收藏品\" title=\"收藏品：${fish.collectable}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/>` : '';
    const completeIconUrl = './assets/icons/button/complete.webp';
    const pinIconUrl = isPinned ? './assets/icons/button/settop_on.webp' : './assets/icons/button/settop_off.webp';

    el.fishDetail.innerHTML = `
      <div class="detail-container">
        <div class="detail-card detail-header">
          <img class="fish-icon lg" src="${iconUrl}" alt="${fish.name}" style="opacity: 1;" onerror="this.style.display='none'" />
          <div class="detail-title">${fish.name}${collectBadge}</div>
          <div class="detail-actions">
            <button class="spoil-btn" title="战利品">
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
          <div class="detail-grid">
            <div class="field-row"><span class="tag">等级</span> <strong>${fish.level ?? '—'}</strong></div>
            <div class="field-row"><span class="tag">时间</span> <span class="tag tag-time">${timeText}</span></div>
            <div class="field-row"><span class="tag">天气</span> ${weatherTags || '无'}</div>
            ${fish.rod ? `<div class="field-row"><span class="tag">杆型</span> <img class="rod-icon meta-icon" style="image-rendering:auto;" src="./assets/icons/type/${rodIconMap[fish.rod] || ''}" alt="${fish.rod}" onerror="this.style.display='none'"/> ${fish.rod}</div>` : ''}
            ${fish.hook ? `<div class=\"field-row\"><span class=\"tag\">拉杆</span> <img class=\"hook-icon meta-icon\" src=\"./assets/icons/skill/${hookIconMap[fish.hook] || ''}\" alt=\"${fish.hook}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/> ${fish.hook}</div>` : ''}
            ${(() => {
              const c = String(fish.collectable || '无').trim();
              if (c === '大地红票' || c === '大地蓝票') {
                const icon = `./assets/icons/current/${c}.webp`;
                return `<div class=\"field-row\"><span class=\"tag\">收藏品</span> <img class=\"current-icon meta-icon\" src=\"${icon}\" alt=\"${c}\" loading=\"lazy\" onerror=\"this.style.display='none'\"/> ${c}</div>`;
              }
              return `<div class=\"field-row\"><span class=\"tag\">收藏品</span> ${c || '无'}</div>`;
            })()}
          </div>
        </div>
        <div class="detail-card">
          <div class="section-title">钓取方式</div>
          ${maps.length > 1 ? `
          <div class="folder">
            <div class="folder-tabs" id="mapTabs">${mapsToShow.map((m,i)=>`<div class=\"tab ${i===0?'active':''}\" data-name=\"${m}\">${m}</div>`).join('')}${(maps.length>mapsToShow.length)?`<div class=\"tab tab-more\" id=\"mapMoreBtn\">…</div>`:''}<span class=\"more-tabs collapsed\" id=\"mapMoreWrap\">${(maps.length>mapsToShow.length)?maps.filter(n=>!mapsToShow.includes(n)).map(m=>`<div class=\"tab\" data-name=\"${m}\">${m}</div>`).join(''):''}</span></div>
            <div class="folder-body" id="mapBody">${renderForMap(mapsToShow[0])}</div>
          </div>` : `
          ${renderForMap(mapsToShow[0] || '')}`}
        </div>
      </div>`;

    // 绑定详情操作按钮（确保 HTML 已经插入 DOM 后再绑定）
    bindDetailActionsIn(el.fishDetail, fish);

    // 标签切换：按地图筛选展示
    if (mapsToShow.length >= 1) {
      const tabs = el.fishDetail.querySelectorAll('.folder-tabs .tab');
      const body = el.fishDetail.querySelector('#mapBody');
      const moreBtn = el.fishDetail.querySelector('#mapMoreBtn');
      const moreWrap = el.fishDetail.querySelector('#mapMoreWrap');
      if (moreBtn && moreWrap) {
        moreBtn.addEventListener('click', () => {
          moreWrap.classList.toggle('collapsed');
        });
      }
      tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mapName = tab.getAttribute('data-name');
        body.innerHTML = renderForMap(mapName);
        // 切换钓场后需要重新绑定"全部钓法"折叠/展开
        bindAllToggle();
      }));
    }

    // 绑定"全部钓法"折叠/展开（在初次渲染和每次切换钓场后都需要重绑）
    function bindAllToggle() {
      const toggleBtn = el.fishDetail.querySelector('#toggleAllBtn');
      const allBlockEl = el.fishDetail.querySelector('#allMethods');
      if (!toggleBtn || !allBlockEl) return;
      toggleBtn.onclick = () => {
        const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        toggleBtn.setAttribute('aria-expanded', String(next));
        allBlockEl.classList.toggle('collapsed', !next);
      };
    }
    bindAllToggle();
  }

  // ---------- 事件与周期任务 ----------
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

  function setupEvents() {
    // 证件头可折叠/展开
    const profilePanel = document.getElementById('userProfile');
    const profileHeader = document.getElementById('userProfileHeader');
    if (profilePanel && profileHeader) {
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
      const COLL_KEY = isMobile ? 'mcfisher-profile-collapsed-m' : 'mcfisher-profile-collapsed';
      // 首次默认折叠；有记录则按记录恢复（移动端与桌面端独立记录）
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
    el.themeToggle.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', state.theme);
      el.themeToggle.querySelector('i').className = state.theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
      localStorage.setItem('mcfisher-theme', state.theme);
    });

    if (el.settingsToggle) {
      el.settingsToggle.addEventListener('click', () => {
        // 设置菜单：导出 / 导入（垂直排列，纯色底，高层级）
        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.top = '72px';
        menu.style.right = '18px';
        // 纯色底：使用主题主色，不透明
        menu.style.background = 'var(--ff14-primary)';
        menu.style.opacity = '1';
        menu.style.backdropFilter = 'none';
        menu.style.border = '2px solid var(--ff14-border)';
        menu.style.borderRadius = '12px';
        menu.style.boxShadow = '0 14px 34px rgba(0,0,0,.28)';
        menu.style.padding = '12px';
        menu.style.zIndex = '2147483647';
        menu.style.minWidth = '180px';
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

    const importInput = document.getElementById('importDataInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) importLocalData(file);
        importInput.value = '';
      });
    }

    el.fishSearch.addEventListener('input', (e) => {
      state.searchText = e.target.value || '';
      applyFilter();
      renderFishList();
    });

    // 筛选浮窗
    if (el.filterBtn && el.filterModal) {
      el.filterBtn.addEventListener('click', (e) => {
        el.filterModal.classList.remove('hidden');
        // 将浮窗定位到按钮附近
        const rect = el.filterBtn.getBoundingClientRect();
        const panel = el.filterModal.querySelector('.filter-modal-content');
        if (panel) {
          const top = rect.bottom + 8 + window.scrollY;
          const left = Math.min(window.innerWidth - 20, rect.left + window.scrollX + 0);
          panel.style.top = `${top}px`;
          panel.style.left = `${left}px`;
        }
      });
    }
    if (el.filterClose && el.filterModal) {
      el.filterClose.addEventListener('click', () => el.filterModal.classList.add('hidden'));
    }
    if (el.filterModal) {
      el.filterModal.addEventListener('click', (e) => {
        if (e.target === el.filterModal) el.filterModal.classList.add('hidden');
      });
      el.filterModal.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const key = chip.getAttribute('data-key');
        const val = chip.getAttribute('data-value');
        // 分组至少保留一个激活：统计同组当前激活数量
        const group = chip.parentElement;
        const activeCount = group ? group.querySelectorAll('.chip.active').length : 0;
        const willTurnOff = chip.classList.contains('active');
        if (willTurnOff && activeCount <= 1) {
          chip.classList.add('deny');
          setTimeout(() => chip.classList.remove('deny'), 400);
          return; // 阻止关掉最后一个
        }
        chip.classList.toggle('active');
        const on = chip.classList.contains('active');
        switch (key) {
          case 'version':
            if (on) state.filters.versions.add(val); else state.filters.versions.delete(val);
            break;
          case 'rarity':
            if (on) state.filters.rarity.add(val); else state.filters.rarity.delete(val);
            break;
          case 'condition':
            if (on) state.filters.condition.add(val); else state.filters.condition.delete(val);
            break;
          case 'completion':
            if (on) state.filters.completion.add(val); else state.filters.completion.delete(val);
            break;
          case 'collect':
            if (on) state.filters.collect.add(val); else state.filters.collect.delete(val);
            break;
        }
        applyFilter();
        renderFishList();
      });
    }

    // 移动端上浮窗关闭
    const m = document.getElementById('detailModal');
    const mClose = document.getElementById('detailModalClose');
    if (m && mClose) {
      mClose.addEventListener('click', () => { m.classList.remove('show'); m.classList.add('hidden'); });
      m.addEventListener('click', (e) => { if (e.target === m) { m.classList.remove('show'); m.classList.add('hidden'); } });
    }

    // 个人信息栏：昵称 + 头像 本地存储
    const NICK_KEY = 'mcfisher-user-nickname';
    const AVATAR_KEY = 'mcfisher-user-avatar'; // dataURL

    if (el.userNickname) {
      const saveNick = debounce(() => {
        try { localStorage.setItem(NICK_KEY, el.userNickname.textContent || ''); } catch (_) {}
      }, 300);
      el.userNickname.addEventListener('input', saveNick);
      // 失焦时立即保存
      el.userNickname.addEventListener('blur', () => {
        try { localStorage.setItem(NICK_KEY, el.userNickname.textContent || ''); } catch (_) {}
      });
    }

    // 点击头像打开文件选择
    if (el.userAvatar && el.avatarFile) {
      el.userAvatar.addEventListener('click', () => el.avatarFile.click());
    }
    // 移动端圆形头像上传
    const userAvatarMobile = document.getElementById('userAvatarMobile');
    const avatarFileMobile = document.getElementById('avatarFileMobile');
    if (userAvatarMobile && avatarFileMobile) {
      userAvatarMobile.addEventListener('click', () => avatarFileMobile.click());
    }

    // 头像裁剪：文件选择后弹窗并允许缩放/拖拽裁剪
    const modal = document.getElementById('avatarModal');
    const canvas = document.getElementById('avatarCanvas');
    const zoom = document.getElementById('avatarZoom');
    const btnCancel = document.getElementById('avatarCancel');
    const btnSave = document.getElementById('avatarSave');
    // 圆形裁剪（移动端）
    const modalM = document.getElementById('avatarModalMobile');
    const canvasM = document.getElementById('avatarCanvasMobile');
    const zoomM = document.getElementById('avatarZoomMobile');
    const btnCancelM = document.getElementById('avatarCancelMobile');
    const btnSaveM = document.getElementById('avatarSaveMobile');
    const ctxM = canvasM ? canvasM.getContext('2d') : null;
    let imgM = null; let imgMX = 0; let imgMY = 0; let imgMScale = 1; let draggingM = false; let dragStartMX = 0; let dragStartMY = 0;

    function drawCanvasMobile() {
      if (!ctxM || !imgM) return;
      const { width, height } = canvasM;
      ctxM.clearRect(0,0,width,height);
      ctxM.fillStyle = '#222';
      ctxM.fillRect(0,0,width,height);
      const w = imgM.width * imgMScale; const h = imgM.height * imgMScale;
      ctxM.drawImage(imgM, imgMX - w/2, imgMY - h/2, w, h);
      // 圆形遮罩
      ctxM.save();
      ctxM.globalCompositeOperation = 'destination-in';
      const r = Math.min(width, height) * 0.48;
      ctxM.beginPath(); ctxM.arc(width/2, height/2, r, 0, Math.PI*2); ctxM.fill();
      ctxM.restore();
      // 辅助圈
      ctxM.strokeStyle = '#c9a86a'; ctxM.lineWidth = 3; ctxM.beginPath(); ctxM.arc(width/2, height/2, r, 0, Math.PI*2); ctxM.stroke();
    }

    function openModalWithFileMobile(file) {
      if (!modalM || !canvasM) return;
      imgM = new Image();
      imgM.onload = () => {
        const baseScale = Math.max(canvasM.width / imgM.width, canvasM.height / imgM.height);
        imgMScale = Math.max(baseScale, 1);
        if (zoomM) { zoomM.min = String(baseScale * 0.6); zoomM.max = String(Math.max(baseScale * 4, 3)); zoomM.step = '0.01'; zoomM.value = String(imgMScale); }
        imgMX = canvasM.width / 2; imgMY = canvasM.height / 2; drawCanvasMobile();
      };
      imgM.src = URL.createObjectURL(file);
      modalM.classList.remove('hidden');
    }

    if (avatarFileMobile) {
      avatarFileMobile.addEventListener('change', () => {
        const file = avatarFileMobile.files && avatarFileMobile.files[0];
        if (file) openModalWithFileMobile(file);
        avatarFileMobile.value = '';
      });
    }

    if (canvasM) {
      const startDrag = (x, y) => { draggingM = true; dragStartMX = x; dragStartMY = y; };
      const moveDrag = (x, y) => { if (!draggingM || !imgM) return; imgMX += (x - dragStartMX); imgMY += (y - dragStartMY); dragStartMX = x; dragStartMY = y; drawCanvasMobile(); };
      const endDrag = () => { draggingM = false; };
      // 鼠标
      canvasM.addEventListener('mousedown', (e) => startDrag(e.offsetX, e.offsetY));
      canvasM.addEventListener('mousemove', (e) => moveDrag(e.offsetX, e.offsetY));
      window.addEventListener('mouseup', endDrag);
      // 触摸
      canvasM.addEventListener('touchstart', (e) => { const t = e.touches[0]; const rect = canvasM.getBoundingClientRect(); startDrag(t.clientX - rect.left, t.clientY - rect.top); }, { passive: true });
      canvasM.addEventListener('touchmove', (e) => { const t = e.touches[0]; const rect = canvasM.getBoundingClientRect(); moveDrag(t.clientX - rect.left, t.clientY - rect.top); }, { passive: true });
      window.addEventListener('touchend', endDrag, { passive: true });
      canvasM.addEventListener('wheel', (e) => { if (!imgM) return; e.preventDefault(); const delta = e.deltaY < 0 ? 1.05 : 0.95; imgMScale = Math.max(0.2, Math.min(5, imgMScale * delta)); if (zoomM) zoomM.value = String(imgMScale); drawCanvasMobile(); }, { passive: false });
    }
    if (zoomM) { zoomM.addEventListener('input', () => { imgMScale = parseFloat(zoomM.value || '1'); drawCanvasMobile(); }); }
    if (btnCancelM && modalM) { btnCancelM.addEventListener('click', () => { modalM.classList.add('hidden'); if (imgM && imgM.src) URL.revokeObjectURL(imgM.src); imgM = null; }); }
    if (btnSaveM && modalM) { btnSaveM.addEventListener('click', () => { if (!canvasM) return; const dataUrl = canvasM.toDataURL('image/png'); if (userAvatarMobile) userAvatarMobile.src = dataUrl; try { localStorage.setItem('mcfisher-user-avatar-mobile', dataUrl); } catch (_) {} modalM.classList.add('hidden'); if (imgM && imgM.src) URL.revokeObjectURL(imgM.src); imgM = null; }); }
    const ctx = canvas ? canvas.getContext('2d') : null;
    let img = null; let imgX = 0; let imgY = 0; let imgScale = 1; let dragging = false; let dragStartX = 0; let dragStartY = 0;

    function getTargetAspect() {
      // 目标为页面中的 .avatar-wrap 比例（宽/高），竖向矩形时 < 1
      const wrap = document.querySelector('.avatar-wrap');
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) return r.width / r.height;
      }
      // 兜底采用接近证件照的比例（竖向）
      return 0.78; // 约等于 7:9
    }

    function computeMaskRect() {
      const { width, height } = canvas;
      const margin = 12;
      const availW = width - margin * 2;
      const availH = height - margin * 2;
      const ar = getTargetAspect();
      let w = availW, h = availH;
      if (availW / availH > ar) {
        // 画布更宽，以高度为准
        h = availH;
        w = h * ar;
      } else {
        w = availW;
        h = w / ar;
      }
      const x = (width - w) / 2;
      const y = (height - h) / 2;
      return { x, y, w, h, r: 14 };
    }

    let lastMaskRect = null;

    function drawCanvas() {
      if (!ctx || !img) return;
      const { width, height } = canvas;
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle = '#222';
      ctx.fillRect(0,0,width,height);
      const w = img.width * imgScale; const h = img.height * imgScale;
      ctx.drawImage(img, imgX - w/2, imgY - h/2, w, h);
      // 方形（圆角）预览遮罩，和页面方形头像框保持一致（竖向）
      const mask = computeMaskRect();
      lastMaskRect = mask;
      function roundRectPath(ctx, x, y, w, h, r) {
        const rr2 = Math.min(r, w/2, h/2);
        ctx.beginPath();
        ctx.moveTo(x + rr2, y);
        ctx.lineTo(x + w - rr2, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr2);
        ctx.lineTo(x + w, y + h - rr2);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr2, y + h);
        ctx.lineTo(x + rr2, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr2);
        ctx.lineTo(x, y + rr2);
        ctx.quadraticCurveTo(x, y, x + rr2, y);
        ctx.closePath();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      roundRectPath(ctx, mask.x, mask.y, mask.w, mask.h, mask.r);
      ctx.fill();
      ctx.restore();
      // 辅助虚线边框
      ctx.save();
      ctx.strokeStyle = '#c9a86a';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      roundRectPath(ctx, mask.x, mask.y, mask.w, mask.h, mask.r);
      ctx.stroke();
      ctx.restore();
    }

    function openModalWithFile(file) {
      if (!modal || !canvas) return;
      img = new Image();
      img.onload = () => {
        const mask = computeMaskRect();
        // 使图片至少覆盖遮罩区域
        const baseScale = Math.max(mask.w / img.width, mask.h / img.height);
        imgScale = Math.max(baseScale, 1);
        if (zoom) {
          zoom.min = String(baseScale * 0.6);
          zoom.max = String(Math.max(baseScale * 4, 3));
          zoom.step = '0.01';
          zoom.value = String(imgScale);
        }
        imgX = canvas.width / 2; imgY = canvas.height / 2;
        drawCanvas();
      };
      img.src = URL.createObjectURL(file);
      modal.classList.remove('hidden');
    }

    if (el.avatarFile) {
      el.avatarFile.addEventListener('change', () => {
        const file = el.avatarFile.files && el.avatarFile.files[0];
        if (file) openModalWithFile(file);
        el.avatarFile.value = '';
      });
    }

    if (canvas) {
      canvas.addEventListener('mousedown', (e) => { dragging = true; dragStartX = e.offsetX; dragStartY = e.offsetY; });
      canvas.addEventListener('mousemove', (e) => {
        if (!dragging || !img) return;
        imgX += (e.offsetX - dragStartX);
        imgY += (e.offsetY - dragStartY);
        dragStartX = e.offsetX; dragStartY = e.offsetY; drawCanvas();
      });
      window.addEventListener('mouseup', () => { dragging = false; });
      canvas.addEventListener('wheel', (e) => {
        if (!img) return; e.preventDefault();
        const delta = e.deltaY < 0 ? 1.05 : 0.95;
        const mask = lastMaskRect || computeMaskRect();
        imgScale = Math.max(Math.max(mask.w / img.width, mask.h / img.height), Math.min(5, imgScale * delta));
        if (zoom) zoom.value = String(imgScale);
        drawCanvas();
      }, { passive: false });
    }

    if (zoom) {
      zoom.addEventListener('input', () => { imgScale = parseFloat(zoom.value || '1'); drawCanvas(); });
    }

    if (btnCancel && modal) {
      btnCancel.addEventListener('click', () => { modal.classList.add('hidden'); if (img && img.src) URL.revokeObjectURL(img.src); img = null; });
    }

    if (btnSave && modal) {
      btnSave.addEventListener('click', () => {
        if (!canvas) return;
        // 根据遮罩区域裁剪导出，保证与竖向方形一致
        const mask = lastMaskRect || computeMaskRect();
        const out = document.createElement('canvas');
        out.width = Math.round(mask.w);
        out.height = Math.round(mask.h);
        const octx = out.getContext('2d');
        // 将当前画布中的像素剪裁过来
        const pixels = ctx.getImageData(mask.x, mask.y, mask.w, mask.h);
        octx.putImageData(pixels, 0, 0);
        const dataUrl = out.toDataURL('image/png');
        if (el.userAvatar) el.userAvatar.src = dataUrl;
        try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch (_) {}
        modal.classList.add('hidden');
        if (img && img.src) URL.revokeObjectURL(img.src);
        img = null;
      });
    }

    // 钓取方式：自定义悬浮提示
    let tooltipEl = null;
    function showTooltip(text, x, y) {
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tooltip-floating';
        document.body.appendChild(tooltipEl);
      }
      tooltipEl.textContent = text || '';
      if (!text) { tooltipEl.style.display = 'none'; return; }
      // 先展示到屏幕外以便准确测量尺寸
      tooltipEl.style.visibility = 'hidden';
      tooltipEl.style.display = 'block';
      const padding = 12;
      const vw = window.innerWidth; const vh = window.innerHeight;
      let left = x + 14; let top = y + 12;
      const rect = tooltipEl.getBoundingClientRect();
      if (left + rect.width + padding > vw) left = Math.max(padding, vw - rect.width - padding);
      if (top + rect.height + padding > vh) top = Math.max(padding, vh - rect.height - padding);
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.visibility = 'visible';
    }
    function hideTooltip() {
      if (tooltipEl) tooltipEl.style.display = 'none';
    }
    document.body.addEventListener('mouseover', (e) => {
      const target = e.target;
      const isTipTarget = target && target.classList && (target.classList.contains('bait-icon') || target.classList.contains('weather-icon'));
      if (isTipTarget) {
        const title = target.getAttribute('data-tip') || target.getAttribute('title') || target.getAttribute('alt') || '';
        // 使用 clientX/clientY 与 position:fixed 对齐，避免滚动导致位置异常
        if (title) showTooltip(title, e.clientX, e.clientY);
      }
    });
    document.body.addEventListener('mousemove', (e) => {
      if (tooltipEl && tooltipEl.style.display === 'block') {
        const padding = 12;
        const vw = window.innerWidth; const vh = window.innerHeight;
        // 使用视口坐标（clientX/Y）与 position:fixed 对齐
        let left = e.clientX + 14; let top = e.clientY + 12;
        const rect = tooltipEl.getBoundingClientRect();
        if (left + rect.width + padding > vw) left = vw - rect.width - padding;
        if (top + rect.height + padding > vh) top = vh - rect.height - padding;
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
      }
    });
    document.body.addEventListener('mouseout', (e) => {
      const target = e.target;
      const isTipTarget = target && target.classList && (target.classList.contains('bait-icon') || target.classList.contains('weather-icon'));
      if (isTipTarget) {
        hideTooltip();
      }
    });

    setInterval(() => {
      updateEorzeaClock();
      // 列表倒计时刷新
      if (state.filtered.length) renderFishList();
      // 进度刷新（处理跨端/多标签完成状态变动）
      updateFishingProgress();
    }, 1000);
  }

  function loadPreferences() {
    state.theme = localStorage.getItem('mcfisher-theme') || 'dark';
    document.body.setAttribute('data-theme', state.theme);
    el.themeToggle.querySelector('i').className = state.theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';

    // 读取个人信息
    try {
      const nick = localStorage.getItem('mcfisher-user-nickname') || '';
      if (el.userNickname && nick) el.userNickname.textContent = nick;
      const avatarData = localStorage.getItem('mcfisher-user-avatar') || '';
      if (el.userAvatar) {
        if (avatarData) el.userAvatar.src = avatarData; else el.userAvatar.src = './assets/icons/profile.webp';
      }
      const avatarMobileData = localStorage.getItem('mcfisher-user-avatar-mobile') || '';
      const userAvatarMobile = document.getElementById('userAvatarMobile');
      if (userAvatarMobile) {
        if (avatarMobileData) userAvatarMobile.src = avatarMobileData; else userAvatarMobile.src = './assets/icons/profile.webp';
      }
      // 战利品读取并渲染
      loadLoot();
      renderLootGrid();
      // 设置证件信息（编号/发证日期/世界）
      const certKey = 'mcfisher-cert-id';
      let certId = localStorage.getItem(certKey);
      if (!certId) {
        certId = 'FF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        try { localStorage.setItem(certKey, certId); } catch (_) {}
      }
      const issueKey = 'mcfisher-issue-date';
      let issueDate = localStorage.getItem(issueKey);
      if (!issueDate) {
        const d = new Date();
        issueDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        try { localStorage.setItem(issueKey, issueDate); } catch (_) {}
      }
      const worldKey = 'mcfisher-user-world';
      const world = localStorage.getItem(worldKey) || '';
      const titleKey = 'mcfisher-user-title';
      const progressKey = 'mcfisher-user-progress';
      const certEl = document.getElementById('userCertId');
      const issueEl = document.getElementById('userIssueDate');
      const worldEl = document.getElementById('userWorld');
      const titleEl = document.getElementById('userTitle');
      const progressEl = document.getElementById('userProgress');
      if (certEl) {
        certEl.contentEditable = 'true';
        certEl.textContent = certId;
        certEl.addEventListener('blur', () => {
          const v = certEl.textContent || '';
          try { localStorage.setItem(certKey, v); } catch(_){}
        });
      }
      if (issueEl) {
        issueEl.contentEditable = 'true';
        issueEl.textContent = issueDate;
        issueEl.addEventListener('blur', () => {
          const v = issueEl.textContent || '';
          try { localStorage.setItem(issueKey, v); } catch(_){}
        });
      }
      if (worldEl) {
        worldEl.contentEditable = 'true';
        if (world) worldEl.textContent = world;
        worldEl.addEventListener('blur', () => {
          try { localStorage.setItem(worldKey, worldEl.textContent || ''); } catch(_){}
        });
      }
      if (titleEl) {
        const title = localStorage.getItem(titleKey) || '';
        if (title) titleEl.textContent = title;
        titleEl.addEventListener('blur', () => {
          try { localStorage.setItem(titleKey, titleEl.textContent || ''); } catch(_){}
        });
      }
      if (progressEl) {
        const progress = localStorage.getItem(progressKey) || '';
        if (progress) progressEl.textContent = progress;
        progressEl.addEventListener('blur', () => {
          try { localStorage.setItem(progressKey, progressEl.textContent || ''); } catch(_){ }
        });
      }
      // 读取完成状态
      state.completed.clear();
      const prefix = 'mcfisher-completed-';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && localStorage.getItem(k) === '1') {
          state.completed.add(k.slice(prefix.length));
        }
      }

      // 读取置顶状态
      state.pinned.clear();
      const ppx = 'mcfisher-pinned-';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(ppx) && localStorage.getItem(k) === '1') {
          state.pinned.add(k.slice(ppx.length));
        }
      }
      // 同步一次进度展示
      updateFishingProgress();
    } catch (_) { /* ignore */ }
  }

  async function init() {
    // 立即启用基础功能，避免等待图片加载
    loadPreferences();
    setupEvents();
    updateEorzeaClock();
    setInterval(updateEorzeaClock, 1000);
    
    // 并行加载关键资源和数据
    try {
      // 预加载关键图片（不阻塞）
      preloadCriticalImages();
      
      // 加载数据
      await loadFishData();
      // 每隔5分钟刷新数据（减少频率提升性能）
      setInterval(loadFishData, 5 * 60 * 1000);
    } catch (err) {
      console.error(err);
      el.fishList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>无法加载鱼类数据</p>
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();


