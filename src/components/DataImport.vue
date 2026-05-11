<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { fetchAllResources, fetchSchema } from "../utils/psIntrospect";
import { buildXmlFromSchema } from "../utils/xmlBuilder";
import { parseMultiEntityCsv } from "../utils/csvParser";

const props = defineProps({
  baseUrl: {
    type: String,
    default: "",
  },
  apiKey: {
    type: String,
    default: "",
  },
});

const resources = ref([]);
const selectedResource = ref("");
const isLoadingResources = ref(false);
const loadError = ref("");

const progress = ref(0);
const results = ref({});
const isImporting = ref(false);

const resetProgress = ref(0);
const resetResult = ref({ deleted: 0, errors: [] });
const isResetting = ref(false);

const canUseApi = computed(() => !!props.baseUrl && !!props.apiKey);

const buildUrl = (resourcePath = "") => {
  const base = props.baseUrl.replace(/\/$/, "");
  if (!resourcePath) return base;
  const path = resourcePath.replace(/^\//, "");
  return `${base}/${path}`;
};

const buildAuthHeaders = () => {
  if (!props.apiKey) return {};
  return { Authorization: `Basic ${btoa(`${props.apiKey}:`)}` };
};

const loadResources = async () => {
  loadError.value = "";
  if (!canUseApi.value) {
    resources.value = [];
    selectedResource.value = "";
    return;
  }

  isLoadingResources.value = true;
  try {
    const list = await fetchAllResources(props.baseUrl, props.apiKey);
    resources.value = list;
    if (!list.includes(selectedResource.value)) {
      selectedResource.value = list[0] || "";
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : "Erreur lors du chargement.";
    resources.value = [];
    selectedResource.value = "";
  } finally {
    isLoadingResources.value = false;
  }
};

onMounted(loadResources);
watch(() => [props.baseUrl, props.apiKey], loadResources);

const detectDelimiter = (text) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const headerLine = lines.find((line) => line.includes(";") || line.includes(","));
  if (!headerLine) return ",";

  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
};

const handleFile = (event) => {
  if (!canUseApi.value) {
    loadError.value = "Configuration manquante: base URL ou cle API.";
    return;
  }

  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target?.result;
    if (typeof text !== "string") return;

    const delimiter = detectDelimiter(text);
    const sections = parseMultiEntityCsv(text, delimiter);

    if (!sections.length) {
      alert("Aucune donnee trouvee dans le CSV");
      return;
    }

    await importMulti(sections);
  };
  reader.readAsText(file, "UTF-8");
};

const importMulti = async (sections) => {
  isImporting.value = true;
  results.value = {};
  progress.value = 0;

  const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0);
  let doneRows = 0;

  for (const section of sections) {
    const { resource, rows } = section;
    results.value[resource] = { success: 0, errors: [] };

    let schema;
    try {
      schema = await fetchSchema(props.baseUrl, props.apiKey, resource);
    } catch (err) {
      results.value[resource].errors.push(
        `Schema introuvable: ${err instanceof Error ? err.message : "erreur inconnue"}`
      );
      doneRows += rows.length;
      progress.value = totalRows ? Math.round((doneRows / totalRows) * 100) : 0;
      continue;
    }

    for (let i = 0; i < rows.length; i += 1) {
      try {
        const xml = buildXmlFromSchema(schema, rows[i], resource);
        const res = await fetch(buildUrl(resource), {
          method: "POST",
          headers: {
            ...buildAuthHeaders(),
            Accept: "application/xml",
            "Content-Type": "application/xml",
          },
          body: xml,
        });

        if (res.ok) {
          results.value[resource].success += 1;
        } else {
          const errorText = await res.text().catch(() => "");
          results.value[resource].errors.push(
            `Ligne ${i + 1}: ${res.status} - ${errorText.slice(0, 120)}`
          );
        }
      } catch (err) {
        results.value[resource].errors.push(`Ligne ${i + 1}: erreur inattendue`);
      }

      doneRows += 1;
      progress.value = totalRows ? Math.round((doneRows / totalRows) * 100) : 0;
    }
  }

  isImporting.value = false;
};

