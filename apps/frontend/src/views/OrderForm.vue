<template>
  <a-card :bordered="false">
    <template #title>
      <a-button type="link" @click="goBack" style="padding-left: 0;">
        <LeftOutlined /> 返回列表
      </a-button>
      <span style="margin-left: 8px;">{{ isEdit ? '编辑订单' : '新增订单' }}</span>
    </template>

    <a-spin :spinning="loading">
      <a-form ref="formRef" :model="form" layout="vertical" :style="{ maxWidth: '720px' }">
        <!-- 订单名称 -->
        <a-form-item label="订单名称" name="name" :rules="[{ required: true, message: '请输入订单名称' }]">
          <a-input v-model:value="form.name" placeholder="请输入订单名称" />
        </a-form-item>

        <!-- S/N码：可搜索下拉，选中后带出品牌型号与图片 -->
        <a-form-item label="S/N码" name="sinCode" :rules="[{ required: true, message: '请选择 S/N码' }]">
          <a-select
            v-model:value="form.sinCode"
            show-search
            placeholder="搜索或选择设备 S/N码"
            :options="sinOptions"
            :filter-option="filterSin"
            @change="onSinChange"
          />
        </a-form-item>

        <!-- 品牌型号：级联选择，只读 -->
        <a-form-item label="品牌型号" name="brandModel"
          :rules="[{ required: true, message: '请通过 S/N码选择设备', validator: validateBrandModel }]"
        >
          <a-cascader
            v-model:value="form.brandModel"
            :options="cascaderOptions"
            placeholder="由 S/N码自动带出"
            disabled
          />
        </a-form-item>

        <!-- 设备图片：只读预览 -->
        <a-form-item label="设备图片">
          <a-empty v-if="!deviceImages.length" description="暂无图片" />
          <div v-else style="display: flex; flex-wrap: wrap; gap: 8px;">
            <a-image
              v-for="url in deviceImages"
              :key="url"
              :src="url"
              :width="100"
              :height="100"
              style="object-fit: cover;"
            />
          </div>
        </a-form-item>

        <!-- 配件：多选下拉框 -->
        <a-form-item label="配件" name="accessoryIds">
          <a-select
            v-model:value="form.accessoryIds"
            mode="multiple"
            placeholder="选择关联配件"
            :options="availableAccessoryOptions"
            :disabled="accessoryLoading"
            allow-clear
          />
        </a-form-item>

        <!-- 已选配件图片预览 -->
        <a-form-item v-if="selectedAccessoryImages.length" label="配件图片">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <div v-for="acc in selectedAccessoryImages" :key="acc.id" style="text-align: center;">
              <a-image
                v-if="acc.imageUrl"
                :src="acc.imageUrl"
                :width="80"
                :height="80"
                style="object-fit: cover;"
              />
              <div style="font-size: 12px; color: #666; margin-top: 4px;">{{ acc.name }}</div>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="租赁日期" name="dateRange" :rules="[{ required: true, message: '请选择租赁日期' }]">
          <a-range-picker v-model:value="form.dateRange" style="width: 100%" :disabled-date="disabledDate" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="订单金额" name="amount" :rules="[{ required: true, message: '请输入金额' }]">
              <a-input-number v-model:value="form.amount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户名" name="customerName">
              <a-input v-model:value="form.customerName" placeholder="客户网名/姓名" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="客户电话" name="customerPhone">
              <a-input v-model:value="form.customerPhone" placeholder="联系电话" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="备注" name="remarks">
          <a-textarea v-model:value="form.remarks" :rows="3" placeholder="可选" />
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleSubmit">保存</a-button>
            <a-button @click="goBack">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-spin>
  </a-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LeftOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import request from '../utils/request';

const route = useRoute();
const router = useRouter();

const isEdit = ref(route.name === 'OrderEdit');
const orderId = ref<number | null>(isEdit.value ? Number(route.params.id) : null);
const assetIdFromQuery = ref<string | undefined>(route.query.assetId as string | undefined);
const loading = ref(false);
const submitting = ref(false);
const formRef = ref();

