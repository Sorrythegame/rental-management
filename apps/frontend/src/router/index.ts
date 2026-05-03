import { createRouter, createWebHistory } from 'vue-router';
import BasicLayout from '../layout/BasicLayout.vue';
import { useUserStore } from '../stores/user';

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
          path: 'assets/detail/:id',
          name: 'AssetDetail',
          component: () => import('../views/AssetDetail.vue'),
        },
        {
          path: 'orders',
          name: 'Orders',
          component: () => import('../views/Orders.vue'),
        },
        {
          path: 'orders/add',
          name: 'OrderAdd',
          component: () => import('../views/OrderForm.vue'),
          meta: { mode: 'add' },
        },
        {
          path: 'orders/edit/:id',
          name: 'OrderEdit',
          component: () => import('../views/OrderForm.vue'),
          meta: { mode: 'edit' },
        },
        {
          path: 'orders/detail/:id',
          name: 'OrderDetail',
          component: () => import('../views/OrderDetail.vue'),
        },
        {
          path: 'reservations',
          name: 'Reservations',
          component: () => import('../views/Reservations.vue'),
        },
        {
          path: 'reservations/add',
          name: 'ReservationAdd',
          component: () => import('../views/ReservationForm.vue'),
          meta: { mode: 'add' },
        },
        {
          path: 'reservations/edit/:id',
          name: 'ReservationEdit',
          component: () => import('../views/ReservationForm.vue'),
          meta: { mode: 'edit' },
        },
        {
          path: 'reservations/detail/:id',
          name: 'ReservationDetail',
          component: () => import('../views/ReservationDetail.vue'),
        },
        {
          path: 'system',
          name: 'System',
          component: () => import('../views/System/index.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore();
  if (to.name !== 'Login' && !userStore.loggedIn) {
    next({ name: 'Login' });
  } else {
    next();
  }
});

export default router;
