# Appel API PrestaShop (notes techniques)

Ce document explique comment l'API Webservice est appelee et resume les modifications faites dans l'app.

## 1) Flux d'appel API (XML -> JSON)

1. L'UI declenche un appel (liste ou edition).
2. `fetchResource` recupere la reponse XML.
3. `parseXmlToJson` convertit l'XML en JSON.
4. Les fonctions `normalize*` extraient un objet simple pour l'UI.

Fichiers cles:
- [prestashop-App/src/services/prestashopApi.js](prestashop-App/src/services/prestashopApi.js)
- [prestashop-App/src/services/xml.js](prestashop-App/src/services/xml.js)

### Fonctions ajoutees et ou elles sont appelees

#### `fetchResource(resource, params, config)`

**Utilite:** effectue un GET, recupere le XML et le convertit en JSON.

**Extrait:**

```js
export const fetchResource = async (resource, params, config = {}) => {
	const url = `${joinUrl(baseUrl, resource)}${buildQuery(finalParams)}`
	const headers = {
		Accept: 'application/xml',
		...buildAuthHeaders(apiKey, useQueryKey),
	}
	const response = await fetch(url, { headers })
	const xml = await response.text()
	const json = parseXmlToJson(xml)
	return { xml, json }
}
```

**Ou appelee:**
- [prestashop-App/src/App.vue](prestashop-App/src/App.vue) dans `loadProducts()`
- [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue) dans `loadProduct()`

#### `sendXmlResource(resource, xmlBody, method, config)`

**Utilite:** envoie un XML (POST/PUT) vers l'API.

**Extrait:**

```js
export const sendXmlResource = async (resource, xmlBody, method, config = {}) => {
	const url = joinUrl(baseUrl, resource)
	const headers = {
		Accept: 'application/xml',
		'Content-Type': 'application/xml',
		...buildAuthHeaders(apiKey, useQueryKey),
	}
	const response = await fetch(url, { method, headers, body: xmlBody })
	const xml = await response.text()
	const json = xml ? parseXmlToJson(xml) : null
	return { xml, json }
}
```

**Ou appelee:**
- [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue) dans `saveProduct()`

**Note debug:** en cas d'erreur HTTP, la reponse XML est incluse dans le message pour comprendre le probleme.

#### `normalizeProducts(payload)`

**Utilite:** transforme la reponse de liste en tableau simple pour l'UI.

**Extrait:**

```js
export const normalizeProducts = (payload) => {
	const raw = payload?.prestashop?.products?.product
	const list = Array.isArray(raw) ? raw : [raw]
	return list.map((item) => ({
		id: pickText(item.id),
		name: pickLanguageValue(item.name),
		price: pickText(item.price),
		active: pickText(item.active) === '1',
	}))
}
```

**Ou appelee:**
- [prestashop-App/src/App.vue](prestashop-App/src/App.vue) dans `loadProducts()`

#### `normalizeProductDetail(payload)`

**Utilite:** transforme la reponse d'un produit en objet editable.

**Extrait:**

```js
export const normalizeProductDetail = (payload) => {
	const product = payload?.prestashop?.product
	return {
		id: pickText(product.id),
		name: pickLanguageValue(product.name),
		price: pickText(product.price),
		active: pickText(product.active) === '1',
		languageId: pickLanguageId(product.name),
		linkRewrite: pickLanguageValue(product.link_rewrite),
		categoryId: pickText(product.id_category_default),
		taxRulesGroupId: pickText(product.id_tax_rules_group),
	}
}
```

**Ou appelee:**
- [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue) dans `loadProduct()`

#### `parseXmlToJson(xmlString)`

**Utilite:** convertit l'XML en objet JSON (en gardant les attributs et le texte).

**Extrait:**

```js
export const parseXmlToJson = (xmlString) => {
	const document = parser.parseFromString(xmlString, 'application/xml')
	return { [root.nodeName]: elementToObject(root) }
}
```

