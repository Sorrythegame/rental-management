<template>
  <div>
    <a-card title="订单管理" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="goAdd">新增订单</a-button>
      </template>

      <!-- 筛选区 -->
      <div class="filter-bar">
        <a-select
          v-model:value="filters.brandName"
          placeholder="品牌"
          allow-clear
          :style="{ width: '180px' }"
          @change="onFilterChange"
        >
          <a-select-option v-for="b in brands" :key="b.id" :value="b.name">{{ b.name }}</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.modelName"
          placeholder="型号"
          allow-clear
          :style="{ width: '180px' }"
          @change="onFilterChange"
        >
          <a-select-option v-for="m in deviceModels" :key="m.id" :value="m.name">{{ m.name }}</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.orderStatus"
          placeholder="订单状态"
          allow-clear
          :style="{ width: '160px' }"
          @change="onFilterChange"
        >
          <a-select-option value="NotStarted">未开始</a-select-option>
          <a-select-option value="InProgress">进行中</a-select-option>
          <a-select-option value="Completed">已完成</a-select-option>
        </a-select>
        <a-input
          v-model:value="filters.sinCode"
          placeholder="SIN 码"
          allow-clear
          :style="{ width: '200px' }"
          @pressEnter="onFilterChange"
        />
        <a-space>
          <a-button type="primary" @click="onFilterChange">查询</a-button>
          <a-button @click="resetFilters">重置</a-button>
        </a-space>
      </div>

      <!-- 桌面端表格展示 -->
      <a-table
        v-if="!isMobile"
        :columns="columns"
        :data-source="orders"
        :row-key="(record: any) => record.id"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brandModel'">
            {{ record.brandName || '-' }} {{ record.modelName || '' }}
          </template>
          <template v-if="column.key === 'orderStatus'">
            <a-tag :color="statusColor(computeOrderStatus(record.startTime, record.endTime))">
              {{ statusText(computeOrderStatus(record.startTime, record.endTime)) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'timeRange'">
            {{ formatTime(record.startTime) }} ~ {{ formatTime(record.endTime) }}
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="goDetail(record)">查看</a-button>
              <a-button type="link" size="small" @click="goEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="confirmDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>

      <!-- 移动端卡片展示 -->
      <div v-else>
        <a-empty v-if="!orders.length && !loading" description="暂无订单" />
        <a-card v-for="order in orders" :key="order.id" style="margin-bottom: 16px;">
          <p><strong>订单 ID：</strong>{{ order.id }}</p>
          <p><strong>品牌型号：</strong>{{ order.brandName || '-' }} {{ order.modelName || '' }}</p>
          <p><strong>SIN 码：</strong>{{ order.sinCode || '-' }}</p>
          <p><strong>租赁时间：</strong>{{ formatTime(order.startTime) }} ~ {{ formatTime(order.endTime) }}</p>
          <p>
            <strong>订单状态：</strong>
            <a-tag :color="statusColor(computeOrderStatus(order.startTime, order.endTime))">
              {{ statusText(computeOrderStatus(order.startTime, order.endTime)) }}
            </a-tag>
          </p>
          <p><strong>金额：</strong>¥{{ order.amount }}</p>
          <p><strong>客户：</strong>{{ order.customerName || '-' }} {{ order.customerPhone || '' }}</p>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
            <a-button size="small" @click="goDetail(order)">查看</a-button>
            <a-button size="small" @click="goEdit(order)">编辑</a-button>
            <a-button size="small" danger @click="confirmDelete(order)">删除</a-button>
          </div>
        </a-card>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import request from '../utils/request';

const router = useRouter();

const isMobile = ref(window.innerWidth < 768);
const orders = ref<any[]>([]);
const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const loading = ref(false);

const filters = ref<{
  brandName?: string;
  modelName?: string;
  orderStatus?: string;
  sinCode?: string;
}>({});

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '品牌型号', key: 'brandModel', width: 180 },
  { title: 'SIN 码', dataIndex: 'sinCode', key: 'sinCode', width: 140 },
  { title: '租赁时间', key: 'timeRange', width: 220 },
  { title: '订单状态', key: 'orderStatus', width: 100 },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 100 },
  { title: '客户名', dataIndex: 'customerName', key: 'customerName', width: 120 },
  { title: '客户电话', dataIndex: 'customerPhone', key: 'customerPhone', width: 130 },
  { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true, width: 160 },
  { title: '操作', key: 'actions', width: 200, fixed: !isMobile.value ? ('right' as const) : undefined },
];

const computeOrderStatus = (startTime: string, endTime: string): 'NotStarted' | 'InProgress' | 'Completed' => {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now < start) return 'NotStarted';
  if (now > end) return 'Completed';
  return 'InProgress';
};

const statusText = (s: string) => {
  const map: Record<string, string> = { NotStarted: '未开始', InProgress: '进行中', Completed: '已完成' };
  return map[s] || s;
};

const statusColor = (s: string) => {
  const map: Record<string, string> = { NotStarted: 'default', InProgress: 'blue', Completed: 'green' };
  return map[s] || 'default';
};

const formatTime = (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-');

const buildParams = () => {
  const p: Record<string, string> = {};
  if (filters.value.brandName) p.brandName = filters.value.brandName;
  if (filters.value.modelName) p.modelName = filters.value.modelName;
  if (filters.value.orderStatus) p.orderStatus = filters.value.orderStatus;
  if (filters.value.sinCode?.trim()) p.sinCode = filters.value.sinCode.trim();
  return p;
};

const fetchOrders = async () => {
  loading.value = true;
  try {
    orders.value = (await request.get('/rental-order', { params: buildParams() })) as unknown as any[];
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const fetchDicts = async () => {
  const [brandsData, modelsData] = (await Promise.all([
    request.get('/brand'),
    request.get('/device-model'),
  ])) as unknown as [any[], any[]];
  brands.value = brandsData;
  deviceModels.value = modelsData;
};

const onFilterChange = () => {
  fetchOrders();
};

const resetFilters = () => {
  filters.value = {};
  fetchOrders();
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchDicts();
  fetchOrders();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 操作
const goAdd = () => router.push({ name: 'OrderAdd' });
const goEdit = (record: any) => router.push({ name: 'OrderEdit', params: { id: record.id } });
const goDetail = (record: any) => router.push({ name: 'OrderDetail', params: { id: record.id } });

const confirmDelete = (record: any) => {
  Modal.confirm({
    title: '确认删除该订单？',
    content: h('div', null, [
      h('div', `订单 ${record.id}：${record.brandName || ''} ${record.modelName || ''}`),
      h('div', { style: 'color: #999; font-size: 12px;' }, '删除后无法恢复'),
    ]),
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await request.delete(`/rental-order/${record.id}`);
        message.success('订单已删除');
        await fetchOrders();
      } catch {
        // 拦截器已提示
      }
    },
  });
};
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
</style>
