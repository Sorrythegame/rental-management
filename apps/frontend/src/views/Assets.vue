<template>
  <div>
    <a-card title="资产管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button @click="openBrandModal">品牌管理</a-button>
          <a-button @click="openModelModal">型号管理</a-button>
          <a-button type="primary" @click="openAddAssetModal">新增资产</a-button>
        </a-space>
      </template>

      <!-- 桌面端表格展示 -->
      <a-table
        v-if="!isMobile"
        :columns="columns"
        :data-source="assets"
        :row-key="(record: any) => record.id"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'imageUrl'">
            <img :src="record.imageUrl" alt="资产图片" style="max-height: 50px; max-width: 50px" v-if="record.imageUrl" />
          </template>
          <template v-if="column.key === 'type'">
            <a-tag color="blue">{{ record.type === 'Camera' ? '相机' : '配件' }}</a-tag>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'Normal' ? 'green' : 'red'">
              {{ record.status === 'Normal' ? '正常' : '损坏' }}
            </a-tag>
          </template>
        </template>
      </a-table>

      <!-- 移动端卡片展示 -->
      <div v-else>
        <a-card v-for="asset in assets" :key="asset.id" style="margin-bottom: 16px;">
          <div style="display: flex; gap: 16px;">
            <div style="width: 80px; height: 80px; background: #eee; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <img :src="asset.imageUrl" alt="图片" style="max-width: 100%; max-height: 100%;" v-if="asset.imageUrl"/>
              <span v-else>无图</span>
            </div>
            <div>
              <p><strong>类型：</strong>{{ asset.type === 'Camera' ? '相机' : '配件' }}</p>
              <p><strong>品牌型号：</strong>{{ asset.brand?.name }} - {{ asset.model?.name }}</p>
              <p><strong>价格：</strong>¥{{ asset.price }}</p>
              <p><strong>状态：</strong>
                <a-tag :color="asset.status === 'Normal' ? 'green' : 'red'">
                  {{ asset.status === 'Normal' ? '正常' : '损坏' }}
                </a-tag>
              </p>
            </div>
          </div>
        </a-card>
      </div>
    </a-card>

    <!-- 新增资产表单弹窗 -->
    <a-modal v-model:open="assetModalVisible" title="新增资产" @ok="handleAddAsset" :confirmLoading="submitLoading">
      <a-form ref="assetFormRef" :model="assetForm" layout="vertical">
        <a-form-item label="资产类型" name="type" :rules="[{ required: true, message: '请选择资产类型' }]">
          <a-select v-model:value="assetForm.type">
            <a-select-option value="Camera">相机</a-select-option>
            <a-select-option value="Accessory">配件</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="品牌" name="brandId" :rules="[{ required: true, message: '请选择品牌' }]">
          <a-select v-model:value="assetForm.brandId" @change="handleBrandChange">
            <a-select-option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="型号" name="modelId" :rules="[{ required: true, message: '请选择型号' }]">
          <a-select v-model:value="assetForm.modelId" :disabled="!assetForm.brandId">
            <a-select-option v-for="model in filteredModels" :key="model.id" :value="model.id">{{ model.name }}</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="资产图片 (占位)" name="imageUrl">
          <a-input v-model:value="assetForm.imageUrl" placeholder="请输入图片链接（或上传占位）" />
        </a-form-item>

        <a-form-item label="购买时间" name="purchaseDate" :rules="[{ required: true, message: '请选择购买时间' }]">
          <a-date-picker v-model:value="assetForm.purchaseDate" style="width: 100%" />
        </a-form-item>

        <a-form-item label="购买金额" name="price" :rules="[{ required: true, message: '请输入购买金额' }]">
          <a-input-number v-model:value="assetForm.price" :min="0" style="width: 100%" />
        </a-form-item>

        <a-form-item label="当前状态" name="status" :rules="[{ required: true, message: '请选择当前状态' }]">
          <a-select v-model:value="assetForm.status">
            <a-select-option value="Normal">正常</a-select-option>
            <a-select-option value="Damaged">损坏</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 联动损坏描述 -->
        <a-form-item v-if="assetForm.status === 'Damaged'" label="损坏描述" name="damageDesc" :rules="[{ required: true, message: '请输入损坏描述' }]">
          <a-textarea v-model:value="assetForm.damageDesc" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 品牌管理弹窗 -->
    <a-modal v-model:open="brandModalVisible" title="品牌字典录入" @ok="handleAddBrand">
      <a-form layout="vertical">
        <a-form-item label="品牌名称" required>
          <a-input v-model:value="newBrandName" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 型号管理弹窗 -->
    <a-modal v-model:open="modelModalVisible" title="型号字典录入" @ok="handleAddModel">
      <a-form layout="vertical">
        <a-form-item label="关联品牌" required>
          <a-select v-model:value="newModelBrandId">
            <a-select-option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="型号名称" required>
          <a-input v-model:value="newModelName" />
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

