<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import {
  fetchResource,
  normalizeProducts,
  normalizeStockAvailables,
  normalizeOrderDetails,
  normalizeOrders,
  sendXmlResource,
} from "../services/prestashopApi";
import { fetchSchema } from "../utils/psIntrospect";
import { buildXmlFromSchema } from "../utils/xmlBuilder";

const router = useRouter();

const baseUrl = ref(import.meta.env.VITE_PS_BASE_URL || "http://localhost/prestashop/api");
const apiKey = ref(import.meta.env.VITE_PS_WS_KEY || "");

const loading = ref(false);
const error = ref("");
const success = ref("");

const products = ref([]);
const search = ref("");
const selectedProduct = ref(null);
const stockHistory = ref([]);
const historyLoading = ref(false);

const loadData = async () => {
  loading.value = true;
  error.value = "";
  success.value = "";
  try {
    const [productsRes, stocksRes] = await Promise.all([
      fetchResource("products", { display: "[id,name,reference]" }, {
        baseUrl: baseUrl.value,
        apiKey: apiKey.value,
      }),
      fetchResource("stock_availables", { display: "full" }, {
        baseUrl: baseUrl.value,
        apiKey: apiKey.value,
      }),
    ]);

    const normalizedP = normalizeProducts(productsRes.json);
    const normalizedS = normalizeStockAvailables(stocksRes.json);
    
    products.value = normalizedP.map(p => {
      const stockEntry = normalizedS.find(
        (s) => s.productId === p.id && (s.productAttributeId === "0" || !s.productAttributeId)
      );
      return {
        ...p,
        stockId: stockEntry?.id || null,
        quantity: stockEntry?.quantity || "0",
        newQuantity: stockEntry?.quantity || "0",
        dependsOnStock: stockEntry?.dependsOnStock || "0",
        outOfStock: stockEntry?.outOfStock || "0",
        isUpdating: false,
      };
    });
  } catch (err) {
    error.value = "Erreur lors du chargement des données: " + err.message;
  } finally {
    loading.value = false;
  }
};

const filteredProducts = computed(() => {
  if (!search.value) return products.value;
  const s = search.value.toLowerCase();
  return products.value.filter(p => 
    p.name.toLowerCase().includes(s) || (p.reference && p.reference.toLowerCase().includes(s))
  );
});

const loadStockHistory = async (product) => {
  selectedProduct.value = product;
  historyLoading.value = true;
  stockHistory.value = [];
  
  try {
    // 1. Récupérer les détails de commandes pour ce produit
    const detailsRes = await fetchResource("order_details", { 
      display: "[id_order,product_quantity]",
      "filter[product_id]": `[${product.id}]`
    }, {
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
    });

    const details = normalizeOrderDetails(detailsRes.json);
    
    if (details.length > 0) {
      // 2. Récupérer les dates des commandes correspondantes
      const orderIds = [...new Set(details.map(d => d.orderId))];
      const ordersRes = await fetchResource("orders", {
        display: "[id,date_add]",
        "filter[id]": `[${orderIds.join("|")}]`
      }, {
        baseUrl: baseUrl.value,
        apiKey: apiKey.value,
      });
      
      const ordersList = normalizeOrders(ordersRes.json);
      const ordersMap = ordersList.reduce((acc, o) => {
        acc[o.id] = o.dateAdd;
        return acc;
      }, {});

      // 3. Transformer en mouvements (négatifs car ce sont des ventes)
      const salesHistory = details.map(d => ({
        date: ordersMap[d.orderId] || "",
        quantity: d.quantity,
        sign: -1,
        type: 'Vente'
      }));
      
      stockHistory.value = [...salesHistory];
    }

    // 4. Ajouter les mouvements manuels enregistrés localement
    const localLogs = JSON.parse(localStorage.getItem(`stock_log_${product.id}`) || "[]");
    stockHistory.value = [...stockHistory.value, ...localLogs];

    // Trier par date
    stockHistory.value.sort((a, b) => b.date.localeCompare(a.date));

  } catch (err) {
    console.error("Erreur historique:", err);
    error.value = "Erreur lors de la récupération de l'historique des ventes.";
  } finally {
    historyLoading.value = false;
  }
};

