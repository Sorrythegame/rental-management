<template>
  <a-card :bordered="false">
    <template #title>
      <a-button type="link" @click="goBack" style="padding-left: 0;">
        <LeftOutlined /> 返回列表
      </a-button>
      <span style="margin-left: 8px;">预定详情</span>
    </template>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !reservation" description="预定不存在" />

      <template v-else-if="reservation">
        <a-descriptions :column="isMobile ? 1 : 2" bordered size="small">
          <a-descriptions-item label="预定 ID">{{ reservation.id }}</a-descriptions-item>
          <a-descriptions-item label="预定名称">{{ reservation.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="SIN 码">{{ reservation.sinCode || '-' }}</a-descriptions-item>
          <a-descriptions-item label="品牌">{{ reservation.brandName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="型号 / 名称">{{ reservation.modelName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="预定状态">
            <a-tag :color="statusColor(reservation.status)">{{ statusText(reservation.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="预计金额">¥{{ reservation.amount }}</a-descriptions-item>
          <a-descriptions-item label="押金">¥{{ reservation.deposit ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="租赁开始日期">
            {{ reservation.startTime ? dayjs(reservation.startTime).format('YYYY-MM-DD') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="租赁结束日期">
            {{ reservation.endTime ? dayjs(reservation.endTime).format('YYYY-MM-DD') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="客户名">{{ reservation.customerName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="客户电话">{{ reservation.customerPhone || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ reservation.createdAt ? dayjs(reservation.createdAt).format('YYYY-MM-DD HH:mm') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ reservation.remarks || '-' }}</a-descriptions-item>
        </a-descriptions>

        <template v-if="reservation.rentalOrder">
          <a-divider />
          <h4>关联正式订单</h4>
          <a-descriptions :column="isMobile ? 1 : 2" bordered size="small">
            <a-descriptions-item label="订单 ID">{{ reservation.rentalOrder.id }}</a-descriptions-item>
            <a-descriptions-item label="订单状态">
              <a-tag :color="orderStatusColor(reservation.rentalOrder.orderStatus)">
                {{ orderStatusText(reservation.rentalOrder.orderStatus) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="订单金额">¥{{ reservation.rentalOrder.amount }}</a-descriptions-item>
            <a-descriptions-item label="操作" :span="2">
              <a-button type="link" size="small" @click="goOrderDetail(reservation.rentalOrder.id)">查看订单详情</a-button>
            </a-descriptions-item>
          </a-descriptions>
        </template>

        <template v-else-if="reservation.status === 'Pending' || reservation.status === 'Confirmed'">
          <a-divider />
          <a-button type="primary" @click="openConvertModal">转为正式订单</a-button>
        </template>

        <a-modal
          v-model:open="convertModalVisible"
          title="选择配件并转单"
          :confirm-loading="convertModalLoading"
          @ok="handleConvert"
        >
          <a-form layout="vertical">
            <a-form-item label="配件（多选）">
              <a-select
                v-model:value="convertAccessoryIds"
                mode="multiple"
                placeholder="选择关联配件"
                :options="availableAccessoryOptions"
                allow-clear
              />
            </a-form-item>
          </a-form>
        </a-modal>

        <a-divider />

        <h4>关联设备信息</h4>
        <a-empty v-if="!reservation.asset" description="未关联设备" />
        <a-descriptions v-else :column="isMobile ? 1 : 2" bordered size="small">
          <a-descriptions-item label="设备 ID">{{ reservation.asset.id }}</a-descriptions-item>
          <a-descriptions-item label="类型">
            <a-tag color="blue">{{ reservation.asset.type === 'Camera' ? '相机' : '配件' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="品牌">{{ reservation.asset.brand?.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="型号 / 名称">
            {{ reservation.asset.type === 'Camera' ? (reservation.asset.model?.name || '-') : (reservation.asset.name || '-') }}
          </a-descriptions-item>
          <a-descriptions-item label="设备状态">
            <a-tag :color="reservation.asset.status === 'Normal' ? 'green' : 'red'">
              {{ reservation.asset.status === 'Normal' ? '正常' : '损坏' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ reservation.asset.remark || '-' }}</a-descriptions-item>
          <a-descriptions-item label="资产图片" :span="2">
            <a-empty v-if="!assetImageUrls.length" description="暂无图片" />
            <a-image-preview-group v-else>
              <a-image
                v-for="url in assetImageUrls"
                :key="url"
                :src="url"
                :width="120"
                :height="120"
                style="object-fit: cover; margin-right: 8px; margin-bottom: 8px;"
              />
            </a-image-preview-group>
          </a-descriptions-item>
        </a-descriptions>

        <template v-if="reservation.accessories?.length">
          <a-divider />
          <h4>关联配件</h4>
          <a-descriptions v-for="acc in reservation.accessories" :key="acc.id" :column="isMobile ? 1 : 2" bordered size="small" style="margin-bottom: 16px;">
            <a-descriptions-item label="配件名称">{{ acc.asset?.name || `ID:${acc.assetId}` }}</a-descriptions-item>
            <a-descriptions-item label="设备状态">
              <a-tag :color="acc.asset?.status === 'Normal' ? 'green' : 'red'">
                {{ acc.asset?.status === 'Normal' ? '正常' : '损坏' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item v-if="acc.asset?.imageUrls?.length" label="配件图片" :span="2">
              <a-image-preview-group>
                <a-image
                  v-for="url in acc.asset.imageUrls.filter((s: any) => typeof s === 'string' && s)"
                  :key="url"
                  :src="url"
                  :width="100"
                  :height="100"
                  style="object-fit: cover; margin-right: 8px; margin-bottom: 8px;"
                />
              </a-image-preview-group>
            </a-descriptions-item>
          </a-descriptions>
        </template>
      </template>
    </a-spin>
  </a-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LeftOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import request from '../utils/request';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const reservation = ref<any>(null);
const isMobile = ref(window.innerWidth < 768);
const allAccessories = ref<any[]>([]);

// 转单弹窗
const convertModalVisible = ref(false);
const convertModalLoading = ref(false);
const convertAccessoryIds = ref<number[]>([]);

const occupiedAccessoryIds = computed(() => {
  const occupied = new Set<number>();
  allAccessories.value.forEach((acc) => {
    if (acc.rentalStatus === 'Rented') {
      occupied.add(acc.id);
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
    }));
});

const assetImageUrls = computed(() => {
  const v = reservation.value?.asset?.imageUrls;
  if (Array.isArray(v)) return v.filter((s: any) => typeof s === 'string' && s);
  return [];
});

const statusText = (s: string) => {
  const map: Record<string, string> = { Pending: '待确认', Confirmed: '已确认', Cancelled: '已取消', Converted: '已转单' };
  return map[s] || s;
};

const statusColor = (s: string) => {
  const map: Record<string, string> = { Pending: 'orange', Confirmed: 'blue', Cancelled: 'default', Converted: 'green' };
  return map[s] || 'default';
};

const orderStatusText = (s: string) => {
  const map: Record<string, string> = { NotStarted: '未开始', InProgress: '进行中', Completed: '已完成', ManuallyStopped: '手动停止' };
  return map[s] || s;
};

const orderStatusColor = (s: string) => {
  const map: Record<string, string> = { NotStarted: 'default', InProgress: 'green', Completed: 'green', ManuallyStopped: 'red' };
  return map[s] || 'default';
};

const fetchReservation = async () => {
  const id = Number(route.params.id);
  if (!id) return;
  loading.value = true;
  try {
    reservation.value = await request.get(`/reservation/${id}`);
  } finally {
    loading.value = false;
  }
};

const goBack = () => router.push({ name: 'Reservations' });
const goOrderDetail = (id: number) => router.push({ name: 'OrderDetail', params: { id } });

const fetchAccessories = async () => {
  allAccessories.value = (await request.get('/asset', { params: { type: 'Accessory' } })) as unknown as any[];
};

const openConvertModal = () => {
  convertAccessoryIds.value = [];
  convertModalVisible.value = true;
};

const handleConvert = async () => {
  if (!reservation.value) return;
  convertModalLoading.value = true;
  try {
    const order = await request.put(`/reservation/${reservation.value.id}/convert`, {
      accessoryIds: convertAccessoryIds.value,
    });
    message.success('已转单，订单 ID：' + order.id);
    convertModalVisible.value = false;
    await fetchReservation();
  } catch {
    // 拦截器已提示
  } finally {
    convertModalLoading.value = false;
  }
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchAccessories();
  fetchReservation();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>
