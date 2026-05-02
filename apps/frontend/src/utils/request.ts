import axios from 'axios';
import { message } from 'ant-design-vue';
import router from '../router';
import { useUserStore } from '../stores/user';

const request = axios.create({
  baseURL: '/api',
  timeout: 5000,
  withCredentials: true, // 走 HttpOnly cookie
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // cookie 失效或被清掉
      try {
        useUserStore().clearLogin();
      } catch {
        // 应用未挂载时忽略
      }
      if (router.currentRoute.value.name !== 'Login') {
        message.error('登录已过期，请重新登录');
        router.push('/login');
      }
    } else {
      message.error(error.response?.data?.message || '网络请求错误');
    }
    return Promise.reject(error);
  },
);

export default request;
