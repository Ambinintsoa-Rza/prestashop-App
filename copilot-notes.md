# Notes Copilot - prestashop-App (FR)

Ce document explique ce qui a ete ajoute ou modifie, avec une explication simple de chaque fonction et de son utilite.

## 1) Structure de l'app et pages

L'app utilise Vue Router pour afficher plusieurs pages :

- Page login a `/` (par defaut) et alias `/login`
- Page dashboard a `/dashboard` (uniquement apres login)

Fichiers cle :
- src/App.vue : ne fait que rendre `<router-view />`
- src/router/index.js : routes + guard d'auth
- src/pages/AdminLogin.vue : UI et logique login BO
- src/pages/Dashboard.vue : UI principale (produits, import, XML)

## 2) Flux login backoffice (PrestaShop AdminLogin)

### Service utilise
Fichier : src/services/adminAuth.js

Fonctions :
- normalizeBaseUrl(baseUrl)
  - Nettoie le slash final pour construire des URLs stables.
- buildControllerUrl(baseUrl, controller)
  - Construit `/index.php?controller=...` pour le dossier admin.
- buildLoginUrl(baseUrl)
  - Raccourci pour le controller AdminLogin.
- buildDashboardUrl(baseUrl)
  - Raccourci pour le controller AdminDashboard.
- isLoginResponse(response, text)
  - Detecte si la reponse est la page login (header `Login: true` ou marqueurs HTML).
- setAdminSessionCache(value)
  - Garde l'etat de connexion en memoire pour limiter les appels reseau.
- clearAdminSessionCache()
  - Vide le cache de session.
- loginAdmin(baseUrl, options)
  - Envoie un `POST` vers AdminLogin avec `ajax=1` et les champs login.
  - Utilise `credentials: "include"` pour stocker les cookies.
  - Retourne `{ ok, errors?, redirect? }`.
- checkAdminSession(baseUrl, { maxAgeMs, force })
  - Envoie un `GET` vers AdminDashboard.
  - Si la reponse est la page login, la session n'est pas valide.
  - Utilise un cache court pour eviter les appels repetes.

### Page UI
Fichier : src/pages/AdminLogin.vue

Fonctions :
- submit()
  - Appelle `loginAdmin()` et redirige vers `/dashboard` si OK.
- goToApp()
  - Va sur `/dashboard` (si pas logge, le guard renvoie vers `/`).
- openBackoffice()
  - Ouvre l'URL backoffice dans un nouvel onglet (optionnel).

### Router guard
Fichier : src/router/index.js

Logique :
- Route par defaut `/` -> AdminLogin.
- `/dashboard` est protege par `meta.requiresAuth`.
- Guard utilise `checkAdminSession()` :
  - Si pas connecte et acces a `/dashboard` -> redirection vers `/`.
  - Si deja connecte et acces a `/` -> redirection vers `/dashboard`.

### Proxy et env
Fichiers : vite.config.js et .env

Variables :
- VITE_PS_ADMIN_BASE_URL=/ps-admin
- VITE_PS_ADMIN_PROXY_TARGET=http://localhost/prestashop/admin_Ambinintsoa

Ca evite le CORS en dev et permet l'appel login via Vite.

## 3) Dashboard (produits + import)

Fichier : src/pages/Dashboard.vue

Fonctions :
- loadProducts()
  - Appelle `fetchResource('products', ...)` et stocke les resultats.
- startEdit(id), startCreate(), stopEdit()
  - Bascule entre liste et edition/creation.
- handleSaved()
  - Rafraichit la liste apres sauvegarde.
- goLogin()
  - Revient a la page login.

Sections UI :
- Liste produits
- Formulaire edit/create
- Import + reset
- Apercu XML brut

## 4) Aides CRUD produits

### Service API
Fichier : src/services/prestashopApi.js

Fonctions :
- fetchResource(resource, params, config)
  - Envoie un GET avec Basic Auth et retourne `{ xml, json }`.
