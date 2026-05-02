/* eslint-disable */
// 系统管理：品牌/型号 CRUD + 防呆校验端到端验证脚本
// 运行：cd apps/backend && pnpm exec ts-node --transpile-only -P tsconfig.seed.json scripts/verify-brand-model.ts
const NodeRSA = require('node-rsa');

const BASE = 'http://localhost:3000/api';

const log = (label: string, ok: boolean, detail?: any) => {
  const tag = ok ? '✅' : '❌';
  console.log(`${tag} ${label}${detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`);
};

const fetchJson = async (path: string, init?: any) => {
  const res = await fetch(BASE + path, init);
  let body: any = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};

(async () => {
  // ---- 1. 登录获取 token ----
  const pk = await fetchJson('/auth/public-key');
  if (pk.status !== 200) throw new Error('public-key failed: ' + pk.status);

  const rsa = new NodeRSA(pk.body.publicKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipher = rsa.encrypt('123456', 'base64');

  const loginRes = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: cipher }),
  });
  if (loginRes.status !== 200) throw new Error('login failed: ' + JSON.stringify(loginRes));
  const token = loginRes.body.access_token;
  log('登录成功', true);

  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const api = (path: string, init: any = {}) =>
    fetchJson(path, { ...init, headers: { ...auth, ...(init.headers || {}) } });

  // ---- 2. 创建测试品牌 ----
  const sfx = '_' + Date.now();
  const brandRes = await api('/brand', {
    method: 'POST',
    body: JSON.stringify({ name: '测试品牌' + sfx }),
  });
  log('创建品牌', brandRes.status === 201 || brandRes.status === 200, brandRes.body);
  const brandId = brandRes.body.id;

  // ---- 3. 重复品牌名 → 应 409 ----
  const dupBrand = await api('/brand', {
    method: 'POST',
    body: JSON.stringify({ name: '测试品牌' + sfx }),
  });
  log('重复品牌名应被拒', dupBrand.status === 409, { status: dupBrand.status, msg: dupBrand.body?.message });

  // ---- 4. 创建型号 ----
  const m1 = await api('/device-model', {
    method: 'POST',
    body: JSON.stringify({ name: '测试型号A', brandId }),
  });
  log('创建型号', m1.status === 201 || m1.status === 200, m1.body);
  const modelId = m1.body.id;

  // ---- 5. 同品牌同名型号 → 应 409 ----
  const dupModel = await api('/device-model', {
    method: 'POST',
    body: JSON.stringify({ name: '测试型号A', brandId }),
  });
  log('同品牌同名型号应被拒', dupModel.status === 409, { status: dupModel.status, msg: dupModel.body?.message });

  // ---- 6. 删除有型号的品牌 → 应 400 ----
  const delBrandWithModel = await api(`/brand/${brandId}`, { method: 'DELETE' });
  log(
    '删除有型号的品牌应被拒',
    delBrandWithModel.status === 400 && delBrandWithModel.body?.message === '请先清空该品牌下的所有型号',
    { status: delBrandWithModel.status, msg: delBrandWithModel.body?.message },
  );

  // ---- 7. 删除型号 → 应成功 ----
  const delModel = await api(`/device-model/${modelId}`, { method: 'DELETE' });
  log('删除型号', delModel.status === 200, { status: delModel.status });

  // ---- 8. 创建第二个型号 + 关联资产，删除该型号应被拒 ----
  const m2 = await api('/device-model', {
    method: 'POST',
    body: JSON.stringify({ name: '测试型号B', brandId }),
  });
  const model2Id = m2.body.id;

  const asset = await api('/asset', {
    method: 'POST',
    body: JSON.stringify({
      type: 'Camera',
      brandId,
      modelId: model2Id,
      imageUrl: '',
      purchaseDate: new Date().toISOString(),
      price: 100,
      status: 'Normal',
    }),
  });
  const assetId = asset.body.id;

  const delModelWithAsset = await api(`/device-model/${model2Id}`, { method: 'DELETE' });
  log(
    '删除有关联资产的型号应被拒',
    delModelWithAsset.status === 400 &&
      delModelWithAsset.body?.message === '该型号下存在关联资产，无法删除',
    { status: delModelWithAsset.status, msg: delModelWithAsset.body?.message },
  );

  // ---- 清理：删资产 → 删型号 → 删品牌 ----
  await api(`/asset/${assetId}`, { method: 'DELETE' });
  await api(`/device-model/${model2Id}`, { method: 'DELETE' });

  // ---- 9. 删除空品牌 → 应成功 ----
  const delBrand = await api(`/brand/${brandId}`, { method: 'DELETE' });
  log('删除空品牌', delBrand.status === 200, { status: delBrand.status });

  console.log('\n--- 端到端验证完成 ---');
})().catch((e) => {
  console.error('❌ 脚本异常：', e);
  process.exit(1);
});
