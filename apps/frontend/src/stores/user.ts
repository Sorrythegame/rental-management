import { defineStore } from 'pinia';

// 仅用作前端 UI 提示：是否处于"已登录"态。
// 真正的认证依赖后端 HttpOnly cookie，前端不持有 token。
const STORAGE_KEY = 'loggedIn';

export const useUserStore = defineStore('user', {
  state: () => ({
    loggedIn: localStorage.getItem(STORAGE_KEY) === '1',
    username: '',
  }),
  actions: {
    markLogin(username = '') {
      this.loggedIn = true;
      this.username = username;
      localStorage.setItem(STORAGE_KEY, '1');
    },
    clearLogin() {
      this.loggedIn = false;
      this.username = '';
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});
