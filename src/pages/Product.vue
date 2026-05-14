<script setup>
import {computed, onMounted ,ref} from 'vue';
import { fetchResource ,normalizeProducts } from '../services/prestashopApi';
import ProductList from "../components/ProductList.vue";
import ProductCreate from "../components/ProductCreate.vue";


const products = ref([]);

const loading = ref(false);
const error = ref("");
const rawXml = ref("");

const editingId = ref(null);
const viewMode = ref("list");

const isEditing = computed(() => viewMode.value !== "list");
const isCreating = computed(() => viewMode.value === "create");

const baseUrl = ref(import.meta.env.VITE_PS_BASE_URL || "http://localhost/prestashop/api");
const apiKey = ref(import.meta.env.VITE_PS_WS_KEY || "");

const loadProducts = async () => {
  error.value = "";
  loading.value = true;

  try {
    const { xml, json } = await fetchResource(
      "products",
      { display: "[id,name,price,active]" },
      {
        baseUrl: baseUrl.value,
        apiKey: apiKey.value,
      }
    );

    rawXml.value = xml;
    products.value = normalizeProducts(json);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Erreur inconnue.";
  } finally {
    loading.value = false;
  }
};

const startEdit = (id) => {
  editingId.value = id;
  viewMode.value = "edit";
};

const stopEdit = () => {
  editingId.value = null;
  viewMode.value = "list";
};

const handleSaved = async () => {
  await loadProducts();
  stopEdit();
};

onMounted(() => {
  loadProducts();
});
</script>

<template>
    <h2>liste des produits</h2>
          <section v-if="!isEditing" class="panel">
        <h2>Produits</h2>
        <ProductList :items="products" :loading="loading" :error="error" @edit="startEdit" />
      </section>

      <section v-else class="panel">
        <ProductCreate
          :product-id="editingId"
          :mode="isCreating ? 'create' : 'edit'"
          @close="stopEdit"
          @saved="handleSaved"
        />
      </section>

</template>