const historyByDay = computed(() => {
  const map = {};
  stockHistory.value.forEach(mvt => {
    if (!mvt.date) return;
    const day = mvt.date.slice(0, 10);
    if (!map[day]) map[day] = { date: day, totalChange: 0, movements: 0, types: new Set() };
    const qty = parseInt(mvt.quantity) || 0;
    const sign = parseInt(mvt.sign) || 1;
    map[day].totalChange += (qty * sign);
    map[day].movements += 1;
    if (mvt.type) map[day].types.add(mvt.type);
  });
  return Object.values(map).map(day => ({
    ...day,
    typeLabel: Array.from(day.types).join(', ')
  })).sort((a, b) => b.date.localeCompare(a.date));
});

const updateStock = async (product) => {
  if (!product.stockId) {
    error.value = "Impossible de mettre à jour : ID de stock manquant pour ce produit.";
    return;
  }

  product.isUpdating = true;
  error.value = "";
  success.value = "";

  try {
    const schema = await fetchSchema(baseUrl.value, apiKey.value, "stock_availables");
    const xml = buildXmlFromSchema(
      schema,
      {
        id: product.stockId,
        id_product: product.id,
        id_product_attribute: "0",
        quantity: String(product.newQuantity),
        depends_on_stock: String(product.dependsOnStock),
        out_of_stock: String(product.outOfStock),
        id_shop: "1", 
        id_shop_group: "0",
      },
      "stock_available"
    );

    await sendXmlResource(`stock_availables/${product.stockId}`, xml, "PUT", {
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
    });

    // Enregistrer le mouvement localement pour l'historique (puisque ASM est désactivé)
    const diff = parseInt(product.newQuantity) - parseInt(product.quantity);
    if (diff !== 0) {
      const logEntry = {
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        quantity: Math.abs(diff),
        sign: diff > 0 ? 1 : -1,
        type: 'Manuel'
      };
      const existingLogs = JSON.parse(localStorage.getItem(`stock_log_${product.id}`) || "[]");
      existingLogs.push(logEntry);
      localStorage.setItem(`stock_log_${product.id}`, JSON.stringify(existingLogs));
    }

    success.value = `Stock mis à jour pour "${product.name}"`;
    product.quantity = String(product.newQuantity);
    
    // Rafraichir l'historique si c'est le produit sélectionné
    if (selectedProduct.value?.id === product.id) {
      await loadStockHistory(product);
    }
  } catch (err) {
    error.value = `Erreur lors de la mise à jour de "${product.name}": ` + err.message;
  } finally {
    product.isUpdating = false;
  }
};

