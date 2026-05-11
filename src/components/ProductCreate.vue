<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
    fetchResource,
    normalizeProductDetail,
    sendXmlResource,
} from '../services/prestashopApi'

const props = defineProps({
    productId: {
        type: [String, Number],
        default: null,
    },
    mode: {
        type: String,
        default: 'edit',
    },
})

const emit = defineEmits(['close', 'saved'])

const baseUrl = import.meta.env.VITE_PS_BASE_URL || 'http://localhost/prestashop/api'
const apiKey = import.meta.env.VITE_PS_WS_KEY || ''

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const productXml = ref('')

const form = ref({
    name: '',
    price: '',
    active: true,
    languageId: '1',
    linkRewrite: '',
    categoryId: '2',
    taxRulesGroupId: '1',
})

const isCreate = computed(() => props.mode === 'create')
const isReady = computed(() => !!productXml.value && !loading.value)

const loadProductOrSchema = async () => {
    if (!props.productId && !isCreate.value) return

    error.value = ''
    success.value = ''
    loading.value = true

    try {
        const resource = isCreate.value ? 'products' : `products/${props.productId}`
        const params = isCreate.value ? { schema: 'blank' } : {}
        const { xml, json } = await fetchResource(resource, params, { baseUrl, apiKey })

        productXml.value = xml
        const detail = normalizeProductDetail(json)
        if (detail) {
            form.value = {
                name: detail.name,
                price: detail.price,
                active: detail.active,
                languageId: detail.languageId || '1',
                linkRewrite: detail.linkRewrite || '',
                categoryId: detail.categoryId || '2',
                taxRulesGroupId: detail.taxRulesGroupId || '1',
            }
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Erreur inconnue.'
    } finally {
        loading.value = false
    }
}

const updateXmlValue = (doc, selector, value) => {
    const node = doc.querySelector(selector)
    if (!node) return
    node.textContent = value
}

const ensurePositiveValue = (doc, selector, fallbackValue = '1') => {
    let node = doc.querySelector(selector)
    if (!node) {
        const parts = selector.split(' > ')
        if (parts.length === 2) {
            const parent = doc.querySelector(parts[0])
            if (parent) {
                node = doc.createElement(parts[1])
                parent.appendChild(node)
            }
        }
    }
    if (!node) return
    const value = parseInt(node.textContent || '0', 10)
    if (!Number.isFinite(value) || value < 1) {
        node.textContent = fallbackValue
    }
}

const ensureCategoryPositions = (doc, fallbackValue = '1') => {
    const categories = Array.from(
        doc.querySelectorAll('product > associations > categories > category')
    )
    categories.forEach((category) => {
        let position = category.querySelector('position')
        if (!position) {
            position = doc.createElement('position')
            category.appendChild(position)
        }
        const value = parseInt(position.textContent || '0', 10)
        if (!Number.isFinite(value) || value < 1) {
            position.textContent = fallbackValue
        }
    })
}

const removeXmlNode = (doc, selector) => {
    const node = doc.querySelector(selector)
    if (!node || !node.parentNode) return
    node.parentNode.removeChild(node)
}

const updateXmlName = (doc, value, languageId) => {
    const nameNode = doc.querySelector('product > name')
    if (!nameNode) return

    const languageNodes = Array.from(nameNode.querySelectorAll('language'))
    const target = languageNodes.find(
        (node) => node.getAttribute('id') === String(languageId)
    )

    const fallback = target || languageNodes[0]
    if (fallback) {
        fallback.textContent = value
        return
    }

    const created = doc.createElement('language')
    created.setAttribute('id', String(languageId))
    created.textContent = value
    nameNode.appendChild(created)
}

const updateXmlLinkRewrite = (doc, value, languageId) => {
    const rewriteNode = doc.querySelector('product > link_rewrite')
    if (!rewriteNode) return

    const languageNodes = Array.from(rewriteNode.querySelectorAll('language'))
    const target = languageNodes.find(
        (node) => node.getAttribute('id') === String(languageId)
    )

    const fallback = target || languageNodes[0]
    if (fallback) {
        fallback.textContent = value
        return
    }

    const created = doc.createElement('language')
    created.setAttribute('id', String(languageId))
    created.textContent = value
    rewriteNode.appendChild(created)
}

const slugify = (value) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

const buildUpdatedXml = () => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(productXml.value, 'application/xml')
    const parseError = doc.querySelector('parsererror')

    if (parseError) {
        throw new Error('XML invalide: impossible de modifier le produit.')
    }

    updateXmlValue(doc, 'product > price', String(form.value.price))
    updateXmlValue(doc, 'product > active', form.value.active ? '1' : '0')
    updateXmlName(doc, form.value.name, form.value.languageId)
    updateXmlValue(doc, 'product > id_category_default', String(form.value.categoryId))
    updateXmlValue(doc, 'product > id_tax_rules_group', String(form.value.taxRulesGroupId))

    const rewrite = form.value.linkRewrite || slugify(form.value.name)
    updateXmlLinkRewrite(doc, rewrite, form.value.languageId)

    ensurePositiveValue(doc, 'product > position', '1')
    ensureCategoryPositions(doc, '1')

    removeXmlNode(doc, 'product > manufacturer_name')
    removeXmlNode(doc, 'product > date_add')
    removeXmlNode(doc, 'product > date_upd')
    removeXmlNode(doc, 'product > quantity')

    if (isCreate.value) {
        removeXmlNode(doc, 'product > id')
    }

    return new XMLSerializer().serializeToString(doc)
}

