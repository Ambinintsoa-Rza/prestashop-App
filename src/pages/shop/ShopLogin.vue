<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchResource, pickText } from '../../services/prestashopApi'
import { useShopStore } from '../../store/useShopStore'

const router = useRouter()
const { setCustomer } = useShopStore()

const customers = ref([])
const loading = ref(false)
const error = ref('')

const baseUrl = import.meta.env.VITE_PS_BASE_URL || '/ps-api'
const apiKey = import.meta.env.VITE_PS_WS_KEY || ''

const loadCustomers = async () => {
  loading.value = true
  error.value = ''
  try {
    const { json } = await fetchResource(
      'customers',
      { display: '[id,firstname,lastname,email,active]' },
      { baseUrl, apiKey }
    )
    const raw = json?.prestashop?.customers?.customer
    if (!raw) { customers.value = []; return }
    const list = Array.isArray(raw) ? raw : [raw]
    customers.value = list
      .filter(c => pickText(c.active) === '1')
      .map(c => ({
        id: pickText(c.id),
        firstname: pickText(c.firstname),
        lastname: pickText(c.lastname),
        email: pickText(c.email),
      }))
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const selectCustomer = (customer) => {
  setCustomer({ ...customer, isAnonymous: false })
  router.push({ name: 'ShopCatalog' })
}

const selectAnonymous = () => {
  setCustomer({ isAnonymous: true, id: null, firstname: 'Invité', lastname: '', email: '' })
  router.push({ name: 'ShopCatalog' })
}

const initials = (c) =>
  `${(c.firstname?.[0] || '').toUpperCase()}${(c.lastname?.[0] || '').toUpperCase()}`

onMounted(loadCustomers)
</script>

<template>
  <div class="sl-root">
    <!-- Header -->
    <header class="sl-header">
      <div class="sl-header-inner">
        <span class="sl-logo">🛍️</span>
        <span class="sl-brand">Ma Boutique</span>
      </div>
    </header>

    <main class="sl-main">
      <div class="sl-hero">
        <h1 class="sl-title">Qui êtes-vous ?</h1>
        <p class="sl-subtitle">Choisissez un compte existant ou continuez en tant qu'invité</p>
      </div>

      <!-- Chargement -->
      <div v-if="loading" class="sl-loading">
        <span class="sl-spinner"></span>
        <p>Chargement des comptes…</p>
      </div>

      <!-- Erreur -->
      <div v-else-if="error" class="sl-error">⚠️ {{ error }}</div>

      <!-- Grille -->
      <div v-else class="sl-grid">

        <!-- Option anonyme — en premier -->
        <button class="customer-card anon-card" @click="selectAnonymous">
          <div class="ccard-avatar anon-avatar">👤</div>
          <div class="ccard-info">
            <p class="ccard-name">Utilisateur anonyme</p>
            <p class="ccard-email">Saisir mes informations à la commande</p>
          </div>
          <span class="ccard-arrow">→</span>
        </button>

        <!-- Séparateur -->
        <div v-if="customers.length" class="sl-divider">
          <span>ou choisir un compte existant</span>
        </div>

        <!-- Clients existants -->
        <button
          v-for="c in customers"
          :key="c.id"
          class="customer-card"
          @click="selectCustomer(c)"
        >
          <div class="ccard-avatar">{{ initials(c) }}</div>
          <div class="ccard-info">
            <p class="ccard-name">{{ c.firstname }} {{ c.lastname }}</p>
            <p class="ccard-email">{{ c.email }}</p>
          </div>
          <span class="ccard-arrow">→</span>
        </button>

        <!-- Aucun client -->
        <p v-if="!customers.length && !loading" class="sl-no-customers">
          Aucun client enregistré — vous pouvez continuer en tant qu'invité.
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.sl-root {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  color: #e8e8f0;
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

/* Header */
.sl-header {
  backdrop-filter: blur(20px);
  background: rgba(15, 15, 26, 0.85);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sl-header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.sl-logo { font-size: 24px; }
.sl-brand {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Main */
.sl-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 80px;
}

/* Hero */
.sl-hero {
  text-align: center;
  margin-bottom: 48px;
}
.sl-title {
  font-size: clamp(28px, 5vw, 42px);
  font-weight: 800;
  margin: 0 0 12px;
  background: linear-gradient(135deg, #ffffff 0%, #a78bfa 60%, #60a5fa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sl-subtitle {
  color: rgba(232, 232, 240, 0.5);
  font-size: 16px;
  margin: 0;
}

/* Loading */
.sl-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: rgba(232,232,240,0.5);
}
.sl-spinner {
  width: 32px; height: 32px;
  border: 3px solid rgba(167,139,250,0.2);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sl-error {
  color: #f87171;
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: 14px;
  padding: 14px 18px;
  font-size: 14px;
}

/* Grid */
.sl-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Customer card */
.customer-card {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 18px;
  padding: 18px 20px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font-family: inherit;
  transition: transform 0.18s, border-color 0.18s, background 0.18s, box-shadow 0.18s;
}
.customer-card:hover {
  transform: translateY(-3px);
  border-color: rgba(167,139,250,0.5);
  background: rgba(167,139,250,0.07);
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
}

/* Avatar */
.ccard-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}
.anon-avatar {
  background: rgba(255,255,255,0.08);
  font-size: 22px;
}

.ccard-info {
  flex: 1;
  min-width: 0;
}
.ccard-name {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 3px;
  color: #f0f0f8;
}
.ccard-email {
  font-size: 13px;
  color: rgba(232,232,240,0.45);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ccard-arrow {
  font-size: 18px;
  color: rgba(232,232,240,0.25);
  transition: color 0.2s, transform 0.2s;
  flex-shrink: 0;
}
.customer-card:hover .ccard-arrow {
  color: #a78bfa;
  transform: translateX(4px);
}

/* Carte anonyme — mise en avant */
.anon-card {
  border-color: rgba(52,211,153,0.25);
  background: rgba(52,211,153,0.05);
}
.anon-card:hover {
  border-color: rgba(52,211,153,0.55);
  background: rgba(52,211,153,0.1);
  box-shadow: 0 12px 32px rgba(52,211,153,0.1);
}
.anon-card .ccard-name { color: #34d399; }

/* Séparateur */
.sl-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
  color: rgba(232,232,240,0.25);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.sl-divider::before,
.sl-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.08);
}

.sl-no-customers {
  text-align: center;
  color: rgba(232,232,240,0.35);
  font-size: 14px;
  padding: 16px 0;
  margin: 0;
}
</style>
