# Creation produit (notes techniques)

Ce document explique comment la creation de produit est faite et quelles fonctions sont utilisees.

## 1) API utilisee

- **Schema vide:** `GET /api/products?schema=blank`
- **Creation:** `POST /api/products`

Pourquoi `schema=blank` ? PrestaShop attend un XML complet. Le schema fournit la structure correcte, puis on remplit les champs utiles (name, price, active, link_rewrite, id_category_default, id_tax_rules_group).
Note: la validation exige aussi `position >= 1`, donc on force une valeur valide si besoin.
Dans certains schemas, la position se trouve aussi dans `associations > categories > category > position`, on force aussi cette valeur.
Certains champs ne sont pas modifiables (ex: `manufacturer_name`, `date_add`, `date_upd`, `quantity`). Ils sont supprimes du XML avant l'envoi.

## 2) Fonctions et utilite

### `loadProductOrSchema()`

**Ou:** [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue)

**Utilite:** charge soit un produit existant (edition), soit le schema vide (creation).

```js
const resource = isCreate.value ? 'products' : `products/${props.productId}`
const params = isCreate.value ? { schema: 'blank' } : {}
const { xml, json } = await fetchResource(resource, params, { baseUrl, apiKey })
```

### `buildUpdatedXml()`

**Ou:** [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue)

**Utilite:** modifie le XML charge avec les valeurs du formulaire.

```js
updateXmlValue(doc, 'product > price', String(form.value.price))
updateXmlValue(doc, 'product > active', form.value.active ? '1' : '0')
updateXmlName(doc, form.value.name, form.value.languageId)
updateXmlValue(doc, 'product > id_category_default', String(form.value.categoryId))
updateXmlValue(doc, 'product > id_tax_rules_group', String(form.value.taxRulesGroupId))
updateXmlLinkRewrite(doc, rewrite, form.value.languageId)
ensurePositiveValue(doc, 'product > position', '1')
removeXmlNode(doc, 'product > id')
```

### `sendXmlResource()`

**Ou:** [prestashop-App/src/services/prestashopApi.js](prestashop-App/src/services/prestashopApi.js)

**Utilite:** envoie un XML via `POST` ou `PUT`.

```js
await sendXmlResource('products', xmlBody, 'POST', { baseUrl, apiKey })
```

## 3) Interface creation

- Bouton **Nouveau produit** dans la page liste.
- Formulaire commun a l'edition/creation.
- En mode creation, le bouton principal envoie un `POST`.
- Champs requis ajoutes: `link_rewrite`, `id_category_default`, `id_tax_rules_group`.

Fichiers:
- [prestashop-App/src/App.vue](prestashop-App/src/App.vue)
- [prestashop-App/src/components/ProductCreate.vue](prestashop-App/src/components/ProductCreate.vue)

## 4) Flux complet

1. Click sur **Nouveau produit**.
2. `loadProductOrSchema()` charge `schema=blank`.
3. L'utilisateur remplit le formulaire.
4. `buildUpdatedXml()` construit le XML final.
5. `sendXmlResource()` envoie un `POST`.
6. La liste est rechargee.
