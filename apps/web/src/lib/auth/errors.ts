export function getFriendlyAuthError(message: string | undefined, fallback: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("invalid login")) {
    return "E-mail ou senha inválidos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Este e-mail já está cadastrado. Entre ou recupere sua senha.";
  }

  if (normalized.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  if (normalized.includes("password")) {
    return "Confira a senha informada e tente novamente.";
  }

  return fallback;
}
