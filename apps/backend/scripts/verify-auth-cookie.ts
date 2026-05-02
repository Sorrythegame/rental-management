/* eslint-disable */
// 鉴权 cookie 化端到端验证
// 运行：cd apps/backend && pnpm exec ts-node --transpile-only -P tsconfig.seed.json scripts/verify-auth-cookie.ts
const NodeRSA = require('node-rsa');

const BASE = 'http://localhost:3000/api';

const log = (label: string, ok: boolean, detail?: any) => {
  const tag = ok ? '✅' : '❌';
  console.log(`${tag} ${label}${detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`);
};

const fetchWith = async (path: string, init?: any) => {
  const res = await fetch(BASE + path, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body, headers: res.headers };
};

const parseSetCookie = (h: Headers): Record<string, string> => {
  // node fetch 把多个 set-cookie 合并到 raw 数组里
  const all = (h as any).getSetCookie ? (h as any).getSetCookie() : [];
  const out: Record<string, string> = {};
  for (const line of all) {
    const [kv, ...attrs] = line.split(';');
    const [k, v] = kv.split('=');
    out[k.trim()] = v ?? '';
    out[`__attrs_${k.trim()}`] = attrs.join(';');
  }
  return out;
};

(async () => {
  // 1. 拿公钥 + 加密
  const pk = await fetchWith('/auth/public-key');
  const rsa = new NodeRSA(pk.body.publicKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipher = rsa.encrypt('123456', 'base64');

  // 2. 登录：响应应只含 ok/username,不含 access_token；并下发 HttpOnly cookie
  const loginRes = await fetchWith('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: cipher }),
  });
  log('登录返回 ok=true', loginRes.status === 200 && loginRes.body?.ok === true, loginRes.body);
  log('登录响应不含 access_token', !('access_token' in (loginRes.body || {})));

  const cookies = parseSetCookie(loginRes.headers);
  const tokenValue = cookies['token'];
  const tokenAttrs = (cookies['__attrs_token'] || '').toLowerCase();
  log('Set-Cookie 含 token', !!tokenValue);
  log('cookie 是 HttpOnly', tokenAttrs.includes('httponly'));
  log('cookie 设置了 max-age', /max-age=\d+/.test(tokenAttrs), { tokenAttrs });

  // 3. 用 cookie 调 /auth/me（不带 Authorization 头）
  const me = await fetchWith('/auth/me', {
    headers: { cookie: `token=${tokenValue}` },
  });
  log('cookie 携带可访问 /auth/me', me.status === 200 && me.body?.username === 'admin', me.body);

  // 4. 不带 cookie 访问 /auth/me 应该 401
  const meAnon = await fetchWith('/auth/me');
  log('未带 cookie 访问 /auth/me 401', meAnon.status === 401);

  // 5. 用 cookie 访问受保护资源（/asset 列表）
  const assetList = await fetchWith('/asset', {
    headers: { cookie: `token=${tokenValue}` },
  });
  log('cookie 可访问受保护资源 /asset', assetList.status === 200 && Array.isArray(assetList.body), {
    status: assetList.status,
    isArr: Array.isArray(assetList.body),
  });

  // 6. JWT 有效期解析（中间段 base64url decode）
  const jwtParts = tokenValue.split('.');
  const payloadJson = JSON.parse(
    Buffer.from(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  );
  const expSec = payloadJson.exp - payloadJson.iat;
  // 36500d * 86400 = 3,153,600,000 秒
  log('JWT 有效期 ~100 年', expSec >= 3153600000 - 60 && expSec <= 3153600000 + 60, {
    expSec,
    iat: payloadJson.iat,
    exp: payloadJson.exp,
  });

  // 7. 调用 /auth/logout 下发清除 cookie 的 Set-Cookie（即 Max-Age=0 / 过期时间过去）
  const logoutRes = await fetchWith('/auth/logout', {
    method: 'POST',
    headers: { cookie: `token=${tokenValue}` },
  });
  log('登出 200', logoutRes.status === 200 && logoutRes.body?.ok === true);
  const clearCookie = parseSetCookie(logoutRes.headers);
  const clearAttrs = (clearCookie['__attrs_token'] || '').toLowerCase();
  log(
    '登出下发清 cookie',
    'token' in clearCookie &&
      (clearAttrs.includes('expires=thu, 01 jan 1970') || clearAttrs.includes('max-age=0')),
    { clearAttrs },
  );

  // 8. 兼容性：bearer header 仍可用（工具脚本场景）
  // 重新登录拿一份 token 给 bearer 测
  const reLogin = await fetchWith('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: rsa.encrypt('123456', 'base64') }),
  });
  const reCookies = parseSetCookie(reLogin.headers);
  const bearerToken = reCookies['token'];
  const bearerProbe = await fetchWith('/auth/me', {
    headers: { authorization: `Bearer ${bearerToken}` },
  });
  log('bearer 兼容仍可访问 /auth/me', bearerProbe.status === 200, bearerProbe.body);

  console.log('\n--- 鉴权 cookie 化端到端验证完成 ---');
})().catch((e) => {
  console.error('❌ 脚本异常：', e);
  process.exit(1);
});
