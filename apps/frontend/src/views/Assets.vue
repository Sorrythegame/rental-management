<template>
  <div>
    <a-card title="资产管理" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="openAddAssetModal">新增资产</a-button>
      </template>

      <!-- 品牌型号统计卡片 -->
      <div v-if="brandModelStats.length || accessorySummary.count" class="stats-card-wrapper">
        <div
          v-for="stat in brandModelStats"
          :key="stat.brandName + '-' + stat.modelName"
          class="stats-card"
        >
          <div class="stats-card-header">
            <span class="stats-brand">{{ stat.brandName }}-{{ stat.modelName }}</span>
          </div>
          <div class="stats-card-body">
            <div class="stats-item">
              <div class="stats-value">{{ stat.count }}个</div>
            </div>
            <div class="stats-divider" />
            <div class="stats-item">
              <div class="stats-value stats-price">￥{{ stat.totalPrice.toLocaleString() }}</div>
            </div>
          </div>
        </div>
        <div v-if="accessorySummary.count" class="stats-card stats-card-accessory">
          <div class="stats-card-header">
            <span class="stats-brand">配件</span>
          </div>
          <div class="stats-card-body">
            <div class="stats-item">
              <div class="stats-value">{{ accessorySummary.count }}个</div>
            </div>
            <div class="stats-divider" />
            <div class="stats-item">
              <div class="stats-value stats-price">￥{{ accessorySummary.totalPrice.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </div>

      <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
        <a-tab-pane key="Camera" tab="相机">
          <!-- 相机筛选区 -->
          <div class="filter-bar">
            <a-cascader
              v-model:value="cameraFilters.brandModel"
              :options="cascaderOptions"
              placeholder="品牌 / 型号"
              change-on-select
              allow-clear
              :style="{ width: '260px' }"
              @change="onCameraFilterChange"
            />
            <a-select
              v-model:value="cameraFilters.status"
              placeholder="设备状态"
              allow-clear
              :style="{ width: '160px' }"
              @change="onCameraFilterChange"
            >
              <a-select-option value="Normal">正常</a-select-option>
              <a-select-option value="Damaged">损坏</a-select-option>
            </a-select>
            <a-button @click="resetCameraFilters">重置</a-button>
          </div>

          <!-- 桌面端表格展示 -->
          <a-table
            v-if="!isMobile"
            :columns="cameraColumns"
            :data-source="cameraAssets"
            :row-key="(record: any) => record.id"
            :loading="loading"
            :pagination="pagination"
            :scroll="{ x: 1100 }"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'imageUrl'">
                <img
                  v-if="firstImageUrl(record)"
                  :src="firstImageUrl(record)"
                  alt="资产图片"
                  style="max-height: 50px; max-width: 50px; object-fit: cover;"
                />
              </template>
              <template v-if="column.key === 'type'">
                <a-tag color="blue">相机</a-tag>
              </template>
              <template v-if="column.key === 'brandName'">
                {{ record.brand?.name || '-' }}
              </template>
              <template v-if="column.key === 'modelOrName'">
                {{ record.model?.name || '-' }}
              </template>
              <template v-if="column.key === 'sinCode'">
                <a-tooltip v-if="record.sinCode" title="点击新增订单">
                  <a-button type="link" size="small" style="padding: 0;" @click="goCreateOrder(record)">
                    {{ record.sinCode }}
                  </a-button>
                </a-tooltip>
                <span v-else>-</span>
              </template>
              <template v-if="column.key === 'rentalStatus'">
                <a-tag :color="record.rentalStatus === 'Rented' ? 'green' : 'default'">
                  {{ record.rentalStatus === 'Rented' ? '出租中' : '未出租' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'Normal' ? 'green' : 'red'">
                  {{ record.status === 'Normal' ? '正常' : '损坏' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="goDetail(record)">查看</a-button>
                  <a-button type="link" size="small" @click="openCalendarModal(record)">占用情况</a-button>
                  <a-button type="link" size="small" @click="openEditAssetModal(record)">编辑</a-button>
                  <a-button type="link" size="small" danger @click="confirmDeleteAsset(record)">删除</a-button>
                </a-space>
              </template>
            </template>
          </a-table>

          <!-- 移动端卡片展示 -->
          <div v-else>
            <a-empty v-if="!cameraAssets.length && !loading" description="暂无相机" />
            <a-card v-for="asset in cameraAssets" :key="asset.id" style="margin-bottom: 16px;">
              <div style="display: flex; gap: 16px;">
                <div style="width: 80px; height: 80px; background: #eee; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  <img
                    v-if="firstImageUrl(asset)"
                    :src="firstImageUrl(asset)"
                    alt="图片"
                    style="max-width: 100%; max-height: 100%; object-fit: cover;"
                  />
                  <span v-else>无图</span>
                </div>
                <div style="flex: 1;">
                  <p><strong>类型：</strong>相机</p>
                  <p><strong>品牌型号：</strong>{{ asset.brand?.name }} - {{ asset.model?.name }}</p>
                  <p><strong>S/N码：</strong>{{ asset.sinCode }}</p>
                  <p><strong>价格：</strong>¥{{ asset.price }}</p>
                  <p>
                    <strong>状态：</strong>
                    <a-tag :color="asset.status === 'Normal' ? 'green' : 'red'">
                      {{ asset.status === 'Normal' ? '正常' : '损坏' }}
                    </a-tag>
                    <a-tag :color="asset.rentalStatus === 'Rented' ? 'green' : 'default'">
                      {{ asset.rentalStatus === 'Rented' ? '出租中' : '未出租' }}
                    </a-tag>
                  </p>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
                <a-button size="small" @click="goDetail(asset)">查看</a-button>
                <a-button size="small" @click="openCalendarModal(asset)">占用情况</a-button>
                <a-button size="small" @click="openEditAssetModal(asset)">编辑</a-button>
                <a-button size="small" danger @click="confirmDeleteAsset(asset)">删除</a-button>
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
              @change="fetchAssets"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="Accessory" tab="配件">
          <!-- 配件筛选区 -->
          <div class="filter-bar">
            <a-input
              v-model:value="accessoryFilters.name"
              placeholder="配件名称"
              allow-clear
              :style="{ width: '200px' }"
              @change="onAccessoryFilterChange"
              @press-enter="onAccessoryFilterChange"
            />
            <a-select
              v-model:value="accessoryFilters.status"
              placeholder="设备状态"
              allow-clear
              :style="{ width: '160px' }"
              @change="onAccessoryFilterChange"
            >
              <a-select-option value="Normal">正常</a-select-option>
              <a-select-option value="Damaged">损坏</a-select-option>
            </a-select>
            <a-button @click="resetAccessoryFilters">重置</a-button>
          </div>

          <!-- 桌面端表格展示 -->
          <a-table
            v-if="!isMobile"
            :columns="accessoryColumns"
            :data-source="accessoryAssets"
            :row-key="(record: any) => record.id"
            :loading="loading"
            :pagination="pagination"
            :scroll="{ x: 900 }"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'imageUrl'">
                <img
                  v-if="firstImageUrl(record)"
                  :src="firstImageUrl(record)"
                  alt="资产图片"
                  style="max-height: 50px; max-width: 50px; object-fit: cover;"
                />
              </template>
              <template v-if="column.key === 'type'">
                <a-tag color="purple">配件</a-tag>
              </template>
              <template v-if="column.key === 'name'">
                {{ record.name || '-' }}
              </template>
              <template v-if="column.key === 'rentalStatus'">
                <a-tag :color="record.rentalStatus === 'Rented' ? 'green' : 'default'">
                  {{ record.rentalStatus === 'Rented' ? '出租中' : '未出租' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'Normal' ? 'green' : 'red'">
                  {{ record.status === 'Normal' ? '正常' : '损坏' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="goDetail(record)">查看</a-button>
                  <a-button type="link" size="small" @click="openCalendarModal(record)">占用情况</a-button>
                  <a-button type="link" size="small" @click="openEditAssetModal(record)">编辑</a-button>
                  <a-button type="link" size="small" danger @click="confirmDeleteAsset(record)">删除</a-button>
                </a-space>
              </template>
            </template>
          </a-table>

          <!-- 移动端卡片展示 -->
          <div v-else>
            <a-empty v-if="!accessoryAssets.length && !loading" description="暂无配件" />
            <a-card v-for="asset in accessoryAssets" :key="asset.id" style="margin-bottom: 16px;">
              <div style="display: flex; gap: 16px;">
                <div style="width: 80px; height: 80px; background: #eee; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  <img
                    v-if="firstImageUrl(asset)"
                    :src="firstImageUrl(asset)"
                    alt="图片"
                    style="max-width: 100%; max-height: 100%; object-fit: cover;"
                  />
                  <span v-else>无图</span>
                </div>
                <div style="flex: 1;">
                  <p><strong>类型：</strong>配件</p>
                  <p><strong>名称：</strong>{{ asset.name }}</p>
                  <p><strong>价格：</strong>¥{{ asset.price }}</p>
                  <p>
                    <strong>状态：</strong>
                    <a-tag :color="asset.status === 'Normal' ? 'green' : 'red'">
                      {{ asset.status === 'Normal' ? '正常' : '损坏' }}
                    </a-tag>
                    <a-tag :color="asset.rentalStatus === 'Rented' ? 'green' : 'default'">
                      {{ asset.rentalStatus === 'Rented' ? '出租中' : '未出租' }}
                    </a-tag>
                  </p>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
                <a-button size="small" @click="goDetail(asset)">查看</a-button>
                <a-button size="small" @click="openCalendarModal(asset)">占用情况</a-button>
                <a-button size="small" @click="openEditAssetModal(asset)">编辑</a-button>
                <a-button size="small" danger @click="confirmDeleteAsset(asset)">删除</a-button>
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
              @change="fetchAssets"
            />
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 新增/编辑资产弹窗 -->
    <a-modal
      v-model:open="assetModalVisible"
      :title="assetModalMode === 'edit' ? '编辑资产' : '新增资产'"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :keyboard="false"
      width="640px"
      @ok="handleSubmitAsset"
      @cancel="handleCancelAssetModal"
    >
      <a-form ref="assetFormRef" :model="assetForm" layout="vertical">
        <a-form-item label="资产类型" name="type" :rules="[{ required: true, message: '请选择资产类型' }]">
          <a-select v-model:value="assetForm.type" @change="onTypeChange">
            <a-select-option value="Camera">相机</a-select-option>
            <a-select-option value="Accessory">配件</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 相机：品牌 + 型号 + SN码 -->
        <template v-if="assetForm.type === 'Camera'">
          <a-form-item label="品牌" name="brandId" :rules="[{ required: true, message: '请选择品牌' }]">
            <a-select v-model:value="assetForm.brandId" @change="handleBrandChange">
              <a-select-option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="型号" name="modelId" :rules="[{ required: true, message: '请选择型号' }]">
            <a-select v-model:value="assetForm.modelId" :disabled="!assetForm.brandId">
              <a-select-option v-for="m in filteredModels" :key="m.id" :value="m.id">{{ m.name }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="S/N码" name="sinCode" :rules="[{ required: true, message: '请输入 S/N码' }]">
            <a-input v-model:value="assetForm.sinCode" placeholder="设备机身 S/N码" />
          </a-form-item>
        </template>

        <!-- 配件：名称 -->
        <template v-else>
          <a-form-item label="配件名称" name="name" :rules="[{ required: true, message: '请输入配件名称' }]">
            <a-input v-model:value="assetForm.name" placeholder="例如：相机背带、电池" />
          </a-form-item>
        </template>

        <a-form-item label="资产图片" name="imageUrls">
          <a-upload
            v-model:file-list="fileList"
            list-type="picture-card"
            :custom-request="customUpload"
            :before-upload="beforeUpload"
            :on-preview="handlePreview"
            :on-remove="handleRemove"
            accept="image/*"
          >
            <div v-if="fileList.length < 9">
              <PlusOutlined />
              <div style="margin-top: 8px;">上传</div>
            </div>
          </a-upload>
        </a-form-item>

        <a-form-item label="购买时间" name="purchaseDate" :rules="[{ required: true, message: '请选择购买时间' }]">
          <a-date-picker v-model:value="assetForm.purchaseDate" style="width: 100%" />
        </a-form-item>

        <a-form-item label="购买金额" name="price" :rules="[{ required: true, message: '请输入购买金额' }]">
          <a-input-number v-model:value="assetForm.price" :min="0" style="width: 100%" />
        </a-form-item>

        <a-form-item label="设备状态" name="status" :rules="[{ required: true, message: '请选择设备状态' }]">
          <a-select v-model:value="assetForm.status">
            <a-select-option value="Normal">正常</a-select-option>
            <a-select-option value="Damaged">损坏</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item v-if="assetForm.status === 'Damaged'" label="损坏描述" name="damageDesc" :rules="[{ required: true, message: '请输入损坏描述' }]">
          <a-textarea v-model:value="assetForm.damageDesc" />
        </a-form-item>

        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="assetForm.remark" :rows="2" placeholder="可选" />
        </a-form-item>
      </a-form>

      <!-- 大图预览 -->
      <a-image
        :width="0"
        :style="{ display: 'none' }"
        :src="previewSrc"
        :preview="{
          visible: previewVisible,
          src: previewSrc,
          onVisibleChange: (v: boolean) => (previewVisible = v),
        }"
      />
    </a-modal>

    <!-- 占用情况日历弹窗 -->
    <a-modal
      v-model:open="calendarVisible"
      :title="calendarAsset?.type === 'Camera' ? `${calendarAsset?.brand?.name || ''} ${calendarAsset?.model?.name || ''} (${calendarAsset?.sinCode}) 占用情况` : `${calendarAsset?.name || ''} 占用情况`"
      :footer="null"
      width="900px"
      @cancel="calendarVisible = false"
    >
      <a-spin :spinning="calendarLoading">
        <div class="calendar-wrapper">
          <a-button class="cal-nav-btn" size="large" @click="prevMonth">
            <LeftOutlined />
          </a-button>
          <a-calendar v-model:value="calendarDate" class="cal-body">
            <template #dateCellRender="{ current }">
              <div style="min-height: 50px">
                <a-tooltip v-if="getOccupanciesForDate(current).length" placement="top">
                  <template #title>
                    <template v-for="(occ, idx) in getOccupanciesForDate(current)" :key="occ.id + '-' + occ.type">
                      <div v-if="idx > 0" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px"></div>
                      <div>{{ occ.name }}</div>
                      <div>{{ dayjs(occ.startTime).format('YYYY年MM月DD日') }}-{{ dayjs(occ.endTime).format('YYYY年MM月DD日') }}</div>
                      <div>{{ occ.customerName || '-' }}</div>
                    </template>
                  </template>
                  <ul class="calendar-events">
                    <li v-for="occ in getOccupanciesForDate(current)" :key="occ.id + '-' + occ.type">
                      <span :class="['calendar-event', occ.type === 'order' ? 'event-order' : 'event-reservation']"></span>
                    </li>
                  </ul>
                </a-tooltip>
              </div>
            </template>
          </a-calendar>
          <a-button class="cal-nav-btn" size="large" @click="nextMonth">
            <RightOutlined />
          </a-button>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import { PlusOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import request from '../utils/request';

const router = useRouter();

const isMobile = ref(window.innerWidth < 768);
const assets = ref<any[]>([]);
const brands = ref<any[]>([]);
const deviceModels = ref<any[]>([]);
const filteredModels = ref<any[]>([]);
const loading = ref(false);

interface BrandModelStat {
  brandName: string;
  modelName: string;
  count: number;
  totalPrice: number;
}
const brandModelStats = ref<BrandModelStat[]>([]);

interface AccessorySummary {
  count: number;
  totalPrice: number;
}
const accessorySummary = ref<AccessorySummary>({ count: 0, totalPrice: 0 });

const fetchBrandModelStats = async () => {
  try {
    const res = await request.get('/asset/stats/by-brand-model') as BrandModelStat[];
    brandModelStats.value = res;
  } catch {
    brandModelStats.value = [];
  }
};

const fetchAccessorySummary = async () => {
  try {
    const res = await request.get('/asset/stats/accessory-summary') as AccessorySummary;
    accessorySummary.value = {
      count: Number(res.count) || 0,
      totalPrice: Number(res.totalPrice) || 0,
    };
  } catch {
    accessorySummary.value = { count: 0, totalPrice: 0 };
  }
};

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
});

// ----- Calendar Modal -----
const calendarVisible = ref(false);
const calendarLoading = ref(false);
const calendarAsset = ref<any>(null);
const calendarOccupancies = ref<any[]>([]);
const calendarDate = ref(dayjs());

// ----- Tabs -----
const activeTab = ref<'Camera' | 'Accessory'>('Camera');

const cameraAssets = computed(() => assets.value.filter((a) => a.type === 'Camera'));
const accessoryAssets = computed(() => assets.value.filter((a) => a.type === 'Accessory'));

const onTabChange = () => {
  pagination.value.current = 1;
  fetchAssets();
};

// ----- 筛选 -----
const cameraFilters = ref({
  brandModel: [] as number[],
  status: undefined as 'Normal' | 'Damaged' | undefined,
});

const accessoryFilters = ref({
  name: '',
  status: undefined as 'Normal' | 'Damaged' | undefined,
});

const cascaderOptions = computed(() => {
  return brands.value.map((b) => ({
    value: b.id,
    label: b.name,
    children: deviceModels.value
      .filter((m) => m.brandId === b.id)
      .map((m) => ({ value: m.id, label: m.name })),
  }));
});

const buildListParams = () => {
  const p: Record<string, string | number> = { type: activeTab.value };
  if (activeTab.value === 'Camera') {
    const [bId, mId] = cameraFilters.value.brandModel || [];
    if (bId) p.brandId = bId;
    if (mId) p.modelId = mId;
    if (cameraFilters.value.status) p.status = cameraFilters.value.status;
  } else {
    if (accessoryFilters.value.status) p.status = accessoryFilters.value.status;
    if (accessoryFilters.value.name?.trim()) p.name = accessoryFilters.value.name.trim();
  }
  p.page = pagination.value.current;
  p.pageSize = pagination.value.pageSize;
  return p;
};

const fetchAssets = async () => {
  loading.value = true;
  try {
    const res = (await request.get('/asset', { params: buildListParams() })) as { list: any[]; total: number };
    assets.value = res.list;
    pagination.value.total = res.total;
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

const onCameraFilterChange = () => {
  pagination.value.current = 1;
  fetchAssets();
};

const onAccessoryFilterChange = () => {
  pagination.value.current = 1;
  fetchAssets();
};

const resetCameraFilters = () => {
  cameraFilters.value = { brandModel: [], status: undefined };
  pagination.value.current = 1;
  pagination.value.pageSize = 10;
  fetchAssets();
};

const resetAccessoryFilters = () => {
  accessoryFilters.value = { name: '', status: undefined };
  pagination.value.current = 1;
  pagination.value.pageSize = 10;
  fetchAssets();
};

const handleTableChange = (pag: any) => {
  pagination.value.current = pag.current;
  pagination.value.pageSize = pag.pageSize;
  fetchAssets();
};

const cameraColumns = [
  { title: '类型', key: 'type', width: 80 },
  { title: '品牌', key: 'brandName', width: 120 },
  { title: '型号', key: 'modelOrName', width: 140 },
  { title: '图片', key: 'imageUrl', width: 80 },
  { title: 'S/N码', key: 'sinCode', width: 140 },
  { title: '购买金额', dataIndex: 'price', key: 'price', width: 100 },
  {
    title: '购买时间',
    dataIndex: 'purchaseDate',
    key: 'purchaseDate',
    width: 120,
    customRender: ({ text }: any) => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
  },
  { title: '租赁状态', key: 'rentalStatus', width: 100 },
  { title: '设备状态', key: 'status', width: 90 },
  { title: '操作', key: 'actions', width: 200, fixed: !isMobile.value ? ('right' as const) : undefined },
];

const accessoryColumns = [
  { title: '类型', key: 'type', width: 80 },
  { title: '配件名称', key: 'name', width: 180 },
  { title: '图片', key: 'imageUrl', width: 80 },
  { title: '购买金额', dataIndex: 'price', key: 'price', width: 100 },
  {
    title: '购买时间',
    dataIndex: 'purchaseDate',
    key: 'purchaseDate',
    width: 120,
    customRender: ({ text }: any) => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
  },
  { title: '租赁状态', key: 'rentalStatus', width: 100 },
  { title: '设备状态', key: 'status', width: 90 },
  { title: '操作', key: 'actions', width: 200, fixed: !isMobile.value ? ('right' as const) : undefined },
];

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

const firstImageUrl = (asset: any): string => {
  const arr = asset?.imageUrls;
  return Array.isArray(arr) && arr.length ? arr[0] : '';
};

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await fetchDicts();
  await Promise.all([fetchAssets(), fetchBrandModelStats(), fetchAccessorySummary()]);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// ----- 弹窗 + 表单 -----
const assetModalVisible = ref(false);
const assetModalMode = ref<'add' | 'edit'>('add');
const submitLoading = ref(false);
const assetFormRef = ref();
const editingAssetId = ref<number | null>(null);
const originalImageUrls = ref<string[]>([]);

interface AssetForm {
  type: 'Camera' | 'Accessory';
  name: string;
  sinCode: string;
  brandId: number | null;
  modelId: number | null;
  purchaseDate: dayjs.Dayjs | null;
  price: number;
  status: 'Normal' | 'Damaged';
  damageDesc: string;
  remark: string;
}

const blankForm = (): AssetForm => ({
  type: 'Camera',
  name: '',
  sinCode: '',
  brandId: null,
  modelId: null,
  purchaseDate: null,
  price: 0,
  status: 'Normal',
  damageDesc: '',
  remark: '',
});

const assetForm = ref<AssetForm>(blankForm());
const fileList = ref<UploadFile[]>([]);

const previewVisible = ref(false);
const previewSrc = ref('');

const onTypeChange = () => {
  if (assetForm.value.type === 'Camera') {
    assetForm.value.name = '';
  } else {
    assetForm.value.brandId = null;
    assetForm.value.modelId = null;
    assetForm.value.sinCode = '';
    filteredModels.value = [];
  }
};

const openAddAssetModal = () => {
  assetModalMode.value = 'add';
  editingAssetId.value = null;
  assetForm.value = blankForm();
  filteredModels.value = [];
  fileList.value = [];
  originalImageUrls.value = [];
  assetModalVisible.value = true;
};

const openEditAssetModal = (record: any) => {
  assetModalMode.value = 'edit';
  editingAssetId.value = record.id;
  assetForm.value = {
    type: record.type,
    name: record.name || '',
    sinCode: record.sinCode || '',
    brandId: record.brandId ?? null,
    modelId: record.modelId ?? null,
    purchaseDate: record.purchaseDate ? dayjs(record.purchaseDate) : null,
    price: record.price,
    status: record.status,
    damageDesc: record.damageDesc || '',
    remark: record.remark || '',
  };
  filteredModels.value = record.brandId
    ? deviceModels.value.filter((m) => m.brandId === record.brandId)
    : [];
  const urls: string[] = Array.isArray(record.imageUrls) ? record.imageUrls.filter(Boolean) : [];
  originalImageUrls.value = [...urls];
  fileList.value = urls.map((url, idx) => ({
    uid: `existing-${idx}-${url}`,
    name: url.split('/').pop() || `image-${idx}`,
    status: 'done',
    url,
  }));
  assetModalVisible.value = true;
};

const handleBrandChange = (value: number) => {
  assetForm.value.modelId = null;
  filteredModels.value = deviceModels.value.filter((m) => m.brandId === value);
};

// ----- 上传 -----
const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('仅支持图片文件');
    return false;
  }
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    message.error('图片大小不能超过 10MB');
    return false;
  }
  return true;
};

const customUpload: UploadProps['customRequest'] = async (options) => {
  const { file, onSuccess, onError } = options as any;
  const fd = new FormData();
  fd.append('file', file as Blob);
  try {
    const data = (await request.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })) as unknown as { url: string };
    onSuccess?.(data, file as any);
  } catch (e) {
    onError?.(e as Error);
  }
};

const extractUrl = (f: UploadFile): string => f.url || (f.response as any)?.url || '';

const handlePreview = async (file: UploadFile) => {
  previewSrc.value = extractUrl(file);
  if (previewSrc.value) {
    previewVisible.value = true;
  }
};

const silentDeleteUpload = async (url: string) => {
  if (!url) return;
  try {
    await request.delete('/upload', { data: { url } });
  } catch {
    // 静默：删不掉就忽略
  }
};

const handleRemove: UploadProps['onRemove'] = async (file) => {
  const url = extractUrl(file);
  if (url) await silentDeleteUpload(url);
  return true;
};

// ----- 提交 / 取消 -----
const handleSubmitAsset = async () => {
  try {
    await assetFormRef.value.validate();
  } catch {
    return;
  }
  if (fileList.value.some((f) => f.status === 'uploading')) {
    message.warning('图片上传中，请稍候');
    return;
  }
  const imageUrls = fileList.value.map(extractUrl).filter(Boolean);

  submitLoading.value = true;
  try {
    const f = assetForm.value;
    const payload: Record<string, any> = {
      type: f.type,
      imageUrls,
      purchaseDate: f.purchaseDate?.toISOString(),
      price: f.price,
      status: f.status,
      damageDesc: f.status === 'Damaged' ? f.damageDesc : null,
      remark: f.remark || null,
    };
    if (f.type === 'Camera') {
      payload.brandId = f.brandId;
      payload.modelId = f.modelId;
      payload.sinCode = f.sinCode;
    } else {
      payload.name = f.name;
    }

    if (assetModalMode.value === 'edit' && editingAssetId.value) {
      await request.put(`/asset/${editingAssetId.value}`, payload);
      message.success('资产已更新');
    } else {
      await request.post('/asset', payload);
      message.success('资产已新增');
    }
    assetModalVisible.value = false;
    originalImageUrls.value = [...imageUrls];
    fileList.value = [];
    await Promise.all([fetchAssets(), fetchBrandModelStats(), fetchAccessorySummary()]);
  } catch {
    // 拦截器已提示
  } finally {
    submitLoading.value = false;
  }
};

const handleCancelAssetModal = async () => {
  const orphans = fileList.value
    .map(extractUrl)
    .filter((u) => u && !originalImageUrls.value.includes(u));
  if (orphans.length) {
    await Promise.all(orphans.map(silentDeleteUpload));
  }
  assetForm.value = blankForm();
  filteredModels.value = [];
  fileList.value = [];
  originalImageUrls.value = [];
  editingAssetId.value = null;
};

// ----- 操作列 -----
const goDetail = (record: any) => {
  router.push({ name: 'AssetDetail', params: { id: record.id } });
};

const goCreateOrder = (record: any) => {
  router.push({ name: 'OrderAdd', query: { assetId: record.id } });
};

const confirmDeleteAsset = (record: any) => {
  const titleLine =
    record.type === 'Camera'
      ? `${record.brand?.name || ''} ${record.model?.name || ''}`
      : record.name || '配件';
  Modal.confirm({
    title: '确认删除该资产？',
    content: h('div', null, [
      h('div', titleLine),
      h('div', { style: 'color: #999; font-size: 12px;' }, '删除后无法恢复'),
    ]),
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        const urls: string[] = Array.isArray(record.imageUrls) ? record.imageUrls : [];
        await request.delete(`/asset/${record.id}`);
        await Promise.all(urls.map(silentDeleteUpload));
        message.success('资产已删除');
        await Promise.all([fetchAssets(), fetchBrandModelStats(), fetchAccessorySummary()]);
      } catch {
        // 拦截器已提示
      }
    },
  });
};

const openCalendarModal = async (asset: any) => {
  calendarAsset.value = asset;
  calendarDate.value = dayjs();
  calendarVisible.value = true;
  calendarLoading.value = true;
  try {
    const data = (await request.get(`/asset/${asset.id}/occupancy`)) as any[];
    calendarOccupancies.value = data;
  } catch {
    calendarOccupancies.value = [];
  } finally {
    calendarLoading.value = false;
  }
};

const getOccupanciesForDate = (date: dayjs.Dayjs) => {
  const d = date.startOf('day');
  return calendarOccupancies.value.filter((occ) => {
    const start = dayjs(occ.startTime).startOf('day');
    const end = dayjs(occ.endTime).startOf('day');
    return (d.isSame(start) || d.isAfter(start)) && (d.isSame(end) || d.isBefore(end));
  });
};

const prevMonth = () => {
  calendarDate.value = calendarDate.value.subtract(1, 'month');
};

const nextMonth = () => {
  calendarDate.value = calendarDate.value.add(1, 'month');
};
</script>

<style scoped>
.stats-card-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.stats-card {
  flex: 1 1 160px;
  max-width: 220px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stats-card::before {
  content: '';
  display: block;
  height: 3px;
  background: linear-gradient(90deg, #1890ff, #36cfc9);
}

.stats-card-accessory::before {
  background: linear-gradient(90deg, #722ed1, #eb2f96);
}

.stats-card-header {
  padding: 8px 12px 6px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.stats-brand {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
  line-height: 1.3;
}

.stats-card-body {
  display: flex;
  align-items: center;
  padding: 8px 12px;
}

.stats-item {
  flex: 1;
  text-align: center;
}

.stats-value {
  font-size: 15px;
  font-weight: 600;
  color: #262626;
  line-height: 1.2;
}

.stats-price {
  color: #cf1322;
}

.stats-divider {
  width: 1px;
  height: 32px;
  background: #f0f0f0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.calendar-events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.calendar-event {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
}

.event-order {
  background-color: #ff4d4f;
}

.event-reservation {
  background-color: #1890ff;
}

.calendar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cal-nav-btn {
  height: 64px;
  font-size: 16px;
  padding: 0 20px;
  flex-shrink: 0;
}

.cal-body {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .calendar-wrapper {
    flex-direction: column;
  }
  .cal-nav-btn {
    width: 100%;
    height: 48px;
  }
}
</style>
