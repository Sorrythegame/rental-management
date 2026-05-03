<template>
  <a-card :bordered="false">
    <template #title>
      <a-button type="link" @click="goBack" style="padding-left: 0;">
        <LeftOutlined /> 返回列表
      </a-button>
      <span style="margin-left: 8px;">订单详情</span>
    </template>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !order" description="订单不存在" />

      <template v-else-if="order">
        <a-descriptions :column="isMobile ? 1 : 2" bordered size="small">
          <a-descriptions-item label="订单 ID">{{ order.id }}</a-descriptions-item>
          <a-descriptions-item label="订单名称">{{ order.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="SIN 码">{{ order.sinCode || '-' }}</a-descriptions-item>
          <a-descriptions-item label="品牌">{{ order.brandName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="型号 / 名称">{{ order.modelName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="订单状态">
            <a-tag :color="statusColor(computeOrderStatus(order))">{{ statusText(computeOrderStatus(order)) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="订单金额">¥{{ order.amount }}</a-descriptions-item>
          <a-descriptions-item label="租赁开始时间">
            {{ order.startTime ? dayjs(order.startTime).format('YYYY-MM-DD HH:mm') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="租赁结束时间">
            {{ order.endTime ? dayjs(order.endTime).format('YYYY-MM-DD HH:mm') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="客户名">{{ order.customerName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="客户电话">{{ order.customerPhone || '-' }}</a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ order.remarks || '-' }}</a-descriptions-item>
        </a-descriptions>

        <a-divider />

        <h4>关联设备信息</h4>
        <a-empty v-if="!order.asset" description="未关联设备" />
        <a-descriptions v-else :column="isMobile ? 1 : 2" bordered size="small">
          <a-descriptions-item label="设备 ID">{{ order.asset.id }}</a-descriptions-item>
          <a-descriptions-item label="类型">
            <a-tag color="blue">{{ order.asset.type === 'Camera' ? '相机' : '配件' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="品牌">{{ order.asset.brand?.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="型号 / 名称">
            {{ order.asset.type === 'Camera' ? (order.asset.model?.name || '-') : (order.asset.name || '-') }}
          </a-descriptions-item>
          <a-descriptions-item label="设备状态">
            <a-tag :color="order.asset.status === 'Normal' ? 'green' : 'red'">
              {{ order.asset.status === 'Normal' ? '正常' : '损坏' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="租赁状态">
            <a-tag :color="order.asset.rentalStatus === 'Rented' ? 'green' : 'default'">
              {{ order.asset.rentalStatus === 'Rented' ? '出租中' : '未出租' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ order.asset.remark || '-' }}</a-descriptions-item>
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

        <template v-if="order.accessories?.length">
          <a-divider />
          <h4>关联配件</h4>
          <a-descriptions v-for="acc in order.accessories" :key="acc.id" :column="isMobile ? 1 : 2" bordered size="small" style="margin-bottom: 16px;">
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
import dayjs from 'dayjs';
import request from '../utils/request';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const order = ref<any>(null);
const isMobile = ref(window.innerWidth < 768);

const assetImageUrls = computed(() => {
  const v = order.value?.asset?.imageUrls;
  if (Array.isArray(v)) return v.filter((s: any) => typeof s === 'string' && s);
  return [];
});

const computeOrderStatus = (record: any): 'NotStarted' | 'InProgress' | 'Completed' | 'ManuallyStopped' => {
  if (record.orderStatus === 'ManuallyStopped') return 'ManuallyStopped';
  const now = Date.now();
  const start = new Date(record.startTime).getTime();
  const end = new Date(record.endTime).getTime();
  if (now < start) return 'NotStarted';
  if (now > end) return 'Completed';
  return 'InProgress';
};

const statusText = (s: string) => {
  const map: Record<string, string> = { NotStarted: '未开始', InProgress: '进行中', Completed: '已完成', ManuallyStopped: '手动停止' };
  return map[s] || s;
};

const statusColor = (s: string) => {
  const map: Record<string, string> = { NotStarted: 'default', InProgress: 'green', Completed: 'green', ManuallyStopped: 'red' };
  return map[s] || 'default';
};

const fetchOrder = async () => {
  const id = Number(route.params.id);
  if (!id) return;
  loading.value = true;
  try {
    order.value = await request.get(`/rental-order/${id}`);
  } finally {
    loading.value = false;
  }
};

const goBack = () => router.push({ name: 'Orders' });

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchOrder();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>
