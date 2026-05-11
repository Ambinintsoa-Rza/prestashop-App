const joinUrl = (baseUrl, resourcePath = "") => {
  const base = baseUrl.replace(/\/$/, "");
  if (!resourcePath) return base;
  const path = resourcePath.replace(/^\//, "");
  return `${base}/${path}`;
};

const buildAuthHeaders = (apiKey) => {
  if (!apiKey) return {};
  return { Authorization: `Basic ${btoa(`${apiKey}:`)}` };
};

export const fetchAllResources = async (baseUrl, apiKey) => {
  if (!baseUrl) {
    throw new Error("Base URL manquante: configurez VITE_PS_BASE_URL.");
  }

  const res = await fetch(`${joinUrl(baseUrl)}?display=full`, {
    headers: buildAuthHeaders(apiKey),
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API erreur ${res.status}: ${res.statusText || "Erreur inconnue"}`);
  }

  const xml = new DOMParser().parseFromString(text, "application/xml");
  return [...xml.querySelectorAll("api > *")].map((el) => el.tagName);
};

export const fetchSchema = async (baseUrl, apiKey, resource) => {
  if (!baseUrl) {
    throw new Error("Base URL manquante: configurez VITE_PS_BASE_URL.");
  }

  const res = await fetch(`${joinUrl(baseUrl, resource)}?schema=blank`, {
    headers: buildAuthHeaders(apiKey),
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API erreur ${res.status}: ${res.statusText || "Erreur inconnue"}`);
  }

  return new DOMParser().parseFromString(text, "application/xml");
};
