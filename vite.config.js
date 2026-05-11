import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const proxyTarget = env.VITE_PS_PROXY_TARGET
  const adminProxyTarget = env.VITE_PS_ADMIN_PROXY_TARGET

  const proxy = {}

  if (proxyTarget) {
    proxy['/ps-api'] = {
      target: proxyTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/ps-api/, ''),
    }
  }

  if (adminProxyTarget) {
    proxy['/ps-admin'] = {
      target: adminProxyTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/ps-admin/, ''),
    }
  }

  return {
    plugins: [vue()],
    server: {
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
  }
})
