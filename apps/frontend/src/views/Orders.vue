<template>
  <div>
    <a-card title="订单管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-range-picker v-model:value="dateRange" @change="fetchOrders" />
          <a-button type="primary" @click="openAddModal">新增订单</a-button>
        </a-space>
      </template>

      <!-- 桌面端表格展示 -->
      <a-table
        v-if="!isMobile"
        :columns="columns"
        :data-source="orders"
        :row-key="(record: any) => record.id"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'isReturnedOnTime'">
            <a-tag :color="record.isReturnedOnTime ? 'green' : 'red'">
              {{ record.isReturnedOnTime ? '是' : '否' }}
            </a-tag>
          </template>
        </template>
      </a-table>

      <!-- 移动端卡片展示 -->
      <div v-else>
        <a-card v-for="order in orders" :key="order.id" style="margin-bottom: 16px;">
          <p><strong>客户名称：</strong>{{ order.customerName }}</p>
          <p><strong>订单金额：</strong>¥{{ order.amount }}</p>
          <p><strong>租赁时间：</strong>{{ dayjs(order.startTime).format('YYYY-MM-DD') }} - {{ dayjs(order.endTime).format('YYYY-MM-DD') }}</p>
          <p>
            <strong>按时归还：</strong>
            <a-tag :color="order.isReturnedOnTime ? 'green' : 'red'">
              {{ order.isReturnedOnTime ? '是' : '否' }}
            </a-tag>
          </p>
          <p v-if="order.remarks"><strong>备注：</strong>{{ order.remarks }}</p>
        </a-card>
      </div>
    </a-card>

    <a-modal v-model:open="modalVisible" title="新增订单" @ok="handleAddOrder" :confirmLoading="submitLoading">
      <a-form ref="formRef" :model="formState" layout="vertical">
        <a-form-item label="租赁起止时间" name="timeRange" :rules="[{ required: true, message: '请选择租赁时间' }]">
          <a-range-picker v-model:value="formState.timeRange" show-time style="width: 100%" />
        </a-form-item>
        <a-form-item label="客户网名" name="customerName">
          <a-input v-model:value="formState.customerName" />
        </a-form-item>
        <a-form-item label="订单金额" name="amount" :rules="[{ required: true, message: '请输入订单金额' }]">
          <a-input-number v-model:value="formState.amount" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="按时归还" name="isReturnedOnTime">
          <a-switch v-model:checked="formState.isReturnedOnTime" />
        </a-form-item>
        <a-form-item label="备注" name="remarks">
          <a-textarea v-model:value="formState.remarks" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import request from '../utils/request';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';

const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
const isMobile = ref(window.innerWidth < 768);
const orders = ref<any[]>([]);
const loading = ref(false);

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '客户', dataIndex: 'customerName', key: 'customerName' },
  { title: '金额 (元)', dataIndex: 'amount', key: 'amount' },
  {
    title: '租赁开始时间',
    dataIndex: 'startTime',
    key: 'startTime',
    customRender: ({ text }: any) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
  },
  {
    title: '租赁结束时间',
    dataIndex: 'endTime',
    key: 'endTime',
    customRender: ({ text }: any) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
  },
  { title: '按时归还', dataIndex: 'isReturnedOnTime', key: 'isReturnedOnTime' },
  { title: '备注', dataIndex: 'remarks', key: 'remarks' },
];

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

const fetchOrders = async () => {
  loading.value = true;
  let params: any = {};
  if (dateRange.value) {
    params.startDate = dateRange.value[0].toISOString();
    params.endDate = dateRange.value[1].toISOString();
  }
  try {
    orders.value = await request.get('/rental-order', { params }) as any;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchOrders();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 新增订单逻辑
const modalVisible = ref(false);
const submitLoading = ref(false);
const formRef = ref();
const formState = ref({
  timeRange: [] as [dayjs.Dayjs, dayjs.Dayjs] | [],
  customerName: '',
  amount: 0,
  isReturnedOnTime: false,
  remarks: '',
});

const openAddModal = () => {
  formState.value = {
    timeRange: [],
    customerName: '',
    amount: 0,
    isReturnedOnTime: false,
    remarks: '',
  };
  modalVisible.value = true;
};

const handleAddOrder = async () => {
  try {
    await formRef.value.validate();
    submitLoading.value = true;
    const data = {
      startTime: formState.value.timeRange[0]?.toISOString() || new Date().toISOString(),
      endTime: formState.value.timeRange[1]?.toISOString() || new Date().toISOString(),
      customerName: formState.value.customerName,
      amount: formState.value.amount,
      isReturnedOnTime: formState.value.isReturnedOnTime,
      remarks: formState.value.remarks,
    };
    await request.post('/rental-order', data);
    message.success('新增订单成功');
    modalVisible.value = false;
    fetchOrders();
  } catch (error) {
    console.error(error);
  } finally {
    submitLoading.value = false;
  }
};
</script>
