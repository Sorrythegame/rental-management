import { createRouter, createWebHistory } from 'vue-router';
import BasicLayout from '../layout/BasicLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/',
      component: BasicLayout,
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
        },
        {
          path: 'assets',
          name: 'Assets',
          component: () => import('../views/Assets.vue'),
        },
        {
          path: 'orders',
          name: 'Orders',
          component: () => import('../views/Orders.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.name !== 'Login' && !token) {
    next({ name: 'Login' });
  } else {
    next();
  }
});

export default router;
