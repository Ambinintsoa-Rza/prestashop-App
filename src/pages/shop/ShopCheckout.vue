<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '../../store/useShopStore'
import {
  sendXmlResource,
  buildCustomerXml,
  buildAddressXml,
  buildCartXml,
  buildOrderXml,
  extractCreatedId,
  extractOrderReference,
} from '../../services/prestashopApi'

const router = useRouter()
const { cart, cartTotal, clearCart, setLastOrder } = useShopStore()

const baseUrl = import.meta.env.VITE_PS_BASE_URL || '/ps-api'
const apiKey = import.meta.env.VITE_PS_WS_KEY || ''
const config = { baseUrl, apiKey }

const step = ref(1) // 1 = infos client, 2 = adresse
const submitting = ref(false)
const error = ref('')

const form = ref({
  firstname: '',
  lastname: '',
  email: '',
  password: 'Pwd@' + Math.random().toString(36).slice(2, 8), // auto
  address1: '',
  postcode: '',
  city: '',
  phone: '',
  countryId: '8', // France
})

const goBack = () => router.push({ name: 'ShopCart' })

const placeOrder = async () => {
  if (!cart.value.length) return
  error.value = ''
  submitting.value = true

  try {
    // 1. Créer le client
    const custXml = buildCustomerXml(form.value)
    const custRes = await sendXmlResource('customers', custXml, 'POST', config)
    const customerId = extractCreatedId(custRes.json)
    if (!customerId) throw new Error('Impossible de créer le client.')

    // 2. Créer l'adresse
    const addrXml = buildAddressXml({ ...form.value, customerId })
    const addrRes = await sendXmlResource('addresses', addrXml, 'POST', config)
    const addressId = extractCreatedId(addrRes.json)
    if (!addressId) throw new Error('Impossible de créer l\'adresse.')

    // 3. Créer le panier
    const cartXml = buildCartXml({
      customerId,
      addressId,
      items: cart.value.map((i) => ({ id: i.id, quantity: i.quantity })),
    })
    const cartRes = await sendXmlResource('carts', cartXml, 'POST', config)
    const cartId = extractCreatedId(cartRes.json)
    if (!cartId) throw new Error('Impossible de créer le panier.')

    // 4. Créer la commande
    const orderXml = buildOrderXml({
      customerId,
      addressId,
      cartId,
      total: cartTotal.value,
    })
    const orderRes = await sendXmlResource('orders', orderXml, 'POST', config)
    const orderInfo = extractOrderReference(orderRes.json)

    setLastOrder({
      id: orderInfo?.id || cartId,
      reference: orderInfo?.reference || `CMD-${cartId}`,
      total: cartTotal.value,
      items: [...cart.value],
    })

    clearCart()
    router.push({ name: 'ShopConfirmation' })
  } catch (err) {
    error.value = err.message || 'Une erreur est survenue.'
  } finally {
    submitting.value = false
  }
}

const nextStep = () => {
  if (!form.value.firstname || !form.value.lastname || !form.value.email) {
    error.value = 'Veuillez remplir tous les champs obligatoires.'
    return
  }
  error.value = ''
  step.value = 2
}
const prevStep = () => { step.value = 1 }
</script>

<template>
  <div class="shop-root">
    <!-- Header -->
    <header class="shop-header">
      <div class="shop-header-inner">
        <button class="back-btn" @click="goBack">← Panier</button>
        <div class="shop-brand-name">Finaliser la commande</div>
      </div>
    </header>

    <main class="shop-main">
      <!-- Stepper -->
      <div class="stepper">
        <div class="step" :class="{ active: step === 1, done: step > 1 }">
          <span class="step-num">1</span>
          <span class="step-label">Vos informations</span>
        </div>
        <div class="step-line" :class="{ done: step > 1 }"></div>
        <div class="step" :class="{ active: step === 2 }">
          <span class="step-num">2</span>
          <span class="step-label">Adresse de livraison</span>
        </div>
      </div>

      <div class="checkout-layout">
        <!-- Formulaire -->
        <section class="checkout-form-section">

          <!-- Erreur -->
          <p v-if="error" class="checkout-error">⚠️ {{ error }}</p>

          <!-- Étape 1 : Infos client -->
          <div v-if="step === 1">
            <h2 class="form-title">Vos informations</h2>
            <div class="form-grid">
              <div class="field-group">
                <label>Prénom *</label>
                <input v-model="form.firstname" type="text" placeholder="Jean" />
              </div>
              <div class="field-group">
                <label>Nom *</label>
                <input v-model="form.lastname" type="text" placeholder="Dupont" />
              </div>
              <div class="field-group full">
                <label>Email *</label>
                <input v-model="form.email" type="email" placeholder="jean.dupont@email.com" />
              </div>
              <div class="field-group full">
                <label>Téléphone</label>
                <input v-model="form.phone" type="tel" placeholder="06 00 00 00 00" />
              </div>
            </div>
            <button class="btn-next" @click="nextStep">Continuer →</button>
          </div>

          <!-- Étape 2 : Adresse -->
          <div v-if="step === 2">
            <h2 class="form-title">Adresse de livraison</h2>
            <div class="form-grid">
              <div class="field-group full">
                <label>Adresse *</label>
                <input v-model="form.address1" type="text" placeholder="12 rue de la Paix" />
              </div>
              <div class="field-group">
                <label>Code postal *</label>
                <input v-model="form.postcode" type="text" placeholder="75001" />
              </div>
              <div class="field-group">
                <label>Ville *</label>
                <input v-model="form.city" type="text" placeholder="Paris" />
              </div>
              <div class="field-group full">
                <label>Pays</label>
                <select v-model="form.countryId">
                  <option value="8">France</option>
                  <option value="21">Belgique</option>
                  <option value="21">Suisse</option>
                  <option value="110">Madagascar</option>
                </select>
              </div>
            </div>

            <!-- Paiement info -->
            <div class="payment-info">
              <div class="payment-icon">💵</div>
              <div>
                <p class="payment-title">Paiement à la livraison</p>
                <p class="payment-desc">Vous réglez en espèces à la réception de votre commande. Livraison gratuite.</p>
              </div>
            </div>

            <div class="form-actions">
              <button class="btn-back-step" @click="prevStep">← Retour</button>
              <button
                class="btn-order"
                :disabled="submitting || !form.address1 || !form.postcode || !form.city"
                @click="placeOrder"
              >
                <span v-if="submitting">⏳ Envoi en cours…</span>
                <span v-else>✓ Confirmer la commande</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Résumé commande -->
        <aside class="checkout-summary">
          <h3 class="summary-title">Votre commande</h3>
          <ul class="summary-items">
            <li v-for="item in cart" :key="item.id" class="summary-item">
              <span class="summary-item-name">{{ item.name }}</span>
              <span class="summary-item-qty">× {{ item.quantity }}</span>
              <span class="summary-item-price">{{ (parseFloat(item.price) * item.quantity).toFixed(2) }} €</span>
            </li>
          </ul>
          <div class="summary-divider"></div>
          <div class="summary-row">
            <span>Livraison</span><span class="free-badge">Gratuite</span>
          </div>
          <div class="summary-row">
            <span>Paiement</span><span class="cod-badge">À la livraison</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-total">
            <span>Total</span>
            <span>{{ cartTotal.toFixed(2) }} €</span>
          </div>
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

