<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchResource, pickText } from '../../services/prestashopApi'
import { useShopStore } from '../../store/useShopStore'

const router = useRouter()
const { currentCustomer } = useShopStore()

const orders  = ref([])
const loading = ref(false)
const error   = ref('')

const baseUrl = import.meta.env.VITE_PS_BASE_URL || '/ps-api'
const apiKey  = import.meta.env.VITE_PS_WS_KEY  || ''

// ── Mapping des états ──────────────────────────────────────
const STATE_MAP = {
  '1':  { label: 'En attente de paiement', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⏳' },
  '2':  { label: 'Paiement effectué',      color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: '✅' },
  '3':  { label: 'En préparation',         color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: '📦' },
  '4':  { label: 'Expédié',                color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🚚' },
  '5':  { label: 'Livré',                  color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: '🎉' },
  '6':  { label: 'Annulé',                 color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '❌' },
  '7':  { label: 'Remboursé',              color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '↩️' },
}

const getState = (stateId) =>
  STATE_MAP[String(stateId)] || { label: `État #${stateId}`, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '❓' }

// ── Chargement des commandes du client ────────────────────
const loadOrders = async () => {
  if (!currentCustomer.value?.id) return
  loading.value = true
  error.value   = ''
  try {
    const { json } = await fetchResource(
      'orders',
      {
        display: '[id,reference,current_state,total_paid,date_add,id_customer]',
        'filter[id_customer]': `[${currentCustomer.value.id}]`,
      },
      { baseUrl, apiKey }
    )
    const raw = json?.prestashop?.orders?.order
    if (!raw) { orders.value = []; return }
    const list = Array.isArray(raw) ? raw : [raw]
    orders.value = list
      .map(o => ({
        id:         pickText(o.id),
        reference:  pickText(o.reference),
        stateId:    pickText(o.current_state),
        totalPaid:  pickText(o.total_paid),
        dateAdd:    pickText(o.date_add),
      }))
      // Trier du plus récent au plus ancien côté client
      .sort((a, b) => new Date(b.dateAdd) - new Date(a.dateAdd))
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const formatDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const goBack = () => router.push({ name: 'ShopCatalog' })

onMounted(loadOrders)
</script>

<template>
  <div class="so-root">
    <!-- Header -->
    <header class="so-header">
      <div class="so-header-inner">
        <button class="so-back-btn" @click="goBack">← Catalogue</button>
        <div class="so-brand">
          <span>📋</span>
          <span class="so-brand-text">Mes commandes</span>
        </div>
        <!-- Identité client -->
        <div v-if="currentCustomer && !currentCustomer.isAnonymous" class="so-user">
          <div class="so-avatar">
            {{ (currentCustomer.firstname?.[0] || '').toUpperCase() }}{{ (currentCustomer.lastname?.[0] || '').toUpperCase() }}
          </div>
          <span class="so-user-name">{{ currentCustomer.firstname }} {{ currentCustomer.lastname }}</span>
        </div>
      </div>
    </header>

    <main class="so-main">
      <div class="so-hero">
        <h1 class="so-title">Mes commandes</h1>
        <p class="so-sub">Suivez l'état de vos commandes en temps réel</p>
      </div>

      <!-- Chargement -->
      <div v-if="loading" class="so-loading">
        <span class="so-spinner"></span>
        <p>Chargement de vos commandes…</p>
      </div>

      <!-- Erreur -->
      <div v-else-if="error" class="so-error">⚠️ {{ error }}</div>

      <!-- Aucune commande -->
      <div v-else-if="!orders.length" class="so-empty">
        <div class="so-empty-icon">📭</div>
        <h2>Aucune commande</h2>
        <p>Vous n'avez pas encore passé de commande.</p>
        <button class="so-shop-btn" @click="goBack">Voir le catalogue</button>
      </div>

      <!-- Liste des commandes -->
      <div v-else class="so-orders">
        <div
          v-for="order in orders"
          :key="order.id"
          class="so-order-card"
        >
          <!-- En-tête de la carte -->
          <div class="so-order-header">
            <div class="so-order-ref">
              <span class="so-order-ref-label">Commande</span>
              <span class="so-order-ref-value">#{{ order.reference || order.id }}</span>
            </div>
            <span
              class="so-order-state"
              :style="{ color: getState(order.stateId).color, background: getState(order.stateId).bg }"
            >
              {{ getState(order.stateId).icon }} {{ getState(order.stateId).label }}
            </span>
          </div>

          <!-- Détails -->
          <div class="so-order-body">
            <div class="so-order-detail">
              <span class="so-detail-label">Date</span>
              <span class="so-detail-value">{{ formatDate(order.dateAdd) }}</span>
            </div>
            <div class="so-order-detail">
              <span class="so-detail-label">Montant total</span>
              <span class="so-detail-value so-amount">{{ parseFloat(order.totalPaid || 0).toFixed(2) }} €</span>
            </div>
            <div class="so-order-detail">
              <span class="so-detail-label">Paiement</span>
              <span class="so-detail-value">À la livraison</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.so-root {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  color: #e8e8f0;
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

/* Header */
.so-header {
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(20px);
  background: rgba(15,15,26,0.85);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.so-header-inner {
  max-width: 900px; margin: 0 auto; padding: 0 24px;
  height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.so-back-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.15);
  color: rgba(232,232,240,0.7); border-radius: 10px;
  padding: 8px 14px; cursor: pointer; font-size: 13px; transition: all 0.2s; flex-shrink: 0;
}
.so-back-btn:hover { border-color: rgba(167,139,250,0.5); color: #a78bfa; }
.so-brand {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 700;
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.so-user {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.so-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: white;
}
.so-user-name { font-size: 13px; color: rgba(232,232,240,0.6); }

/* Main */
.so-main { max-width: 900px; margin: 0 auto; padding: 48px 24px 80px; }

.so-hero { text-align: center; margin-bottom: 40px; }
.so-title {
  font-size: clamp(24px, 4vw, 36px); font-weight: 800; margin: 0 0 8px;
  background: linear-gradient(135deg, #ffffff, #a78bfa);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.so-sub { color: rgba(232,232,240,0.45); font-size: 15px; margin: 0; }

/* Loading */
.so-loading {
  display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 0;
  color: rgba(232,232,240,0.5);
}
.so-spinner {
  width: 32px; height: 32px; border: 3px solid rgba(167,139,250,0.2);
  border-top-color: #a78bfa; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.so-error {
  text-align: center; color: #f87171;
  background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25);
  border-radius: 14px; padding: 16px;
}

/* Empty */
.so-empty {
  text-align: center; padding: 64px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.so-empty-icon { font-size: 64px; opacity: 0.35; }
.so-empty h2 { font-size: 20px; margin: 0; color: rgba(232,232,240,0.7); }
.so-empty p { font-size: 14px; color: rgba(232,232,240,0.4); margin: 0; }
.so-shop-btn {
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border: none; color: white; padding: 12px 28px; border-radius: 12px;
  font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 4px; transition: opacity 0.2s;
}
.so-shop-btn:hover { opacity: 0.9; }

/* Orders */
.so-orders { display: flex; flex-direction: column; gap: 14px; }

.so-order-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 18px; overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.so-order-card:hover {
  border-color: rgba(167,139,250,0.3);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
}

.so-order-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-wrap: wrap; gap: 10px;
}
.so-order-ref-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(232,232,240,0.35); display: block; margin-bottom: 2px; }
.so-order-ref-value { font-size: 16px; font-weight: 800; color: #f0f0f8; }

.so-order-state {
  padding: 5px 14px; border-radius: 99px;
  font-size: 13px; font-weight: 700;
  white-space: nowrap;
}

.so-order-body {
  padding: 14px 22px 18px;
  display: flex; gap: 32px; flex-wrap: wrap;
}
.so-order-detail { display: flex; flex-direction: column; gap: 3px; }
.so-detail-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(232,232,240,0.35); }
.so-detail-value { font-size: 14px; font-weight: 600; color: rgba(232,232,240,0.8); }
.so-amount { color: #a78bfa; font-size: 16px; font-weight: 800; }
</style>
