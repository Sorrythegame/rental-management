/* eslint-disable */
// 资产 + 上传端到端验证（cookie 鉴权）
// 运行：cd apps/backend && pnpm exec ts-node --transpile-only -P tsconfig.seed.json scripts/verify-asset.ts
const NodeRSA = require('node-rsa');
const fs = require('fs');
const path = require('path');

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
  const loginRes = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: cipher }),
  });
  log('登录', loginRes.status === 200 && loginRes.body?.ok === true);
  log('登录后 cookieJar 已写入 token', cookieJar.startsWith('token='));

  // 2. 创建测试品牌+型号
  const sfx = '_t_' + Date.now();
  const brand = await fetchJson('/brand', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '品牌' + sfx }),
  });
  const brandId = brand.body.id;
  const m = await fetchJson('/device-model', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'X1' + sfx, brandId }),
  });
  const modelId = m.body.id;
  log('品牌/型号准备', !!brandId && !!modelId, { brandId, modelId });

  // 3. 上传一张 1x1 PNG（base64 解码）
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const tmpFile = path.join(__dirname, 'tmp-test.png');
  fs.writeFileSync(tmpFile, Buffer.from(pngBase64, 'base64'));

  const buf = fs.readFileSync(tmpFile);
  const blob = new Blob([buf], { type: 'image/png' });

  const upload = async (filename: string) => {
    const fd = new FormData();
    fd.append('file', blob, filename);
    const upRes = await fetch(BASE + '/upload', {
      method: 'POST',
      headers: { ...buildCookieHeader() },
      body: fd,
    });
    const upBody = await upRes.json();
    return { ok: upRes.status === 201 && typeof upBody.url === 'string', url: upBody.url };
  };

  const up1 = await upload('test.png');
  log('上传图片', up1.ok, { url: up1.url });

  // 4. 静态文件可下载
  const staticRes = await fetch('http://localhost:3000' + up1.url);
  log('静态访问图片', staticRes.status === 200, { status: staticRes.status });

  // 5. 创建资产 Camera（含 sinCode, rentalStatus, remark）
  const assetCamera = await fetchJson('/asset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'Camera',
      brandId,
      modelId,
      sinCode: 'SN-998877',
      imageUrls: [up1.url],
      purchaseDate: new Date().toISOString(),
      price: 1000,
      status: 'Normal',
      rentalStatus: 'Available',
      remark: '新购入',
    }),
  });
  log(
    '创建相机资产',
    !!assetCamera.body?.id && assetCamera.body.sinCode === 'SN-998877',
    assetCamera.body,
  );
  const cameraId = assetCamera.body.id;

  // 6. 创建资产 Accessory（含 name, rentalStatus, 无 brandId/modelId）
  const assetAccessory = await fetchJson('/asset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'Accessory',
      name: '电池' + sfx,
      imageUrls: [up1.url],
      purchaseDate: new Date().toISOString(),
      price: 200,
      status: 'Normal',
      rentalStatus: 'Rented',
      remark: null,
    }),
  });
  log(
    '创建配件资产',
    !!assetAccessory.body?.id && assetAccessory.body.name === '电池' + sfx,
    assetAccessory.body,
  );
  const accessoryId = assetAccessory.body.id;

  // 7. 相机详情
  const detailCam = await fetchJson(`/asset/${cameraId}`);
  log(
    '相机详情字段完整',
    detailCam.body?.brandId === brandId &&
      detailCam.body?.modelId === modelId &&
      detailCam.body?.sinCode === 'SN-998877' &&
      detailCam.body?.rentalStatus === 'Available' &&
      detailCam.body?.remark === '新购入',
    detailCam.body,
  );

  // 8. 配件详情
  const detailAcc = await fetchJson(`/asset/${accessoryId}`);
  log(
    '配件详情字段完整',
    detailAcc.body?.brandId == null &&
      detailAcc.body?.modelId == null &&
      detailAcc.body?.name === '电池' + sfx &&
      detailAcc.body?.rentalStatus === 'Rented',
    detailAcc.body,
  );

  // 9. 列表筛选：brandId 应只返回相机（配件无 brand）
  const listBrand = await fetchJson(`/asset?brandId=${brandId}`);
  log(
    '按 brandId 筛选只含相机',
    listBrand.body?.every?.((a: any) => a.type === 'Camera') && listBrand.body?.length >= 1,
    { count: listBrand.body?.length },
  );

  // 10. 列表筛选：rentalStatus=Rented 只含配件
  const listRented = await fetchJson(`/asset?rentalStatus=Rented`);
  log(
    '按 rentalStatus=Rented 含配件',
    listRented.body?.some?.((a: any) => a.id === accessoryId) &&
      listRented.body?.every?.((a: any) => a.rentalStatus === 'Rented'),
    { count: listRented.body?.length },
  );

  // 11. 编辑相机：改状态为 Damaged + rentalStatus=Rented
  const up2 = await upload('test2.png');
  const editCam = await fetchJson(`/asset/${cameraId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'Camera',
      brandId,
      modelId,
      sinCode: 'SN-998877',
      imageUrls: [up1.url, up2.url],
      purchaseDate: detailCam.body.purchaseDate,
      price: 1500,
      status: 'Damaged',
      damageDesc: '镜头划痕',
      rentalStatus: 'Rented',
      remark: '维修中',
    }),
  });
  log(
    '编辑相机（多图/损坏/出租中）',
    editCam.status === 200 &&
      editCam.body.imageUrls?.length === 2 &&
      editCam.body.status === 'Damaged' &&
      editCam.body.rentalStatus === 'Rented',
    { len: editCam.body.imageUrls?.length, status: editCam.body.status, rentalStatus: editCam.body.rentalStatus },
  );

  // 12. 按 status=Damaged 筛选应返回刚编辑的相机
  const listDamaged = await fetchJson(`/asset?status=Damaged`);
  log(
    '按 status=Damaged 筛选含相机',
    listDamaged.body?.some?.((a: any) => a.id === cameraId),
    { count: listDamaged.body?.length },
  );

  // 13. 删除单个上传的图片
  const delImg = await fetchJson('/upload', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: up2.url }),
  });
  log('删除单张图片接口', delImg.status === 200, delImg.body);

  // 14. 删除后静态访问应 404
  const after = await fetch('http://localhost:3000' + up2.url);
  log('删除后静态访问 404', after.status === 404, { status: after.status });

  // 15. 删除相机资产
  const delCam = await fetchJson(`/asset/${cameraId}`, { method: 'DELETE' });
  log('删除相机资产', delCam.status === 200);

  // 16. 删除配件资产
  const delAcc = await fetchJson(`/asset/${accessoryId}`, { method: 'DELETE' });
  log('删除配件资产', delAcc.status === 200);

  // 清理
  await fetchJson('/upload', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: up1.url }),
  });
  await fetchJson(`/device-model/${modelId}`, { method: 'DELETE' });
  await fetchJson(`/brand/${brandId}`, { method: 'DELETE' });
  fs.unlinkSync(tmpFile);

  console.log('\n--- 资产/上传 端到端验证完成 ---');
})().catch((e) => {
  console.error('❌ 脚本异常：', e);
  process.exit(1);
});
