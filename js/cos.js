// ============================================================
// COS 云存储模块 —— 实现「随传随看」
//
// 架构：
//   - 媒体文件（照片/视频/音乐）直传 COS 的 media/ 目录
//   - media/manifest.json 是「云端清单」，记录所有媒体 + 当前背景音乐
//   - 任何设备打开，都从云端读 manifest → 所有设备看到的都一样
//
// 桶为「公有读」，所以【读取】无需签名，直接公开 URL 访问；
// 只有【上传/写清单】需要临时密钥签名。
// ============================================================
(function () {
  const TOKEN_URL = 'https://1325537396-38auh1e983.ap-guangzhou.tencentscf.com';
  const BUCKET = 'qinglv-1325537396';
  const REGION = 'ap-guangzhou';
  const BASE_URL = `https://${BUCKET}.cos.${REGION}.myqcloud.com`;
  const MANIFEST_KEY = 'media/manifest.json';

  let tokenCache = null;

  async function getToken() {
    if (tokenCache && tokenCache.expiredTime * 1000 - Date.now() > 300000) {
      return tokenCache;
    }
    const resp = await fetch(TOKEN_URL, { method: 'GET' });
    const json = await resp.json();
    if (json.code !== 0 || !json.data) {
      throw new Error('获取上传凭证失败：' + (json.msg || '未知错误'));
    }
    tokenCache = json.data;
    return json.data;
  }

  function makeKey(folder, ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    const rand = Math.random().toString(36).slice(2, 8);
    return `${folder}/${stamp}_${rand}.${ext}`;
  }

  // ---------- Web Crypto 工具 ----------
  async function sha1Hex(str) {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function hmacSha1Hex(keyBytes, str) {
    const keyBuf = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', keyBuf, new TextEncoder().encode(str));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function utf8ToBytes(str) { return new TextEncoder().encode(str); }

  async function buildCosAuth(method, pathname, secretId, secretKey, keyTime, host) {
    const headerList = 'host';
    const httpHeaders = `host=${encodeURIComponent(host)}`;
    const httpString = `${method.toLowerCase()}\n${pathname}\n\n${httpHeaders}\n`;
    const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(httpString)}\n`;
    const signKey = await hmacSha1Hex(utf8ToBytes(secretKey), keyTime);
    const signature = await hmacSha1Hex(utf8ToBytes(signKey), stringToSign);
    return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList}&q-url-param-list=&q-signature=${signature}`;
  }

  // PUT 直传
  async function uploadFile(file, folder) {
    const token = await getToken();
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const key = makeKey(folder || 'media', ext);
    const host = `${token.bucket}.cos.${token.region}.myqcloud.com`;
    const url = `https://${host}/${key}`;

    const now = Math.floor(Date.now() / 1000);
    const keyTime = `${now};${now + 1800}`;
    const auth = await buildCosAuth('PUT', '/' + key, token.tmpSecretId, token.tmpSecretKey, keyTime, host);

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'x-cos-security-token': token.sessionToken,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (resp.status !== 200) {
      const txt = await resp.text().catch(() => '');
      throw new Error('上传失败 HTTP ' + resp.status + ' ' + txt);
    }
    return { key, url };
  }

  // 上传 JSON 字符串到指定 key（用于写清单）
  async function uploadJson(key, jsonStr, contentType) {
    const token = await getToken();
    const host = `${token.bucket}.cos.${token.region}.myqcloud.com`;
    const url = `https://${host}/${key}`;
    const now = Math.floor(Date.now() / 1000);
    const keyTime = `${now};${now + 1800}`;
    const auth = await buildCosAuth('PUT', '/' + key, token.tmpSecretId, token.tmpSecretKey, keyTime, host);

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'x-cos-security-token': token.sessionToken,
        'Content-Type': contentType || 'application/json'
      },
      body: jsonStr
    });
    if (resp.status !== 200) {
      const txt = await resp.text().catch(() => '');
      throw new Error('写入失败 HTTP ' + resp.status + ' ' + txt);
    }
    return { key, url };
  }

  // ---------- 云端清单 ----------
  function publicUrl(key) {
    return `${BASE_URL}/${key}`;
  }

  // 读云端清单（公有读，无需签名；加时间戳防缓存）
  async function readManifest() {
    const resp = await fetch(`${BASE_URL}/${MANIFEST_KEY}?t=${Date.now()}`);
    if (resp.status === 404) {
      return { items: [], bgm: null };
    }
    if (resp.status !== 200) {
      throw new Error('读取云端清单失败 HTTP ' + resp.status);
    }
    const json = await resp.json();
    if (!json || typeof json !== 'object') return { items: [], bgm: null };
    return {
      items: Array.isArray(json.items) ? json.items : [],
      bgm: json.bgm || null
    };
  }

  // 写云端清单（覆盖整个 manifest.json）
  async function writeManifest(manifest) {
    return uploadJson(MANIFEST_KEY, JSON.stringify(manifest), 'application/json');
  }

  window.CosUpload = {
    BASE_URL,
    uploadFile,
    uploadJson,
    publicUrl,
    readManifest,
    writeManifest,
    getToken
  };
})();
