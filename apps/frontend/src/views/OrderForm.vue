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
        <!-- SIN 码：可搜索下拉，选中后带出品牌型号与图片 -->
        <a-form-item label="SIN 码" name="sinCode" :rules="[{ required: true, message: '请选择 SIN 码' }]">
          <a-select
            v-model:value="form.sinCode"
            show-search
            placeholder="搜索或选择设备 SIN 码"
            :options="sinOptions"
            :filter-option="filterSin"
            @change="onSinChange"
          />
        </a-form-item>

        <!-- 品牌型号：级联选择，只读 -->
        <a-form-item label="品牌型号" name="brandModel"
          :rules="[{ required: true, message: '请通过 SIN 码选择设备', validator: validateBrandModel }]"
        >
          <a-cascader
            v-model:value="form.brandModel"
            :options="cascaderOptions"
            placeholder="由 SIN 码自动带出"
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

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="租赁开始时间" name="startTime" :rules="[{ required: true, message: '请选择开始时间' }]">
              <a-date-picker v-model:value="form.startTime" show-time style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="租赁结束时间" name="endTime" :rules="[{ required: true, message: '请选择结束时间' }]">
              <a-date-picker v-model:value="form.endTime" show-time style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

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

interface OrderForm {
  assetId: number | null;
  sinCode: string;
  brandModel: number[]; // [brandId, modelId]
  startTime: dayjs.Dayjs | null;
  endTime: dayjs.Dayjs | null;
  amount: number;
  customerName: string;
  customerPhone: string;
  remarks: string;
}

const blankForm = (): OrderForm => ({
  assetId: null,
  sinCode: '',
  brandModel: [],
  startTime: null,
  endTime: null,
  amount: 0,
  customerName: '',
  customerPhone: '',
  remarks: '',
});

const form = ref<OrderForm>(blankForm());
const deviceImages = ref<string[]>([]);

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
  return form.value.brandModel.length === 2 ? Promise.resolve() : Promise.reject(new Error('请通过 SIN 码选择设备'));
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
  } else {
    form.value.assetId = null;
    form.value.brandModel = [];
    deviceImages.value = [];
  }
};

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
      assetId: order.assetId ?? null,
      sinCode: order.sinCode || '',
      brandModel: [],
      startTime: order.startTime ? dayjs(order.startTime) : null,
      endTime: order.endTime ? dayjs(order.endTime) : null,
      amount: order.amount ?? 0,
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      remarks: order.remarks || '',
    };

    if (asset) {
      applyAssetToForm(asset);
    } else {
      deviceImages.value = [];
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
      assetId: form.value.assetId,
      sinCode: form.value.sinCode,
      brandName: brand?.name || '',
      modelName: model?.name || '',
      startTime: form.value.startTime?.toISOString(),
      endTime: form.value.endTime?.toISOString(),
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
  if (isEdit.value && orderId.value) {
    await loadOrder(orderId.value);
  } else if (assetIdFromQuery.value) {
    const id = Number(assetIdFromQuery.value);
    if (id) {
      try {
        const asset = await request.get(`/asset/${id}`) as any;
        applyAssetToForm(asset);
      } catch {
        message.error('关联设备信息加载失败');
      }
    }
  }
});
</script>
