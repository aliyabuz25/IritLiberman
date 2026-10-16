import { DEFAULT_LANG, loadI18n } from './i18n.js'

const LABELS = {
  en: 'English', tr: 'Türkçe', az: 'Azərbaycanca', de: 'Deutsch', fr: 'Français',
  es: 'Español', it: 'Italiano', pt: 'Português', ru: 'Русский', ar: 'العربية'
}
const storageKey = 'site-language'

function languageLabel(code) {
  return LABELS[code.toLowerCase()] || code.toUpperCase()
}

function createPicker(languages, activeLanguage) {
  const picker = document.createElement('div')
  picker.className = 'site-language-picker'
  picker.innerHTML = `
    <button class="language-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="language-picker-code"></span><span class="language-picker-chevron" aria-hidden="true"></span>
    </button>
    <div class="language-picker-menu" role="listbox" aria-label="Choose language" hidden></div>`
  const trigger = picker.querySelector('.language-picker-trigger')
  const menu = picker.querySelector('.language-picker-menu')
  const code = picker.querySelector('.language-picker-code')

  const choose = (lang) => {
    code.textContent = lang.toUpperCase()
    trigger.setAttribute('aria-label', `Language: ${languageLabel(lang)}`)
    menu.querySelectorAll('[role="option"]').forEach(option => {
      const selected = option.dataset.lang === lang
      option.setAttribute('aria-selected', String(selected))
      option.classList.toggle('is-selected', selected)
    })
  }

  languages.forEach(lang => {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = 'language-picker-option'
    option.setAttribute('role', 'option')
    option.dataset.lang = lang
    option.textContent = languageLabel(lang)
    option.addEventListener('click', async () => {
      try { localStorage.setItem(storageKey, lang) } catch {}
      document.documentElement.lang = lang
      choose(lang)
      menu.hidden = true
      picker.classList.remove('is-open')
      trigger.setAttribute('aria-expanded', 'false')
      await loadI18n(lang)
    })
    menu.append(option)
  })
  choose(activeLanguage)

  trigger.addEventListener('click', () => {
    const open = menu.hidden
    menu.hidden = !open
    picker.classList.toggle('is-open', open)
    trigger.setAttribute('aria-expanded', String(open))
  })
  document.addEventListener('click', event => {
    if (!picker.contains(event.target)) {
      menu.hidden = true
      picker.classList.remove('is-open')
      trigger.setAttribute('aria-expanded', 'false')
    }
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      menu.hidden = true
      picker.classList.remove('is-open')
      trigger.setAttribute('aria-expanded', 'false')
      trigger.focus()
    }
  })
  return picker
}

async function initLanguagePicker() {
  let config = { enabled: false, languages: [DEFAULT_LANG] }
  try {
    const response = await fetch('/api/site/languages', { cache: 'no-store' })
    if (response.ok) config = await response.json()
  } catch {}

  const languages = [...new Set((config.languages || []).filter(lang => /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(lang)))]
  let selected = DEFAULT_LANG
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved && languages.includes(saved)) selected = saved
  } catch {}
  if (!languages.includes(selected)) selected = languages[0] || DEFAULT_LANG
  document.documentElement.lang = selected
  await loadI18n(selected)

  if (!config.enabled || languages.length < 2) return
  document.querySelectorAll('.header-inner').forEach(header => {
    if (header.querySelector('.site-language-picker')) return
    const picker = createPicker(languages, selected)
    const hamburger = header.querySelector('.hamburger')
    header.insertBefore(picker, hamburger || null)
  })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLanguagePicker, { once: true })
else initLanguagePicker()
