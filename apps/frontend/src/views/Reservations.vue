<template>
  <div>
    <a-card title="预定管理" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="goAdd">新增预定</a-button>
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
          v-model:value="filters.status"
          placeholder="预定状态"
          allow-clear
          :style="{ width: '160px' }"
          @change="onFilterChange"
        >
          <a-select-option value="Pending">待确认</a-select-option>
          <a-select-option value="Confirmed">已确认</a-select-option>
          <a-select-option value="Cancelled">已取消</a-select-option>
          <a-select-option value="Converted">已转单</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.sinCode"
          show-search
          placeholder="SIN 码"
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
        :data-source="reservations"
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
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">
              {{ statusText(record.status) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'timeRange'">
            {{ formatTime(record.startTime) }} ~ {{ formatTime(record.endTime) }}
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="goDetail(record)">查看</a-button>
              <a-button v-if="record.status !== 'Converted' && record.status !== 'Cancelled'" type="link" size="small" @click="goEdit(record)">编辑</a-button>
              <a-button v-if="record.status === 'Pending' || record.status === 'Confirmed'" type="link" size="small" @click="openConvertModal(record)">转单</a-button>
              <a-button v-if="record.status === 'Pending' || record.status === 'Confirmed'" type="link" size="small" danger @click="confirmCancel(record)">取消</a-button>
              <a-button v-if="record.status !== 'Converted'" type="link" size="small" danger @click="confirmDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>

      <!-- 移动端卡片展示 -->
      <div v-else>
        <a-empty v-if="!reservations.length && !loading" description="暂无预定" />
        <a-card v-for="r in reservations" :key="r.id" style="margin-bottom: 16px;">
          <p><strong>预定名称：</strong>{{ r.name || '-' }}</p>
          <p><strong>品牌型号：</strong>{{ r.brandName || '-' }} {{ r.modelName || '' }}</p>
          <p><strong>SIN 码：</strong>{{ r.sinCode || '-' }}</p>
          <p v-if="r.accessories?.length"><strong>配件：</strong>{{ accessoryNames(r) }}</p>
          <p><strong>租赁日期：</strong>{{ formatTime(r.startTime) }} ~ {{ formatTime(r.endTime) }}</p>
          <p>
            <strong>状态：</strong>
            <a-tag :color="statusColor(r.status)">
              {{ statusText(r.status) }}
            </a-tag>
          </p>
          <p><strong>预计金额：</strong>¥{{ r.amount }}</p>
          <p v-if="r.deposit"><strong>押金：</strong>¥{{ r.deposit }}</p>
          <p><strong>客户：</strong>{{ r.customerName || '-' }} {{ r.customerPhone || '' }}</p>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <a-button size="small" @click="goDetail(r)">查看</a-button>
            <a-button v-if="r.status !== 'Converted' && r.status !== 'Cancelled'" size="small" @click="goEdit(r)">编辑</a-button>
            <a-button v-if="r.status === 'Pending' || r.status === 'Confirmed'" size="small" @click="openConvertModal(r)">转单</a-button>
            <a-button v-if="r.status === 'Pending' || r.status === 'Confirmed'" size="small" danger @click="confirmCancel(r)">取消</a-button>
            <a-button v-if="r.status !== 'Converted'" size="small" danger @click="confirmDelete(r)">删除</a-button>
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
          @change="fetchReservations"
        />
      </div>

      <!-- 转单配件选择弹窗 -->
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
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import request from '../utils/request';

const router = useRouter();

const isMobile = ref(window.innerWidth < 768);
const reservations = ref<any[]>([]);
const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const cameraAssets = ref<any[]>([]);
const allAccessories = ref<any[]>([]);
const loading = ref(false);

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
});

// 转单弹窗
const convertModalVisible = ref(false);
const convertModalLoading = ref(false);
const convertingRecord = ref<any>(null);
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

const filters = ref<{
  brandName?: string;
  modelName?: string;
  status?: string;
  sinCode?: string;
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
}>({});

