<template>
  <div class="brand-model-mgmt">
    <!-- PC 布局 -->
    <a-row v-if="!isMobile" :gutter="16">
      <!-- 左侧：品牌列表 -->
      <a-col :span="8">
        <a-card size="small" :bordered="true">
          <template #title>
            <span>品牌</span>
          </template>
          <template #extra>
            <a-button type="primary" size="small" @click="openBrandModal()">
              新增品牌
            </a-button>
          </template>

          <a-empty v-if="!brands.length" description="暂无品牌" />
          <a-list v-else :data-source="brands" size="small">
            <template #renderItem="{ item }">
              <a-list-item
                class="brand-item"
                :class="{ 'brand-item--active': item.id === selectedBrandId }"
                @click="selectedBrandId = item.id"
              >
                <span class="brand-item__name">{{ item.name }}</span>
                <span class="brand-item__actions" @click.stop>
                  <a-button type="link" size="small" @click="openBrandModal(item)">编辑</a-button>
                  <a-popconfirm title="确认删除该品牌？" @confirm="handleDeleteBrand(item)">
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </span>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>

      <!-- 右侧：所选品牌下的型号列表 -->
      <a-col :span="16">
        <a-card size="small" :bordered="true">
          <template #title>
            <span>型号 <span v-if="selectedBrand" style="color: #888;">— {{ selectedBrand.name }}</span></span>
          </template>
          <template #extra>
            <a-button type="primary" size="small" :disabled="!selectedBrandId" @click="openModelModal()">
              新增型号
            </a-button>
          </template>

          <a-empty v-if="!selectedBrandId" description="请先在左侧选择一个品牌" />
          <a-empty v-else-if="!modelsOfSelected.length" description="该品牌下暂无型号" />
          <a-list v-else :data-source="modelsOfSelected" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <span>{{ item.name }}</span>
                <template #actions>
                  <a-button type="link" size="small" @click="openModelModal(item)">编辑</a-button>
                  <a-popconfirm title="确认删除该型号？" @confirm="handleDeleteModel(item)">
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <!-- 移动端布局 -->
    <div v-else>
      <div class="mobile-toolbar">
        <a-button type="primary" size="small" @click="openBrandModal()">新增品牌</a-button>
        <a-button type="primary" size="small" :disabled="!selectedBrandId" @click="openModelModal()">
          新增型号
        </a-button>
      </div>

      <a-empty v-if="!brands.length" description="暂无品牌，请先新增品牌" />
      <template v-else>
        <a-tabs v-model:activeKey="selectedBrandId" type="card" tab-position="top">
          <a-tab-pane v-for="brand in brands" :key="brand.id" :tab="brand.name">
            <div class="mobile-brand-actions">
              <a-button size="small" @click="openBrandModal(brand)">编辑品牌</a-button>
              <a-popconfirm title="确认删除该品牌？" @confirm="handleDeleteBrand(brand)">
                <a-button size="small" danger>删除品牌</a-button>
              </a-popconfirm>
            </div>

            <a-empty v-if="!modelsOfSelected.length" description="该品牌下暂无型号" />
            <a-card
              v-for="m in modelsOfSelected"
              :key="m.id"
              size="small"
              style="margin-bottom: 8px;"
            >
              <div class="mobile-model-row">
                <span>{{ m.name }}</span>
                <span>
                  <a-button type="link" size="small" @click="openModelModal(m)">编辑</a-button>
                  <a-popconfirm title="确认删除该型号？" @confirm="handleDeleteModel(m)">
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </span>
              </div>
            </a-card>
          </a-tab-pane>
        </a-tabs>
      </template>
    </div>

    <!-- 品牌新增/编辑弹窗 -->
    <a-modal
      v-model:open="brandModalVisible"
      :title="brandEditing ? '编辑品牌' : '新增品牌'"
      :confirmLoading="brandSubmitting"
      @ok="handleSubmitBrand"
    >
      <a-form layout="vertical">
        <a-form-item label="品牌名称" required>
          <a-input v-model:value="brandFormName" placeholder="例如：Sony" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 型号新增/编辑弹窗 -->
    <a-modal
      v-model:open="modelModalVisible"
      :title="modelEditing ? '编辑型号' : '新增型号'"
      :confirmLoading="modelSubmitting"
      @ok="handleSubmitModel"
    >
      <a-form layout="vertical">
        <a-form-item label="所属品牌" required>
          <a-select v-model:value="modelFormBrandId" placeholder="请选择品牌">
            <a-select-option v-for="b in brands" :key="b.id" :value="b.id">
              {{ b.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="型号名称" required>
          <a-input v-model:value="modelFormName" placeholder="例如：A7 IV" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import request from '../../utils/request';

interface Brand {
  id: number;
  name: string;
}
interface DeviceModel {
  id: number;
  name: string;
  brandId: number;
  brand?: Brand;
}

const isMobile = ref(window.innerWidth < 768);
const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

const brands = ref<Brand[]>([]);
const models = ref<DeviceModel[]>([]);
const selectedBrandId = ref<number | null>(null);

const selectedBrand = computed(() => brands.value.find((b) => b.id === selectedBrandId.value) || null);
const modelsOfSelected = computed(() =>
  selectedBrandId.value
    ? models.value.filter((m) => m.brandId === selectedBrandId.value)
    : [],
);

const fetchBrands = async () => {
  const data = (await request.get('/brand')) as unknown as Brand[];
  brands.value = data;
  if (selectedBrandId.value && !data.some((b) => b.id === selectedBrandId.value)) {
    selectedBrandId.value = null;
  }
  if (!selectedBrandId.value && data.length) {
    selectedBrandId.value = data[0].id;
  }
};

const fetchModels = async () => {
  const data = (await request.get('/device-model')) as unknown as DeviceModel[];
  models.value = data;
};

const refresh = async () => {
  await Promise.all([fetchBrands(), fetchModels()]);
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  refresh();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// ----- 品牌弹窗 -----
const brandModalVisible = ref(false);
const brandEditing = ref<Brand | null>(null);
const brandFormName = ref('');
const brandSubmitting = ref(false);

const openBrandModal = (brand?: Brand) => {
  brandEditing.value = brand || null;
  brandFormName.value = brand ? brand.name : '';
  brandModalVisible.value = true;
};

const handleSubmitBrand = async () => {
  const name = brandFormName.value.trim();
  if (!name) {
    message.warning('请输入品牌名称');
    return;
  }
  brandSubmitting.value = true;
  try {
    if (brandEditing.value) {
      await request.put(`/brand/${brandEditing.value.id}`, { name });
      message.success('品牌已更新');
    } else {
      await request.post('/brand', { name });
      message.success('品牌已新增');
    }
    brandModalVisible.value = false;
    await refresh();
  } catch (e) {
    // 错误信息由 axios 拦截器统一展示
  } finally {
    brandSubmitting.value = false;
  }
};

const handleDeleteBrand = async (brand: Brand) => {
  try {
    await request.delete(`/brand/${brand.id}`);
    message.success('品牌已删除');
    await refresh();
  } catch (e) {
    // 后端返回的「请先清空该品牌下的所有型号」由拦截器展示
  }
};

// ----- 型号弹窗 -----
const modelModalVisible = ref(false);
const modelEditing = ref<DeviceModel | null>(null);
const modelFormName = ref('');
const modelFormBrandId = ref<number | null>(null);
const modelSubmitting = ref(false);

const openModelModal = (model?: DeviceModel) => {
  modelEditing.value = model || null;
  modelFormName.value = model ? model.name : '';
  modelFormBrandId.value = model ? model.brandId : selectedBrandId.value;
  modelModalVisible.value = true;
};

const handleSubmitModel = async () => {
  const name = modelFormName.value.trim();
  const brandId = modelFormBrandId.value;
  if (!brandId) {
    message.warning('请选择所属品牌');
    return;
  }
  if (!name) {
    message.warning('请输入型号名称');
    return;
  }
  modelSubmitting.value = true;
  try {
    if (modelEditing.value) {
      await request.put(`/device-model/${modelEditing.value.id}`, { name, brandId });
      message.success('型号已更新');
    } else {
      await request.post('/device-model', { name, brandId });
      message.success('型号已新增');
    }
    modelModalVisible.value = false;
    selectedBrandId.value = brandId;
    await refresh();
  } catch (e) {
    // 错误信息由 axios 拦截器统一展示（如：该品牌下已存在同名型号）
  } finally {
    modelSubmitting.value = false;
  }
};

const handleDeleteModel = async (model: DeviceModel) => {
  try {
    await request.delete(`/device-model/${model.id}`);
    message.success('型号已删除');
    await refresh();
  } catch (e) {
    // 后端返回的「该型号下存在关联资产，无法删除」由拦截器展示
  }
};
</script>

<style scoped>
.brand-model-mgmt {
  width: 100%;
}

.brand-item {
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand-item:hover {
  background: #fafafa;
}
.brand-item--active {
  background: #e6f4ff;
}
.brand-item__name {
  flex: 1;
}
.brand-item__actions {
  flex-shrink: 0;
}

.mobile-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.mobile-brand-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.mobile-model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
