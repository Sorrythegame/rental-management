/* eslint-disable */
// 订单管理端到端验证
// 运行：cd apps/backend && pnpm exec ts-node --transpile-only -P tsconfig.seed.json scripts/verify-order.ts
const NodeRSA = require('node-rsa');

const BASE = 'http://localhost:3000/api';

const log = (label: string, ok: boolean, detail?: any) => {
  const tag = ok ? '✅' : '❌';
  console.log(`${tag} ${label}${detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`);
};

let cookieJar = '';

const buildCookieHeader = (): Record<string, string> =>
  cookieJar ? { cookie: cookieJar } : {};

const fetchJson = async (p: string, init: any = {}) => {
  const headers: Record<string, string> = {
    ...(init.headers || {}),
    ...buildCookieHeader(),
  };
  const res = await fetch(BASE + p, { ...init, headers });
  const setCookies = (res.headers as any).getSetCookie?.() || [];
  for (const line of setCookies) {
    const [kv] = line.split(';');
    const [k] = kv.split('=');
    if (k.trim() === 'token') {
      cookieJar = kv.trim();
    }
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
};

(async () => {
  // 1. 登录
  const pk = await fetchJson('/auth/public-key');
  const rsa = new NodeRSA(pk.body.publicKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipher = rsa.encrypt('123456', 'base64');
  await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: cipher }),
  });

  // 2. 创建品牌+型号+相机资产（带 SN 码）
  const sfx = '_t_' + Date.now();
  const brand = await fetchJson('/brand', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '品牌' + sfx }),
  });
  const brandId = brand.body.id;
  const model = await fetchJson('/device-model', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'X1' + sfx, brandId }),
  });
  const modelId = model.body.id;

  const camera = await fetchJson('/asset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'Camera',
      brandId,
      modelId,
      sinCode: 'SN-ORDER-' + sfx,
      imageUrls: [],
      purchaseDate: new Date().toISOString(),
      price: 5000,
      status: 'Normal',
      rentalStatus: 'Available',
    }),
  });
  const cameraId = camera.body.id;
  log('创建相机资产', !!cameraId, { cameraId, sinCode: camera.body.sinCode });

  // 3. 新增订单（带 assetId 回填）
  const orderCreate = await fetchJson('/rental-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetId: cameraId,
      sinCode: camera.body.sinCode,
      brandName: brand.body.name,
      modelName: model.body.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
      amount: 300,
      customerName: '客户A',
      customerPhone: '13800138000',
      remarks: '测试订单',
    }),
  });
  log('新增订单', !!orderCreate.body?.id, orderCreate.body);
  const orderId = orderCreate.body.id;

  // 4. 列表筛选：brandName
  const listBrand = await fetchJson(`/rental-order?brandName=${encodeURIComponent(brand.body.name)}`);
  log('按 brandName 筛选', listBrand.body?.some?.((o: any) => o.id === orderId), { count: listBrand.body?.length });

  // 5. 列表筛选：orderStatus=InProgress（startTime=now, endTime=now+1d，当前正处于进行中）
  const listStatus = await fetchJson('/rental-order?orderStatus=InProgress');
  log('按 orderStatus 筛选', listStatus.body?.some?.((o: any) => o.id === orderId), { count: listStatus.body?.length });

  // 6. 列表筛选：sinCode 模糊
  const listSn = await fetchJson(`/rental-order?sinCode=${encodeURIComponent('SN-ORDER')}`);
  log('按 sinCode 模糊筛选', listSn.body?.some?.((o: any) => o.id === orderId), { count: listSn.body?.length });

  // 7. 编辑订单
  const editRes = await fetchJson(`/rental-order/${orderId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetId: cameraId,
      sinCode: 'SN-ORDER-' + sfx,
      brandName: brand.body.name,
      modelName: model.body.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 172800000).toISOString(),
      amount: 500,
      customerName: '客户B',
      customerPhone: '13900139000',
      remarks: '已修改',
    }),
  });
  log('编辑订单', editRes.status === 200 && editRes.body?.amount === 500, editRes.body);

  // 8. 订单详情含关联设备
  const detail = await fetchJson(`/rental-order/${orderId}`);
  log(
    '订单详情含关联设备',
    detail.body?.asset?.id === cameraId && detail.body?.orderStatus === 'InProgress',
    { assetId: detail.body?.asset?.id, orderStatus: detail.body?.orderStatus },
  );

  // 9. 删除订单
  const delRes = await fetchJson(`/rental-order/${orderId}`, { method: 'DELETE' });
  log('删除订单', delRes.status === 200);

  // 清理
  await fetchJson(`/asset/${cameraId}`, { method: 'DELETE' });
  await fetchJson(`/device-model/${modelId}`, { method: 'DELETE' });
  await fetchJson(`/brand/${brandId}`, { method: 'DELETE' });

  console.log('\n--- 订单管理端到端验证完成 ---');
})().catch((e) => {
  console.error('❌ 脚本异常：', e);
  process.exit(1);
});
