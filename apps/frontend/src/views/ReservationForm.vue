<template>
  <a-card :bordered="false">
    <template #title>
      <a-button type="link" @click="goBack" style="padding-left: 0;">
        <LeftOutlined /> 返回列表
      </a-button>
      <span style="margin-left: 8px;">{{ isEdit ? '编辑预定' : '新增预定' }}</span>
    </template>

    <a-spin :spinning="loading">
      <a-form ref="formRef" :model="form" layout="vertical" :style="{ maxWidth: '720px' }">
        <!-- 预定名称 -->
        <a-form-item label="预定名称" name="name" :rules="[{ required: true, message: '请输入预定名称' }]">
          <a-input v-model:value="form.name" placeholder="请输入预定名称" />
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

        <!-- 租赁日期 -->
        <a-form-item label="租赁日期" name="dateRange" :rules="[{ required: true, message: '请选择租赁日期' }]">
          <a-range-picker v-model:value="form.dateRange" style="width: 100%" :disabled-date="disabledDate" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="预计金额" name="amount" :rules="[{ required: true, message: '请输入金额' }]">
              <a-input-number v-model:value="form.amount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="押金" name="deposit">
              <a-input-number v-model:value="form.deposit" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="客户名" name="customerName">
              <a-input v-model:value="form.customerName" placeholder="客户网名/姓名" />
            </a-form-item>
          </a-col>
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

const isEdit = ref(route.name === 'ReservationEdit');
const reservationId = ref<number | null>(isEdit.value ? Number(route.params.id) : null);
const loading = ref(false);
const submitting = ref(false);
const formRef = ref();

const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const cameraAssets = ref<any[]>([]);

interface ReservationForm {
  name: string;
  assetId: number | null;
  sinCode: string;
  brandModel: number[];
  dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  amount: number;
  deposit: number | null;
  customerName: string;
  customerPhone: string;
  remarks: string;
}

const blankForm = (): ReservationForm => ({
  name: '',
  assetId: null,
  sinCode: '',
  brandModel: [],
  dateRange: null,
  amount: 0,
  deposit: null,
  customerName: '',
  customerPhone: '',
  remarks: '',
});

const form = ref<ReservationForm>(blankForm());
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
    if (isEdit.value && reservationId.value) {
      params.excludeReservationId = String(reservationId.value);
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

const goBack = () => router.push({ name: 'Reservations' });

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
    fetchOccupancy(opt.asset.id);
  } else {
    form.value.assetId = null;
    form.value.brandModel = [];
    deviceImages.value = [];
    occupiedRanges.value = [];
  }
};

const loadReservation = async (id: number) => {
  loading.value = true;
  try {
    const reservation = await request.get(`/reservation/${id}`) as any;
    let asset = reservation.asset;
    if (!asset && reservation.assetId) {
      try {
        asset = await request.get(`/asset/${reservation.assetId}`);
      } catch {
        // ignore
      }
    }
    if (!asset && reservation.sinCode) {
      asset = cameraAssets.value.find((a) => a.sinCode === reservation.sinCode);
    }

    form.value = {
      name: reservation.name || '',
      assetId: reservation.assetId ?? null,
      sinCode: reservation.sinCode || '',
      brandModel: [],
      dateRange: reservation.startTime && reservation.endTime ? [dayjs(reservation.startTime), dayjs(reservation.endTime)] : null,
      amount: reservation.amount ?? 0,
      deposit: reservation.deposit ?? null,
      customerName: reservation.customerName || '',
      customerPhone: reservation.customerPhone || '',
      remarks: reservation.remarks || '',
    };

    if (asset) {
      applyAssetToForm(asset);
      await fetchOccupancy(asset.id);
    } else {
      deviceImages.value = [];
      occupiedRanges.value = [];
    }
  } catch {
    message.error('预定加载失败');
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
      startTime: form.value.dateRange?.[0]?.startOf('day').toISOString(),
      endTime: form.value.dateRange?.[1]?.endOf('day').toISOString(),
      amount: form.value.amount,
      deposit: form.value.deposit,
      customerName: form.value.customerName,
      customerPhone: form.value.customerPhone,
      remarks: form.value.remarks,
    };
    if (isEdit.value && reservationId.value) {
      await request.put(`/reservation/${reservationId.value}`, payload);
      message.success('预定已更新');
    } else {
      await request.post('/reservation', payload);
      message.success('预定已新增');
    }
    router.push({ name: 'Reservations' });
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await fetchDicts();
  await fetchCameraAssets();
  if (isEdit.value && reservationId.value) {
    await loadReservation(reservationId.value);
  }
});
</script>
