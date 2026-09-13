export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '').trim();
}

export function isValidPhone(value: string) {
  return /^\+?[1-9]\d{7,14}$/.test(normalizePhone(value));
}
