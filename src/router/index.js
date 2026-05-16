import { createRouter, createWebHistory } from "vue-router";

import AdminLogin from "../pages/AdminLogin.vue";
import Dashboard from "../pages/Dashboard.vue";
import ImportPage from "../pages/Import.vue";
import Product from "../pages/Product.vue";
import { checkAdminSession } from "../services/adminAuth";

const routes = [
  {
    path: "/",
    name: "AdminLogin",
    component: AdminLogin,
    alias: "/login",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/import",
    name: "Import",
    component: ImportPage,
    meta: { requiresAuth: true },
  },
  // ── Shop (frontoffice) ──────────────────────────
  {
    path: '/front',
    name: 'ShopLogin',
    component: () => import('../pages/shop/ShopLogin.vue'),
  },
  {
    path: '/front/catalog',
    name: 'ShopCatalog',
    component: Product,
  },
  {
    path: "/front/product/:id",
    name: "ShopProduct",
    component: () => import("../pages/shop/ShopProduct.vue"),
  },
  {
    path: "/front/cart",
    name: "ShopCart",
    component: () => import("../pages/shop/ShopCart.vue"),
  },
  {
    path: "/front/checkout",
    name: "ShopCheckout",
    component: () => import("../pages/shop/ShopCheckout.vue"),
  },
  {
    path: "/front/confirmation",
    name: "ShopConfirmation",
    component: () => import("../pages/shop/ShopConfirmation.vue"),
  },
  {
    path: "/front/orders",
    name: "ShopOrders",
    component: () => import("../pages/shop/ShopOrders.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const adminBaseUrl = import.meta.env.VITE_PS_ADMIN_BASE_URL || "/ps-admin";

router.beforeEach(async (to) => {
  const isAuthenticated = await checkAdminSession(adminBaseUrl);

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: "AdminLogin" };
  }

  if (isAuthenticated && to.name === "AdminLogin") {
    return { name: "Dashboard" };
  }

  return true;
});

export default router;