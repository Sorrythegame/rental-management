<template>
  <a-card :bordered="false">
    <template #title>
      <a-button type="link" @click="goBack" style="padding-left: 0;">
        <LeftOutlined /> 返回列表
      </a-button>
      <span style="margin-left: 8px;">资产详情</span>
    </template>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !asset" description="资产不存在" />

      <a-descriptions v-else-if="asset" :column="isMobile ? 1 : 2" bordered size="small">
        <a-descriptions-item label="ID">{{ asset.id }}</a-descriptions-item>
        <a-descriptions-item label="类型">
          <a-tag color="blue">{{ asset.type === 'Camera' ? '相机' : '配件' }}</a-tag>
        </a-descriptions-item>

        <template v-if="asset.type === 'Camera'">
          <a-descriptions-item label="品牌">{{ asset.brand?.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="型号">{{ asset.model?.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="SIN 码" :span="2">{{ asset.sinCode || '-' }}</a-descriptions-item>
        </template>
        <template v-else>
          <a-descriptions-item label="配件名称" :span="2">{{ asset.name || '-' }}</a-descriptions-item>
        </template>

        <a-descriptions-item label="购买金额">¥{{ asset.price }}</a-descriptions-item>
        <a-descriptions-item label="购买时间">
          {{ asset.purchaseDate ? dayjs(asset.purchaseDate).format('YYYY-MM-DD') : '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="设备状态">
          <a-tag :color="asset.status === 'Normal' ? 'green' : 'red'">
            {{ asset.status === 'Normal' ? '正常' : '损坏' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="租赁状态">
          <a-tag :color="asset.rentalStatus === 'Rented' ? 'orange' : 'default'">
            {{ asset.rentalStatus === 'Rented' ? '出租中' : '未出租' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item v-if="asset.status === 'Damaged'" label="损坏描述" :span="2">
          {{ asset.damageDesc || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">
          {{ asset.remark || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="资产图片" :span="2">
          <a-empty v-if="!imageUrls.length" description="暂无图片" />
          <a-image-preview-group v-else>
            <a-image
              v-for="url in imageUrls"
              :key="url"
              :src="url"
              :width="120"
              :height="120"
              style="object-fit: cover; margin-right: 8px; margin-bottom: 8px;"
            />
          </a-image-preview-group>
        </a-descriptions-item>
      </a-descriptions>
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
const asset = ref<any>(null);
const isMobile = ref(window.innerWidth < 768);

const imageUrls = computed<string[]>(() => {
  const v = asset.value?.imageUrls;
  if (Array.isArray(v)) return v.filter((s) => typeof s === 'string' && s);
  return [];
});

const fetchAsset = async () => {
  const id = Number(route.params.id);
  if (!id) return;
  loading.value = true;
  try {
    asset.value = await request.get(`/asset/${id}`);
  } finally {
    loading.value = false;
  }
};

const goBack = () => router.push({ name: 'Assets' });

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchAsset();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>