const fetchAllIds = async (resource) => {
  const res = await fetch(`${buildUrl(resource)}?display=[id]`, {
    headers: {
      ...buildAuthHeaders(),
      Accept: "application/xml",
    },
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API erreur ${res.status}: ${res.statusText || "Erreur inconnue"}`);
  }

  const xml = new DOMParser().parseFromString(text, "application/xml");
  return Array.from(xml.querySelectorAll(`${resource} > * > id`))
    .map((node) => node.textContent)
    .filter(Boolean);
};

const resetResource = async () => {
  if (!canUseApi.value) {
    loadError.value = "Configuration manquante: base URL ou cle API.";
    return;
  }

  if (!selectedResource.value) {
    alert("Veuillez selectionner une ressource a vider.");
    return;
  }

  const confirmed = confirm(
    `Supprimer tous les enregistrements de "${selectedResource.value}" ?`
  );
  if (!confirmed) return;

  isResetting.value = true;
  resetProgress.value = 0;
  resetResult.value = { deleted: 0, errors: [] };

  let ids = [];
  try {
    ids = await fetchAllIds(selectedResource.value);
  } catch (err) {
    resetResult.value.errors.push(
      err instanceof Error ? err.message : "Impossible de recuperer les IDs."
    );
    isResetting.value = false;
    return;
  }

  if (!ids.length) {
    resetResult.value.errors.push("Aucun enregistrement trouve.");
    isResetting.value = false;
    return;
  }

  for (let i = 0; i < ids.length; i += 1) {
    try {
      const res = await fetch(buildUrl(`${selectedResource.value}/${ids[i]}`), {
        method: "DELETE",
        headers: {
          ...buildAuthHeaders(),
          Accept: "application/xml",
        },
      });
      if (res.ok) {
        resetResult.value.deleted += 1;
      } else {
        resetResult.value.errors.push(`ID ${ids[i]}: ${res.status}`);
      }
    } catch (err) {
      resetResult.value.errors.push(`ID ${ids[i]}: erreur inattendue`);
    }
    resetProgress.value = Math.round(((i + 1) / ids.length) * 100);
  }

  isResetting.value = false;
};
</script>

<template>
  <div class="stack">
    <p class="eyebrow">Import / Reset</p>
    <h2>Import CSV multi-ressources</h2>
    <p class="lead">Importation via XML, avec schema auto.</p>

    <p v-if="loadError" class="error">{{ loadError }}</p>
    <p v-else-if="isLoadingResources" class="status">Chargement des ressources...</p>
    <p v-else-if="!canUseApi" class="status">
      Configurez VITE_PS_BASE_URL et VITE_PS_WS_KEY pour activer l'import.
    </p>

    <div class="block">
      <h3>Importer un fichier CSV</h3>
      <p class="hint">Separateur "," ou ";" - mono ou multi-entites.</p>
      <input
        type="file"
        accept=".csv"
        @change="handleFile"
        :disabled="isImporting || !canUseApi"
      />
    </div>

    <div v-if="progress > 0" class="progress">
      <p>Progression: <strong>{{ progress }}%</strong></p>
      <progress :value="progress" max="100"></progress>
    </div>

    <div v-if="Object.keys(results).length" class="result-grid">
      <div v-for="(res, resource) in results" :key="resource" class="result-card">
        <h3>{{ resource }}</h3>
        <p class="success">{{ res.success }} enregistrements importes</p>
        <ul v-if="res.errors.length" class="error-list">
          <li v-for="(err, i) in res.errors" :key="i">{{ err }}</li>
        </ul>
      </div>
    </div>

    <div class="block danger-zone">
      <h3>Zone dangereuse</h3>
      <p>Supprime tous les enregistrements de la ressource selectionnee.</p>
      <div class="row">
        <select v-model="selectedResource" :disabled="isResetting || !resources.length">
          <option value="">Selectionner une ressource</option>
          <option v-for="resource in resources" :key="resource" :value="resource">
            {{ resource }}
          </option>
        </select>
        <button
          type="button"
          class="danger"
          @click="resetResource"
          :disabled="isResetting || !selectedResource"
        >
          {{ isResetting ? "Suppression..." : "Vider" }}
        </button>
      </div>

      <div v-if="resetProgress > 0" class="progress">
        <p>Progression suppression: <strong>{{ resetProgress }}%</strong></p>
        <progress :value="resetProgress" max="100"></progress>
      </div>

      <div v-if="resetResult.deleted > 0 || resetResult.errors.length">
        <p class="success">{{ resetResult.deleted }} enregistrements supprimes</p>
        <ul v-if="resetResult.errors.length" class="error-list">
          <li v-for="(err, i) in resetResult.errors" :key="i">{{ err }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>