- sendXmlResource(resource, xmlBody, method, config)
  - Envoie POST/PUT avec XML.
- normalizeProducts(payload)
  - Transforme le XML JSON en liste de produits pour l'UI.
- normalizeProductDetail(payload)
  - Transforme le XML JSON en objet pour edition.

### Parseur XML
Fichier : src/services/xml.js

Fonctions :
- parseXmlToJson(xmlString)
  - Convertit XML -> objet JSON simple.

## 5) Logique formulaire produit

Fichier : src/components/ProductCreate.vue

Helpers :
- loadProductOrSchema()
  - GET produit ou schema=blank et remplit le form.
- buildUpdatedXml()
  - Met a jour le XML avec les valeurs du form.
- updateXmlName(), updateXmlLinkRewrite()
  - Gere les champs multilang.
- ensurePositiveValue(), ensureCategoryPositions()
  - Force les champs requis >= 1.
- removeXmlNode()
  - Supprime les champs interdits en POST/PUT.

## 6) Import + reset

### Composant
Fichier : src/components/DataImport.vue

Fonctions :
- loadResources()
  - Appelle `fetchAllResources()` pour lister les ressources API.
- detectDelimiter(text)
  - Detecte `;` ou `,` dans le CSV.
- handleFile(event)
  - Lit le CSV et lance l'import.
- importMulti(sections)
  - Pour chaque section (resource) et ligne :
    - charge le schema via `fetchSchema()`
    - construit le XML via `buildXmlFromSchema()`
    - POST vers l'endpoint
- fetchAllIds(resource)
  - Recupere tous les IDs (pour reset).
- resetResource()
  - Supprime tous les enregistrements de la ressource.

### Parseur CSV
Fichier : src/utils/csvParser.js

Fonctions :
- parseMultiEntityCsv(text, delimiter)
  - Decoupe un CSV multi-entites par nom de ressource.

### Schema + XML builder
Fichiers : src/utils/psIntrospect.js, src/utils/xmlBuilder.js

Fonctions :
- fetchAllResources(baseUrl, apiKey)
  - GET /api?display=full pour lister les ressources.
- fetchSchema(baseUrl, apiKey, resource)
  - GET /api/{resource}?schema=blank
- buildXmlFromSchema(schemaXml, row, resource)
  - Construit le XML pour chaque ligne CSV.
  - Gere multilang et normalise les decimaux.

## 7) Styles

Fichier : src/style.css

Classes ajoutees :
- .panel.wide, .stack, .block, .danger-zone
- .result-grid, .result-card, .success, .error-list
- styles pour select et progress

## 8) Dependances

Fichier : package.json

Ajoute :
- papaparse (parse CSV)

## 9) Lancer et tester

- npm install
- npm run dev
- Ouvrir `/` pour login
- Apres login : redirection vers `/dashboard`
- Import/Reset via les CSV

## 10) Pourquoi le login marche

Le backoffice utilise le controller AdminLogin :
- Champs POST : email, passwd, submitLogin
- `ajax=1` -> reponse JSON
- Cookies stockes par le navigateur (via `credentials: include`)
- Verif session via `/index.php?controller=AdminDashboard`

## Schemas

### Schema 1: Routing + guard

```mermaid
flowchart TD
  A[Visiteur ouvre /] --> B{Session BO valide ?}
  B -- non --> C[Page Login]
  C --> D[POST AdminLogin ajax=1]
  D --> E[Cookie BO OK]
  E --> F[/dashboard]
  B -- oui --> F
```

### Schema 2: Import CSV

```mermaid
flowchart LR
  CSV[CSV] --> P[parseMultiEntityCsv]
  P --> S[sections resource + rows]
  S --> SC[fetchSchema]
  SC --> X[buildXmlFromSchema]
  X --> API[POST /api/{resource}]
```
