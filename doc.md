# prestashop-App

Ce projet est un petit client Vue 3 pour l'API Webservice de PrestaShop. Les donnees sont recues en XML, puis converties en JSON pour etre utilisees dans Vue.

## Demarrage rapide

1. Copier `.env.example` vers `.env`.
2. Remplir `VITE_PS_BASE_URL` et `VITE_PS_WS_KEY`.
3. Installer et lancer:

```bash
npm install
npm run dev
```

## Principes cle

- L'API PrestaShop renvoie du XML.
- Le code convertit ensuite XML -> JSON dans `src/services/xml.js`.
- Les appels API sont centralises dans `src/services/prestashopApi.js`.

## Appeler l'API (exemple produits)

### URL Webservice

Par defaut, l'API est exposee sur:

```
http://localhost/prestashop/api
```

Pour lister les produits:

```
GET /api/products?display=[id,name,price,active]
```

### Authentification

Deux options sont possibles:

- **Basic Auth** (recommande):
  - username = cle webservice
  - password = vide
- **Query param**: `?ws_key=YOUR_KEY`

Le client utilise Basic Auth par defaut.

## Exemple cote Vue

```js
import { fetchResource, normalizeProducts } from './services/prestashopApi'

const load = async () => {
  const { xml, json } = await fetchResource(
    'products',
    { display: '[id,name,price,active]' },
    { baseUrl: 'http://localhost/prestashop/api', apiKey: 'YOUR_KEY' }
  )

  console.log(xml)
  console.log(normalizeProducts(json))
}
```

## Explication des services

### src/services/xml.js

- `parseXmlToJson(xmlString)` transforme le XML en objet JSON.
- Les attributs XML sont ranges dans `@attributes`.
- Le texte est range dans `#text`.

### src/services/prestashopApi.js

- `fetchResource(resource, params, config)` fait l'appel HTTP et retourne:
  - `xml`: la reponse brute
  - `json`: XML converti en JSON
- `normalizeProducts(payload)` normalise la structure pour l'UI.

## Proxy pour eviter les CORS

Si votre navigateur bloque les appels, activez un proxy Vite:

1. Dans `.env`:

```
VITE_PS_BASE_URL=/ps-api
VITE_PS_PROXY_TARGET=http://localhost/prestashop/api
```

2. Redemarrez `npm run dev`.

## Continuer le dev

- Ajoutez de nouveaux endpoints avec `fetchResource('categories', ...)`.
- Creez des fonctions de normalisation par ressource.
- Gardez la logique XML/JSON dans `services/` pour generaliser.

## Objectif perso: CRUD produit

Voici le minimum a connaitre pour creer, lire, mettre a jour et supprimer un produit via l'API Webservice.

### 1) Endpoints principaux

- **Lister**: `GET /api/products?display=[id,name,price,active]`
- **Lire un produit**: `GET /api/products/ID`
- **Creer**: `POST /api/products`
- **Modifier**: `PUT /api/products/ID`
- **Supprimer**: `DELETE /api/products/ID`

### 2) Format XML attendu

PrestaShop attend un XML complet, structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <id><![CDATA[1]]></id>
    <active><![CDATA[1]]></active>
    <price><![CDATA[29.000000]]></price>
    <name>
      <language id="1"><![CDATA[Nom FR]]></language>
      <language id="2"><![CDATA[Name EN]]></language>
    </name>
  </product>
</prestashop>
```

Pour **creer**, le champ `id` n'est pas obligatoire (il sera genere).

### 3) Astuce: recuperer le schema

Avant de faire un `POST`/`PUT`, recupere un XML complet depuis le schema ou un produit existant:

```
GET /api/products?schema=blank
```

Ou:

```
GET /api/products/ID
```

Puis tu modifies les champs utiles et tu renvoies ce XML.

### 4) Exemple d'appel (fetch simple)

```js
const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <active><![CDATA[1]]></active>
    <price><![CDATA[9.90]]></price>
    <name>
      <language id="1"><![CDATA[Test produit]]></language>
    </name>
  </product>
</prestashop>`

const response = await fetch('/ps-api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/xml',
    Accept: 'application/xml',
  },
  body: xmlBody,
})

const xml = await response.text()
```

### 5) Etapes conseillees pour ton CRUD

1. **Read**: afficher le detail d'un produit.
2. **Create**: formulaire minimal (name, price, active).
3. **Update**: modifier ces champs.
4. **Delete**: bouton de suppression.

Quand tu seras pret, on peut generaliser `fetchResource` pour gerer `POST/PUT/DELETE` et l'envoi de XML.

## Mini guide Vue (pour debuter vite)

Cette section suffit pour terminer ce projet si vous n'avez jamais utilise Vue.

### 1) Structure d'un composant (SFC)

Un composant Vue est un fichier `.vue` avec 3 parties:

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'

const count = ref(0)
const double = computed(() => count.value * 2)

onMounted(() => {
  console.log('pret')
})
</script>

<template>
  <button @click="count++">{{ count }} / {{ double }}</button>
</template>

<style scoped>
button { padding: 8px 12px; }
</style>
```

### 2) Donnees reactives

- `ref(value)` cree une valeur reactive. Acces via `maRef.value` en JS.
- Dans le template, pas besoin de `.value`.

```js
const loading = ref(false)
loading.value = true
```

### 3) Conditions et boucles

```vue
<p v-if="loading">Chargement...</p>
<ul>
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>
</ul>
```

### 4) Props (donnees passees a un composant)

```vue
<!-- parent -->
<ProductList :items="products" :loading="loading" />
```

```js
// ProductList.vue
defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
```

### 5) Appels API et cycle de vie

- `onMounted` s'execute apres l'affichage du composant.

```js
onMounted(async () => {
  const { json } = await fetchResource('products', { display: '[id,name]' })
  products.value = normalizeProducts(json)
})
```

### 6) Ou modifier dans ce projet

- UI principale: `src/App.vue`
- Composants UI: `src/components/`
- Appels API: `src/services/prestashopApi.js`
- Conversion XML -> JSON: `src/services/xml.js`

### 7) Exercices rapides (pour s'entrainer)

1. Ajouter un champ de recherche et filtrer la liste dans `App.vue`.
2. Ajouter un bouton "Voir details" par produit.
3. Creer un nouveau service `normalizeCategories` et afficher les categories.
