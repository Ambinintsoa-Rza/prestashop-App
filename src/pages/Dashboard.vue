<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import DataImport from "../components/DataImport.vue";
import OrderList from "../components/OrderList.vue";
import ProductCreate from "../components/ProductCreate.vue";
import ProductList from "../components/ProductList.vue";
import {
  fetchResource,
  normalizeOrders,
  normalizeOrderStates,
  normalizeProducts,
  sendXmlResource,
} from "../services/prestashopApi";
import { fetchSchema } from "../utils/psIntrospect";
import { buildXmlFromSchema } from "../utils/xmlBuilder";

const router = useRouter();

const baseUrl = ref(import.meta.env.VITE_PS_BASE_URL || "http://localhost/prestashop/api");
const apiKey = ref(import.meta.env.VITE_PS_WS_KEY || "");

const loading = ref(false);
const error = ref("");
const rawXml = ref("");
const products = ref([]);
const editingId = ref(null);
const viewMode = ref("list");

const ordersLoading = ref(false);
const ordersError = ref("");
const orders = ref([]);
const orderStates = ref({});
const orderStateOptions = ref([]);
const updatingOrderId = ref(null);

const allowedOrderStates = [
  {
    key: "payment_failed",
    label: "Echec paiement",
    aliases: [
      "echec paiement",
      "echec de paiement",
      "erreur paiement",
      "erreur de paiement",
      "paiement erreur",
      "paiement en erreur",
      "payment error",
      "payment failed",
    ],
  },
  {
    key: "payment_done",
    label: "Paiement effectue",
    aliases: ["paiement effectue", "paiement accepte", "payment accepted", "paid"],
  },
  {
    key: "canceled",
    label: "Annule",
    aliases: ["annule", "annulee", "canceled", "cancelled", "annulation"],
  },
];

const envOrderStateOverrides = {
  payment_failed: import.meta.env.VITE_ORDER_STATE_PAYMENT_FAILED_ID,
  payment_done: import.meta.env.VITE_ORDER_STATE_PAYMENT_DONE_ID,
  canceled: import.meta.env.VITE_ORDER_STATE_CANCELED_ID,
};

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

const normalizeStateName = (value) => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const buildStateMap = (states) => {
  return states.reduce((acc, item) => {
    const id = String(item.id || "");
    if (!id) return acc;
    acc[id] = item.name || `Etat #${id}`;
    return acc;
  }, {});
};

const resolveStateId = (states, key, aliases) => {
  const override = envOrderStateOverrides[key];
  if (override) return String(override);

  const normalizedAliases = aliases.map(normalizeStateName);
  const match = states.find((state) =>
    normalizedAliases.includes(normalizeStateName(state.name))
  );
  return match?.id ? String(match.id) : "";
};

const buildAllowedStateOptions = (states) => {
  return allowedOrderStates.map((state) => ({
    key: state.key,
    label: state.label,
    id: resolveStateId(states, state.key, state.aliases),
  }));
};

const applyOrderStates = (ordersList, stateMap, options) => {
  return ordersList.map((order) => {
    const currentStateId = String(order.currentStateId || "");
    const currentStateKey =
      options.find((option) => String(option.id) === currentStateId)?.key || "";

    return {
      ...order,
      currentStateId,
      currentStateKey,
      stateName:
        stateMap[currentStateId] ||
        (currentStateId ? `Etat #${currentStateId}` : "Etat inconnu"),
    };
  });
};

const loadOrders = async () => {
  ordersError.value = "";
  ordersLoading.value = true;

  try {
    const [ordersResult, statesResult] = await Promise.allSettled([
      fetchResource(
        "orders",
        { display: "[id,reference,current_state,total_paid,date_add]" },
        {
          baseUrl: baseUrl.value,
          apiKey: apiKey.value,
        }
      ),
      fetchResource("order_states", { display: "[id,name]" }, {
        baseUrl: baseUrl.value,
        apiKey: apiKey.value,
      }),
    ]);

    let stateMap = {};
    let stateOptions = [];
    if (statesResult.status === "fulfilled") {
      const list = normalizeOrderStates(statesResult.value.json);
      stateMap = buildStateMap(list);
      orderStates.value = stateMap;
      stateOptions = buildAllowedStateOptions(list);
      orderStateOptions.value = stateOptions;
    } else {
      orderStates.value = {};
      orderStateOptions.value = [];
    }

    if (ordersResult.status === "fulfilled") {
      const list = normalizeOrders(ordersResult.value.json);
      orders.value = applyOrderStates(list, stateMap, stateOptions);
    } else {
      throw ordersResult.reason;
    }
  } catch (err) {
    ordersError.value = err instanceof Error ? err.message : "Erreur inconnue.";
    orders.value = [];
  } finally {
    ordersLoading.value = false;
  }
};

const updateOrderState = async (payload) => {
  const orderId = payload?.orderId;
  const stateKey = payload?.stateKey;

  ordersError.value = "";
  if (!orderId || !stateKey) {
    ordersError.value = "Selection invalide pour la commande.";
    return;
  }

  const option = orderStateOptions.value.find((item) => item.key === stateKey);
  if (!option?.id) {
    ordersError.value = "Etat indisponible. Verifiez le mapping des IDs.";
    return;
  }

  updatingOrderId.value = orderId;
  try {
    const schema = await fetchSchema(baseUrl.value, apiKey.value, "order_histories");
    const xml = buildXmlFromSchema(
      schema,
      {
        id_order: String(orderId),
        id_order_state: String(option.id),
      },
      "order_history"
    );

    await sendXmlResource("order_histories", xml, "POST", {
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
    });

    await loadOrders();
  } catch (err) {
    ordersError.value = err instanceof Error ? err.message : "Erreur inconnue.";
  } finally {
    updatingOrderId.value = null;
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
  loadOrders();
  loadProducts();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Backoffice</p>
        <h1>Commandes</h1>
        <p class="lead">Liste des commandes et de leur etat depuis l'API.</p>
        <div class="meta">
          <span>Format: XML -> JSON</span>
          <span>Endpoint: /api/orders</span>
        </div>
      </div>

      <div class="panel">
        <h2>Etat</h2>
        <div class="row">
          <button :disabled="ordersLoading" @click="loadOrders">
            {{ ordersLoading ? "Chargement..." : "Rafraichir commandes" }}
          </button>
          <button type="button" @click="router.push('/import')">Importer CSVs</button>
          <button class="ghost" type="button" @click="goLogin">Retour login</button>
        </div>
        <p class="hint">Lecture automatique au chargement de la page.</p>
      </div>
    </header>

    <main class="content">
      <section class="panel wide">
        <h2>Commandes</h2>
        <OrderList
          :items="orders"
          :loading="ordersLoading"
          :error="ordersError"
          :state-options="orderStateOptions"
          :updating-id="updatingOrderId"
          @update-state="updateOrderState"
        />
      </section>

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
