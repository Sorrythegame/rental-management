import { createApp } from 'vue'
import App from './App.vue'

// 引入 Ant Design Vue
import Antd from 'ant-design-vue';
// 引入 Ant Design Vue 样式
import 'ant-design-vue/dist/reset.css';

import router from './router'
import { createPinia } from 'pinia'

import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 注册全局 UI 库
app.use(Antd)
app.mount('#app')
