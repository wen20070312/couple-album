// ============================================================
// IndexedDB 存储封装 —— 用于存照片/视频/背景音乐
// 相比 localStorage，IndexedDB 容量大得多（可存几百 MB 到几 GB），
// 视频文件也能存下。
// ============================================================
(function () {
  const DB_NAME = 'couple_album_db';
  const DB_VERSION = 1;
  const STORE_MEDIA = 'media';
  const STORE_MUSIC = 'music';
  const LEGACY_KEY = 'couple_album_user_media_v1';

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('indexeddb not supported')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_MUSIC)) {
          db.createObjectStore(STORE_MUSIC, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- 媒体（照片/视频） ----------
  function addMedia(entry) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      tx.objectStore(STORE_MEDIA).add({
        type: entry.type,
        blob: entry.blob,
        caption: entry.caption || '',
        date: entry.date || '',
        createdAt: Date.now()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function getAllUserMedia() {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const req = tx.objectStore(STORE_MEDIA).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  // ---------- 背景音乐 ----------
  function addMusic(blob, name) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUSIC, 'readwrite');
      tx.objectStore(STORE_MUSIC).put({ id: 'bgm', blob: blob, name: name || '' });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function getMusic() {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUSIC, 'readonly');
      const req = tx.objectStore(STORE_MUSIC).get('bgm');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  function deleteMusic() {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUSIC, 'readwrite');
      tx.objectStore(STORE_MUSIC).delete('bgm');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  // ---------- 旧 localStorage 数据迁移 ----------
  function dataURLtoBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = (parts[0].match(/:(.*?);/) || ['', ''])[1];
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  async function migrateFromLocalStorage() {
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch (e) { return false; }
    if (!raw) return false;
    try {
      const list = JSON.parse(raw);
      for (const item of list) {
        try {
          const blob = dataURLtoBlob(item.src);
          await addMedia({ type: item.type, blob: blob, caption: item.caption, date: item.date });
        } catch (e) { /* 跳过损坏项 */ }
      }
      try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* 忽略 */ }
      return list.length > 0;
    } catch (e) {
      return false;
    }
  }

  window.AlbumStorage = {
    addMedia,
    getAllUserMedia,
    addMusic,
    getMusic,
    deleteMusic,
    migrateFromLocalStorage
  };
})();
