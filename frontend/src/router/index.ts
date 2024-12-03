import { RouteLocationNormalized, createRouter, createWebHashHistory } from 'vue-router';

import MainPage from '../pages/MainPage.vue';
const WorldPage = () => import('../pages/WorldPage.vue');

declare module 'vue-router' {
  interface RouteMeta {
    title: string;
  }
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: '',
      component: MainPage,
    },
    {
      path: '/world',
      name: 'world',
      component: WorldPage,
    },
  ],
});

export function setPageTitle(page: RouteLocationNormalized) {
  document.title = page.meta.title || (page.name as string) || '';
}

router.beforeEach((to, from, next) => {
  if (import.meta.env.DEV) {
    console.log(from, to);
  }
  // if (!api.context.token && to.meta.requiresAuth) {
  //   next({ name: 'login' });
  //   return;
  // }
  setPageTitle(to);
  next(true);
});
