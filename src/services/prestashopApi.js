import { parseXmlToJson } from './xml'

const joinUrl = (baseUrl, resource) => {
  const base = baseUrl.replace(/\/$/, '')
  const path = resource.replace(/^\//, '')
  return `${base}/${path}`
}

const buildQuery = (params = {}) => {
  const parts = []
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    // PrestaShop WS exige des crochets littéraux dans les clés ET valeurs
    // (ex: filter[id_customer]=[3] et display=[id,name])
    // Ne pas encoder ni les clés ni les valeurs
    parts.push(`${key}=${value}`)
  })
  return parts.length ? `?${parts.join('&')}` : ''
}

const encodeKey = (apiKey) => {
  if (!apiKey) return ''
  return btoa(`${apiKey}:`)
}

const buildAuthHeaders = (apiKey, useQueryKey) => {
  if (useQueryKey || !apiKey) return {}
  return {
    Authorization: `Basic ${encodeKey(apiKey)}`,
  }
}

export const fetchResource = async (resource, params, config = {}) => {
  const baseUrl = config.baseUrl || ''
  const apiKey = config.apiKey || ''
  const useQueryKey = config.useQueryKey || false

  if (!baseUrl) {
    throw new Error('Base URL manquante: configurez VITE_PS_BASE_URL ou le champ UI.')
  }

  const finalParams = { ...params }
  if (useQueryKey && apiKey) {
    finalParams.ws_key = apiKey
  }

  const url = `${joinUrl(baseUrl, resource)}${buildQuery(finalParams)}`
  const headers = {
    Accept: 'application/xml',
    ...buildAuthHeaders(apiKey, useQueryKey),
  }

  const response = await fetch(url, { headers })
  const xml = await response.text()

  if (!response.ok) {
    const errBody = xml ? xml.slice(0, 1200) : ''
    throw new Error(`API erreur ${response.status}: ${response.statusText || 'Erreur inconnue'} | ${errBody}`)
  }

  const json = parseXmlToJson(xml)
  return { xml, json }
}

export const sendXmlResource = async (resource, xmlBody, method, config = {}) => {
  const baseUrl = config.baseUrl || ''
  const apiKey = config.apiKey || ''
  const useQueryKey = config.useQueryKey || false

  if (!baseUrl) {
    throw new Error('Base URL manquante: configurez VITE_PS_BASE_URL ou le champ UI.')
  }

  const url = joinUrl(baseUrl, resource)
  const headers = {
    Accept: 'application/xml',
    'Content-Type': 'application/xml',
    ...buildAuthHeaders(apiKey, useQueryKey),
  }

  const response = await fetch(url, {
    method,
    headers,
    body: xmlBody,
  })

  const xml = await response.text()
  if (!response.ok) {
    const details = xml ? ` | Reponse: ${xml}` : ''
    console.error('API Error Response:', xml)
    throw new Error(
      `API erreur ${response.status}: ${response.statusText || 'Erreur inconnue'}${details}`
    )
  }

  const json = xml ? parseXmlToJson(xml) : null
  return { xml, json }
}

export const pickText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value['#text']) return value['#text']
  return ''
}

export const pickLanguageValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  const language = value.language
  if (!language) return pickText(value)
  const languages = Array.isArray(language) ? language : [language]
  return pickText(languages[0])
}

const pickLanguageId = (value) => {
  if (!value || typeof value === 'string') return ''
  const language = value.language
  if (!language) return ''
  const first = Array.isArray(language) ? language[0] : language
  return first?.['@attributes']?.id || ''
}

export const normalizeProducts = (payload) => {
  const raw = payload?.prestashop?.products?.product
  if (!raw) return []

  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((item) => ({
    id: pickText(item.id),
    name: pickLanguageValue(item.name),
    price: pickText(item.price),
    active: pickText(item.active) === '1',
  }))
}

export const normalizeShopProducts = (payload) => {
  const raw = payload?.prestashop?.products?.product
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((item) => ({
    id: pickText(item.id),
    name: pickLanguageValue(item.name),
    price: pickText(item.price),
    active: pickText(item.active) === '1',
    defaultImageId: pickText(item.id_default_image),
    descriptionShort: pickLanguageValue(item.description_short),
    dateAvailable: pickText(item.date_add) || pickText(item.available_date) || '',
    categoryId: pickText(item.id_category_default) || '',
  }))
}

export const normalizeShopProductDetail = (payload) => {
  const product = payload?.prestashop?.product
  if (!product) return null
  return {
    id: pickText(product.id),
    name: pickLanguageValue(product.name),
    description: pickLanguageValue(product.description),
    descriptionShort: pickLanguageValue(product.description_short),
    price: pickText(product.price),
    active: pickText(product.active) === '1',
    defaultImageId: pickText(product.id_default_image),
    reference: pickText(product.reference),
    quantity: pickText(product.quantity),
    languageId: pickLanguageId(product.name),
    categoryId: pickText(product.id_category_default),
    dateAvailable: pickText(product.date_add) || pickText(product.available_date) || '',
  }
}

export const buildImageUrl = (baseUrl, productId, imageId, apiKey) => {
  if (!imageId || imageId === '0' || imageId === '') return null
  return `${baseUrl}/images/products/${productId}/${imageId}?ws_key=${apiKey}`
}

