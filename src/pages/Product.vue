<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchResource,
  normalizeShopProducts,
  buildImageUrl,
  pickText,
  pickLanguageValue,
} from '../services/prestashopApi'
import { useShopStore } from '../store/useShopStore'

const router = useRouter()
const { cartCount, currentCustomer } = useShopStore()

const products   = ref([])
const categories = ref([])  // [{ id, name }]
const loading    = ref(false)
const error      = ref('')

const baseUrl = import.meta.env.VITE_PS_BASE_URL || '/ps-api'
const apiKey  = import.meta.env.VITE_PS_WS_KEY  || ''

// ── Chargement produits + catégories ──────────────────────
const loadAll = async () => {
  loading.value = true
  error.value   = ''
  try {
    const [prodRes, catRes] = await Promise.all([
      fetchResource(
        'products',
        { display: '[id,name,price,active,id_default_image,description_short,date_add,available_date,id_category_default]' },
        { baseUrl, apiKey }
      ),
      fetchResource(
        'categories',
        { display: '[id,name,active]' },
        { baseUrl, apiKey }
      ),
    ])

    products.value = normalizeShopProducts(prodRes.json).filter((p) => p.active)

    // Normaliser les catégories
    const rawCat = catRes.json?.prestashop?.categories?.category
    if (rawCat) {
      const list = Array.isArray(rawCat) ? rawCat : [rawCat]
      categories.value = list
        .filter(c => pickText(c.active) === '1' && pickText(c.id) !== '1' && pickText(c.id) !== '2')
        .map(c => ({ id: pickText(c.id), name: pickLanguageValue(c.name) }))
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// ── Normaliser pour inclure categoryId ────────────────────
// (déjà dans normalizeShopProducts via date_add, on complète ici)

const goToProduct = (id) => router.push({ name: 'ShopProduct', params: { id } })
const goToCart    = ()   => router.push({ name: 'ShopCart' })
const goToOrders  = ()   => router.push({ name: 'ShopOrders' })
const imgUrl      = (p)  => buildImageUrl(baseUrl, p.id, p.defaultImageId, apiKey)

// ── Badges HOT / NEW ──────────────────────────────────────
const getProductBadge = (p) => {
  if (!p.dateAvailable) return null
  const now      = Date.now()
  const released = new Date(p.dateAvailable).getTime()
  if (isNaN(released)) return null
  const diff   = now - released
  const DAY    = 24 * 60 * 60 * 1000
  const WEEK   = 7 * DAY
  if (diff >= 0 && diff < DAY)  return 'hot'
  if (diff >= 0 && diff < WEEK) return 'new'
  return null
}

// ── Recherche multicritère ─────────────────────────────────
const searchName      = ref('')
const searchCategory  = ref('')   // id catégorie
const searchPriceMin  = ref('')
const searchPriceMax  = ref('')

const filteredProducts = computed(() => {
  const name    = searchName.value.trim().toLowerCase()
  const catId   = searchCategory.value
  const pMin    = searchPriceMin.value !== '' ? parseFloat(searchPriceMin.value) : null
  const pMax    = searchPriceMax.value !== '' ? parseFloat(searchPriceMax.value) : null

  return products.value.filter((p) => {
    if (name   && !p.name.toLowerCase().includes(name)) return false
    if (catId  && p.categoryId !== catId)               return false
    const price = parseFloat(p.price)
    if (pMin !== null && price < pMin) return false
    if (pMax !== null && price > pMax) return false
    return true
  })
})

const hasActiveFilter = computed(() =>
  searchName.value || searchCategory.value || searchPriceMin.value || searchPriceMax.value
)

const clearFilters = () => {
  searchName.value     = ''
  searchCategory.value = ''
  searchPriceMin.value = ''
  searchPriceMax.value = ''
}

// Prix min/max du catalogue (pour les placeholders)
const priceRange = computed(() => {
  if (!products.value.length) return { min: 0, max: 0 }
  const prices = products.value.map(p => parseFloat(p.price))
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
})

onMounted(loadAll)
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
        <div class="shop-header-actions">
          <!-- Mes commandes (client connecté uniquement) -->
          <button
            v-if="currentCustomer && !currentCustomer.isAnonymous"
            class="orders-btn"
            @click="goToOrders"
          >
            📋 Mes commandes
          </button>

          <button class="cart-btn" @click="goToCart">
            <span class="cart-icon">🛒</span>
            <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
            <span class="cart-label">Panier</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="shop-hero">
      <h1>Notre catalogue</h1>
      <p class="shop-hero-sub">Découvrez nos produits · Livraison gratuite · Paiement à la livraison</p>
    </section>

    <main class="shop-main">
      <p v-if="error" class="shop-error">⚠️ {{ error }}</p>

      <div v-else-if="loading" class="shop-loading">
        <span class="shop-spinner"></span>
        <p>Chargement du catalogue…</p>
      </div>

      <template v-else>

        <!-- ── Panneau de recherche ───────────────────────── -->
        <div class="search-panel">
          <!-- Nom -->
          <div class="search-field search-name">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchName"
              type="text"
              placeholder="Rechercher un produit…"
              class="search-input"
            />
          </div>

          <!-- Catégorie -->
          <div class="search-field">
            <span class="search-icon">🏷️</span>
            <select v-model="searchCategory" class="search-select">
              <option value="">Toutes les catégories</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <!-- Prix min -->
          <div class="search-field search-price">
            <span class="search-icon">€</span>
            <input
              v-model="searchPriceMin"
              type="number"
              min="0"
              :placeholder="`Min (${priceRange.min} €)`"
              class="search-input"
            />
          </div>

          <!-- Prix max -->
          <div class="search-field search-price">
            <span class="search-icon">€</span>
            <input
              v-model="searchPriceMax"
              type="number"
              min="0"
              :placeholder="`Max (${priceRange.max} €)`"
              class="search-input"
            />
          </div>

          <!-- Reset -->
          <button
            v-if="hasActiveFilter"
            class="search-clear"
            @click="clearFilters"
            title="Effacer les filtres"
          >
            ✕ Effacer
          </button>
        </div>

        <!-- Compteur résultats -->
        <div class="search-results-bar" v-if="hasActiveFilter">
          <span>{{ filteredProducts.length }} résultat{{ filteredProducts.length !== 1 ? 's' : '' }}</span>
          <span v-if="filteredProducts.length < products.length" class="results-hint">
            sur {{ products.length }} produits
          </span>
        </div>

        <!-- Aucun résultat -->
        <div v-if="!filteredProducts.length" class="shop-empty">
          <p>Aucun produit ne correspond à votre recherche.</p>
          <button class="btn-clear-empty" @click="clearFilters">Réinitialiser les filtres</button>
        </div>

        <!-- Grille produits -->
        <ul v-else class="product-grid">
          <li
            v-for="p in filteredProducts"
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

              <!-- Badge HOT / NEW — toujours visible -->
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

      </template>
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
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(20px);
  background: rgba(15, 15, 26, 0.85);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.shop-header-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 24px;
  height: 64px; display: flex; align-items: center; justify-content: space-between;
}
.shop-brand { display: flex; align-items: center; gap: 10px; }
.shop-logo-icon { font-size: 24px; }
.shop-brand-name {
  font-size: 20px; font-weight: 700;
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.cart-btn {
  display: flex; align-items: center; gap: 8px;
  background: rgba(167, 139, 250, 0.15); border: 1px solid rgba(167, 139, 250, 0.4);
  color: #a78bfa; border-radius: 12px; padding: 8px 18px;
  font-size: 15px; font-weight: 600; cursor: pointer;
  position: relative; transition: background 0.2s, transform 0.15s;
}
.cart-btn:hover { background: rgba(167, 139, 250, 0.25); transform: translateY(-1px); }
.cart-icon { font-size: 18px; }
.cart-badge {
  position: absolute; top: -6px; right: -6px;
  background: #f43f5e; color: white; font-size: 11px; font-weight: 700;
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.shop-header-actions {
  display: flex; align-items: center; gap: 10px;
}
.orders-btn {
  display: flex; align-items: center; gap: 6px;
  background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.35);
  color: #60a5fa; border-radius: 12px; padding: 8px 16px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background 0.2s, transform 0.15s; white-space: nowrap;
}
.orders-btn:hover { background: rgba(96,165,250,0.22); transform: translateY(-1px); }

/* Hero */
.shop-hero { text-align: center; padding: 64px 24px 32px; }
.shop-hero h1 {
  font-size: clamp(32px, 6vw, 56px); font-weight: 800; margin: 0 0 12px;
  background: linear-gradient(135deg, #ffffff 0%, #a78bfa 60%, #60a5fa 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.shop-hero-sub { color: rgba(232, 232, 240, 0.55); font-size: 16px; margin: 0; }

/* Main */
.shop-main { max-width: 1280px; margin: 0 auto; padding: 16px 24px 80px; }

/* States */
.shop-error {
  text-align: center; color: #f87171;
  background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 14px; padding: 16px;
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
.shop-empty { text-align: center; padding: 60px 0; color: rgba(232,232,240,0.4); }
.shop-empty p { margin: 0 0 16px; font-size: 16px; }

/* ── Panneau de recherche ─────────────────────────────── */
.search-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
  padding: 20px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  align-items: center;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 0 14px;
  transition: border-color 0.2s;
  flex: 1;
  min-width: 180px;
}
.search-field:focus-within { border-color: rgba(167,139,250,0.5); }
.search-name { flex: 2; min-width: 240px; }
.search-price { max-width: 160px; flex: 0 1 140px; }

.search-icon {
  font-size: 14px;
  color: rgba(232,232,240,0.4);
  flex-shrink: 0;
}

.search-input, .search-select {
  background: transparent;
  border: none;
  outline: none;
  color: #e8e8f0;
  font-size: 14px;
  font-family: inherit;
  padding: 11px 0;
  width: 100%;
}
.search-input::placeholder { color: rgba(232,232,240,0.3); }
.search-select { cursor: pointer; appearance: none; }
.search-select option { background: #1a1a2e; color: #e8e8f0; }

.search-clear {
  background: rgba(248,113,113,0.12);
  border: 1px solid rgba(248,113,113,0.3);
  color: #f87171;
  border-radius: 12px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}
.search-clear:hover { background: rgba(248,113,113,0.22); }

/* Barre résultats */
.search-results-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: rgba(232,232,240,0.5);
  margin-bottom: 20px;
  padding: 0 4px;
}
.results-hint { color: rgba(232,232,240,0.3); }

.btn-clear-empty {
  background: rgba(167,139,250,0.15);
  border: 1px solid rgba(167,139,250,0.35);
  color: #a78bfa;
  border-radius: 12px;
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-clear-empty:hover { background: rgba(167,139,250,0.25); }

/* Grid */
.product-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

/* Card */
.product-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; overflow: hidden; cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.product-card:hover {
  transform: translateY(-6px);
  border-color: rgba(167,139,250,0.5);
  box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(167,139,250,0.2);
}

/* Image */
.product-img-wrap {
  height: 220px;
  background: rgba(255,255,255,0.03);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  position: relative;   /* ← nécessaire pour le badge absolu */
}
.product-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.product-card:hover .product-img { transform: scale(1.04); }
.product-img-placeholder { font-size: 64px; opacity: 0.3; }

.product-card-body { padding: 18px 20px; }
.product-card-name { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #f0f0f8; line-height: 1.35; }
.product-card-desc {
  font-size: 13px; color: rgba(232,232,240,0.5); margin: 0 0 14px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.product-card-footer { display: flex; align-items: center; justify-content: space-between; }
.product-card-price { font-size: 20px; font-weight: 800; color: #a78bfa; }
.product-card-cta {
  font-size: 13px; font-weight: 600; color: #60a5fa;
  opacity: 0; transition: opacity 0.2s;
}
.product-card:hover .product-card-cta { opacity: 1; }

/* ── Badges HOT / NEW — toujours visibles ─────────────── */
.product-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  pointer-events: none;
  z-index: 2;
  /* Toujours visible — pas de dépendance au hover */
}
.badge-hot {
  background: linear-gradient(135deg, #ef4444, #f97316);
  color: #fff;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.55);
  animation: pulse-hot 2s ease-in-out infinite;
}
@keyframes pulse-hot {
  0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
  50%       { box-shadow: 0 0 22px rgba(249, 115, 22, 0.85); }
}
.badge-new {
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  color: #fff;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.4);
}

@media (max-width: 640px) {
  .search-panel { flex-direction: column; }
  .search-field, .search-name, .search-price { min-width: 100%; max-width: 100%; flex: 1 1 100%; }
}
</style>