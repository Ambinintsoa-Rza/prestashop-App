const isElement = (node) => node.nodeType === Node.ELEMENT_NODE
const isText = (node) =>
  node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE

const elementToObject = (element) => {
  const result = {}

  if (element.attributes && element.attributes.length) {
    result['@attributes'] = {}
    Array.from(element.attributes).forEach((attr) => {
      result['@attributes'][attr.name] = attr.value
    })
  }

  const childElements = Array.from(element.childNodes).filter(isElement)
  const textNodes = Array.from(element.childNodes)
    .filter(isText)
    .map((node) => node.nodeValue.trim())
    .filter(Boolean)

  if (!childElements.length) {
    const textValue = textNodes.join(' ')
    if (!Object.keys(result).length) {
      return textValue
    }
    if (textValue) {
      result['#text'] = textValue
    }
    return result
  }

  childElements.forEach((child) => {
    const key = child.nodeName
    const value = elementToObject(child)

    if (result[key] === undefined) {
      result[key] = value
      return
    }

    if (!Array.isArray(result[key])) {
      result[key] = [result[key]]
    }
    result[key].push(value)
  })

  if (textNodes.length) {
    result['#text'] = textNodes.join(' ')
  }

  return result
}

export const parseXmlToJson = (xmlString) => {
  const parser = new DOMParser()
  const document = parser.parseFromString(xmlString, 'application/xml')
  const parseError = document.querySelector('parsererror')

  if (parseError) {
    throw new Error('XML invalide: impossible de parser la reponse.')
  }

  const root = document.documentElement
  if (!root) {
    throw new Error('XML vide: aucune racine trouvee.')
  }

  return {
    [root.nodeName]: elementToObject(root),
  }
}
