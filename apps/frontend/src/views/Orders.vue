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
          <a-select-option value="ManuallyStopped">手动停止</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.sinCode"
          show-search
          placeholder="S/N码"
          allow-clear
          :style="{ width: '200px' }"
          :options="sinOptions"
          :filter-option="filterSin"
          @change="onFilterChange"
        />
        <a-range-picker
          v-model:value="filters.dateRange"
          :style="{ width: '240px' }"
          @change="onFilterChange"
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
        :pagination="pagination"
        :scroll="{ x: 1500 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            {{ record.name || '-' }}
          </template>
          <template v-if="column.key === 'brandModel'">
            {{ record.brandName || '-' }} {{ record.modelName || '' }}
          </template>
          <template v-if="column.key === 'accessories'">
            {{ accessoryNames(record) || '-' }}
          </template>
          <template v-if="column.key === 'orderStatus'">
            <a-tag :color="statusColor(computeOrderStatus(record))">
              {{ statusText(computeOrderStatus(record)) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'timeRange'">
            {{ formatTime(record.startTime) }} ~ {{ formatTime(record.endTime) }}
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="goDetail(record)">查看</a-button>
              <a-button type="link" size="small" @click="goEdit(record)">编辑</a-button>
              <a-button v-if="computeOrderStatus(record) === 'InProgress'" type="link" size="small" danger @click="confirmStop(record)">停止订单</a-button>
              <a-button type="link" size="small" danger @click="confirmDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>

      <!-- 移动端卡片展示 -->
      <div v-else>
        <a-empty v-if="!orders.length && !loading" description="暂无订单" />
        <a-card v-for="order in orders" :key="order.id" style="margin-bottom: 16px;">
          <p><strong>订单名称：</strong>{{ order.name || '-' }}</p>
          <p><strong>品牌型号：</strong>{{ order.brandName || '-' }} {{ order.modelName || '' }}</p>
          <p><strong>S/N码：</strong>{{ order.sinCode || '-' }}</p>
          <p v-if="order.accessories?.length"><strong>配件：</strong>{{ accessoryNames(order) }}</p>
          <p><strong>租赁时间：</strong>{{ formatTime(order.startTime) }} ~ {{ formatTime(order.endTime) }}</p>
          <p>
            <strong>订单状态：</strong>
            <a-tag :color="statusColor(computeOrderStatus(order))">
              {{ statusText(computeOrderStatus(order)) }}
            </a-tag>
          </p>
          <p><strong>金额：</strong>¥{{ order.amount }}</p>
          <p><strong>客户：</strong>{{ order.customerName || '-' }} {{ order.customerPhone || '' }}</p>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
            <a-button size="small" @click="goDetail(order)">查看</a-button>
            <a-button size="small" @click="goEdit(order)">编辑</a-button>
            <a-button v-if="computeOrderStatus(order) === 'InProgress'" size="small" danger @click="confirmStop(order)">停止</a-button>
            <a-button size="small" danger @click="confirmDelete(order)">删除</a-button>
          </div>
        </a-card>
        <a-pagination
          v-if="pagination.total > 0"
          v-model:current="pagination.current"
          v-model:pageSize="pagination.pageSize"
          :total="pagination.total"
          :page-size-options="pagination.pageSizeOptions"
          show-size-changer
          :show-total="pagination.showTotal"
          style="margin-top: 16px; text-align: right;"
          @change="fetchOrders"
        />
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import request from '../utils/request';

const router = useRouter();

const isMobile = ref(window.innerWidth < 768);
const orders = ref<any[]>([]);
const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const cameraAssets = ref<any[]>([]);
const loading = ref(false);

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
});

const filters = ref<{
  brandName?: string;
  modelName?: string;
  orderStatus?: string;
  sinCode?: string;
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
}>({});

const columns = [
  { title: '订单名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
  { title: '品牌型号', key: 'brandModel', width: 180 },
  { title: 'S/N码', dataIndex: 'sinCode', key: 'sinCode', width: 140 },
  { title: '配件', key: 'accessories', width: 180, ellipsis: true },
  { title: '租赁时间', key: 'timeRange', width: 220 },
  { title: '订单状态', key: 'orderStatus', width: 100 },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 100 },
  { title: '客户名', dataIndex: 'customerName', key: 'customerName', width: 120 },
  { title: '客户电话', dataIndex: 'customerPhone', key: 'customerPhone', width: 130 },
  { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true, width: 160 },
  { title: '操作', key: 'actions', width: 260, fixed: !isMobile.value ? ('right' as const) : undefined },
];

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

const formatTime = (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-');

const accessoryNames = (record: any): string => {
  const accessories = record.accessories || [];
  if (!accessories.length) return '';
  return accessories.map((a: any) => a.asset?.name || `ID:${a.assetId}`).join('，');
};

const sinOptions = computed(() => {
  return cameraAssets.value.map((a) => ({
    label: a.sinCode || `ID:${a.id}`,
    value: a.sinCode || `ID:${a.id}`,
  }));
});

const filterSin = (input: string, option: any) => {
  return (option.label || '').toLowerCase().includes(input.toLowerCase());
};

const fetchCameraAssets = async () => {
  cameraAssets.value = (await request.get('/asset', { params: { type: 'Camera' } })) as unknown as any[];
};

const buildParams = () => {
  const p: Record<string, string | number> = {};
  if (filters.value.brandName) p.brandName = filters.value.brandName;
  if (filters.value.modelName) p.modelName = filters.value.modelName;
  if (filters.value.orderStatus) p.orderStatus = filters.value.orderStatus;
  if (filters.value.sinCode?.trim()) p.sinCode = filters.value.sinCode.trim();
  if (filters.value.dateRange?.[0]) p.startDate = filters.value.dateRange[0].format('YYYY-MM-DD');
  if (filters.value.dateRange?.[1]) p.endDate = filters.value.dateRange[1].format('YYYY-MM-DD');
  p.page = pagination.value.current;
  p.pageSize = pagination.value.pageSize;
  return p;
};

const fetchOrders = async () => {
  loading.value = true;
  try {
    const res = (await request.get('/rental-order', { params: buildParams() })) as { list: any[]; total: number };
    orders.value = res.list;
    pagination.value.total = res.total;
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
  pagination.value.current = 1;
  fetchOrders();
};

const resetFilters = () => {
  filters.value = {};
  pagination.value.current = 1;
  pagination.value.pageSize = 10;
  fetchOrders();
};

const handleTableChange = (pag: any) => {
  pagination.value.current = pag.current;
  pagination.value.pageSize = pag.pageSize;
  fetchOrders();
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchDicts();
  fetchCameraAssets();
  fetchOrders();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 操作
const goAdd = () => router.push({ name: 'OrderAdd' });
const goEdit = (record: any) => router.push({ name: 'OrderEdit', params: { id: record.id } });
const goDetail = (record: any) => router.push({ name: 'OrderDetail', params: { id: record.id } });

const confirmStop = (record: any) => {
  Modal.confirm({
    title: '确认停止该订单？',
    content: '停止后订单状态将变为“手动停止”，相当于已结束',
    okText: '停止',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await request.put(`/rental-order/${record.id}/stop`);
        message.success('订单已停止');
        await fetchOrders();
      } catch {
        // 拦截器已提示
      }
    },
  });
};

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
