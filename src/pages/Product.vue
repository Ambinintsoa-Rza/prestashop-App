<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchResource,
  normalizeShopProducts,
  buildImageUrl,
} from '../services/prestashopApi'
import { useShopStore } from '../store/useShopStore'

const router = useRouter()
const { cartCount } = useShopStore()

const products = ref([])
const loading = ref(false)
const error = ref('')

const baseUrl = import.meta.env.VITE_PS_BASE_URL || '/ps-api'
const apiKey = import.meta.env.VITE_PS_WS_KEY || ''

const loadProducts = async () => {
  loading.value = true
  error.value = ''
  try {
    const { json } = await fetchResource(
      'products',
      { display: '[id,name,price,active,id_default_image,description_short,date_add,available_date]' },
      { baseUrl, apiKey }
    )
    products.value = normalizeShopProducts(json).filter((p) => p.active)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const goToProduct = (id) => router.push({ name: 'ShopProduct', params: { id } })
const goToCart = () => router.push({ name: 'ShopCart' })

const imgUrl = (p) => buildImageUrl(baseUrl, p.id, p.defaultImageId, apiKey)

// ── Badges HOT / NEW ──────────────────────────────────────
const getProductBadge = (p) => {
  if (!p.dateAvailable) return null
  const now = Date.now()
  const released = new Date(p.dateAvailable).getTime()
  if (isNaN(released)) return null
  const diffMs = now - released
  const ONE_DAY = 24 * 60 * 60 * 1000
  const ONE_WEEK = 7 * ONE_DAY
  if (diffMs >= 0 && diffMs < ONE_DAY)   return 'hot'  // sorti < 1 jour
  if (diffMs >= 0 && diffMs < ONE_WEEK)  return 'new'  // sorti < 1 semaine
  return null
}

onMounted(loadProducts)
</script>

<template>
  <div class="shop-root">
    <!-- Header boutique -->
    <header class="shop-header">
      <div class="shop-header-inner">
        <div class="shop-brand">
          <span class="shop-logo-icon">🛍️</span>
          <span class="shop-brand-name">Ma Boutique</span>
        </div>
        <button class="cart-btn" @click="goToCart">
          <span class="cart-icon">🛒</span>
          <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
          <span class="cart-label">Panier</span>
        </button>
      </div>
    </header>

    <!-- Hero -->
    <section class="shop-hero">
      <h1>Notre catalogue</h1>
      <p class="shop-hero-sub">Découvrez nos produits · Livraison gratuite · Paiement à la livraison</p>
    </section>

    <!-- Contenu -->
    <main class="shop-main">
      <p v-if="error" class="shop-error">⚠️ {{ error }}</p>

      <div v-else-if="loading" class="shop-loading">
        <span class="shop-spinner"></span>
        <p>Chargement du catalogue…</p>
      </div>

      <div v-else-if="!products.length" class="shop-empty">
        Aucun produit disponible.
      </div>

      <ul v-else class="product-grid">
        <li
          v-for="p in products"
          :key="p.id"
          class="product-card"
          @click="goToProduct(p.id)"
        >
          <div class="product-img-wrap">
            <img
              v-if="imgUrl(p)"
              :src="imgUrl(p)"
              :alt="p.name"
              class="product-img"
              @error="($event.target.style.display='none')"
            />
            <div v-else class="product-img-placeholder">📦</div>

            <!-- Badge HOT / NEW -->
            <span
              v-if="getProductBadge(p)"
              :class="['product-badge', `badge-${getProductBadge(p)}`]"
            >
              {{ getProductBadge(p) === 'hot' ? '🔥 HOT' : '✨ NEW' }}
            </span>
          </div>
          <div class="product-card-body">
            <h3 class="product-card-name">{{ p.name }}</h3>
            <p
              v-if="p.descriptionShort"
              class="product-card-desc"
              v-html="p.descriptionShort"
            ></p>
            <div class="product-card-footer">
              <span class="product-card-price">{{ parseFloat(p.price).toFixed(2) }} €</span>
              <span class="product-card-cta">Voir →</span>
            </div>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.shop-root {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  color: #e8e8f0;
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

/* Header */
.shop-header {
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(20px);
  background: rgba(15, 15, 26, 0.85);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.shop-header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.shop-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.shop-logo-icon { font-size: 24px; }
.shop-brand-name {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cart-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.4);
  color: #a78bfa;
  border-radius: 12px;
  padding: 8px 18px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: background 0.2s, transform 0.15s;
}
.cart-btn:hover { background: rgba(167, 139, 250, 0.25); transform: translateY(-1px); }
.cart-icon { font-size: 18px; }
.cart-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #f43f5e;
  color: white;
  font-size: 11px;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Hero */
.shop-hero {
  text-align: center;
  padding: 64px 24px 32px;
}
.shop-hero h1 {
  font-size: clamp(32px, 6vw, 56px);
  font-weight: 800;
  margin: 0 0 12px;
  background: linear-gradient(135deg, #ffffff 0%, #a78bfa 60%, #60a5fa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.shop-hero-sub {
  color: rgba(232, 232, 240, 0.55);
  font-size: 16px;
  margin: 0;
}

/* Main */
.shop-main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 24px 80px;
}

/* States */
.shop-error {
  text-align: center;
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 14px;
  padding: 16px;
}
.shop-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 0;
  color: rgba(232,232,240,0.5);
}
.shop-spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(167,139,250,0.2);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.shop-empty {
  text-align: center;
  padding: 80px 0;
  color: rgba(232,232,240,0.4);
}

/* Grid */
.product-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

/* Card */
.product-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.product-card:hover {
  transform: translateY(-6px);
  border-color: rgba(167,139,250,0.5);
  box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(167,139,250,0.2);
}
.product-img-wrap {
  height: 220px;
  background: rgba(255,255,255,0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}
.product-card:hover .product-img { transform: scale(1.04); }
.product-img-placeholder {
  font-size: 64px;
  opacity: 0.3;
}
.product-card-body {
  padding: 18px 20px;
}
.product-card-name {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #f0f0f8;
  line-height: 1.35;
}
.product-card-desc {
  font-size: 13px;
  color: rgba(232,232,240,0.5);
  margin: 0 0 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.product-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.product-card-price {
  font-size: 20px;
  font-weight: 800;
  color: #a78bfa;
}
.product-card-cta {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  opacity: 0;
  transition: opacity 0.2s;
}
.product-card:hover .product-card-cta { opacity: 1; }

/* ── Badges HOT / NEW ─────────────────────────────────── */
.product-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 2;
}

.badge-hot {
  background: linear-gradient(135deg, #ef4444, #f97316);
  color: #fff;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
  animation: pulse-hot 2s ease-in-out infinite;
}
@keyframes pulse-hot {
  0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
  50%       { box-shadow: 0 0 20px rgba(249, 115, 22, 0.8); }
}

.badge-new {
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  color: #fff;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.4);
}
</style>