const goBack = () => {
  router.push("/dashboard");
};

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Backoffice</p>
        <h1>Gestion des Stocks</h1>
        <p class="lead">Mettez à jour les quantités disponibles en temps réel.</p>
        <div class="meta">
          <span>Resource: stock_availables</span>
        </div>
      </div>

      <div class="panel">
        <div class="row">
          <button class="ghost" @click="goBack">Retour Dashboard</button>
          <button :disabled="loading" @click="loadData">
            {{ loading ? "Chargement..." : "Actualiser" }}
          </button>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="panel wide">
        <div class="search-bar">
          <input 
            v-model="search" 
            type="text" 
            placeholder="Rechercher un produit par nom ou référence..." 
            class="search-input"
          />
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>
        <div v-if="success" class="success-box">{{ success }}</div>

        <div class="table-container">
          <table class="stock-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Référence</th>
                <th>Nom du produit</th>
                <th class="text-center">Stock actuel</th>
                <th class="text-center">Nouvelle quantité</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in filteredProducts" :key="product.id">
                <td>{{ product.id }}</td>
                <td>{{ product.reference || '—' }}</td>
                <td>{{ product.name }}</td>
                <td class="text-center">
                  <span class="badge" :class="parseInt(product.quantity) <= 0 ? 'badge-red' : 'badge-green'">
                    {{ product.quantity }}
                  </span>
                </td>
                <td class="text-center">
                  <input 
                    v-model.number="product.newQuantity" 
                    type="number" 
                    class="qty-input"
                    :disabled="product.isUpdating"
                  />
                </td>
                <td>
                  <div class="actions">
                    <button 
                      @click="updateStock(product)" 
                      :disabled="product.isUpdating || !product.stockId || Number(product.quantity) === Number(product.newQuantity)"
                      class="btn-small"
                    >
                      {{ product.isUpdating ? "..." : "Enregistrer" }}
                    </button>
                    <button 
                      @click="loadStockHistory(product)" 
                      class="btn-small ghost"
                      title="Voir l'historique"
                    >
                      🕒
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredProducts.length === 0 && !loading">
                <td colspan="6" class="text-center">Aucun produit trouvé.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Section Historique -->
      <section v-if="selectedProduct" class="panel wide history-section">
        <div class="db-header">
          <h2 class="db-title">📈 Évolution du stock : {{ selectedProduct.name }}</h2>
          <button class="btn-close" @click="selectedProduct = null">×</button>
        </div>

        <div v-if="historyLoading" class="db-loading">Chargement de l'historique...</div>
        <div v-else-if="!historyByDay.length" class="db-empty">Aucun mouvement de stock enregistré pour ce produit.</div>
        <div v-else class="db-table-wrap">
          <table class="db-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th class="text-right">Nb mouvements</th>
                <th class="text-right">Variation totale</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in historyByDay" :key="day.date" class="db-row">
                <td class="db-date">{{ formatDate(day.date) }}</td>
                <td>
                  <span class="type-badge">{{ day.typeLabel }}</span>
                </td>
                <td class="text-right">
                  <span class="db-badge">{{ day.movements }}</span>
                </td>
                <td class="text-right" :class="day.totalChange >= 0 ? 'text-ok' : 'text-warning'">
                  <strong>{{ day.totalChange > 0 ? '+' : '' }}{{ day.totalChange }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--stroke);
  border-radius: 8px;
  background: var(--panel);
  color: var(--ink);
}

.stock-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.stock-table th, .stock-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--stroke);
}

.text-center {
  text-align: center;
}

.qty-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid var(--stroke);
  border-radius: 4px;
  text-align: center;
  background: var(--panel);
  color: var(--ink);
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.badge-green {
  background: rgba(47, 158, 111, 0.1);
  color: var(--ok);
}

.badge-red {
  background: rgba(216, 106, 58, 0.1);
  color: var(--warning);
}

.error-box {
  background: rgba(216, 106, 58, 0.1);
  color: var(--warning);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid var(--warning);
}

.success-box {
  background: rgba(47, 158, 111, 0.1);
  color: var(--ok);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid var(--ok);
}

.table-container {
  overflow-x: auto;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.history-section {
  margin-top: 2rem;
  border-top: 4px solid var(--accent);
}

.db-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--muted);
  padding: 4px 8px;
}

.btn-close:hover {
  color: var(--warning);
}

.text-ok {
  color: var(--ok);
}

.text-warning {
  color: var(--warning);
}

.db-table {
  width: 100%;
  border-collapse: collapse;
}

.db-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid var(--stroke);
  color: var(--muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.db-row td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--stroke);
}

.db-date {
  font-weight: 600;
  color: var(--ink);
}

.db-badge {
  background: var(--bg);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid var(--stroke);
}

.type-badge {
  font-size: 0.75rem;
  color: var(--muted);
  background: #eee;
  padding: 2px 6px;
  border-radius: 4px;
}

.db-loading, .db-empty {
  padding: 3rem;
  text-align: center;
  color: var(--muted);
  font-style: italic;
}
</style>
