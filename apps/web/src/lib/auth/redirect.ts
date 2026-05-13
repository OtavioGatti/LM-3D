export function getSafeLocalRedirect(
  value: string | string[] | undefined,
  fallback = "/conta"
) {
  const redirect = Array.isArray(value) ? value[0] : value;

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return fallback;
  }

  return redirect;
}

export function buildLoginHref(redirectTo = "/conta", mode?: "signin" | "signup" | "recover") {
  const params = new URLSearchParams();

  if (redirectTo !== "/conta") {
    params.set("redirect", redirectTo);
  }

  if (mode && mode !== "signin") {
    params.set("mode", mode);
  }

  const queryString = params.toString();

  return queryString ? `/login?${queryString}` : "/login";
}
