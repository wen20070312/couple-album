// ============================================================
// 主应用逻辑
// ============================================================
(function () {
  const CFG = window.COUPLE_CONFIG;
  const MEDIA = window.MEDIA || { photos: [], videos: [] };

  // ---------- 视图切换 ----------
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = {
    home: document.getElementById('view-home'),
    photos: document.getElementById('view-photos'),
    videos: document.getElementById('view-videos'),
    timeline: document.getElementById('view-timeline')
  };

  function switchView(name) {
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  }

  navBtns.forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

  // ---------- 在一起天数 ----------
  function daysBetween(a, b) {
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  function renderDays() {
    const start = new Date(CFG.anniversary + 'T00:00:00');
    const now = new Date();
    const days = daysBetween(start, now);
    const el = document.getElementById('days-counter');
    if (days >= 0) {
      el.textContent = `我们在一起的第 ${days} 天`;
    } else {
      el.textContent = '爱你的每一天';
    }
    document.getElementById('stat-days').textContent = days >= 0 ? days : '∞';
  }

  // ---------- 每日情话 ----------
  function renderLoveLine() {
    const lines = CFG.loveLines || [];
    if (!lines.length) return;
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const line = lines[dayIndex % lines.length];
    document.getElementById('love-line').textContent = '“' + line + '”';
  }

  // ---------- 照片墙 ----------
  function renderPhotos() {
    const grid = document.getElementById('photo-grid');
    const empty = document.getElementById('photos-empty');
    grid.innerHTML = '';
    const photos = MEDIA.photos || [];
    document.getElementById('stat-photos').textContent = photos.length;

    if (!photos.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    photos.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      const img = document.createElement('img');
      img.src = p.src;
      img.alt = p.caption || '照片';
      img.loading = 'lazy';
      card.appendChild(img);
      if (p.caption) {
        const cap = document.createElement('div');
        cap.className = 'photo-caption';
        cap.textContent = p.caption;
        card.appendChild(cap);
      }
      card.addEventListener('click', () => openLightbox(p));
      grid.appendChild(card);
    });
  }

  // ---------- 视频墙 ----------
  function renderVideos() {
    const list = document.getElementById('video-list');
    const empty = document.getElementById('videos-empty');
    list.innerHTML = '';
    const videos = MEDIA.videos || [];
    document.getElementById('stat-videos').textContent = videos.length;

    if (!videos.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    videos.forEach((v, i) => {
      const item = document.createElement('div');
      item.className = 'video-item';
      const video = document.createElement('video');
      video.src = v.src;
      video.controls = true;
      video.playsinline = true;
      video.preload = 'metadata';
      item.appendChild(video);
      if (v.caption) {
        const cap = document.createElement('div');
        cap.className = 'video-caption';
        cap.textContent = v.caption;
        item.appendChild(cap);
      }
      list.appendChild(item);
    });
  }

  // ---------- 时间线 ----------
  function renderTimeline() {
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';

    // 合并照片和视频，按日期排序
    const items = [];
    (MEDIA.photos || []).forEach(p => items.push({ type: 'photo', ...p }));
    (MEDIA.videos || []).forEach(v => items.push({ type: 'video', ...v }));

    items.sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return da.localeCompare(db);
    });

    if (!items.length) {
      tl.innerHTML = '<div class="empty"><div class="empty-emoji">🌷</div><p>还没有回忆哦，快去创造属于你们的故事吧～</p></div>';
      return;
    }

    items.forEach(it => {
      const node = document.createElement('div');
      node.className = 'timeline-item';
      const dot = document.createElement('div');
      dot.className = 'timeline-dot';
      node.appendChild(dot);

      const body = document.createElement('div');
      body.className = 'timeline-body';
      const date = document.createElement('div');
      date.className = 'timeline-date';
      date.textContent = it.date || '某个特别的日子';
      body.appendChild(date);

      if (it.type === 'photo') {
        const img = document.createElement('img');
        img.src = it.src;
        img.alt = it.caption || '';
        img.loading = 'lazy';
        img.addEventListener('click', () => openLightbox(it));
        body.appendChild(img);
      } else {
        const v = document.createElement('video');
        v.src = it.src;
        v.controls = true;
        v.playsinline = true;
        v.preload = 'metadata';
        body.appendChild(v);
      }

      if (it.caption) {
        const cap = document.createElement('div');
        cap.className = 'timeline-caption';
        cap.textContent = (it.type === 'photo' ? '📷 ' : '🎬 ') + it.caption;
        body.appendChild(cap);
      }

      node.appendChild(body);
      tl.appendChild(node);
    });
  }

  // ---------- 灯箱 ----------
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');

  function openLightbox(item) {
    lightboxImg.src = item.src;
    lightboxCaption.textContent = item.caption || '';
    lightbox.classList.remove('hidden');
  }
  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
  }
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  // ---------- 爱心背景 ----------
  function spawnHearts() {
    const bg = document.getElementById('hearts-bg');
    const emojis = ['💗', '💕', '💖', '💘', '🩷', '💝'];
    setInterval(() => {
      if (bg.children.length > 24) return;
      const span = document.createElement('span');
      span.className = 'heart';
      span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      span.style.left = Math.random() * 100 + 'vw';
      span.style.fontSize = (12 + Math.random() * 22) + 'px';
      span.style.animationDuration = (8 + Math.random() * 8) + 's';
      bg.appendChild(span);
      setTimeout(() => span.remove(), 16000);
    }, 600);
  }

  // ---------- 解锁后初始化 ----------
  window.__onUnlock = function () {
    renderDays();
    renderLoveLine();
    renderPhotos();
    renderVideos();
    renderTimeline();
    spawnHearts();
  };
})();
