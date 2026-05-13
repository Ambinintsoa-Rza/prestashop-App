<template>
  <div class="import-page">
    <h2>Import CSVs & images</h2>
    <p class="hint">Import automatique des produits, declinaisons, stocks, clients, commandes et images a partir des 3 CSVs du dossier data.</p>

    <div class="file-row">
      <label>Produits (produit.csv)</label>
      <input type="file" @change="onFileChange($event, 'produit')" accept=".csv" />
    </div>

    <div class="file-row">
      <label>Stock / déclinaisons (stock.csv)</label>
      <input type="file" @change="onFileChange($event, 'stock')" accept=".csv" />
    </div>

    <div class="file-row">
      <label>Commandes (commande.csv)</label>
      <input type="file" @change="onFileChange($event, 'commande')" accept=".csv" />
    </div>

    <div class="file-row">
      <label>Images (zip ou dossier)</label>
      <input type="file" webkitdirectory directory multiple @change="onImagesSelected" />
    </div>

    <div class="options">
      <label><input type="checkbox" v-model="createCombinations" /> Créer des déclinaisons (combinations) depuis `specificité` / `karazany`</label>
      <label><input type="checkbox" v-model="autoCreateProducts" /> Créer les produits manquants</label>
    </div>

    <div class="actions">
      <button @click="preview">Prévisualiser</button>
      <button @click="runImport" :disabled="!previewData">Lancer l'import</button>
      <button class="ghost" type="button" @click="goDashboard">Retour dashboard</button>
    </div>

    <div v-if="log.length" class="log">
      <h3>Log</h3>
      <pre>{{ log.join('\n') }}</pre>
    </div>

    <div v-if="previewData" class="preview">
      <h3>Aperçu</h3>
      <p><strong>Produits détectés:</strong> {{ previewData.products.length }}</p>
      <p><strong>Entries stock:</strong> {{ previewData.stock.length }}</p>
      <p><strong>Commandes:</strong> {{ previewData.orders.length }}</p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import * as importService from '../services/importService'

export default {
  setup() {
    const router = useRouter()
    const files = ref({ produit: null, stock: null, commande: null })
    const images = ref([])
    const createCombinations = ref(true)
    const autoCreateProducts = ref(true)
    const previewData = ref(null)
    const log = ref([])

    const onFileChange = (e, key) => {
      const f = e.target.files && e.target.files[0]
      files.value[key] = f || null
    }

    const onImagesSelected = (e) => {
      images.value = Array.from(e.target.files || [])
    }

    const preview = async () => {
      log.value = []
      try {
        const parsed = await importService.parseFiles(files.value)
        previewData.value = parsed
      } catch (err) {
        log.value.push('Erreur preview: ' + err.message)
      }
    }

    const runImport = async () => {
      log.value = []
      if (!previewData.value) {
        log.value.push('Faites d abord la prévisualisation.')
        return
      }

      try {
        const result = await importService.runImport(previewData.value, images.value, {
          createCombinations: createCombinations.value,
          autoCreateProducts: autoCreateProducts.value,
        })
        log.value.push(...result.logs)
      } catch (err) {
        log.value.push('Erreur import: ' + err.message)
      }
    }

    const goDashboard = () => {
      router.push('/dashboard')
    }

    return {
      onFileChange,
      onImagesSelected,
      preview,
      runImport,
      goDashboard,
      createCombinations,
      autoCreateProducts,
      previewData,
      log,
    }
  },
}
</script>

<style scoped>
.import-page { padding: 16px }
.file-row { margin-bottom: 10px }
.options { margin: 10px 0 }
.actions { margin: 12px 0 }
.log { background:#111; color:#0f0; padding:10px; max-height:300px; overflow:auto }
.preview { margin-top:12px }
</style>
