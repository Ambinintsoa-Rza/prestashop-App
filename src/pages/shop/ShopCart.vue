<script setup>
import { useRouter } from 'vue-router'
import { useShopStore } from '../../store/useShopStore'

const router = useRouter()
const { cart, cartTotal, cartCount, removeFromCart, updateQuantity } = useShopStore()

const goBack = () => router.push({ name: 'ShopCatalog' })
const goCheckout = () => router.push({ name: 'ShopCheckout' })
</script>

<template>
  <div class="shop-root">
    <!-- Header -->
    <header class="shop-header">
      <div class="shop-header-inner">
        <button class="back-btn" @click="goBack">← Continuer mes achats</button>
        <div class="shop-brand-name">Mon Panier</div>
      </div>
    </header>

    <main class="shop-main">
      <!-- Panier vide -->
      <div v-if="!cart.length" class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h2>Votre panier est vide</h2>
        <p>Découvrez nos produits et ajoutez-les à votre panier.</p>
        <button class="btn-primary" @click="goBack">Voir le catalogue</button>
      </div>

      <!-- Panier rempli -->
      <div v-else class="cart-layout">
        <!-- Articles -->
        <section class="cart-items">
          <h2 class="cart-section-title">Articles ({{ cartCount }})</h2>
          <ul class="cart-list">
            <li v-for="item in cart" :key="item.id" class="cart-item">
              <div class="cart-item-img">
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.name"
                  @error="($event.target.style.display='none')"
                />
                <span v-else>📦</span>
              </div>
              <div class="cart-item-info">
                <p class="cart-item-name">{{ item.name }}</p>
                <p class="cart-item-unit">{{ parseFloat(item.price).toFixed(2) }} € / unité</p>
              </div>
              <div class="cart-item-qty">
                <button class="qty-btn" @click="updateQuantity(item.id, item.quantity - 1)">−</button>
                <span class="qty-val">{{ item.quantity }}</span>
                <button class="qty-btn" @click="updateQuantity(item.id, item.quantity + 1)">+</button>
              </div>
              <div class="cart-item-subtotal">
                {{ (parseFloat(item.price) * item.quantity).toFixed(2) }} €
              </div>
              <button class="cart-remove" @click="removeFromCart(item.id)" title="Supprimer">✕</button>
            </li>
          </ul>
        </section>

        <!-- Récap -->
        <aside class="cart-summary">
          <h3 class="summary-title">Récapitulatif</h3>
          <div class="summary-row">
            <span>Sous-total</span>
            <span>{{ cartTotal.toFixed(2) }} €</span>
          </div>
          <div class="summary-row">
            <span>Livraison</span>
            <span class="free-badge">Gratuite</span>
          </div>
          <div class="summary-row">
            <span>Paiement</span>
            <span class="cod-badge">À la livraison</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-total-row">
            <span>Total</span>
            <span>{{ cartTotal.toFixed(2) }} €</span>
          </div>
          <button class="btn-checkout" @click="goCheckout">
            Commander → 
          </button>
          <p class="summary-note">🔒 Commande sécurisée · Aucun frais caché</p>
        </aside>
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
.back-btn:hover { border-color: rgba(167,139,250,0.5); color: #a78bfa; }
.shop-brand-name {
  font-size: 18px; font-weight: 700;
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.shop-main {
  max-width: 1280px; margin: 0 auto; padding: 40px 24px 80px;
}

/* Panier vide */
.cart-empty {
  text-align: center; padding: 80px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
}
.cart-empty-icon { font-size: 72px; opacity: 0.3; }
.cart-empty h2 { margin: 0; font-size: 24px; color: rgba(232,232,240,0.7); }
.cart-empty p { margin: 0; color: rgba(232,232,240,0.4); }
.btn-primary {
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border: none; color: white; padding: 14px 28px;
  border-radius: 14px; font-size: 15px; font-weight: 700;
  cursor: pointer; transition: opacity 0.2s, transform 0.15s;
}
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

/* Layout */
.cart-layout {
  display: grid; grid-template-columns: 1fr 360px; gap: 32px; align-items: start;
}
@media (max-width: 900px) { .cart-layout { grid-template-columns: 1fr; } }

/* Section */
.cart-section-title {
  font-size: 18px; font-weight: 700; margin: 0 0 20px;
  color: rgba(232,232,240,0.8);
}
.cart-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.cart-item {
  display: flex; align-items: center; gap: 16px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 16px;
}
.cart-item-img {
  width: 72px; height: 72px; border-radius: 12px;
  overflow: hidden; background: rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 32px;
}
.cart-item-img img { width: 100%; height: 100%; object-fit: cover; }
.cart-item-info { flex: 1; min-width: 0; }
.cart-item-name { font-size: 15px; font-weight: 600; margin: 0 0 4px; color: #f0f0f8; }
.cart-item-unit { font-size: 13px; color: rgba(232,232,240,0.45); margin: 0; }
.cart-item-qty {
  display: flex; align-items: center; gap: 0;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; overflow: hidden;
}
.qty-btn {
  background: rgba(255,255,255,0.06); border: none; color: #e8e8f0;
  width: 34px; height: 34px; font-size: 16px; cursor: pointer; transition: background 0.15s;
}
.qty-btn:hover { background: rgba(167,139,250,0.2); }
.qty-val { min-width: 36px; text-align: center; font-size: 15px; font-weight: 700; }
.cart-item-subtotal {
  font-size: 17px; font-weight: 800; color: #a78bfa; min-width: 80px; text-align: right;
}
.cart-remove {
  background: transparent; border: none; color: rgba(232,232,240,0.3);
  font-size: 16px; cursor: pointer; padding: 6px; border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}
.cart-remove:hover { color: #f87171; background: rgba(248,113,113,0.1); }

/* Summary */
.cart-summary {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; padding: 28px;
}
.summary-title { font-size: 18px; font-weight: 700; margin: 0 0 20px; }
.summary-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 14px; color: rgba(232,232,240,0.6); margin-bottom: 12px;
}
.free-badge {
  color: #34d399; font-weight: 600;
}
.cod-badge { color: #60a5fa; font-weight: 600; font-size: 13px; }
.summary-divider {
  border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 16px 0;
}
.summary-total-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 20px; font-weight: 800; color: #f0f0f8; margin-bottom: 24px;
}
.btn-checkout {
  width: 100%; background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border: none; color: white; padding: 16px; border-radius: 14px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  transition: opacity 0.2s, transform 0.15s; margin-bottom: 12px;
}
.btn-checkout:hover { opacity: 0.9; transform: translateY(-1px); }
.summary-note { font-size: 12px; color: rgba(232,232,240,0.35); text-align: center; margin: 0; }
</style>
