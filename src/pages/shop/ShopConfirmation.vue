<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '../../store/useShopStore'

const router = useRouter()
const { lastOrder } = useShopStore()

// Rediriger si pas de commande
onMounted(() => {
  if (!lastOrder.value) router.push({ name: 'ShopCatalog' })
})

const goHome = () => router.push({ name: 'ShopCatalog' })
</script>

<template>
  <div class="shop-root">
    <header class="shop-header">
      <div class="shop-header-inner">
        <div class="shop-brand-name">✓ Commande confirmée</div>
      </div>
    </header>

    <main class="shop-main" v-if="lastOrder">
      <div class="confirmation-card">
        <!-- Icône succès animée -->
        <div class="success-icon-wrap">
          <div class="success-ring"></div>
          <span class="success-icon">✓</span>
        </div>

        <h1 class="confirm-title">Merci pour votre commande !</h1>
        <p class="confirm-sub">Votre commande a bien été enregistrée et sera traitée dans les plus brefs délais.</p>

        <!-- Référence -->
        <div class="confirm-ref-block">
          <p class="confirm-ref-label">Référence de commande</p>
          <p class="confirm-ref-value">{{ lastOrder.reference }}</p>
        </div>

        <!-- Mode de paiement -->
        <div class="confirm-info-cards">
          <div class="confirm-info-card">
            <span class="info-icon">💵</span>
            <div>
              <p class="info-title">Paiement à la livraison</p>
              <p class="info-desc">Vous réglez en espèces à la réception</p>
            </div>
          </div>
          <div class="confirm-info-card">
            <span class="info-icon">🚚</span>
            <div>
              <p class="info-title">Livraison gratuite</p>
              <p class="info-desc">Click and collect · Frais offerts</p>
            </div>
          </div>
        </div>

        <!-- Résumé articles -->
        <div class="confirm-items">
          <h3 class="confirm-items-title">Articles commandés</h3>
          <ul>
            <li v-for="item in lastOrder.items" :key="item.id" class="confirm-item">
              <span>{{ item.name }}</span>
              <span class="confirm-item-qty">× {{ item.quantity }}</span>
              <span class="confirm-item-price">{{ (parseFloat(item.price) * item.quantity).toFixed(2) }} €</span>
            </li>
          </ul>
          <div class="confirm-total">
            <span>Total payé à la livraison</span>
            <span>{{ lastOrder.total.toFixed(2) }} €</span>
          </div>
        </div>

        <button class="btn-home" @click="goHome">Continuer mes achats →</button>
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
  backdrop-filter: blur(20px);
  background: rgba(15,15,26,0.85);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.shop-header-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 24px;
  height: 64px; display: flex; align-items: center; justify-content: center;
}
.shop-brand-name {
  font-size: 18px; font-weight: 700; color: #34d399;
}
.shop-main {
  max-width: 720px; margin: 0 auto; padding: 60px 24px 80px;
}

/* Card centrale */
.confirmation-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(52,211,153,0.2);
  border-radius: 24px; padding: 48px 40px; text-align: center;
}

/* Icône success */
.success-icon-wrap {
  position: relative; width: 80px; height: 80px;
  margin: 0 auto 28px; display: flex; align-items: center; justify-content: center;
}
.success-ring {
  position: absolute; inset: 0; border-radius: 50%;
  border: 3px solid #34d399;
  animation: pulse-ring 2s ease-out infinite;
}
@keyframes pulse-ring {
  0% { transform: scale(0.9); opacity: 1; }
  80%, 100% { transform: scale(1.3); opacity: 0; }
}
.success-icon {
  font-size: 36px; color: #34d399; font-weight: 800;
  animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes pop-in {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

.confirm-title {
  font-size: 28px; font-weight: 800; margin: 0 0 12px; color: #f0f0f8;
}
.confirm-sub {
  color: rgba(232,232,240,0.5); margin: 0 0 32px; font-size: 15px; line-height: 1.6;
}

/* Référence */
.confirm-ref-block {
  background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2);
  border-radius: 14px; padding: 16px 24px; margin-bottom: 24px;
}
.confirm-ref-label {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em;
  color: rgba(232,232,240,0.4); margin: 0 0 6px;
}
.confirm-ref-value {
  font-size: 22px; font-weight: 800; color: #34d399; margin: 0;
  font-family: 'IBM Plex Mono', monospace;
}

/* Info cards */
.confirm-info-cards {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;
}
@media (max-width: 600px) { .confirm-info-cards { grid-template-columns: 1fr; } }
.confirm-info-card {
  display: flex; gap: 12px; align-items: flex-start;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 16px; text-align: left;
}
.info-icon { font-size: 24px; flex-shrink: 0; }
.info-title { font-size: 14px; font-weight: 700; margin: 0 0 4px; color: #f0f0f8; }
.info-desc { font-size: 12px; color: rgba(232,232,240,0.45); margin: 0; }

/* Items */
.confirm-items {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 20px 24px; margin-bottom: 32px; text-align: left;
}
.confirm-items-title {
  font-size: 15px; font-weight: 700; color: rgba(232,232,240,0.6);
  margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px;
}
.confirm-items ul { list-style: none; padding: 0; margin: 0 0 16px; }
.confirm-item {
  display: flex; gap: 8px; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px;
}
.confirm-item span:first-child { flex: 1; color: rgba(232,232,240,0.75); }
.confirm-item-qty { color: rgba(232,232,240,0.4); }
.confirm-item-price { font-weight: 700; color: #a78bfa; min-width: 72px; text-align: right; }
.confirm-total {
  display: flex; justify-content: space-between;
  font-size: 18px; font-weight: 800; color: #f0f0f8; padding-top: 12px;
}

/* CTA */
.btn-home {
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border: none; color: white; padding: 16px 40px;
  border-radius: 14px; font-size: 16px; font-weight: 700;
  cursor: pointer; transition: opacity 0.2s, transform 0.15s;
}
.btn-home:hover { opacity: 0.9; transform: translateY(-1px); }
</style>
