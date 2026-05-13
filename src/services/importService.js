import Papa from 'papaparse'
import { fetchResource, sendXmlResource } from './prestashopApi'

const env = {
  baseUrl: import.meta.env.VITE_PS_BASE_URL || '/ps-api',
  apiKey: import.meta.env.VITE_PS_WS_KEY || '',
  orderModule: import.meta.env.VITE_IMPORT_ORDER_MODULE || 'ps_checkpayment',
  orderPaymentLabel: import.meta.env.VITE_IMPORT_PAYMENT_LABEL || 'Import',
}

const parseCsvText = (text, delimiter = ';') => {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter })
  return res.data
}

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^"|"$/g, '')

const normalizeName = (value) =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const normalizePrice = (value) => {
  const text = normalizeText(value)
  return text ? text.replace(',', '.') : ''
}

const normalizeDate = (value) => {
  const text = normalizeText(value)
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text
}

const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const getText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value['#text'] || ''
}

const getLanguageValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  const language = value.language
  if (!language) return getText(value)
  const list = Array.isArray(language) ? language : [language]
  return getText(list[0])
}

const extractList = (payload, rootKey, itemKey) => {
  const root = payload?.prestashop?.[rootKey]?.[itemKey]
  if (!root) return []
  return Array.isArray(root) ? root : [root]
}

const defaultIdFromList = (items) => getText(items[0]?.id) || ''

const findByNormalizedName = (items, wantedName) => {
  const target = normalizeName(wantedName)
  if (!target) return null
  return (
    items.find((item) => normalizeName(getLanguageValue(item.name) || getText(item.name)) === target) || null
  )
}

const buildMultilangNode = (tag, value) => `<${tag}><language id="1">${xmlEscape(value)}</language></${tag}>`

const parseAchatList = (value) => {
  const text = normalizeText(value)
  if (!text) return []

  const items = []
  const regex = /\(\s*"*([^";]+?)"*\s*;\s*(\d+)\s*;\s*"*(.*?)"*\s*\)/g
  let match
  while ((match = regex.exec(text))) {
    items.push({
      reference: normalizeText(match[1]),
      quantity: Number.parseInt(match[2], 10) || 0,
      variant: normalizeText(match[3]),
    })
  }
  return items
}

const buildProductXml = (row, categoryId, productId) => {
  const price = normalizePrice(row.prix_ttc || row.prix_vente_ttc)
  const wholesalePrice = normalizePrice(row.prix_achat)
  const name = normalizeText(row.nom)
  const reference = normalizeText(row.reference)
  const availableDate = normalizeDate(row.date_availability_produit)
  const linkRewrite = slugify(name) || slugify(reference)

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    ${productId ? `<id>${xmlEscape(productId)}</id>` : ''}
    ${buildMultilangNode('name', name)}
    ${buildMultilangNode('link_rewrite', linkRewrite)}
    <price>${xmlEscape(price)}</price>
    <wholesale_price>${xmlEscape(wholesalePrice)}</wholesale_price>
    <reference>${xmlEscape(reference)}</reference>
    <active>1</active>
    <available_for_order>1</available_for_order>
    <show_price>1</show_price>
    <id_category_default>${xmlEscape(categoryId || 2)}</id_category_default>
    ${availableDate ? `<available_date>${xmlEscape(availableDate)}</available_date>` : ''}
    <associations>
      <categories>
        <category><id>${xmlEscape(categoryId || 2)}</id></category>
      </categories>
    </associations>
  </product>
</prestashop>`
}

const buildCategoryXml = (name, parentId) => {
  const slug = slugify(name) || 'category'
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <id_parent>${xmlEscape(parentId)}</id_parent>
    <active>1</active>
    ${buildMultilangNode('name', name)}
    ${buildMultilangNode('link_rewrite', slug)}
  </category>
</prestashop>`
}

const buildProductOptionXml = (groupName) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <group_type>select</group_type>
    ${buildMultilangNode('name', groupName)}
    ${buildMultilangNode('public_name', groupName)}
  </product_option>
