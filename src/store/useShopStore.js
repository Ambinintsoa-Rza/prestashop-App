import { ref, computed } from 'vue'

// ── Persistance localStorage ───────────────────────────────
const STORAGE_KEY = 'shop_carts'

const loadCarts = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

const saveCarts = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  catch { /* quota ignoré */ }
}

const cartKey = (customer) =>
  !customer || customer.isAnonymous ? 'anonymous' : `user_${customer.id}`

// ── Singleton state ────────────────────────────────────────
const carts = ref(loadCarts())         // { "anonymous": [...], "user_6": [...] }
const lastOrder = ref(null)
const currentCustomer = ref(null)

// ── Composable ─────────────────────────────────────────────
export function useShopStore() {

  // Panier actif = panier de l'utilisateur courant
  const activeKey = computed(() => cartKey(currentCustomer.value))

  const cart = computed({
    get: () => carts.value[activeKey.value] || [],
    set: (val) => {
      carts.value = { ...carts.value, [activeKey.value]: val }
      saveCarts(carts.value)
    },
  })

  const cartCount = computed(() =>
    cart.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const cartTotal = computed(() =>
    cart.value.reduce((sum, item) => sum + parseFloat(item.price || 0) * item.quantity, 0)
  )

  const addToCart = (product, qty = 1) => {
    const key = activeKey.value
    const current = JSON.parse(JSON.stringify(carts.value[key] || []))
    const existing = current.find((i) => i.id === product.id)
    if (existing) existing.quantity += qty
    else current.push({ ...product, quantity: qty })
    carts.value = { ...carts.value, [key]: current }
    saveCarts(carts.value)
  }

  const removeFromCart = (productId) => {
    const key = activeKey.value
    const current = (carts.value[key] || []).filter((i) => i.id !== productId)
    carts.value = { ...carts.value, [key]: current }
    saveCarts(carts.value)
  }

  const updateQuantity = (productId, quantity) => {
    const key = activeKey.value
    let current = JSON.parse(JSON.stringify(carts.value[key] || []))
    if (quantity <= 0) {
      current = current.filter((i) => i.id !== productId)
    } else {
      const item = current.find((i) => i.id === productId)
      if (item) item.quantity = quantity
    }
    carts.value = { ...carts.value, [key]: current }
    saveCarts(carts.value)
  }

  const clearCart = () => {
    const key = activeKey.value
    carts.value = { ...carts.value, [key]: [] }
    saveCarts(carts.value)
  }

  // Changer d'utilisateur — chaque user garde son propre panier
  const setCustomer = (customer) => {
    currentCustomer.value = customer
    // Le panier bascule automatiquement via activeKey (computed)
  }

  const setLastOrder = (order) => {
    lastOrder.value = order
  }

  return {
    cart,
    cartCount,
    cartTotal,
    lastOrder,
    currentCustomer,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setLastOrder,
    setCustomer,
  }
}
