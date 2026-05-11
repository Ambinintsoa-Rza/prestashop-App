<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

defineEmits(['edit'])
</script>

<template>
  <div class="list">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="status">Chargement en cours...</p>
    <p v-else-if="!items.length" class="empty">Aucun produit a afficher.</p>

    <ul v-else class="grid">
      <li v-for="item in items" :key="item.id" class="card">
        <div class="card-head">
          <span class="tag">#{{ item.id }}</span>
          <span class="status" :class="item.active ? 'on' : 'off'">
            {{ item.active ? 'Actif' : 'Inactif' }}
          </span>
        </div>
        <h3>{{ item.name || 'Sans nom' }}</h3>
        <p class="price">{{ item.price || '-' }} €</p>
        <div class="card-actions">
          <button class="ghost small" type="button" @click="$emit('edit', item.id)">
            Modifier
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
