const isMultilang = (schemaXml, fieldName) => {
  const field = schemaXml.querySelector(fieldName);
  return field?.querySelector("language") !== null;
};

const normalizeDecimal = (value) => {
  const str = String(value).trim();
  if (/^-?\d+(,\d+)?$/.test(str)) {
    return str.replace(",", ".");
  }
  return str;
};

const escapeXml = (unsafe) => {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

export const buildXmlFromSchema = (schemaXml, row, resource) => {
  if (!schemaXml) throw new Error("Schema non charge");

  const root = schemaXml.querySelector("prestashop > *");
  const rootTag = root?.tagName || resource;

  let body = "";
  const fields = [...root.children];

  for (const fieldEl of fields) {
    const fieldName = fieldEl.tagName;
    let value = row[fieldName];

    if (value === undefined || value === "") continue;

    value = normalizeDecimal(value);

    if (isMultilang(schemaXml, fieldName)) {
      body += `    <${fieldName}><language id="1">${escapeXml(value)}</language></${fieldName}>\n`;
    } else {
      body += `    <${fieldName}>${escapeXml(value)}</${fieldName}>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <${rootTag}>
${body}  </${rootTag}>
</prestashop>`;
};