</prestashop>`

const buildProductOptionValueXml = (groupId, value) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group>${xmlEscape(groupId)}</id_attribute_group>
    ${buildMultilangNode('name', value)}
  </product_option_value>
</prestashop>`

const buildCombinationXml = ({ productId, reference, valueId, priceImpact, availableDate }) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product>${xmlEscape(productId)}</id_product>
    <reference>${xmlEscape(reference)}</reference>
    <price>${xmlEscape(priceImpact || '0')}</price>
    <wholesale_price>0</wholesale_price>
    <minimal_quantity>1</minimal_quantity>
    ${availableDate ? `<available_date>${xmlEscape(availableDate)}</available_date>` : ''}
    <associations>
      <product_option_values>
        <product_option_value>
          <id>${xmlEscape(valueId)}</id>
        </product_option_value>
      </product_option_values>
    </associations>
  </combination>
</prestashop>`

const buildCustomerXml = (row, password) => {
  const name = normalizeText(row.nom || 'Client')
  const parts = name.split(/\s+/).filter(Boolean)
  const firstname = parts[0] || 'Client'
  const lastname = parts.slice(1).join(' ') || parts[0] || 'Client'

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <id_gender>0</id_gender>
    <firstname>${xmlEscape(firstname)}</firstname>
    <lastname>${xmlEscape(lastname)}</lastname>
    <email>${xmlEscape(normalizeText(row.email))}</email>
    <passwd>${xmlEscape(password)}</passwd>
    <active>1</active>
    <newsletter>0</newsletter>
    <optin>0</optin>
  </customer>
</prestashop>`
}

