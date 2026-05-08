export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeBrazilianPhoneDigits(value: string) {
  let digits = onlyDigits(value);

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

export function formatBrazilianPhone(value: string) {
  const digits = normalizeBrazilianPhoneDigits(value);

  if (!digits) {
    return "";
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);

  if (digits.length <= 10) {
    if (number.length <= 4) {
      return `(${areaCode}) ${number}`;
    }

    return `(${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  if (number.length <= 5) {
    return `(${areaCode}) ${number}`;
  }

  return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

export function getBrazilianPhoneHref(value: string) {
  const digits = normalizeBrazilianPhoneDigits(value);

  if (digits.length < 10) {
    return null;
  }

  return `tel:+55${digits}`;
}

export function getBrazilianWhatsAppHref(value: string) {
  const digits = normalizeBrazilianPhoneDigits(value);

  if (digits.length < 10) {
    return null;
  }

  return `https://wa.me/55${digits}`;
}
