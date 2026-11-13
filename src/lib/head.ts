const BRAND = 'Vocelo'

export function pageTitle(name: string): string {
  const trimmed = name.trim()
  return trimmed ? `${trimmed} · ${BRAND}` : BRAND
}
