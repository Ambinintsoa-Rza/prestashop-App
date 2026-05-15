<script setup>
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  fetchResource,
  normalizeShopProductDetail,
  buildImageUrl,
} from '../../services/prestashopApi'
import { useShopStore } from '../../store/useShopStore'

const router = useRouter()
const route = useRoute()
const { addToCart, cartCount } = useShopStore()

const product = ref(null)
const loading = ref(false)
const error = ref('')
const qty = ref(1)
const added = ref(false)

const baseUrl = import.meta.env.VITE_PS_BASE_URL || '/ps-api'
const apiKey = import.meta.env.VITE_PS_WS_KEY || ''

const loadProduct = async () => {
  loading.value = true
  error.value = ''
  try {
    const { json } = await fetchResource(
      `products/${route.params.id}`,
      {},
      { baseUrl, apiKey }
    )
    product.value = normalizeShopProductDetail(json)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const imageUrl = (p) => buildImageUrl(baseUrl, p.id, p.defaultImageId, apiKey)

const handleAddToCart = () => {
  addToCart({ ...product.value, imageUrl: imageUrl(product.value) }, qty.value)
  added.value = true
  setTimeout(() => (added.value = false), 2000)
}

const goBack = () => router.push({ name: 'ShopCatalog' })
const goCart = () => router.push({ name: 'ShopCart' })

onMounted(loadProduct)
</script>

<template>
  <div class="shop-root">
    <!-- Header -->
    <header class="shop-header">
      <div class="shop-header-inner">
        <button class="back-btn" @click="goBack">← Catalogue</button>
        <button class="cart-btn" @click="goCart">
          <span>🛒</span>
          <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
          <span>Panier</span>
        </button>
      </div>
    </header>

    <main class="shop-main">
      <div v-if="loading" class="shop-loading">
        <span class="shop-spinner"></span><p>Chargement…</p>
      </div>

      <p v-else-if="error" class="shop-error">⚠️ {{ error }}</p>

      <div v-else-if="product" class="product-detail">
        <!-- Image -->
        <div class="detail-img-col">
          <div class="detail-img-wrap">
            <img
              v-if="imageUrl(product)"
              :src="imageUrl(product)"
              :alt="product.name"
              class="detail-img"
              @error="($event.target.style.display='none')"
            />
            <div v-else class="detail-img-placeholder">📦</div>
          </div>
        </div>

        <!-- Infos -->
        <div class="detail-info-col">
          <p v-if="product.reference" class="detail-ref">Réf. {{ product.reference }}</p>
          <h1 class="detail-name">{{ product.name }}</h1>

          <p
            v-if="product.descriptionShort"
            class="detail-short-desc"
            v-html="product.descriptionShort"
          ></p>

          <div class="detail-price-block">
            <span class="detail-price">{{ parseFloat(product.price).toFixed(2) }} €</span>
            <span class="detail-price-label">Prix HT</span>
          </div>

          <div class="detail-delivery-badge">
            🚚 Livraison gratuite · Paiement à la livraison
          </div>

          <!-- Quantité -->
          <div class="detail-qty-row">
            <label class="detail-qty-label">Quantité</label>
            <div class="qty-control">
              <button class="qty-btn" @click="qty = Math.max(1, qty - 1)">−</button>
              <span class="qty-value">{{ qty }}</span>
              <button class="qty-btn" @click="qty++">+</button>
            </div>
          </div>

          <!-- Actions -->
          <div class="detail-actions">
            <button
              class="add-to-cart-btn"
              :class="{ 'btn-added': added }"
              @click="handleAddToCart"
            >
              <span v-if="added">✓ Ajouté au panier !</span>
              <span v-else>🛒 Ajouter au panier</span>
            </button>
            <button class="go-cart-btn" @click="goCart">Voir le panier →</button>
          </div>

          <!-- Description longue -->
          <div
            v-if="product.description"
            class="detail-desc"
            v-html="product.description"
          ></div>
        </div>
      </div>
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
.shop-header {
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(20px);
  background: rgba(15,15,26,0.85);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.shop-header-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 24px;
  height: 64px; display: flex; align-items: center; justify-content: space-between;
}
.back-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.15);
  color: rgba(232,232,240,0.7); border-radius: 10px;
  padding: 8px 16px; cursor: pointer; font-size: 14px; transition: all 0.2s;
}
.back-btn:hover { border-color: rgba(167,139,250,0.5); color: #a78bfa; background: rgba(167,139,250,0.08); }
.cart-btn {
  display: flex; align-items: center; gap: 8px;
  background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.4);
  color: #a78bfa; border-radius: 12px; padding: 8px 18px;
  font-size: 15px; font-weight: 600; cursor: pointer; position: relative; transition: all 0.2s;
}
.cart-btn:hover { background: rgba(167,139,250,0.25); transform: translateY(-1px); }
.cart-badge {
  position: absolute; top: -6px; right: -6px;
  background: #f43f5e; color: white; font-size: 11px; font-weight: 700;
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.shop-main {
  max-width: 1280px; margin: 0 auto; padding: 40px 24px 80px;
}
.shop-loading {
  display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 0;
  color: rgba(232,232,240,0.5);
}
.shop-spinner {
  width: 36px; height: 36px; border: 3px solid rgba(167,139,250,0.2);
  border-top-color: #a78bfa; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.shop-error {
  color: #f87171; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25);
  border-radius: 14px; padding: 16px; text-align: center;
}
.product-detail {
  display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start;
}
@media (max-width: 800px) { .product-detail { grid-template-columns: 1fr; gap: 32px; } }

/* Image */
.detail-img-wrap {
  border-radius: 24px; overflow: hidden;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
}
.detail-img { width: 100%; height: 100%; object-fit: cover; }
.detail-img-placeholder { font-size: 96px; opacity: 0.2; }

/* Info */
.detail-ref { font-size: 12px; color: rgba(232,232,240,0.4); margin: 0 0 8px; font-family: monospace; }
.detail-name {
  font-size: clamp(22px, 4vw, 36px); font-weight: 800; margin: 0 0 16px;
  color: #f0f0f8; line-height: 1.2;
}
.detail-short-desc {
  font-size: 15px; color: rgba(232,232,240,0.55); margin: 0 0 24px; line-height: 1.6;
}
.detail-price-block {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px;
}
.detail-price {
  font-size: 38px; font-weight: 800;
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.detail-price-label {
  font-size: 13px; color: rgba(232,232,240,0.4);
}
.detail-delivery-badge {
  display: inline-block; background: rgba(52,211,153,0.1);
  border: 1px solid rgba(52,211,153,0.3); color: #34d399;
  border-radius: 99px; padding: 6px 14px; font-size: 13px; font-weight: 500;
  margin-bottom: 28px;
}
.detail-qty-label {
  font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(232,232,240,0.5); margin: 0 0 10px; display: block;
}
.qty-control {
  display: flex; align-items: center; gap: 0;
  border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
  overflow: hidden; width: fit-content; margin-bottom: 28px;
}
.qty-btn {
  background: rgba(255,255,255,0.06); border: none; color: #e8e8f0;
  width: 42px; height: 42px; font-size: 20px; cursor: pointer;
  transition: background 0.15s; display: flex; align-items: center; justify-content: center;
}
.qty-btn:hover { background: rgba(167,139,250,0.2); }
.qty-value {
  min-width: 48px; text-align: center; font-size: 18px; font-weight: 700;
}
.detail-actions { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
.add-to-cart-btn {
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border: none; color: white; padding: 16px 28px; border-radius: 14px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  transition: opacity 0.2s, transform 0.15s; width: 100%;
}
.add-to-cart-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.add-to-cart-btn.btn-added {
  background: linear-gradient(135deg, #059669, #10b981);
}
.go-cart-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
  color: rgba(232,232,240,0.7); padding: 12px 28px; border-radius: 14px;
  font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%;
}
.go-cart-btn:hover { border-color: rgba(167,139,250,0.4); color: #a78bfa; }
.detail-desc {
  font-size: 14px; color: rgba(232,232,240,0.45); line-height: 1.7;
  border-top: 1px solid rgba(255,255,255,0.07); padding-top: 24px;
}
</style>