/* Stepper */
.stepper {
  display: flex; align-items: center; justify-content: center;
  gap: 0; margin-bottom: 40px;
}
.step {
  display: flex; align-items: center; gap: 10px;
  color: rgba(232,232,240,0.3); font-size: 14px; font-weight: 600;
}
.step.active { color: #a78bfa; }
.step.done { color: #34d399; }
.step-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
}
.step.active .step-num { background: rgba(167,139,250,0.2); border-color: #a78bfa; color: #a78bfa; }
.step.done .step-num { background: rgba(52,211,153,0.15); border-color: #34d399; color: #34d399; }
.step-line {
  width: 60px; height: 1px; background: rgba(255,255,255,0.1); margin: 0 12px;
}
.step-line.done { background: #34d399; }

/* Layout */
.checkout-layout {
  display: grid; grid-template-columns: 1fr 360px; gap: 32px; align-items: start;
}
@media (max-width: 900px) { .checkout-layout { grid-template-columns: 1fr; } }

/* Form */
.checkout-form-section {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; padding: 32px;
}
.form-title {
  font-size: 20px; font-weight: 700; margin: 0 0 24px; color: #f0f0f8;
}
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;
}
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-group.full { grid-column: 1 / -1; }
.field-group label {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(232,232,240,0.45);
}
.field-group input, .field-group select {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; padding: 12px 14px; color: #e8e8f0; font-size: 15px;
  font-family: inherit; outline: none; transition: border-color 0.2s;
  width: 100%;
}
.field-group input:focus, .field-group select:focus {
  border-color: #a78bfa;
}
.field-group select { appearance: none; cursor: pointer; }
.field-group input::placeholder { color: rgba(232,232,240,0.25); }

.btn-next, .btn-order {
  width: 100%; background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border: none; color: white; padding: 16px; border-radius: 14px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}
.btn-next:hover, .btn-order:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-order:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.form-actions { display: flex; gap: 12px; }
.btn-back-step {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
  color: rgba(232,232,240,0.7); border-radius: 14px; padding: 16px 24px;
  font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-back-step:hover { border-color: rgba(167,139,250,0.4); color: #a78bfa; }
.btn-order { flex: 1; }

/* Payment info */
.payment-info {
  display: flex; gap: 16px; align-items: flex-start;
  background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2);
  border-radius: 14px; padding: 16px; margin-bottom: 24px;
}
.payment-icon { font-size: 28px; flex-shrink: 0; }
.payment-title { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: #60a5fa; }
.payment-desc { font-size: 13px; color: rgba(232,232,240,0.5); margin: 0; }

.checkout-error {
  color: #f87171; background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.25); border-radius: 12px;
  padding: 12px 16px; margin-bottom: 20px; font-size: 14px;
}

/* Summary */
.checkout-summary {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; padding: 28px; position: sticky; top: 80px;
}
.summary-title { font-size: 18px; font-weight: 700; margin: 0 0 20px; }
.summary-items { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 10px; }
.summary-item {
  display: flex; align-items: center; gap: 8px; font-size: 14px;
}
.summary-item-name { flex: 1; color: rgba(232,232,240,0.7); }
.summary-item-qty { color: rgba(232,232,240,0.4); font-size: 13px; }
.summary-item-price { font-weight: 700; color: #a78bfa; min-width: 64px; text-align: right; }
.summary-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 12px 0; }
.summary-row {
  display: flex; justify-content: space-between; font-size: 14px;
  color: rgba(232,232,240,0.55); margin-bottom: 10px;
}
.free-badge { color: #34d399; font-weight: 600; }
.cod-badge { color: #60a5fa; font-weight: 600; font-size: 13px; }
.summary-total {
  display: flex; justify-content: space-between;
  font-size: 20px; font-weight: 800; color: #f0f0f8;
}
</style>
