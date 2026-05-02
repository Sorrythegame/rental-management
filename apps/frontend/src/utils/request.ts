import axios from 'axios';
import { message } from 'ant-design-vue';
import router from '../router';

const request = axios.create({
  baseURL: '/api',
  timeout: 5000,
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      message.error('登录已过期，请重新登录');
      localStorage.removeItem('token');
      router.push('/login');
    } else {
      message.error(error.response?.data?.message || '网络请求错误');
    }
    return Promise.reject(error);
  },
);

export default request;
