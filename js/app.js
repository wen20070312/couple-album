// ============================================================
// 主应用逻辑
// ============================================================
(function () {
  const CFG = window.COUPLE_CONFIG;
  const STORAGE_KEY = 'couple_album_user_media_v1';

  // ---------- 用户添加的媒体（本地永久存储） ----------
  // 内置媒体（js/media.js 里的） + 用户上传的（localStorage）合并展示
  function getBuiltinMedia() {
    return {
      photos: (window.MEDIA && window.MEDIA.photos) || [],
      videos: (window.MEDIA && window.MEDIA.videos) || []
    };
  }

  function getUserMedia() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveUserMedia(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      // 存储超限时提示
      return false;
    }
  }

  // 合并所有媒体（照片+视频统一成 items 数组）
  function getAllMedia() {
    const builtin = getBuiltinMedia();
    const user = getUserMedia();
    const items = [];
    builtin.photos.forEach(p => items.push({ type: 'photo', src: p.src, caption: p.caption || '', date: p.date || '', source: 'builtin' }));
    builtin.videos.forEach(v => items.push({ type: 'video', src: v.src, caption: v.caption || '', date: v.date || '', source: 'builtin' }));
    user.forEach(u => items.push({ type: u.type, src: u.src, caption: u.caption || '', date: u.date || '', source: 'user' }));
    return items;
  }

  // ---------- 视图切换 ----------
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = {
    home: document.getElementById('view-home'),
    album: document.getElementById('view-album'),
    timeline: document.getElementById('view-timeline')
  };

  function switchView(name) {
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  }

  navBtns.forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

  // ---------- 背景音乐 ----------
  const bgMusic = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  let musicPlaying = false;

  function toggleMusic() {
    if (musicPlaying) {
      bgMusic.pause();
      musicPlaying = false;
      musicToggle.classList.remove('playing');
    } else {
      bgMusic.play().then(() => {
        musicPlaying = true;
        musicToggle.classList.add('playing');
      }).catch(() => {
        // 播放失败（浏览器自动播放限制）
      });
    }
  }

  musicToggle.addEventListener('click', toggleMusic);

  // 用户手动开启音乐（很多浏览器禁止自动播放，需交互）
  function tryAutoPlayMusic() {
    if (CFG.musicAutoPlay) {
      bgMusic.play().then(() => {
        musicPlaying = true;
        musicToggle.classList.add('playing');
      }).catch(() => {});
    }
  }

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
      el.textContent = '遇见你之后，已经是第 ' + days + ' 天啦';
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

  // ---------- 相册（照片+视频合并） ----------
  function renderAlbum() {
    const grid = document.getElementById('album-grid');
    const empty = document.getElementById('album-empty');
    grid.innerHTML = '';
    const items = getAllMedia();
    const photos = items.filter(i => i.type === 'photo');
    const videos = items.filter(i => i.type === 'video');
    document.getElementById('stat-photos').textContent = photos.length;
    document.getElementById('stat-videos').textContent = videos.length;

    if (!items.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    items.forEach((it) => {
      const card = document.createElement('div');
      card.className = 'album-card';

      if (it.type === 'photo') {
        const img = document.createElement('img');
        img.src = it.src;
        img.alt = it.caption || '照片';
        img.loading = 'lazy';
        card.appendChild(img);
        card.addEventListener('click', () => openLightbox(it));
      } else {
        const thumb = document.createElement('div');
        thumb.className = 'video-thumb';
        thumb.innerHTML = '<span class="play-icon">▶</span>';
        card.appendChild(thumb);
        card.addEventListener('click', () => openLightbox(it));
      }

      // 类型角标
      const badge = document.createElement('span');
      badge.className = 'type-badge ' + it.type;
      badge.textContent = it.type === 'photo' ? '📷' : '🎬';
      card.appendChild(badge);

      if (it.caption) {
        const cap = document.createElement('div');
        cap.className = 'album-caption';
        cap.textContent = it.caption;
        card.appendChild(cap);
      }
      grid.appendChild(card);
    });
  }

  // ---------- 时间线 ----------
  function renderTimeline() {
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    const items = getAllMedia();

    items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

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
  const lightboxMedia = document.getElementById('lightbox-media');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');

  function openLightbox(item) {
    lightboxMedia.innerHTML = '';
    if (item.type === 'photo') {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.caption || '';
      lightboxMedia.appendChild(img);
    } else {
      const v = document.createElement('video');
      v.src = item.src;
      v.controls = true;
      v.autoplay = true;
      v.playsinline = true;
      lightboxMedia.appendChild(v);
    }
    lightboxCaption.textContent = item.caption || '';
    lightbox.classList.remove('hidden');
  }
  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxMedia.innerHTML = '';
  }
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  // ---------- 添加媒体 ----------
  const addModal = document.getElementById('add-modal');
  const addModalClose = document.getElementById('add-modal-close');
  const addFileInput = document.getElementById('add-file-input');
  const addCaptionInput = document.getElementById('add-caption-input');
  const addDateInput = document.getElementById('add-date-input');
  const addPreview = document.getElementById('add-preview');
  const addSaveBtn = document.getElementById('add-save-btn');
  const addBtn = document.getElementById('add-media-btn');

  let pendingFile = null;
  let pendingType = 'photo';

  function openAddModal() {
    addModal.classList.remove('hidden');
    resetAddForm();
  }
  function closeAddModal() {
    addModal.classList.add('hidden');
    resetAddForm();
  }

  function resetAddForm() {
    addFileInput.value = '';
    addCaptionInput.value = '';
    addDateInput.value = '';
    addPreview.innerHTML = '';
    addSaveBtn.disabled = true;
    pendingFile = null;
  }

  addBtn.addEventListener('click', openAddModal);
  addModalClose.addEventListener('click', closeAddModal);
  addModal.addEventListener('click', e => {
    if (e.target === addModal) closeAddModal();
  });

  addFileInput.addEventListener('change', () => {
    const file = addFileInput.files[0];
    if (!file) return;
    pendingType = file.type.startsWith('video') ? 'video' : 'photo';
    pendingFile = file;

    // 预览
    addPreview.innerHTML = '';
    const url = URL.createObjectURL(file);
    if (pendingType === 'photo') {
      const img = document.createElement('img');
      img.src = url;
      addPreview.appendChild(img);
    } else {
      const v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.playsinline = true;
      addPreview.appendChild(v);
    }
    addSaveBtn.disabled = false;
  });

  addSaveBtn.addEventListener('click', () => {
    if (!pendingFile) return;

    // 检查大小（localStorage 上限约 5MB，超出的提示）
    if (pendingFile.size > 4.5 * 1024 * 1024) {
      alert('这个文件太大了（超过 4.5MB）💦\n\n提示：浏览器本地存储空间有限，照片建议 2MB 以内，视频建议 3MB 以内哦～');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const item = {
        type: pendingType,
        src: dataUrl,
        caption: addCaptionInput.value.trim(),
        date: addDateInput.value || '',
        source: 'user'
      };
      const list = getUserMedia();
      list.push(item);
      const ok = saveUserMedia(list);
      if (!ok) {
        alert('存储空间不足，保存失败 💦\n\n可以先把之前的大视频删掉，或者换小一点的图片。');
        return;
      }
      closeAddModal();
      renderAlbum();
      renderTimeline();
    };
    reader.onerror = () => {
      alert('读取文件失败，请重试 💦');
    };
    reader.readAsDataURL(pendingFile);
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

  // ---------- 响应式检测（电脑版 vs 手机版） ----------
  function applyResponsive() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile', isMobile);
    document.body.classList.toggle('desktop', !isMobile);
  }
  window.addEventListener('resize', applyResponsive);
  applyResponsive();

  // ---------- 解锁后初始化 ----------
  window.__onUnlock = function () {
    renderDays();
    renderLoveLine();
    renderAlbum();
    renderTimeline();
    spawnHearts();
    tryAutoPlayMusic();
  };
})();
