export function maskValue(value: string, privacyMode: boolean, mask = '••••') {
  if (!privacyMode) return value
  return mask
}

export function formatPrivateValue(value: string, privacyMode: boolean, mask = '••••') {
  if (!privacyMode) return value
  if (!/[\d₹$%]/.test(value)) return value
  return maskValue(value, privacyMode, mask)
}

export function getSensitiveTextClass(baseClass: string, privacyMode: boolean) {
  if (!privacyMode) return baseClass
  return 'text-slate-400 dark:text-slate-400'
}

export function maskSensitiveText(value: string, privacyMode: boolean, mask = '••••') {
  if (!privacyMode) return value
  return value.replace(/[₹$]?\d[\d,]*(?:\.\d+)?%?/g, mask)
}