<template>
  <div class="dashboard">
    <a-card title="数据看板" :bordered="false" style="margin-bottom: 24px;">
      <template #extra>
        <a-range-picker v-model:value="dateRange" @change="fetchData" />
      </template>

      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="12" :md="6">
          <a-card>
            <a-statistic title="总营业额 (元)" :value="summaryData.metrics.totalRevenue" :precision="2" />
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card>
            <a-statistic title="总订单数" :value="summaryData.metrics.totalOrders" />
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card>
            <a-statistic title="损坏资产预警" :value="summaryData.warnings.damagedAssetsCount" value-style="color: #cf1322" />
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card>
            <a-statistic title="逾期未归还订单" :value="summaryData.warnings.overdueOrdersCount" value-style="color: #cf1322" />
          </a-card>
        </a-col>
      </a-row>
    </a-card>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :md="12">
        <a-card title="每日订单量趋势（近30天）">
          <v-chart class="chart" :option="orderTrendOption" autoresize />
        </a-card>
      </a-col>
      <a-col :xs="24" :md="12">
        <a-card title="每周营业额统计（近4周）">
          <v-chart class="chart" :option="revenueTrendOption" autoresize />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px;">
      <a-col :xs="24" :md="12">
        <a-card title="创收排名前5的设备型号">
          <v-chart class="chart" :option="topModelsOption" autoresize />
        </a-card>
      </a-col>
      <a-col :xs="24" :md="12">
        <a-card title="资产状态分布">
          <v-chart class="chart" :option="assetStatusOption" autoresize />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { use } from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import request from '../utils/request';
import dayjs from 'dayjs';

use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  LineChart,
  BarChart,
  PieChart,
  CanvasRenderer
]);

const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

const summaryData = ref({
  metrics: { totalOrders: 0, totalRevenue: 0 },
  warnings: { damagedAssetsCount: 0, overdueOrdersCount: 0 },
  charts: {
    orderTrend: [] as { date: string, count: number }[],
    revenueTrend: [] as { week: string, amount: number }[],
    topModels: [] as { name: string, amount: number }[],
    assetStatusDistribution: [] as { name: string, value: number }[],
  }
});

const fetchData = async () => {
  let params: any = {};
  if (dateRange.value) {
    params.startDate = dateRange.value[0].toISOString();
    params.endDate = dateRange.value[1].toISOString();
  }
  try {
    const res = await request.get('/dashboard/summary', { params }) as any;
    summaryData.value = res;
  } catch (err) {
    console.error(err);
  }
};

onMounted(() => {
  fetchData();
});

const orderTrendOption = computed(() => {
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: summaryData.value.charts.orderTrend.map(d => d.date) },
    yAxis: { type: 'value' },
    series: [
      {
        data: summaryData.value.charts.orderTrend.map(d => d.count),
        type: 'line',
        smooth: true,
      }
    ]
  };
});

const revenueTrendOption = computed(() => {
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: summaryData.value.charts.revenueTrend.map(d => d.week) },
    yAxis: { type: 'value' },
    series: [
      {
        data: summaryData.value.charts.revenueTrend.map(d => d.amount),
        type: 'bar',
        barWidth: '60%',
      }
    ]
  };
});

const topModelsOption = computed(() => {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: summaryData.value.charts.topModels.map(d => d.name) },
    series: [
      {
        type: 'bar',
        data: summaryData.value.charts.topModels.map(d => d.amount),
      }
    ]
  };
});

const assetStatusOption = computed(() => {
  return {
    tooltip: { trigger: 'item' },
    legend: { top: '5%', left: 'center' },
    series: [
      {
        name: '资产状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 40, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: summaryData.value.charts.assetStatusDistribution,
      }
    ]
  };
});
</script>

<style scoped>
.chart {
  height: 300px;
  width: 100%;
}
</style>
