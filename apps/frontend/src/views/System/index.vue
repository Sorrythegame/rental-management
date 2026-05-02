<template>
  <a-card title="系统管理" :bordered="false">
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="brand-model" tab="品牌与型号管理">
        <BrandModelManagement />
      </a-tab-pane>
      <a-tab-pane key="others" tab="其它">
        <a-empty description="暂无内容" />
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BrandModelManagement from './BrandModelManagement.vue';

const activeTab = ref<'brand-model' | 'others'>('brand-model');
</script>