**Ou appelee:**
- [prestashop-App/src/services/prestashopApi.js](prestashop-App/src/services/prestashopApi.js) dans `fetchResource()` et `sendXmlResource()`

## 2) Appel API en lecture (GET)

Exemple liste:

```
GET /api/products?display=[id,name,price,active]
```

Implementation:
- `fetchResource('products', { display: '[id,name,price,active]' }, config)`
- `normalizeProducts(json)` pour la liste

Fichiers:
- [prestashop-App/src/services/prestashopApi.js](prestashop-App/src/services/prestashopApi.js)
- [prestashop-App/src/App.vue](prestashop-App/src/App.vue)

## 3) Appel API en edition (PUT)

Etapes:

1. Chargement du XML complet d'un produit: `GET /api/products/ID`
2. Modification locale du XML (price, active, name)
3. Envoi via `PUT /api/products/ID`

Implementation:
- `fetchResource('products/ID', {}, config)` pour charger
- `sendXmlResource('products/ID', xmlBody, 'PUT', config)` pour mettre a jour

Fichiers:
- [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue)
- [prestashop-App/src/services/prestashopApi.js](prestashop-App/src/services/prestashopApi.js)

### Fonctions internes d'edition (dans ProductCreate.vue)

#### `loadProduct()`

**Utilite:** charge le XML du produit et remplit le formulaire.

**Extrait:**

```js
const { xml, json } = await fetchResource(`products/${props.productId}`, {}, { baseUrl, apiKey })
productXml.value = xml
const detail = normalizeProductDetail(json)
form.value = { name: detail.name, price: detail.price, active: detail.active, languageId: detail.languageId }
```

#### `buildUpdatedXml()`

**Utilite:** modifie le XML charge avec les valeurs du formulaire.

**Extrait:**

```js
updateXmlValue(doc, 'product > price', String(form.value.price))
updateXmlValue(doc, 'product > active', form.value.active ? '1' : '0')
updateXmlName(doc, form.value.name, form.value.languageId)
return new XMLSerializer().serializeToString(doc)
```

#### `saveProduct()`

**Utilite:** envoie le XML modifie au serveur.

**Extrait:**

```js
const xmlBody = buildUpdatedXml()
await sendXmlResource(`products/${props.productId}`, xmlBody, 'PUT', { baseUrl, apiKey })
```

**Note validation:** PrestaShop refuse un `position` a 0 ou negatif. Le code force `position >= 1`.
**Note champs non modifiables:** certains champs comme `manufacturer_name`, `date_add`, `date_upd`, `quantity` doivent etre supprimes du XML avant `POST/PUT`.

## 4) Gestion des CDATA

PrestaShop renvoie souvent les valeurs dans des blocs CDATA, donc le parser XML doit les lire comme du texte.

Modification:
- Ajout de la prise en charge de `CDATA_SECTION_NODE` dans le parseur.

Fichier:
- [prestashop-App/src/services/xml.js](prestashop-App/src/services/xml.js)

## 5) CORS et proxy Vite

Pour eviter le CORS en dev:

- Utiliser `VITE_PS_BASE_URL=/ps-api`
- Configurer un proxy vers `http://localhost/prestashop/api`

Fichier:
- [prestashop-App/vite.config.js](prestashop-App/vite.config.js)

## 6) UI et navigation d'edition

Ce qui a ete mis en place:

- Liste des produits avec un bouton "Modifier"
- Vue d'edition qui charge le produit, affiche un formulaire, puis envoie un PUT
- Rafraichissement de la liste apres sauvegarde

Fichiers:
- [prestashop-App/src/components/ProductList.vue](prestashop-App/src/components/ProductList.vue)
- [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue)
- [prestashop-App/src/App.vue](prestashop-App/src/App.vue)
- [prestashop-App/src/style.css](prestashop-App/src/style.css)
