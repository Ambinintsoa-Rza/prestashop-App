<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import DataImport from "../components/DataImport.vue";
import ProductCreate from "../components/ProductCreate.vue";
import ProductList from "../components/ProductList.vue";
import { fetchResource, normalizeProducts } from "../services/prestashopApi";

const router = useRouter();

const baseUrl = ref(import.meta.env.VITE_PS_BASE_URL || "http://localhost/prestashop/api");
const apiKey = ref(import.meta.env.VITE_PS_WS_KEY || "");

const loading = ref(false);
const error = ref("");
const rawXml = ref("");
const products = ref([]);
const editingId = ref(null);
const viewMode = ref("list");

const xmlPreview = computed(() => {
  if (!rawXml.value) return "";
  const maxChars = 2000;
  return rawXml.value.length > maxChars
    ? `${rawXml.value.slice(0, maxChars)}...`
    : rawXml.value;
});

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

const startCreate = () => {
  editingId.value = null;
  viewMode.value = "create";
};

const stopEdit = () => {
  editingId.value = null;
  viewMode.value = "list";
};

const handleSaved = async () => {
  await loadProducts();
  stopEdit();
};

const goLogin = () => {
  router.push("/");
};

const isEditing = computed(() => viewMode.value !== "list");
const isCreating = computed(() => viewMode.value === "create");

onMounted(() => {
  loadProducts();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">PrestaShop Webservice</p>
        <h1>prestashop-App</h1>
        <p class="lead">Liste de produits via API XML, conversion en JSON pour Vue.js.</p>
        <div class="meta">
          <span>Format: XML -> JSON</span>
          <span>Endpoint: /api/products</span>
        </div>
      </div>

      <div class="panel">
        <h2>Etat</h2>
        <div class="row">
          <button :disabled="loading" @click="loadProducts">
            {{ loading ? "Chargement..." : "Rafraichir la liste" }}
          </button>
          <button class="ghost" type="button" @click="startCreate">Nouveau produit</button>
          <button class="ghost" type="button" @click="goLogin">Login BO</button>
        </div>
        <p class="hint">Lecture automatique au chargement de la page.</p>
      </div>
    </header>

    <main class="content">
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

      <section class="panel wide">
        <DataImport :base-url="baseUrl" :api-key="apiKey" />
      </section>

      <section class="panel">
        <h2>XML brut (extrait)</h2>
        <pre v-if="xmlPreview" class="code">{{ xmlPreview }}</pre>
        <p v-else class="empty">Aucun XML charge.</p>
      </section>
    </main>
  </div>
</template>
