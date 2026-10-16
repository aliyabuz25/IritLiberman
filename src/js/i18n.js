/**
 * i18n.js — loads translations from /api/i18n/:lang and applies them.
 * Usage: add data-i18n="page|key" to any element.
 * The page is derived from the current URL or can be overridden with
 * <html data-i18n-page="home">.
 */

export const DEFAULT_LANG = 'en'

function applyTranslations(data) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const [page, key] = el.getAttribute('data-i18n').split('|')
    const value = data[page]?.[key]
    if (value !== undefined && value !== '') {
      el.textContent = value
    }
  })
}

export async function loadI18n(lang = DEFAULT_LANG) {
  try {
    const res = await fetch(`/api/i18n/${lang}`)
    if (!res.ok) return
    const data = await res.json()
    applyTranslations(data)
  } catch (e) {
    // silently fail — fallback is hardcoded HTML text
  }
}