const columns = [
  { title: '预定名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
  { title: '品牌型号', key: 'brandModel', width: 180 },
  { title: 'SIN 码', dataIndex: 'sinCode', key: 'sinCode', width: 140 },
  { title: '配件', key: 'accessories', width: 180, ellipsis: true },
  { title: '租赁日期', key: 'timeRange', width: 220 },
  { title: '状态', key: 'status', width: 100 },
  { title: '预计金额', dataIndex: 'amount', key: 'amount', width: 100 },
  { title: '押金', dataIndex: 'deposit', key: 'deposit', width: 100 },
  { title: '客户名', dataIndex: 'customerName', key: 'customerName', width: 120 },
  { title: '客户电话', dataIndex: 'customerPhone', key: 'customerPhone', width: 130 },
  { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true, width: 160 },
  { title: '操作', key: 'actions', width: 320, fixed: !isMobile.value ? ('right' as const) : undefined },
];

const statusText = (s: string) => {
  const map: Record<string, string> = { Pending: '待确认', Confirmed: '已确认', Cancelled: '已取消', Converted: '已转单' };
  return map[s] || s;
};

const statusColor = (s: string) => {
  const map: Record<string, string> = { Pending: 'orange', Confirmed: 'blue', Cancelled: 'default', Converted: 'green' };
  return map[s] || 'default';
};

const formatTime = (t: string) => (t ? dayjs(t).format('YYYY-MM-DD') : '-');

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

const buildParams = () => {
  const p: Record<string, string | number> = {};
  if (filters.value.brandName) p.brandName = filters.value.brandName;
  if (filters.value.modelName) p.modelName = filters.value.modelName;
  if (filters.value.status) p.status = filters.value.status;
  if (filters.value.sinCode?.trim()) p.sinCode = filters.value.sinCode.trim();
  if (filters.value.dateRange?.[0]) p.startDate = filters.value.dateRange[0].format('YYYY-MM-DD');
  if (filters.value.dateRange?.[1]) p.endDate = filters.value.dateRange[1].format('YYYY-MM-DD');
  p.page = pagination.value.current;
  p.pageSize = pagination.value.pageSize;
  return p;
};

const fetchReservations = async () => {
  loading.value = true;
  try {
    const res = (await request.get('/reservation', { params: buildParams() })) as { list: any[]; total: number };
    reservations.value = res.list;
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

const fetchCameraAssets = async () => {
  cameraAssets.value = (await request.get('/asset', { params: { type: 'Camera' } })) as unknown as any[];
};

const fetchAccessories = async () => {
  allAccessories.value = (await request.get('/asset', { params: { type: 'Accessory' } })) as unknown as any[];
};

const onFilterChange = () => {
  pagination.value.current = 1;
  fetchReservations();
};

const resetFilters = () => {
  filters.value = {};
  pagination.value.current = 1;
  pagination.value.pageSize = 10;
  fetchReservations();
};

const handleTableChange = (pag: any) => {
  pagination.value.current = pag.current;
  pagination.value.pageSize = pag.pageSize;
  fetchReservations();
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchDicts();
  fetchCameraAssets();
  fetchAccessories();
  fetchReservations();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 操作
const goAdd = () => router.push({ name: 'ReservationAdd' });
const goEdit = (record: any) => router.push({ name: 'ReservationEdit', params: { id: record.id } });
const goDetail = (record: any) => router.push({ name: 'ReservationDetail', params: { id: record.id } });

const confirmCancel = (record: any) => {
  Modal.confirm({
    title: '取消该预定？',
    content: `预定 ${record.id}：取消后将变为“已取消”状态`,
    okText: '取消预定',
    okType: 'danger',
    cancelText: '再想想',
    async onOk() {
      try {
        await request.put(`/reservation/${record.id}/cancel`);
        message.success('预定已取消');
        await fetchReservations();
      } catch {
        // 拦截器已提示
      }
    },
  });
};

const openConvertModal = (record: any) => {
  convertingRecord.value = record;
  convertAccessoryIds.value = [];
  convertModalVisible.value = true;
};

const handleConvert = async () => {
  if (!convertingRecord.value) return;
  convertModalLoading.value = true;
  try {
    const order = await request.put(`/reservation/${convertingRecord.value.id}/convert`, {
      accessoryIds: convertAccessoryIds.value,
    });
    message.success('已转单，订单 ID：' + order.id);
    convertModalVisible.value = false;
    await fetchReservations();
  } catch {
    // 拦截器已提示
  } finally {
    convertModalLoading.value = false;
  }
};

const confirmDelete = (record: any) => {
  Modal.confirm({
    title: '确认删除该预定？',
    content: `预定 ${record.id}：${record.brandName || ''} ${record.modelName || ''}`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await request.delete(`/reservation/${record.id}`);
        message.success('预定已删除');
        await fetchReservations();
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
