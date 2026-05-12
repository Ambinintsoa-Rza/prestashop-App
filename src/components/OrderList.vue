<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
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
    default: "",
  },
  stateOptions: {
    type: Array,
    default: () => [],
  },
  updatingId: {
    type: [String, Number],
    default: null,
  },
});

const emit = defineEmits(["update-state"]);

const selectedStates = ref({});

const syncSelection = () => {
  const next = {};
  props.items.forEach((item) => {
    const existing = selectedStates.value[item.id];
    next[item.id] = item.currentStateKey || existing || "";
  });
  selectedStates.value = { ...selectedStates.value, ...next };
};

watch(() => props.items, syncSelection, { immediate: true });

const findOption = (key) => props.stateOptions.find((option) => option.key === key);

const canApply = (item) => {
  const key = selectedStates.value[item.id];
  if (!key) return false;
  const option = findOption(key);
  if (!option?.id) return false;
  return String(props.updatingId || "") !== String(item.id || "");
};

const applyState = (item) => {
  const key = selectedStates.value[item.id];
  if (!key) return;
  emit("update-state", { orderId: item.id, stateKey: key });
};

const hasMissingStates = computed(() =>
  props.stateOptions.length === 0 || props.stateOptions.some((option) => !option.id)
);
</script>

<template>
  <div class="list">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="status">Chargement en cours...</p>
    <p v-else-if="!items.length" class="empty">Aucune commande a afficher.</p>

    <div v-else>
      <p v-if="hasMissingStates" class="status">
        Certains etats ne sont pas mappes. Configurez les IDs si besoin.
      </p>

      <ul class="grid">
        <li v-for="item in items" :key="item.id" class="card">
          <div class="card-head">
            <span class="tag">#{{ item.id }}</span>
            <span class="status">{{ item.stateName || "Etat inconnu" }}</span>
          </div>
          <h3>{{ item.reference || "Sans reference" }}</h3>
          <p class="order-meta">Date: {{ item.dateAdd || "-" }}</p>
          <p class="amount">{{ item.totalPaid || "-" }} €</p>
          <div class="card-actions">
            <select v-model="selectedStates[item.id]">
              <option value="">Choisir un etat</option>
              <option
                v-for="option in stateOptions"
                :key="option.key"
                :value="option.key"
                :disabled="!option.id"
              >
                {{ option.label }}
              </option>
            </select>
            <button
              class="ghost small"
              type="button"
              :disabled="!canApply(item)"
              @click="applyState(item)"
            >
              {{ updatingId === item.id ? "Mise a jour..." : "Appliquer" }}
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