const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const cameraAssets = ref<any[]>([]);
const allAccessories = ref<any[]>([]);
const accessoryLoading = ref(false);

interface OrderForm {
  name: string;
  assetId: number | null;
  sinCode: string;
  brandModel: number[]; // [brandId, modelId]
  accessoryIds: number[];
  dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  amount: number;
  customerName: string;
  customerPhone: string;
  remarks: string;
}

const blankForm = (): OrderForm => ({
  name: '',
  assetId: null,
  sinCode: '',
  brandModel: [],
  accessoryIds: [],
  dateRange: null,
  amount: 0,
  customerName: '',
  customerPhone: '',
  remarks: '',
});

const form = ref<OrderForm>(blankForm());
const deviceImages = ref<string[]>([]);
const occupiedRanges = ref<{ startTime: string; endTime: string }[]>([]);

const disabledDate = (current: dayjs.Dayjs) => {
  if (!current) return false;
  const d = current.startOf('day').valueOf();
  return occupiedRanges.value.some((range) => {
    const start = dayjs(range.startTime).startOf('day').valueOf();
    const end = dayjs(range.endTime).startOf('day').valueOf();
    return d >= start && d <= end;
  });
};

const fetchOccupancy = async (assetId: number) => {
  if (!assetId) {
    occupiedRanges.value = [];
    return;
  }
  try {
    const params: Record<string, string> = {};
    if (isEdit.value && orderId.value) {
      params.excludeOrderId = String(orderId.value);
    }
    occupiedRanges.value = (await request.get(`/asset/${assetId}/occupancy`, { params })) as unknown as { startTime: string; endTime: string }[];
  } catch {
    occupiedRanges.value = [];
  }
};

const cascaderOptions = computed(() => {
  return brands.value.map((b) => ({
    value: b.id,
    label: b.name,
    children: deviceModels.value
      .filter((m) => m.brandId === b.id)
      .map((m) => ({ value: m.id, label: m.name })),
  }));
});

const sinOptions = computed(() => {
  return cameraAssets.value.map((a) => ({
    label: a.sinCode || `ID:${a.id}`,
    value: a.sinCode || `ID:${a.id}`,
    asset: a,
  }));
});

const filterSin = (input: string, option: any) => {
  return (option.label || '').toLowerCase().includes(input.toLowerCase());
};

const validateBrandModel = () => {
  return form.value.brandModel.length === 2 ? Promise.resolve() : Promise.reject(new Error('请通过 S/N码选择设备'));
};

const goBack = () => router.push({ name: 'Orders' });

const fetchDicts = async () => {
  const [brandsData, modelsData] = (await Promise.all([
    request.get('/brand'),
    request.get('/device-model'),
  ])) as unknown as [any[], any[]];
  brands.value = brandsData;
  deviceModels.value = modelsData;
};

const fetchCameraAssets = async () => {
  cameraAssets.value = (await request.get('/asset', { params: { type: 'Camera' } })) as unknown as any[];
};

const fetchAccessories = async () => {
  accessoryLoading.value = true;
  try {
    allAccessories.value = (await request.get('/asset', { params: { type: 'Accessory' } })) as unknown as any[];
  } finally {
    accessoryLoading.value = false;
  }
};

const applyAssetToForm = (asset: any) => {
  form.value.assetId = asset.id ?? null;
  form.value.sinCode = asset.sinCode || '';
  if (asset.brandId && asset.modelId) {
    form.value.brandModel = [asset.brandId, asset.modelId];
  } else {
    form.value.brandModel = [];
  }
  const imgs: string[] = Array.isArray(asset.imageUrls) ? asset.imageUrls.filter((s: any) => typeof s === 'string' && s) : [];
  deviceImages.value = imgs;
};

const onSinChange = (value: string) => {
  const opt = sinOptions.value.find((o) => o.value === value);
  if (opt?.asset) {
    applyAssetToForm(opt.asset);
    fetchOccupancy(opt.asset.id);
  } else {
    form.value.assetId = null;
    form.value.brandModel = [];
    deviceImages.value = [];
    occupiedRanges.value = [];
  }
};

