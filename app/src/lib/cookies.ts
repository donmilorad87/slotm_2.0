export function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  const out = {};
  const pairs = String(cookieHeader).split(";");
  for (const part of pairs) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx < 0) {
      continue;
    }
    const key = decodeURIComponent(trimmed.slice(0, idx));
    const value = decodeURIComponent(trimmed.slice(idx + 1));
    out[key] = value;
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
