export const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

export function validateAccountPassword(password: string) {
  if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
    return `Use pelo menos ${MIN_ACCOUNT_PASSWORD_LENGTH} caracteres na senha.`;
  }

  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return "Use uma senha com letras e numeros.";
  }

  return "";
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  if (password !== confirmation) {
    return "As senhas precisam ser iguais.";
  }

  return "";
}
