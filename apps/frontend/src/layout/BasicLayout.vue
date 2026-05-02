<template>
  <a-layout style="min-height: 100vh">
    <!-- Desktop Sidebar -->
    <a-layout-sider v-if="!isMobile" v-model:collapsed="collapsed" collapsible>
      <div class="logo">相机租赁系统</div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        theme="dark"
        mode="inline"
        @click="handleMenuClick"
      >
        <a-menu-item key="Dashboard">
          <span>数据看板</span>
        </a-menu-item>
        <a-menu-item key="Assets">
          <span>资产管理</span>
        </a-menu-item>
        <a-menu-item key="Orders">
          <span>订单管理</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 16px; display: flex; align-items: center; justify-content: space-between;">
        <div v-if="isMobile">
          <a-button type="text" @click="drawerVisible = true" style="margin-right: 16px;">
            <MenuOutlined />
          </a-button>
          <span style="font-size: 16px; font-weight: bold;">相机租赁系统</span>
        </div>
        <div v-else>
          <!-- header left if any -->
        </div>
        <div>
          <a-button type="link" @click="handleLogout">退出登录</a-button>
        </div>
      </a-layout-header>

      <a-layout-content style="margin: 16px">
        <div style="padding: 24px; background: #fff; min-height: 360px">
          <router-view />
        </div>
      </a-layout-content>
    </a-layout>

    <!-- Mobile Drawer -->
    <a-drawer
      title="菜单"
      placement="left"
      :visible="drawerVisible"
      @close="drawerVisible = false"
    >
      <a-menu
        v-model:selectedKeys="selectedKeys"
        mode="inline"
        @click="handleMenuClick"
      >
        <a-menu-item key="Dashboard">数据看板</a-menu-item>
        <a-menu-item key="Assets">资产管理</a-menu-item>
        <a-menu-item key="Orders">订单管理</a-menu-item>
      </a-menu>
    </a-drawer>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../stores/user';
import { MenuOutlined } from '@ant-design-vue/icons-vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const collapsed = ref(false);
const drawerVisible = ref(false);
const isMobile = ref(window.innerWidth < 768);
const selectedKeys = ref<string[]>([route.name as string || 'Dashboard']);

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

watch(() => route.name, (newVal) => {
  if (newVal) {
    selectedKeys.value = [newVal as string];
  }
});

const handleMenuClick = ({ key }: { key: string }) => {
  router.push({ name: key });
  drawerVisible.value = false;
};

const handleLogout = () => {
  userStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.logo {
  height: 32px;
  margin: 16px;
  color: white;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  line-height: 32px;
  overflow: hidden;
  white-space: nowrap;
}
</style>