// 已被其他非 Completed 订单占用的配件 IDs（排除当前订单）
const occupiedAccessoryIds = computed(() => {
  const occupied = new Set<number>();
  const currentIds = new Set(form.value.accessoryIds.map((id) => Number(id)));
  allAccessories.value.forEach((acc) => {
    if (acc.rentalStatus === 'Rented') {
      if (!currentIds.has(acc.id)) {
        occupied.add(acc.id);
      }
    }
  });
  return occupied;
});

const availableAccessoryOptions = computed(() => {
  return allAccessories.value
    .filter((a) => !occupiedAccessoryIds.value.has(a.id))
    .map((a) => ({
      label: a.name || `ID:${a.id}`,
      value: a.id,
      asset: a,
    }));
});

const selectedAccessoryImages = computed(() => {
  return form.value.accessoryIds
    .map((id) => Number(id))
    .map((id) => allAccessories.value.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => ({
      id: a.id,
      name: a.name || `ID:${a.id}`,
      imageUrl: Array.isArray(a.imageUrls) && a.imageUrls.length ? a.imageUrls[0] : '',
    }));
});

const loadOrder = async (id: number) => {
  loading.value = true;
  try {
    const order = await request.get(`/rental-order/${id}`) as any;
    let asset = order.asset;
    if (!asset && order.assetId) {
      try {
        asset = await request.get(`/asset/${order.assetId}`);
      } catch {
        // ignore
      }
    }
    if (!asset && order.sinCode) {
      asset = cameraAssets.value.find((a) => a.sinCode === order.sinCode);
    }

    form.value = {
      name: order.name || '',
      assetId: order.assetId ?? null,
      sinCode: order.sinCode || '',
      brandModel: [],
      accessoryIds: (order.accessories || []).map((acc: any) => Number(acc.assetId)).filter((id: number) => !isNaN(id)),
      dateRange: order.startTime && order.endTime ? [dayjs(order.startTime), dayjs(order.endTime)] : null,
      amount: order.amount ?? 0,
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      remarks: order.remarks || '',
    };

    if (asset) {
      applyAssetToForm(asset);
      await fetchOccupancy(asset.id);
    } else {
      deviceImages.value = [];
      occupiedRanges.value = [];
    }
  } catch {
    message.error('订单加载失败');
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const brandId = form.value.brandModel[0];
    const modelId = form.value.brandModel[1];
    const brand = brands.value.find((b) => b.id === brandId);
    const model = deviceModels.value.find((m) => m.id === modelId);

    const payload = {
      name: form.value.name,
      assetId: form.value.assetId,
      sinCode: form.value.sinCode,
      brandName: brand?.name || '',
      modelName: model?.name || '',
      accessoryIds: form.value.accessoryIds.map((id) => Number(id)).filter((id) => !isNaN(id)),
      startTime: form.value.dateRange?.[0]?.startOf('day').toISOString(),
      endTime: form.value.dateRange?.[1]?.endOf('day').toISOString(),
      amount: form.value.amount,
      customerName: form.value.customerName,
      customerPhone: form.value.customerPhone,
      remarks: form.value.remarks,
    };
    if (isEdit.value && orderId.value) {
      await request.put(`/rental-order/${orderId.value}`, payload);
      message.success('订单已更新');
    } else {
      await request.post('/rental-order', payload);
      message.success('订单已新增');
    }
    router.push({ name: 'Orders' });
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await fetchDicts();
  await fetchCameraAssets();
  await fetchAccessories();
  if (isEdit.value && orderId.value) {
    await loadOrder(orderId.value);
  } else if (assetIdFromQuery.value) {
    const id = Number(assetIdFromQuery.value);
    if (id) {
      try {
        const asset = await request.get(`/asset/${id}`) as any;
        applyAssetToForm(asset);
        await fetchOccupancy(id);
      } catch {
        message.error('关联设备信息加载失败');
      }
    }
  }
});
</script>