export const buildCustomerXml = (data) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
<customer>
  <firstname><![CDATA[${data.firstname}]]></firstname>
  <lastname><![CDATA[${data.lastname}]]></lastname>
  <email><![CDATA[${data.email}]]></email>
  <passwd><![CDATA[${data.password}]]></passwd>
  <active>1</active>
  <is_guest>0</is_guest>
  <id_lang>1</id_lang>
  <id_default_group>3</id_default_group>
  <newsletter>0</newsletter>
  <optin>0</optin>
  <id_gender>1</id_gender>
</customer>
</prestashop>`

export const buildAddressXml = (data) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
<address>
  <id_customer><![CDATA[${data.customerId}]]></id_customer>
  <id_country><![CDATA[${data.countryId || '8'}]]></id_country>
  <id_state>0</id_state>
  <alias><![CDATA[Mon adresse]]></alias>
  <firstname><![CDATA[${data.firstname}]]></firstname>
  <lastname><![CDATA[${data.lastname}]]></lastname>
  <address1><![CDATA[${data.address1}]]></address1>
  <postcode><![CDATA[${data.postcode}]]></postcode>
  <city><![CDATA[${data.city}]]></city>
  <phone><![CDATA[${data.phone || '0600000000'}]]></phone>
  <deleted>0</deleted>
</address>
</prestashop>`

export const buildCartXml = (data) => {
  const rows = data.items
    .map(
      (item) => `      <cart_row>
        <id_product><![CDATA[${item.id}]]></id_product>
        <id_product_attribute>0</id_product_attribute>
        <id_address_delivery><![CDATA[${data.addressId}]]></id_address_delivery>
        <id_customization>0</id_customization>
        <quantity><![CDATA[${item.quantity}]]></quantity>
      </cart_row>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
<cart>
  <id_address_delivery><![CDATA[${data.addressId}]]></id_address_delivery>
  <id_address_invoice><![CDATA[${data.addressId}]]></id_address_invoice>
  <id_currency>1</id_currency>
  <id_customer><![CDATA[${data.customerId}]]></id_customer>
  <id_lang>1</id_lang>
  <id_carrier>1</id_carrier>
  <recyclable>0</recyclable>
  <gift>0</gift>
  <mobile_theme>0</mobile_theme>
  <allow_seperated_package>0</allow_seperated_package>
  <associations>
    <cart_rows>
${rows}
    </cart_rows>
  </associations>
</cart>
</prestashop>`
}

// Génère un secure_key MD5-like de 32 caractères hexadécimaux
const generateSecureKey = () => {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const buildOrderXml = (data) => {
  const total = data.total.toFixed(6)
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
<order>
  <id_address_delivery><![CDATA[${data.addressId}]]></id_address_delivery>
  <id_address_invoice><![CDATA[${data.addressId}]]></id_address_invoice>
  <id_cart><![CDATA[${data.cartId}]]></id_cart>
  <id_currency>1</id_currency>
  <id_lang>1</id_lang>
  <id_customer><![CDATA[${data.customerId}]]></id_customer>
  <id_carrier>1</id_carrier>
  <module><![CDATA[ps_cashondelivery]]></module>
  <payment><![CDATA[Paiement à la livraison]]></payment>
  <current_state>10</current_state>
  <total_paid>${total}</total_paid>
  <total_paid_tax_incl>${total}</total_paid_tax_incl>
  <total_paid_tax_excl>${total}</total_paid_tax_excl>
  <total_paid_real>0.000000</total_paid_real>
  <total_products>${total}</total_products>
  <total_products_wt>${total}</total_products_wt>
  <total_shipping>0.000000</total_shipping>
  <total_shipping_tax_incl>0.000000</total_shipping_tax_incl>
  <total_shipping_tax_excl>0.000000</total_shipping_tax_excl>
  <total_discounts>0.000000</total_discounts>
  <total_discounts_tax_incl>0.000000</total_discounts_tax_incl>
  <total_discounts_tax_excl>0.000000</total_discounts_tax_excl>
  <total_wrapping>0.000000</total_wrapping>
  <total_wrapping_tax_incl>0.000000</total_wrapping_tax_incl>
  <total_wrapping_tax_excl>0.000000</total_wrapping_tax_excl>
  <carrier_tax_rate>0.000</carrier_tax_rate>
  <conversion_rate>1.000000</conversion_rate>
  <round_mode>2</round_mode>
  <round_type>1</round_type>
  <valid>1</valid>
  <recyclable>0</recyclable>
  <gift>0</gift>
  <secure_key>${generateSecureKey()}</secure_key>
</order>
</prestashop>`
}

export const extractCreatedId = (json) => {
  const node = json?.prestashop
  if (!node) return null
  const keys = Object.keys(node)
  for (const key of keys) {
    const item = node[key]
    if (item && item.id) return pickText(item.id)
  }
  return null
}

export const extractOrderReference = (json) => {
  const order = json?.prestashop?.order
  if (!order) return null
  return {
    id: pickText(order.id),
    reference: pickText(order.reference),
  }
}

export const normalizeProductDetail = (payload) => {
  const product = payload?.prestashop?.product
  if (!product) return null

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

export const normalizeOrderStates = (payload) => {
  const raw = payload?.prestashop?.order_states?.order_state
  if (!raw) return []

  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((item) => ({
    id: pickText(item.id),
    name: pickLanguageValue(item.name),
  }))
}

export const normalizeOrders = (payload) => {
  const raw = payload?.prestashop?.orders?.order
  if (!raw) return []

  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((item) => ({
    id: pickText(item.id),
    reference: pickText(item.reference),
    currentStateId: pickText(item.current_state),
    totalPaid: pickText(item.total_paid),
    dateAdd: pickText(item.date_add),
  }))
}
