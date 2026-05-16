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
    key: "payment_done",
    label: "Paiement effectué",
    aliases: [
      "paiement accepte", "paiement effectue", "payment accepted",
      "paid", "awaiting check payment", "check payment",
      "en attente de paiement par cheque",
    ],
  },
  {
    key: "canceled",
    label: "Annulé",
    aliases: ["annule", "annulee", "canceled", "cancelled", "annulation"],
  },
];

const envOrderStateOverrides = {
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

// ── Statistiques par jour ────────────────────────────
const statsByDay = computed(() => {
  const map = {};
  for (const order of orders.value) {
    const day = (order.dateAdd || '').slice(0, 10); // 'YYYY-MM-DD'
    if (!day) continue;
    if (!map[day]) map[day] = { date: day, count: 0, total: 0 };
    map[day].count += 1;
    map[day].total += parseFloat(order.totalPaid || 0);
  }
  // Trier du plus récent au plus ancien
  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
});

const statsTotal = computed(() => ({
  count: orders.value.length,
  total: orders.value.reduce((s, o) => s + parseFloat(o.totalPaid || 0), 0),
}));

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

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
          <button type="button" @click="router.push('/stock')">Gérer les stocks</button>
          <button type="button" @click="router.push('/import')">Importer CSVs</button>
          <button class="ghost" type="button" @click="goLogin">Retour login</button>
        </div>
        <p class="hint">Lecture automatique au chargement de la page.</p>
      </div>
    </header>

    <main class="content">

      <!-- ── Tableau de bord ────────────────────────── -->
      <section class="panel wide db-stats">
        <div class="db-header">
          <h2 class="db-title">📊 Tableau de bord</h2>
          <span class="db-subtitle">Résumé des commandes</span>
        </div>

        <!-- KPI globaux -->
        <div class="kpi-row">
          <div class="kpi-card kpi-orders">
            <span class="kpi-icon">🧾</span>
            <div>
              <p class="kpi-value">{{ statsTotal.count }}</p>
              <p class="kpi-label">Commandes totales</p>
            </div>
          </div>
          <div class="kpi-card kpi-revenue">
            <span class="kpi-icon">💰</span>
            <div>
              <p class="kpi-value">{{ statsTotal.total.toFixed(2) }} €</p>
              <p class="kpi-label">Chiffre d'affaires total</p>
            </div>
          </div>
          <div class="kpi-card kpi-avg">
            <span class="kpi-icon">📈</span>
            <div>
              <p class="kpi-value">
                {{ statsTotal.count ? (statsTotal.total / statsTotal.count).toFixed(2) : '0.00' }} €
              </p>
              <p class="kpi-label">Panier moyen</p>
            </div>
          </div>
          <div class="kpi-card kpi-days">
            <span class="kpi-icon">📅</span>
            <div>
              <p class="kpi-value">{{ statsByDay.length }}</p>
              <p class="kpi-label">Jours avec commandes</p>
            </div>
          </div>
        </div>

        <!-- Table par jour -->
        <div v-if="ordersLoading" class="db-loading">Chargement des statistiques…</div>
        <div v-else-if="!statsByDay.length" class="db-empty">Aucune commande enregistrée.</div>
        <div v-else class="db-table-wrap">
          <table class="db-table">
            <thead>
              <tr>
                <th>Date</th>
                <th class="text-right">Nb commandes</th>
                <th class="text-right">Montant du jour</th>
                <th class="text-right">% du CA</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in statsByDay" :key="row.date" class="db-row">
                <td class="db-date">{{ formatDate(row.date) }}</td>
                <td class="text-right">
                  <span class="db-badge">{{ row.count }}</span>
                </td>
                <td class="text-right db-amount">{{ row.total.toFixed(2) }} €</td>
                <td class="text-right db-pct">
                  {{ statsTotal.total ? ((row.total / statsTotal.total) * 100).toFixed(1) : '0.0' }}%
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="db-total-row">
                <td><strong>Total général</strong></td>
                <td class="text-right"><strong>{{ statsTotal.count }}</strong></td>
                <td class="text-right db-amount"><strong>{{ statsTotal.total.toFixed(2) }} €</strong></td>
                <td class="text-right"><strong>100%</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

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

      <!-- <section v-if="!isEditing" class="panel">
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
      </section> -->

      <!-- <section class="panel wide">
        <DataImport :base-url="baseUrl" :api-key="apiKey" />
      </section> -->

      <!-- <section class="panel">
        <h2>XML brut (extrait)</h2>
        <pre v-if="xmlPreview" class="code">{{ xmlPreview }}</pre>
        <p v-else class="empty">Aucun XML charge.</p>
      </section> -->
    </main>
  </div>
</template>
