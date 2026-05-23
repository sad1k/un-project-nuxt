const CSRF_COOKIE_NAME = "csrf";
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

function findCookieValue(setCookies, name) {
  for (const cookie of setCookies) {
    const [head] = cookie.split(";");
    if (!head)
      continue;
    const eq = head.indexOf("=");
    if (eq === -1)
      continue;
    const cookieName = head.slice(0, eq).trim();
    if (cookieName === name)
      return decodeURIComponent(head.slice(eq + 1).trim());
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
    const csrfSecret = findCookieValue(setCookies, CSRF_COOKIE_NAME);
    const html = await response.text();
    const csrfToken = extractCsrfMetaToken(html);
    if (!csrfSecret || !csrfToken) {
      throw new Error(`CSRF bootstrap missing ${csrfSecret ? "token meta" : "csrf cookie"} (status ${response.status})`);
    }
    return { csrfSecret, csrfToken };
  }
  finally {
    clearTimeout(timeout);
  }
}

export function buildAuthedWriteHeaders({ sessionCookieHeader, csrfSecret, csrfToken }) {
  return {
    [CSRF_HEADER_NAME]: csrfToken,
    cookie: `${sessionCookieHeader}; ${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfSecret)}`,
  };
}
