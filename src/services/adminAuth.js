const normalizeBaseUrl = (baseUrl) => baseUrl.replace(/\/$/, "");

const buildControllerUrl = (baseUrl, controller) => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith(".php")) {
    return `${normalized}?controller=${controller}`;
  }
  return `${normalized}/index.php?controller=${controller}`;
};

const buildLoginUrl = (baseUrl) => buildControllerUrl(baseUrl, "AdminLogin");
const buildDashboardUrl = (baseUrl) => buildControllerUrl(baseUrl, "AdminDashboard");

const isLoginResponse = (response, text) => {
  const loginHeader = response.headers.get("login");
  if (loginHeader && loginHeader.toLowerCase() === "true") return true;
  if (!text) return false;
  return /id=["']login_form["']|id=["']login-panel["']|name=["']submitLogin["']/.test(text);
};

const sessionCache = {
  value: null,
  checkedAt: 0,
  promise: null,
};

export const setAdminSessionCache = (value) => {
  sessionCache.value = value;
  sessionCache.checkedAt = Date.now();
};

export const clearAdminSessionCache = () => {
  sessionCache.value = null;
  sessionCache.checkedAt = 0;
};

export const loginAdmin = async (baseUrl, options) => {
  if (!baseUrl) {
    throw new Error("Admin base URL manquante: configurez VITE_PS_ADMIN_BASE_URL.");
  }

  const { email, password, stayLoggedIn = false, redirect = "AdminDashboard" } = options || {};

  if (!email || !password) {
    throw new Error("Email et mot de passe requis.");
  }

  const body = new URLSearchParams();
  body.set("ajax", "1");
  body.set("submitLogin", "1");
  body.set("email", email);
  body.set("passwd", password);
  if (stayLoggedIn) {
    body.set("stay_logged_in", "1");
  }
  if (redirect) {
    body.set("redirect", redirect);
  }

  const response = await fetch(buildLoginUrl(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    credentials: "include",
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    throw new Error("Reponse login invalide.");
  }

  if (payload?.hasErrors) {
    setAdminSessionCache(false);
    return {
      ok: false,
      errors: payload.errors || ["Login invalide."],
    };
  }

  setAdminSessionCache(true);
  return {
    ok: response.ok,
    redirect: payload?.redirect || "",
  };
};

export const checkAdminSession = async (baseUrl, options = {}) => {
  const maxAgeMs = options.maxAgeMs ?? 30000;
  const force = options.force ?? false;
  const now = Date.now();

  if (!force && sessionCache.value !== null && now - sessionCache.checkedAt < maxAgeMs) {
    return sessionCache.value;
  }

  if (sessionCache.promise) {
    return sessionCache.promise;
  }

  sessionCache.promise = (async () => {
    if (!baseUrl) {
      setAdminSessionCache(false);
      return false;
    }

    try {
      const response = await fetch(buildDashboardUrl(baseUrl), {
        method: "GET",
        headers: {
          Accept: "text/html",
        },
        credentials: "include",
      });

      const text = await response.text();
      const loggedIn = response.ok && !isLoginResponse(response, text);
      setAdminSessionCache(loggedIn);
      return loggedIn;
    } catch (err) {
      setAdminSessionCache(false);
      return false;
    }
  })();

  try {
    return await sessionCache.promise;
  } finally {
    sessionCache.promise = null;
  }
};
