const CSRF_COOKIE_CANDIDATES = ["__Host-csrf", "__Secure-csrf", "csrf"];
const CSRF_HEADER_NAME = "csrf-token";

function parseSetCookies(headers) {
  const result = [];
  if (typeof headers.getSetCookie === "function") {
    for (const value of headers.getSetCookie())
      result.push(value);
  }
  else {
    const raw = headers.get("set-cookie");
    if (raw)
      result.push(...raw.split(/,(?=\s*[\w-]+=)/));
  }
  return result;
}

function findCsrfCookie(setCookies) {
  for (const cookie of setCookies) {
    const [head] = cookie.split(";");
    if (!head)
      continue;
    const eq = head.indexOf("=");
    if (eq === -1)
      continue;
    const cookieName = head.slice(0, eq).trim();
    if (CSRF_COOKIE_CANDIDATES.includes(cookieName))
      return { name: cookieName, value: decodeURIComponent(head.slice(eq + 1).trim()) };
  }
  return null;
}

function extractCsrfMetaToken(html) {
  const match = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

export async function bootstrapCsrfForSession({ baseUrl, fetchImpl = fetch, sessionCookieHeader, timeoutMs = 15000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL("/", baseUrl), {
      headers: {
        "accept": "text/html",
        "cookie": sessionCookieHeader,
        "user-agent": "WanderLog load runner csrf bootstrap",
      },
      signal: controller.signal,
    });
    const setCookies = parseSetCookies(response.headers);
    const csrfCookie = findCsrfCookie(setCookies);
    const html = await response.text();
    const csrfToken = extractCsrfMetaToken(html);
    if (!csrfCookie || !csrfToken) {
      const missing = csrfCookie ? "token meta" : `csrf cookie (looked for ${CSRF_COOKIE_CANDIDATES.join(", ")})`;
      throw new Error(`CSRF bootstrap missing ${missing} (status ${response.status})`);
    }
    return { csrfCookieName: csrfCookie.name, csrfSecret: csrfCookie.value, csrfToken };
  }
  finally {
    clearTimeout(timeout);
  }
}

export function buildAuthedWriteHeaders({ sessionCookieHeader, csrfCookieName = "csrf", csrfSecret, csrfToken }) {
  return {
    [CSRF_HEADER_NAME]: csrfToken,
    cookie: `${sessionCookieHeader}; ${csrfCookieName}=${encodeURIComponent(csrfSecret)}`,
  };
}
