import { ref, computed } from 'vue'

// Singleton state — partagé entre toutes les pages
const cart = ref([]) // [{ id, name, price, quantity, imageUrl }]
const lastOrder = ref(null) // { reference, id, total }

export function useShopStore() {
  const cartCount = computed(() =>
    cart.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const cartTotal = computed(() =>
    cart.value.reduce((sum, item) => sum + parseFloat(item.price || 0) * item.quantity, 0)
  )

  const addToCart = (product, qty = 1) => {
    const existing = cart.value.find((i) => i.id === product.id)
    if (existing) {
      existing.quantity += qty
    } else {
      cart.value.push({ ...product, quantity: qty })
    }
  }

  const removeFromCart = (productId) => {
    cart.value = cart.value.filter((i) => i.id !== productId)
  }

  const updateQuantity = (productId, quantity) => {
    const item = cart.value.find((i) => i.id === productId)
    if (!item) return
    if (quantity <= 0) removeFromCart(productId)
    else item.quantity = quantity
  }

  const clearCart = () => {
    cart.value = []
  }

  const setLastOrder = (order) => {
    lastOrder.value = order
  }

  return {
    cart,
    cartCount,
    cartTotal,
    lastOrder,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setLastOrder,
  }
}
