import { parseXmlToJson } from './xml'

const joinUrl = (baseUrl, resource) => {
  const base = baseUrl.replace(/\/$/, '')
  const path = resource.replace(/^\//, '')
  return `${base}/${path}`
}

const buildQuery = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.append(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
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
    throw new Error(`API erreur ${response.status}: ${response.statusText || 'Erreur inconnue'}`)
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
    const details = xml ? ` | Reponse: ${xml.slice(0, 800)}` : ''
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