const saveProduct = async () => {
    if (!props.productId && !isCreate.value) return

    error.value = ''
    success.value = ''
    saving.value = true

    try {
        const xmlBody = buildUpdatedXml()
        const resource = isCreate.value ? 'products' : `products/${props.productId}`
        const method = isCreate.value ? 'POST' : 'PUT'

        await sendXmlResource(resource, xmlBody, method, { baseUrl, apiKey })

        success.value = isCreate.value ? 'Produit cree.' : 'Produit mis a jour.'
        emit('saved')
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Erreur inconnue.'
    } finally {
        saving.value = false
    }
}

watch(
    () => [props.productId, props.mode],
    () => {
        loadProductOrSchema()
    }
)

onMounted(() => {
    loadProductOrSchema()
})
</script>

<template>
    <div class="stack">
        <p class="eyebrow">Edition</p>
        <h2 v-if="!isCreate">Modifier le produit #{{ productId }}</h2>
        <h2 v-else>Creer un produit</h2>
        <p class="lead" v-if="!isCreate">Chargement du XML puis mise a jour via PUT.</p>
        <p class="lead" v-else>Chargement du schema puis creation via POST.</p>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-else-if="loading" class="status">Chargement du produit...</p>
        <p v-else-if="success" class="status">{{ success }}</p>

        <form v-if="isReady" class="form-grid" @submit.prevent="saveProduct">
            <div class="field">
                <label for="name">Nom</label>
                <input id="name" v-model="form.name" type="text" />
            </div>

            <div class="field">
                <label for="linkRewrite">Link rewrite</label>
                <input
                    id="linkRewrite"
                    v-model="form.linkRewrite"
                    type="text"
                    placeholder="Auto si vide"
                />
            </div>

            <div class="field">
                <label for="price">Prix</label>
                <input id="price" v-model="form.price" type="number" step="0.01" />
            </div>

            <div class="field">
                <label for="categoryId">Categorie par defaut</label>
                <input id="categoryId" v-model="form.categoryId" type="number" />
            </div>

            <div class="field">
                <label for="taxRulesGroupId">Groupe de taxe</label>
                <input id="taxRulesGroupId" v-model="form.taxRulesGroupId" type="number" />
            </div>

            <div class="field checkbox">
                <label for="active">Actif</label>
                <input id="active" v-model="form.active" type="checkbox" />
            </div>

            <div class="field">
                <label for="languageId">Langue ID</label>
                <input id="languageId" v-model="form.languageId" type="text" />
            </div>

            <div class="actions">
                <button type="submit" :disabled="saving">
                    {{ saving ? 'Enregistrement...' : isCreate ? 'Creer' : 'Enregistrer' }}
                </button>
                <button class="ghost" type="button" @click="emit('close')">
                    Retour a la liste
                </button>
            </div>
        </form>
    </div>
</template>