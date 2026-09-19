'use strict';
// ============================================================
// 情侣相册 - 腾讯云 SCF 云函数（零依赖，仅用 Node 内置 crypto + https）
// 作用：用你的永久密钥签发 STS 临时密钥，供网页直传 COS
// 密钥只存在云函数环境变量里，绝不进网页代码
//
// 环境变量（在 SCF 控制台「函数配置 → 环境变量」里填）：
//   SECRET_ID    腾讯云 SecretId
//   SECRET_KEY   腾讯云 SecretKey
//   BUCKET       完整存储桶名（含 APPID），如 qinglv-1325537396
//   REGION       存储桶地域，如 ap-guangzhou
// ============================================================
const crypto = require('crypto');
const https = require('https');

const SECRET_ID  = process.env.SECRET_ID  || '';
const SECRET_KEY = process.env.SECRET_KEY || '';
const BUCKET     = process.env.BUCKET     || '';
const REGION     = process.env.REGION     || 'ap-guangzhou';
const APPID      = BUCKET.split('-').pop();

function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmacSha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function tc3Sign(secretKey, date, service, stringToSign) {
  const kDate = hmacSha256('TC3' + secretKey, date);
  const kService = hmacSha256(kDate, service);
  const kSigning = hmacSha256(kService, 'tc3_request');
  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
}

// 用 https 模块发 POST 请求（Node 16 无全局 fetch）
function httpPost(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname: host,
      path: path,
      method: 'POST',
      headers: Object.assign({ 'Content-Length': Buffer.byteLength(payload) }, headers)
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ __raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getFederationToken() {
  const host = 'sts.tencentcloudapi.com';
  const service = 'sts';
  const action = 'GetFederationToken';
  const version = '2018-08-13';
  const region = 'ap-guangzhou';

  // 临时密钥权限：仅允许对这个桶做上传/读取/列举，不能删除、不能动账号其他资源
  const policy = {
    version: '2.0',
    statement: [{
      action: [
        'name/cos:PutObject',
        'name/cos:PostObject',
        'name/cos:GetObject',
        'name/cos:GetBucket',
        'name/cos:HeadObject'
      ],
      effect: 'allow',
      resource: [
        `qcs::cos:${REGION}:uid/${APPID}:${BUCKET}`,
        `qcs::cos:${REGION}:uid/${APPID}:${BUCKET}/*`
      ]
    }]
  };

  const payload = JSON.stringify({
    Name: 'album-web-upload',
    Policy: JSON.stringify(policy),
    DurationSeconds: 1800
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:' + host + '\n';
  const signedHeaders = 'content-type;host';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256hex(payload)].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', timestamp, credentialScope, sha256hex(canonicalRequest)].join('\n');
  const signature = tc3Sign(SECRET_KEY, date, service, stringToSign);

  const authorization =
    `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const result = await httpPost(host, '/', {
    'Content-Type': 'application/json; charset=utf-8',
    'Host': host,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': region,
    'Authorization': authorization
  }, payload);

  return result;
}

exports.main_handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  // 函数 URL 触发器的请求在 event 里，可能是 { body, httpMethod } 或直接是 http 请求
  if (event && event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!SECRET_ID || !SECRET_KEY || !BUCKET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ code: -1, msg: '云函数环境变量未配置' })
      };
    }

    const result = await getFederationToken();

    if (result && result.Response && result.Response.Credentials) {
      const cred = result.Response.Credentials;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          code: 0,
          data: {
            tmpSecretId: cred.TmpSecretId,
            tmpSecretKey: cred.TmpSecretKey,
            sessionToken: cred.Token,
            startTime: result.Response.ExpiredTime - 1800,
            expiredTime: result.Response.ExpiredTime,
            bucket: BUCKET,
            region: REGION
          }
        })
      };
    }

    return { statusCode: 500, headers, body: JSON.stringify({ code: -1, msg: '获取临时密钥失败', detail: result }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ code: -1, msg: err.message || String(err) }) };
  }
};
