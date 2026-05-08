const fallbackApiBaseUrl = "http://localhost:4000/api";

export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configuredUrl) {
    return fallbackApiBaseUrl;
  }

  try {
    const url = new URL(configuredUrl);
    const pathname = url.pathname.replace(/\/+$/, "");

    url.pathname = pathname.endsWith("/api") ? pathname : `${pathname}/api`;
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallbackApiBaseUrl;
  }
}
