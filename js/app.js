// ============================================================
// 主应用逻辑
// ============================================================
(function () {
  const CFG = window.COUPLE_CONFIG;
  const STORAGE = window.AlbumStorage;
  const COS = window.CosUpload;

  // ---------- 内置媒体（js/media.js 里的） ----------
  function getBuiltinMedia() {
    return {
      photos: (window.MEDIA && window.MEDIA.photos) || [],
      videos: (window.MEDIA && window.MEDIA.videos) || []
    };
  }

  // ---------- 云端媒体清单（缓存） ----------
  let cloudManifest = { items: [], bgm: null };

  // 合并所有媒体（内置 + 云端），统一成 items 数组
  async function getAllMedia() {
    const builtin = getBuiltinMedia();
    const items = [];

    builtin.photos.forEach(p => items.push({ type: 'photo', src: p.src, caption: p.caption || '', date: p.date || '', source: 'builtin' }));
    builtin.videos.forEach(v => items.push({ type: 'video', src: v.src, caption: v.caption || '', date: v.date || '', source: 'builtin' }));

    // 云端媒体
    try {
      const cloud = await COS.readManifest();
      cloudManifest = cloud;
      (cloud.items || []).forEach(u => {
        items.push({ type: u.type, src: u.url, caption: u.caption || '', date: u.date || '', source: 'cloud' });
      });
    } catch (e) {
      // 云端读失败时，静默降级为仅内置媒体
      console.warn('读取云端媒体失败：', e);
    }

    // 按日期排序
    items.sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da && db && da !== db) return da.localeCompare(db);
      return 0;
    });

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

  // ---------- 背景音乐（支持云端自定义） ----------
  const bgMusic = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  let musicPlaying = false;

  function setPlayingState(playing) {
    musicPlaying = playing;
    musicToggle.classList.toggle('playing', playing);
  }

  function playMusic() {
    return bgMusic.play().then(() => setPlayingState(true)).catch(() => setPlayingState(false));
  }

  function pauseMusic() {
    bgMusic.pause();
    setPlayingState(false);
  }

  function toggleMusic() {
    if (musicPlaying) pauseMusic();
    else playMusic();
  }

  musicToggle.addEventListener('click', toggleMusic);

  // 设置音乐源（优先云端自定义，否则默认）
  async function loadMusic() {
    const wasPlaying = musicPlaying;
    try {
      if (cloudManifest.bgm && cloudManifest.bgm.url) {
        bgMusic.src = cloudManifest.bgm.url;
        musicToggle.classList.add('has-custom');
        musicToggle.title = '背景音乐：' + (cloudManifest.bgm.name || '自定义音乐') + '（双击可更换）';
      } else {
        bgMusic.src = CFG.backgroundMusic;
        musicToggle.classList.remove('has-custom');
        musicToggle.title = '背景音乐（双击可更换）';
      }
    } catch (e) { /* 忽略 */ }
    if (wasPlaying) {
      bgMusic.play().catch(() => {});
    }
  }

  // 供密码门在「用户手势上下文」内调用，满足浏览器自动播放策略
  window.__tryAutoPlayMusic = function () {
    if (CFG.musicAutoPlay && !musicPlaying) {
      playMusic();
    }
  };

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
      el.textContent = '遇见' + (CFG.girlName || '你') + '之后，已经是第 ' + days + ' 天啦';
    } else {
      el.textContent = '爱你的每一天';
    }
    document.getElementById('stat-days').textContent = days >= 0 ? days : '∞';
    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.textContent = '遇见' + (CFG.girlName || '你') + '之后';
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
  async function renderAlbum() {
    const grid = document.getElementById('album-grid');
    const empty = document.getElementById('album-empty');
    grid.innerHTML = '';
    const items = await getAllMedia();
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
      } else {
        const thumb = document.createElement('div');
        thumb.className = 'video-thumb';
        const video = document.createElement('video');
        video.src = it.src;
        video.preload = 'metadata';
        video.muted = true;
        thumb.appendChild(video);
        thumb.innerHTML += '<span class="play-icon">▶</span>';
        card.appendChild(thumb);
      }

      card.addEventListener('click', () => openLightbox(it));

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
  async function renderTimeline() {
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    const items = await getAllMedia();

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

  addSaveBtn.addEventListener('click', async () => {
    if (!pendingFile) return;

    const caption = addCaptionInput.value.trim();
    const date = addDateInput.value || '';

    addSaveBtn.disabled = true;
    addSaveBtn.textContent = '上传中…';
    try {
      // 1. 上传文件到 COS
      const up = await COS.uploadFile(pendingFile, 'media');
      // 2. 更新云端清单
      const manifest = cloudManifest || { items: [], bgm: null };
      manifest.items = manifest.items || [];
      manifest.items.push({ type: pendingType, url: up.url, caption, date });
      await COS.writeManifest(manifest);
      cloudManifest = manifest;

      closeAddModal();
      await refreshAll();
      alert('已上传到云端 ☁️ 任何设备打开都能看到啦～');
    } catch (e) {
      alert('上传失败，请重试 💦\n\n（错误：' + (e && e.message ? e.message : '未知') + '）');
    } finally {
      addSaveBtn.disabled = false;
      addSaveBtn.textContent = '保存 💗';
    }
  });

  // ---------- 自定义背景音乐上传（云端） ----------
  const musicModal = document.getElementById('music-modal');
  const musicModalClose = document.getElementById('music-modal-close');
  const musicFileInput = document.getElementById('music-file-input');
  const musicSaveBtn = document.getElementById('music-save-btn');
  const musicResetBtn = document.getElementById('music-reset-btn');
  const musicUploadHint = document.getElementById('music-upload-hint');

  function openMusicModal() {
    musicModal.classList.remove('hidden');
    musicFileInput.value = '';
    musicSaveBtn.disabled = true;
    musicUploadHint.textContent = '';
  }
  function closeMusicModal() {
    musicModal.classList.add('hidden');
  }

  musicToggle.addEventListener('contextmenu', e => {
    e.preventDefault();
    openMusicModal();
  });
  musicToggle.addEventListener('dblclick', () => openMusicModal());

  musicModalClose.addEventListener('click', closeMusicModal);
  musicModal.addEventListener('click', e => {
    if (e.target === musicModal) closeMusicModal();
  });

  musicFileInput.addEventListener('change', () => {
    const f = musicFileInput.files[0];
    if (!f) return;
    const okType = f.type.startsWith('audio') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name);
    if (!okType) {
      musicUploadHint.textContent = '请选择音频文件（mp3/wav/m4a 等）';
      musicSaveBtn.disabled = true;
      return;
    }
    musicUploadHint.textContent = '已选择：' + f.name + '（' + (f.size / 1024 / 1024).toFixed(1) + ' MB）';
    musicSaveBtn.disabled = false;
  });

  musicSaveBtn.addEventListener('click', async () => {
    const f = musicFileInput.files[0];
    if (!f) return;
    musicSaveBtn.disabled = true;
    musicSaveBtn.textContent = '上传中…';
    try {
      // 1. 上传音乐到 COS
      const up = await COS.uploadFile(f, 'media/music');
      // 2. 更新云端清单的 bgm
      const manifest = cloudManifest || { items: [], bgm: null };
      manifest.bgm = { url: up.url, name: f.name };
      await COS.writeManifest(manifest);
      cloudManifest = manifest;

      await loadMusic();
      closeMusicModal();
      if (!musicPlaying) toggleMusic();
      alert('背景音乐已更新为：' + f.name + ' 🎵（云端同步）');
    } catch (e) {
      alert('上传失败，请重试 💦\n\n（错误：' + (e && e.message ? e.message : '未知') + '）');
    } finally {
      musicSaveBtn.disabled = false;
      musicSaveBtn.textContent = '保存音乐';
    }
  });

  musicResetBtn.addEventListener('click', async () => {
    try {
      const manifest = cloudManifest || { items: [], bgm: null };
      manifest.bgm = null;
      await COS.writeManifest(manifest);
      cloudManifest = manifest;
      await loadMusic();
      closeMusicModal();
      alert('已恢复默认背景音乐 🎵');
    } catch (e) {
      alert('操作失败，请重试 💦');
    }
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

  // ---------- 响应式检测 ----------
  function applyResponsive() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile', isMobile);
    document.body.classList.toggle('desktop', !isMobile);
  }
  window.addEventListener('resize', applyResponsive);
  applyResponsive();

  // ---------- 刷新所有视图 ----------
  async function refreshAll() {
    renderDays();
    renderLoveLine();
    await renderAlbum();
    await renderTimeline();
  }

  // ---------- 解锁后初始化 ----------
  window.__onUnlock = async function () {
    // 先读云端清单（含背景音乐），让所有设备一致
    try {
      cloudManifest = await COS.readManifest();
    } catch (e) {
      cloudManifest = { items: [], bgm: null };
    }

    await loadMusic();
    await refreshAll();
    spawnHearts();
    window.__tryAutoPlayMusic();
  };

  // 页面加载时预加载默认音乐源
  bgMusic.src = CFG.backgroundMusic;
})();
