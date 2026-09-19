// ============================================================
// 密码验证（SHA-256，不存明文）
// ============================================================
(function () {
  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const lockScreen = document.getElementById('lock-screen');
  const app = document.getElementById('app');
  const input = document.getElementById('pwd-input');
  const submit = document.getElementById('pwd-submit');
  const error = document.getElementById('lock-error');

  function unlock() {
    lockScreen.classList.add('hidden');
    app.classList.remove('hidden');
    // 通知主应用开始初始化
    if (window.__onUnlock) window.__onUnlock();
    // 在用户手势上下文内触发音乐自动播放（满足浏览器自动播放策略）
    if (window.__tryAutoPlayMusic) window.__tryAutoPlayMusic();
  }

  async function tryUnlock() {
    const val = input.value.trim();
    if (!val) {
      error.classList.add('show');
      return;
    }
    const hash = await sha256(val);
    if (hash === window.COUPLE_CONFIG.passwordHash) {
      error.classList.remove('show');
      unlock();
    } else {
      error.classList.add('show');
      input.value = '';
      input.focus();
    }
  }

  submit.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
  });
  input.addEventListener('input', () => error.classList.remove('show'));

  // 首次聚焦
  input.focus();
})();