const buildAddressXml = (row, customerId, countryId) => {
  const name = normalizeText(row.nom || 'Client')
  const parts = name.split(/\s+/).filter(Boolean)
  const firstname = parts[0] || 'Client'
  const lastname = parts.slice(1).join(' ') || parts[0] || 'Client'
  const alias = `Import ${normalizeText(row.email || customerId).replace(/\s+/g, '-') || customerId}`.slice(0, 32)

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <id_customer>${xmlEscape(customerId)}</id_customer>
    <id_country>${xmlEscape(countryId)}</id_country>
    <alias>${xmlEscape(alias)}</alias>
    <firstname>${xmlEscape(firstname)}</firstname>
    <lastname>${xmlEscape(lastname)}</lastname>
    <address1>${xmlEscape(normalizeText(row.adresse || 'Adresse importee'))}</address1>
    <city>Import</city>
    <postcode>00000</postcode>
  </address>
</prestashop>`
}

const buildCartXml = ({ customerId, addressId, currencyId, langId, rows }) => {
  const rowsXml = rows
    .map(
      (item) => `
        <cart_row>
          <id_product>${xmlEscape(item.productId)}</id_product>
          <id_product_attribute>${xmlEscape(item.productAttributeId || 0)}</id_product_attribute>
          <id_address_delivery>${xmlEscape(addressId)}</id_address_delivery>
          <quantity>${xmlEscape(item.quantity)}</quantity>
        </cart_row>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_customer>${xmlEscape(customerId)}</id_customer>
    <id_address_delivery>${xmlEscape(addressId)}</id_address_delivery>
    <id_address_invoice>${xmlEscape(addressId)}</id_address_invoice>
    <id_currency>${xmlEscape(currencyId)}</id_currency>
    <id_lang>${xmlEscape(langId)}</id_lang>
    <id_carrier>1</id_carrier>
    <secure_key>-1</secure_key>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <allow_seperated_package>0</allow_seperated_package>
    <associations>
      <cart_rows>${rowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`
}

const buildOrderXml = ({ row, customerId, addressId, cartId, currencyId, langId, carrierId, stateId, total }) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery>${xmlEscape(addressId)}</id_address_delivery>
    <id_address_invoice>${xmlEscape(addressId)}</id_address_invoice>
    <id_cart>${xmlEscape(cartId)}</id_cart>
    <id_currency>${xmlEscape(currencyId)}</id_currency>
    <id_lang>${xmlEscape(langId)}</id_lang>
    <id_customer>${xmlEscape(customerId)}</id_customer>
    <id_carrier>${xmlEscape(carrierId)}</id_carrier>
    <current_state>${xmlEscape(stateId)}</current_state>
    <secure_key>-1</secure_key>
    <payment>${xmlEscape(normalizeText(row.etat || env.orderPaymentLabel))}</payment>
    <module>${xmlEscape(env.orderModule)}</module>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <total_discounts>0</total_discounts>
    <total_discounts_tax_incl>0</total_discounts_tax_incl>
    <total_discounts_tax_excl>0</total_discounts_tax_excl>
    <total_paid>${xmlEscape(total)}</total_paid>
    <total_paid_tax_incl>${xmlEscape(total)}</total_paid_tax_incl>
    <total_paid_tax_excl>${xmlEscape(total)}</total_paid_tax_excl>
    <total_paid_real>${xmlEscape(total)}</total_paid_real>
    <total_products>${xmlEscape(total)}</total_products>
    <total_products_wt>${xmlEscape(total)}</total_products_wt>
    <total_shipping>0</total_shipping>
    <total_shipping_tax_incl>0</total_shipping_tax_incl>
    <total_shipping_tax_excl>0</total_shipping_tax_excl>
    <carrier_tax_rate>0</carrier_tax_rate>
    <conversion_rate>1</conversion_rate>
    <valid>1</valid>
  </order>
</prestashop>`
}

const buildOrderDetailXml = ({
  orderId,
  shopId,
  warehouseId,
  productId,
  productAttributeId,
  quantity,
  unitPrice,
  productName,
  productReference,
}) => {
  const total = (unitPrice * quantity).toFixed(2)
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_detail>
    <id_order>${xmlEscape(orderId)}</id_order>
    <id_shop>${xmlEscape(shopId)}</id_shop>
    <id_warehouse>${xmlEscape(warehouseId)}</id_warehouse>
    <product_id>${xmlEscape(productId)}</product_id>
    <product_attribute_id>${xmlEscape(productAttributeId || 0)}</product_attribute_id>
    <product_name>${xmlEscape(productName)}</product_name>
    <product_quantity>${xmlEscape(quantity)}</product_quantity>
    <product_quantity_in_stock>${xmlEscape(quantity)}</product_quantity_in_stock>
    <product_price>${xmlEscape(unitPrice.toFixed(2))}</product_price>
    <unit_price_tax_incl>${xmlEscape(unitPrice.toFixed(2))}</unit_price_tax_incl>
    <unit_price_tax_excl>${xmlEscape(unitPrice.toFixed(2))}</unit_price_tax_excl>
    <total_price_tax_incl>${xmlEscape(total)}</total_price_tax_incl>
    <total_price_tax_excl>${xmlEscape(total)}</total_price_tax_excl>
    <product_reference>${xmlEscape(productReference)}</product_reference>
  </order_detail>
</prestashop>`
}

const buildOrderHistoryXml = (orderId, stateId) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order>${xmlEscape(orderId)}</id_order>
    <id_order_state>${xmlEscape(stateId)}</id_order_state>
  </order_history>
</prestashop>`

const resolveProductPrice = (productRow, stockRow) => {
  const stockPrice = normalizePrice(stockRow?.prix_vente_ttc)
  if (stockPrice) return stockPrice
  return normalizePrice(productRow?.prix_ttc)
}

const resolveProductCategory = (productRow) => normalizeText(productRow?.categorie)

const parseAllowedOrderStates = (stateItems) => {
  const normalized = stateItems.map((state) => ({
    id: getText(state.id),
    name: normalizeName(getLanguageValue(state.name) || getText(state.name)),
  }))

  const findStateId = (aliases) => {
    const wanted = aliases.map(normalizeName)
    return normalized.find((state) => wanted.includes(state.name))?.id || ''
  }

  return {
    payment_failed: findStateId(['echec paiement', 'echec de paiement', 'erreur de paiement', 'paiement en erreur', 'payment failed', 'payment error']),
    payment_done: findStateId(['paiement effectue', 'paiement accepte', 'payment accepted', 'paid']),
    canceled: findStateId(['annule', 'annulee', 'cancelled', 'canceled', 'annulation']),
  }
}

const parseRowState = (row, orderStateMap) => {
  const stateName = normalizeName(row.etat)
  if (!stateName) return orderStateMap.payment_done || orderStateMap.payment_failed || orderStateMap.canceled || ''
  if (stateName.includes('echec') || stateName.includes('erreur')) return orderStateMap.payment_failed || ''
  if (stateName.includes('annul')) return orderStateMap.canceled || ''
  if (stateName.includes('accepte') || stateName.includes('paye') || stateName.includes('effectue')) {
    return orderStateMap.payment_done || ''
  }
  return orderStateMap.payment_done || orderStateMap.payment_failed || orderStateMap.canceled || ''
}

export const parseFiles = async (files) => {
  const readFile = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = (error) => reject(error)
      reader.readAsText(file, 'utf-8')
    })

  const [produitText, stockText, commandeText] = await Promise.all([
    readFile(files.produit),
    readFile(files.stock),
    readFile(files.commande),
  ])

  const products = produitText ? parseCsvText(produitText, ';') : []
  const stock = stockText ? parseCsvText(stockText, ';') : []
  const orders = commandeText ? parseCsvText(commandeText, ';') : []

  return {
    products: products.map((row) => ({
      ...row,
      date_availability_produit: normalizeDate(row.date_availability_produit),
      prix_ttc: normalizePrice(row.prix_ttc),
      prix_achat: normalizePrice(row.prix_achat),
      categorie: normalizeText(row.categorie),
      nom: normalizeText(row.nom),
      reference: normalizeText(row.reference),
    })),
    stock: stock.map((row) => ({
      ...row,
      reference: normalizeText(row.reference),
      specificité: normalizeText(row.specificité || row['specificité']),
      karazany: normalizeText(row.karazany),
      stock_initial: Number.parseInt(normalizeText(row.stock_initial), 10) || 0,
      prix_vente_ttc: normalizePrice(row.prix_vente_ttc),
    })),
    orders: orders.map((row) => ({
      ...row,
      date: normalizeDate(row.date),
      nom: normalizeText(row.nom),
      email: normalizeText(row.email),
      pwd: normalizeText(row.pwd),
      adresse: normalizeText(row.adresse),
      achat: parseAchatList(row.achat),
      etat: normalizeText(row.etat),
    })),
  }
}