const isMobile = ref(window.innerWidth < 768);
const assets = ref<any[]>([]);
const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const filteredModels = ref<any[]>([]);
const loading = ref(false);

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '图片', dataIndex: 'imageUrl', key: 'imageUrl' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '品牌', dataIndex: ['brand', 'name'], key: 'brandName' },
  { title: '型号', dataIndex: ['model', 'name'], key: 'modelName' },
  { title: '购买金额', dataIndex: 'price', key: 'price' },
  {
    title: '购买时间',
    dataIndex: 'purchaseDate',
    key: 'purchaseDate',
    customRender: ({ text }: any) => dayjs(text).format('YYYY-MM-DD')
  },
  { title: '状态', dataIndex: 'status', key: 'status' },
];

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [assetsData, brandsData, modelsData] = await Promise.all([
      request.get('/asset'),
      request.get('/brand'),
      request.get('/device-model')
    ]) as unknown as [any[], any[], any[]];
    assets.value = assetsData;
    brands.value = brandsData;
    deviceModels.value = modelsData;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  fetchData();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 新增资产逻辑
const assetModalVisible = ref(false);
const submitLoading = ref(false);
const assetFormRef = ref();
const assetForm = ref({
  type: 'Camera',
  brandId: null,
  modelId: null,
  imageUrl: '',
  purchaseDate: null as dayjs.Dayjs | null,
  price: 0,
  status: 'Normal',
  damageDesc: '',
});

const openAddAssetModal = () => {
  assetForm.value = {
    type: 'Camera',
    brandId: null,
    modelId: null,
    imageUrl: '',
    purchaseDate: null,
    price: 0,
    status: 'Normal',
    damageDesc: '',
  };
  filteredModels.value = [];
  assetModalVisible.value = true;
};

const handleBrandChange = (value: number) => {
  assetForm.value.modelId = null;
  filteredModels.value = deviceModels.value.filter(m => m.brandId === value);
};

const handleAddAsset = async () => {
  try {
    await assetFormRef.value.validate();
    submitLoading.value = true;
    const data = {
      ...assetForm.value,
      purchaseDate: assetForm.value.purchaseDate?.toISOString(),
    };
    await request.post('/asset', data);
    message.success('新增资产成功');
    assetModalVisible.value = false;
    fetchData();
  } catch (error) {
    console.error(error);
  } finally {
    submitLoading.value = false;
  }
};

// 品牌字典录入
const brandModalVisible = ref(false);
const newBrandName = ref('');
const openBrandModal = () => {
  newBrandName.value = '';
  brandModalVisible.value = true;
};
const handleAddBrand = async () => {
  if (!newBrandName.value) return message.warning('请输入品牌名称');
  try {
    await request.post('/brand', { name: newBrandName.value });
    message.success('品牌添加成功');
    brandModalVisible.value = false;
    fetchData();
  } catch (e) {
    console.error(e);
  }
};

// 型号字典录入
const modelModalVisible = ref(false);
const newModelName = ref('');
const newModelBrandId = ref<number | null>(null);
const openModelModal = () => {
  newModelName.value = '';
  newModelBrandId.value = null;
  modelModalVisible.value = true;
};
const handleAddModel = async () => {
  if (!newModelBrandId.value || !newModelName.value) return message.warning('请填写完整信息');
  try {
    await request.post('/device-model', { brandId: newModelBrandId.value, name: newModelName.value });
    message.success('型号添加成功');
    modelModalVisible.value = false;
    fetchData();
  } catch (e) {
    console.error(e);
  }
};
</script>
