const CSRF_COOKIE_NAME = "slotm_csrf";

function readCookie(name) {
  const cookiePairs = String(document.cookie || "").split(";");
  for (let i = 0; i < cookiePairs.length; i += 1) {
    const pair = cookiePairs[i].trim();
    if (!pair) {
      continue;
    }
    const index = pair.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = decodeURIComponent(pair.slice(0, index));
    if (key !== name) {
      continue;
    }
    return decodeURIComponent(pair.slice(index + 1));
  }
  return "";
}

export function getCsrfToken() {
  return readCookie(CSRF_COOKIE_NAME);
}

export function withCsrfHeaders(initialHeaders = {}) {
  const headers = new Headers(initialHeaders);
  const token = getCsrfToken();
  if (token && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", token);
  }
  if (!headers.has("X-Requested-With")) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }
  return headers;
}

export async function fetchWithCsrf(url, init = {}) {
  const headers = withCsrfHeaders(init.headers || {});
  const requestInit = {
    ...init,
    headers,
    credentials: "same-origin",
  };
  return fetch(url, requestInit);
}

export async function postJson(url, payload) {
  const response = await fetchWithCsrf(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.message || `Request failed (${response.status})`);
  }
  return json;
}