export const runImport = async (parsed, imageFiles = [], options = {}) => {
  const logs = []
  const cfg = { baseUrl: env.baseUrl, apiKey: env.apiKey }

  const load = async (resource, display) => {
    const { json } = await fetchResource(resource, { display }, cfg)
    return json
  }

  const categoriesPayload = await load('categories', '[id,name,id_parent,active]')
  const countriesPayload = await load('countries', '[id,name,iso_code,active]')
  const currenciesPayload = await load('currencies', '[id,name,active]')
  const languagesPayload = await load('languages', '[id,name,active]')
  const carriersPayload = await load('carriers', '[id,name,active]')
  const shopsPayload = await load('shops', '[id,name,active]')
  const warehousesPayload = await load('warehouses', '[id,name,active]')
  const orderStatesPayload = await load('order_states', '[id,name]')
  const productsPayload = await load('products', '[id,reference,name,id_category_default,price,active]')

  const categoryItems = extractList(categoriesPayload, 'categories', 'category')
  const countryItems = extractList(countriesPayload, 'countries', 'country')
  const currencyItems = extractList(currenciesPayload, 'currencies', 'currency')
  const languageItems = extractList(languagesPayload, 'languages', 'language')
  const carrierItems = extractList(carriersPayload, 'carriers', 'carrier')
  const shopItems = extractList(shopsPayload, 'shops', 'shop')
  const warehouseItems = extractList(warehousesPayload, 'warehouses', 'warehouse')
  const orderStateItems = extractList(orderStatesPayload, 'order_states', 'order_state')
  const existingProducts = extractList(productsPayload, 'products', 'product')

  const defaultLanguageId = defaultIdFromList(languageItems) || '1'
  const defaultCurrencyId = defaultIdFromList(currencyItems) || '1'
  const defaultCountryId = defaultIdFromList(countryItems) || '1'
  const defaultCarrierId = defaultIdFromList(carrierItems) || '1'
  const defaultShopId = defaultIdFromList(shopItems) || '1'
  const defaultWarehouseId = defaultIdFromList(warehouseItems) || '1'
  const categoryFallbackId = getText(findByNormalizedName(categoryItems, 'home')?.id) || defaultIdFromList(categoryItems) || '2'
  const allowedOrderStateIds = parseAllowedOrderStates(orderStateItems)

  const categoryNameToId = new Map()
  for (const category of categoryItems) {
    const id = getText(category.id)
    const name = getLanguageValue(category.name)
    if (id && name) categoryNameToId.set(normalizeName(name), id)
  }

  const productRefToExistingId = new Map()
  for (const product of existingProducts) {
    const ref = normalizeText(getText(product.reference))
    const id = getText(product.id)
    if (ref && id) productRefToExistingId.set(ref, id)
  }

  const productRefToId = new Map()
  const groupNameToId = new Map()
  const valueKeyToId = new Map()
  const combinationKeyToId = new Map()
  const customerEmailToId = new Map()
  const addressKeyToId = new Map()
  const cartKeyToId = new Map()

  if (!warehouseItems.length) {
    logs.push('Aucun warehouse detecte: la creation des details de commande peut echouer.')
  }

  const ensureCategoryId = async (categoryName, allowCreate) => {
    const normalized = normalizeName(categoryName)
    if (!normalized) return categoryFallbackId
    if (categoryNameToId.has(normalized)) return categoryNameToId.get(normalized)

    const category = findByNormalizedName(categoryItems, categoryName)
    if (category?.id) {
      const id = getText(category.id)
      categoryNameToId.set(normalized, id)
      return id
    }

    if (!allowCreate) {
      logs.push(`Categorie inconnue '${categoryName}', categorie par defaut utilisee.`)
      return categoryFallbackId
    }

    try {
      const created = await sendXmlResource('categories', buildCategoryXml(categoryName, categoryFallbackId), 'POST', cfg)
      const id = getText(created?.json?.prestashop?.category?.id)
      if (id) {
        categoryNameToId.set(normalized, id)
        logs.push(`Categorie creee: ${categoryName} (${id})`)
        return id
      }
    } catch (error) {
      logs.push(`Categorie ${categoryName} error: ${error.message}`)
    }

    logs.push(`Categorie inconnue '${categoryName}', categorie par defaut utilisee.`)
    return categoryFallbackId
  }

  const ensureProduct = async (row, allowCreate) => {
    const reference = normalizeText(row.reference)
    const categoryId = await ensureCategoryId(resolveProductCategory(row), allowCreate)
    const existingId = productRefToExistingId.get(reference)

    if (existingId) {
      const xml = buildProductXml(row, categoryId, existingId)
      await sendXmlResource(`products/${existingId}`, xml, 'PUT', cfg)
      productRefToId.set(reference, existingId)
      logs.push(`Produit mis a jour: ${reference} (${existingId})`)
      return existingId
    }

    if (!allowCreate) {
      logs.push(`Produit ignore (creation desactivee): ${reference}`)
      return ''
    }

    const xml = buildProductXml(row, categoryId, '')
    const created = await sendXmlResource('products', xml, 'POST', cfg)
    const productId = getText(created?.json?.prestashop?.product?.id)
    if (productId) {
      productRefToId.set(reference, productId)
      productRefToExistingId.set(reference, productId)
    }
    logs.push(`Produit cree: ${reference} (${productId || 'sans id'})`)
    return productId
  }

  const ensureAttributeGroup = async (groupName) => {
    const normalized = normalizeName(groupName)
    if (!normalized) return ''
    if (groupNameToId.has(normalized)) return groupNameToId.get(normalized)

    const payload = await load('product_options', 'full')
    const groups = extractList(payload, 'product_options', 'product_option')
    const existing = groups.find((group) => normalizeName(getLanguageValue(group.name)) === normalized)
    if (existing?.id) {
      const id = getText(existing.id)
      groupNameToId.set(normalized, id)
      return id
    }

    const created = await sendXmlResource('product_options', buildProductOptionXml(groupName), 'POST', cfg)
    const id = getText(created?.json?.prestashop?.product_option?.id)
    if (id) groupNameToId.set(normalized, id)
    return id
  }

  const ensureAttributeValue = async (groupId, value) => {
    const key = `${groupId}::${normalizeName(value)}`
    if (valueKeyToId.has(key)) return valueKeyToId.get(key)

    const payload = await load('product_option_values', 'full')
    const values = extractList(payload, 'product_option_values', 'product_option_value')
    const existing = values.find(
      (item) => getText(item.id_attribute_group) === String(groupId) && normalizeName(getLanguageValue(item.name)) === normalizeName(value)
    )
    if (existing?.id) {
      const id = getText(existing.id)
      valueKeyToId.set(key, id)
      return id
    }

    const created = await sendXmlResource('product_option_values', buildProductOptionValueXml(groupId, value), 'POST', cfg)
    const id = getText(created?.json?.prestashop?.product_option_value?.id)
    if (id) valueKeyToId.set(key, id)
    return id
  }

  const ensureCombination = async (productId, productRef, stockRow, productRow) => {
    const groupName = normalizeText(stockRow.specificité)
    const valueName = normalizeText(stockRow.karazany)
    if (!groupName || !valueName) return ''

    const comboKey = `${productRef}::${groupName}::${valueName}`
    if (combinationKeyToId.has(comboKey)) return combinationKeyToId.get(comboKey)

    const groupId = await ensureAttributeGroup(groupName)
    if (!groupId) return ''

    const valueId = await ensureAttributeValue(groupId, valueName)
    if (!valueId) return ''

    const existingCombos = await fetchResource(
      'combinations',
      { display: 'full', 'filter[id_product]': `[${productId}]` },
      cfg
    )
    const combos = extractList(existingCombos.json, 'combinations', 'combination')
    const found = combos.find((combo) => {
      const optionValues = combo.associations?.product_option_values?.product_option_value
      const list = Array.isArray(optionValues) ? optionValues : optionValues ? [optionValues] : []
      return list.some((entry) => getText(entry.id) === String(valueId))
    })
    if (found?.id) {
      const id = getText(found.id)
      combinationKeyToId.set(comboKey, id)
      return id
    }

    const created = await sendXmlResource(
      'combinations',
      buildCombinationXml({
        productId,
        reference: `${productRef}-${valueName}`,
        valueId,
        priceImpact: normalizePrice(stockRow.prix_vente_ttc || '0'),
        availableDate: normalizeDate(productRow?.date_availability_produit),
      }),
      'POST',
      cfg
    )
    const id = getText(created?.json?.prestashop?.combination?.id)
    if (id) combinationKeyToId.set(comboKey, id)
    return id
  }

  const updateStockAvailable = async (productId, combinationId, quantity) => {
    const payload = await fetchResource(
      'stock_availables',
      {
        display: 'full',
        'filter[id_product]': `[${productId}]`,
        'filter[id_product_attribute]': `[${combinationId || 0}]`,
      },
      cfg
    )

    const stockItems = extractList(payload.json, 'stock_availables', 'stock_available')
    const stockId = getText(stockItems[0]?.id)
    if (!stockId) {
      logs.push(`Stock non trouve pour produit ${productId} / attr ${combinationId || 0}`)
      return
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id_product>${xmlEscape(productId)}</id_product>
    <id_product_attribute>${xmlEscape(combinationId || 0)}</id_product_attribute>
    <quantity>${xmlEscape(quantity)}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>2</out_of_stock>
  </stock_available>
</prestashop>`

    await sendXmlResource(`stock_availables/${stockId}`, xml, 'PUT', cfg)
  }

  const findCustomerByEmail = async (email) => {
    if (customerEmailToId.has(email)) return customerEmailToId.get(email)

    const payload = await fetchResource('customers', { display: 'full', 'filter[email]': `[${email}]` }, cfg)
    const customers = extractList(payload.json, 'customers', 'customer')
    const existing = customers[0]
    if (existing?.id) {
      const id = getText(existing.id)
      customerEmailToId.set(email, id)
      return id
    }

    return ''
  }

  const ensureCustomer = async (row) => {
    const email = normalizeText(row.email)
    const existingId = await findCustomerByEmail(email)
    if (existingId) return existingId

    const created = await sendXmlResource('customers', buildCustomerXml(row, row.pwd || 'Import123!'), 'POST', cfg)
    const id = getText(created?.json?.prestashop?.customer?.id)
    if (id) customerEmailToId.set(email, id)
    logs.push(`Client cree: ${email} (${id || 'sans id'})`)
    return id
  }

  const ensureAddress = async (row, customerId) => {
    const key = `${normalizeText(row.email)}::${normalizeText(row.adresse)}`
    if (addressKeyToId.has(key)) return addressKeyToId.get(key)

    const created = await sendXmlResource('addresses', buildAddressXml(row, customerId, defaultCountryId), 'POST', cfg)
    const id = getText(created?.json?.prestashop?.address?.id)
    if (id) addressKeyToId.set(key, id)
    logs.push(`Adresse creee: ${normalizeText(row.email)} (${id || 'sans id'})`)
    return id
  }

  const ensureCart = async (row, customerId, addressId, currencyId, langId, rows) => {
    const key = `${normalizeText(row.email)}::${normalizeText(row.date)}::${rows
      .map((item) => `${item.productId}:${item.productAttributeId}:${item.quantity}`)
      .join('|')}`
    if (cartKeyToId.has(key)) return cartKeyToId.get(key)

    const created = await sendXmlResource(
      'carts',
      buildCartXml({ customerId, addressId, currencyId, langId, rows }),
      'POST',
      cfg
    )
    const id = getText(created?.json?.prestashop?.cart?.id)
    if (id) cartKeyToId.set(key, id)
    return id
  }

  const ensureOrder = async (row, customerId, addressId, cartId, currencyId, langId, carrierId, stateId, total) => {
    const created = await sendXmlResource(
      'orders',
      buildOrderXml({
        row,
        customerId,
        addressId,
        cartId,
        currencyId,
        langId,
        carrierId,
        stateId,
        total,
      }),
      'POST',
      cfg
    )
    return getText(created?.json?.prestashop?.order?.id)
  }

  const applyOrderState = async (orderId, stateId) => {
    if (!orderId || !stateId) return
    await sendXmlResource('order_histories', buildOrderHistoryXml(orderId, stateId), 'POST', cfg)
  }

  for (const productRow of parsed.products || []) {
    try {
      await ensureProduct(productRow, options.autoCreateProducts !== false)
    } catch (error) {
      logs.push(`Produit ${productRow.reference} error: ${error.message}`)
    }
  }

  for (const stockRow of parsed.stock || []) {
    try {
      const reference = normalizeText(stockRow.reference)
      const productId = productRefToId.get(reference)
      if (!productId) {
        logs.push(`Stock: produit introuvable pour ${reference}`)
        continue
      }

      const productRow = (parsed.products || []).find((item) => normalizeText(item.reference) === reference)
      const hasCombination = options.createCombinations && normalizeText(stockRow.specificité) && normalizeText(stockRow.karazany)
      const combinationId = hasCombination ? await ensureCombination(productId, reference, stockRow, productRow) : 0

      await updateStockAvailable(productId, combinationId, stockRow.stock_initial)
      logs.push(
        hasCombination
          ? `Stock declinaison mis a jour: ${reference} / ${stockRow.karazany} = ${stockRow.stock_initial}`
          : `Stock produit mis a jour: ${reference} = ${stockRow.stock_initial}`
      )
    } catch (error) {
      logs.push(`Stock ${stockRow.reference} error: ${error.message}`)
    }
  }

  for (const orderRow of parsed.orders || []) {
    try {
      const customerId = await ensureCustomer(orderRow)
      const addressId = await ensureAddress(orderRow, customerId)
      const orderRows = []
      let total = 0

      for (const item of orderRow.achat || []) {
        const productRow = (parsed.products || []).find((product) => normalizeText(product.reference) === normalizeText(item.reference))
        if (!productRow) {
          logs.push(`Commande ${orderRow.email}: produit absent ${item.reference}`)
          continue
        }

        const stockRow = (parsed.stock || []).find(
          (stock) => normalizeText(stock.reference) === normalizeText(item.reference) && normalizeName(stock.karazany) === normalizeName(item.variant)
        )

        const productId = productRefToId.get(normalizeText(item.reference))
        if (!productId) {
          logs.push(`Commande ${orderRow.email}: produit non importe ${item.reference}`)
          continue
        }

        let combinationId = 0
        if (options.createCombinations && stockRow?.specificité && stockRow?.karazany) {
          combinationId = await ensureCombination(productId, normalizeText(item.reference), stockRow, productRow)
        }

        const quantity = Number(item.quantity) || 0
        const unitPrice = Number.parseFloat(resolveProductPrice(productRow, stockRow)) || 0
        total += unitPrice * quantity
        orderRows.push({
          productId,
          productAttributeId: combinationId || 0,
          quantity,
          unitPrice,
          reference: normalizeText(item.reference),
        })
      }

      if (!orderRows.length) {
        logs.push(`Commande ${orderRow.email}: aucun produit valide, import ignore`)
        continue
      }

      const currencyId = defaultCurrencyId
      const langId = defaultLanguageId
      const cartId = await ensureCart(orderRow, customerId, addressId, currencyId, langId, orderRows)
      const stateId = parseRowState(orderRow, allowedOrderStateIds)
      const orderId = await ensureOrder(
        orderRow,
        customerId,
        addressId,
        cartId,
        currencyId,
        langId,
        defaultCarrierId,
        stateId,
        total.toFixed(2)
      )

      if (!orderId) {
        logs.push(`Commande ${orderRow.email}: creation echouee`)
        continue
      }

      for (const row of orderRows) {
        const productRow = (parsed.products || []).find(
          (product) => normalizeText(product.reference) === normalizeText(row.reference)
        )
        const detailXml = buildOrderDetailXml({
          orderId,
          shopId: defaultShopId,
          warehouseId: defaultWarehouseId,
          productId: row.productId,
          productAttributeId: row.productAttributeId,
          quantity: row.quantity,
          unitPrice: Number(row.unitPrice) || 0,
          productName: productRow?.nom || productRow?.name || 'Produit',
          productReference: row.reference,
        })
        await sendXmlResource('order_details', detailXml, 'POST', cfg)
      }

      if (orderId && stateId) {
        await applyOrderState(orderId, stateId)
      }

      logs.push(`Commande importee: ${orderRow.email} (${orderId || 'sans id'})`)
    } catch (error) {
      logs.push(`Commande ${orderRow.email} error: ${error.message}`)
    }
  }

  for (const file of imageFiles || []) {
    const name = file.name
    if (name.startsWith('.') || name.startsWith('._')) {
      continue
    }
    const match = name.match(/^(.+?)\.(png|jpg|jpeg)$/i)
    if (!match) continue

    const reference = match[1]
    const productId = productRefToId.get(normalizeText(reference))
    if (!productId) {
      logs.push(`Image ${name}: aucune correspondance produit`)
      continue
    }

    const url = `${env.baseUrl.replace(/\/$/, '')}/api/images/products/${productId}`
    const headers = {}
    if (env.apiKey) {
      headers.Authorization = `Basic ${btoa(`${env.apiKey}:`)}`
    }

    const form = new FormData()
    form.append('file', file)

    const response = await fetch(url, { method: 'POST', headers, body: form })
    if (!response.ok) {
      const text = await response.text()
      logs.push(`Image ${name} erreur: ${response.status} ${text.slice(0, 200)}`)
      continue
    }

    logs.push(`Image importee: ${name} -> produit ${productId}`)
  }

  return { logs }
}

export default { parseFiles, runImport }
