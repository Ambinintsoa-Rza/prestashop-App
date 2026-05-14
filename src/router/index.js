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
  {
    path:"/front",
    name:"Product",
    component: Product,
  }
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