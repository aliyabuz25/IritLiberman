
import { ISO_639_1_LANGUAGES } from './language-catalog.js'

const OCTO_VERSION = '1.0.0'
const OCTO_BUILD   = 'b' + (parseInt(localStorage.getItem('octo_build') || '1841'))
;(function() {
  // Deterministic build number seeded from first-ever install date
  if (!localStorage.getItem('octo_build')) localStorage.setItem('octo_build', '1841')
  const vStr = `v${OCTO_VERSION}+${OCTO_BUILD}`
  document.addEventListener('DOMContentLoaded', () => {
    const el  = document.getElementById('build-number')
    const el2 = document.getElementById('nav-build')
    if (el)  el.textContent  = vStr
    if (el2) el2.textContent = vStr
  })
})()

// Config
// Gallery images are now fetched dynamically from the server.

// Toast
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container')
  const el = document.createElement('div')
  
  const icon = type === 'success' ? 'fa-check-circle text-success' : type === 'error' ? 'fa-times-circle text-danger' : 'fa-exclamation-triangle text-warning'

  el.className = `toast-msg`
  el.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`
  
  container.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(1rem)'
    el.style.transition = 'all 0.3s ease'
    setTimeout(() => el.remove(), 300)
  }, 3000)
}
window.toast = toast

// Auth
async function doLogin() {
  const u = document.getElementById('inp-user').value.trim()
  const p = document.getElementById('inp-pass').value
  const err = document.getElementById('login-error')
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    if (res.ok) {
      err.classList.add('d-none')
      showApp()
    } else {
      const d = await res.json()
      err.textContent = d.error || 'Wrong username or password.'
      err.classList.remove('d-none')
    }
  } catch {
    err.textContent = 'Could not connect to server.'
    err.classList.remove('d-none')
  }
}
window.doLogin = doLogin

document.getElementById('inp-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })

async function doLogout() {
  await fetch('/api/admin/logout', { method: 'POST' })
  document.getElementById('app').classList.add('d-none')
  document.getElementById('login-screen').classList.remove('d-none')
  document.body.className = 'hold-transition login-page'
}
window.doLogout = doLogout

function showApp() {
  document.getElementById('login-screen').classList.add('d-none')
  document.getElementById('app').classList.remove('d-none')
  document.body.className = 'hold-transition sidebar-mini layout-fixed'
  
  // Show dashboard first, then load data in parallel
  showSection('dashboard', document.querySelector('.nav-sidebar a[onclick*="\'dashboard\'"]'))

  setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
  loadDashboard()
}

// Navigation
let _sectionLoaded = {}

function showSection(name, el) {
  if (!el) {
    el = document.querySelector(`.nav-sidebar a[onclick*="'${name}'"]`)
  }

  ['dashboard','pages','projects','gallery','messages','localization','seo','users','backup','settings'].forEach(s => {
    const sec = document.getElementById('sec-' + s)
    if (sec) sec.classList.add('d-none')
  })
  const active = document.getElementById('sec-' + name)
  if (active) active.classList.remove('d-none')
  
  document.querySelectorAll('.nav-sidebar .nav-link').forEach(a => a.classList.remove('active'))
  if (el) el.classList.add('active')
  
  const titles = {
    dashboard: 'Dashboard', pages: 'Pages', projects: 'Project Images', gallery: 'Media Library', messages: 'Inbox', localization: 'Content & Localization', seo: 'SEO', users: 'Admin Accounts', backup: 'Backup & Restore', settings: 'Settings'
  }
  document.getElementById('section-title').textContent = titles[name] || name

  // Only reload if not already loaded (gallery, pages, localization are stable)
  if (name === 'messages') loadMessages()
  if (name === 'localization' && !_sectionLoaded.localization) { loadI18n(); _sectionLoaded.localization = true }
  if (name === 'users') loadUsers()
  if (name === 'gallery') { loadGallery(); _sectionLoaded.gallery = true }
  if (name === 'pages' && !_sectionLoaded.pages) { loadPages(); _sectionLoaded.pages = true }
  if (name === 'seo' && !_sectionLoaded.seo) { loadSeo(); _sectionLoaded.seo = true }
  if (name === 'projects') loadProjectImages()
  if (name === 'settings') loadSettings()
  if (name === 'backup') loadBackups()
  
  return false
}
window.showSection = showSection

// Dashboard
let _chartMessages = null
let _chartStatus = null

async function loadDashboard() {
  const badge   = document.getElementById('msg-badge')
  const dashMsg = document.getElementById('dash-msg')
  const imgCount = document.getElementById('img-count')
  const totalEl = document.getElementById('dash-total-msg')
  const i18nEl  = document.getElementById('dash-i18n-count')

  const [statsRes, imgRes] = await Promise.allSettled([
    fetch('/api/admin/stats').then(r => r.json()),
    fetch('/api/admin/images/count').then(r => r.json())
  ])

  if (statsRes.status === 'fulfilled') {
    const s = statsRes.value
    const unread = s.unreadMsgs ?? 0
    if (dashMsg) dashMsg.textContent = unread
    if (totalEl) totalEl.textContent = s.totalMsgs ?? 0
    if (i18nEl)  i18nEl.textContent  = s.i18nKeys ?? '—'
    if (badge) {
      if (unread > 0) { badge.textContent = unread; badge.classList.remove('d-none') }
      else badge.classList.add('d-none')
    }
    renderRecentMessages(s.recent || [])
    renderCharts(s)
  }

  if (imgRes.status === 'fulfilled') {
    if (imgCount) imgCount.textContent = imgRes.value.count || '—'
  } else {
    if (imgCount) imgCount.textContent = '—'
  }
}

function renderRecentMessages(msgs) {
  const el = document.getElementById('dash-recent-msgs')
  if (!el) return
  if (!msgs.length) {
    el.innerHTML = '<li class="list-group-item text-center text-muted p-3">No messages yet.</li>'
    return
  }
  el.innerHTML = msgs.map(m => `
    <li class="list-group-item py-2 px-3 d-flex justify-content-between align-items-center ${m.read ? '' : 'bg-light'}">
      <div style="min-width:0;flex:1;">
        <strong style="font-size:.875rem;">${esc(m.name)}</strong>
        <span class="text-muted" style="font-size:.78rem;"> — ${esc(m.email)}</span>
        <div style="font-size:.8rem;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;">${esc(m.message)}</div>
      </div>
      <div style="flex-shrink:0;margin-left:12px;text-align:right;">
        ${m.read ? '' : '<span class="badge badge-primary" style="font-size:.65rem;">New</span>'}
        <div class="text-muted" style="font-size:.72rem;">${new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
      </div>
    </li>
  `).join('')
}

function renderCharts(s) {
  // Build last-30-days labels
  const labels = []
  const counts = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    const found = (s.daily || []).find(r => r.day === key)
    counts.push(found ? found.count : 0)
  }

  // Messages line chart — update data in-place to avoid flicker
  const ctxLine = document.getElementById('chart-messages')
  if (ctxLine) {
    if (_chartMessages) {
      _chartMessages.data.labels = labels
      _chartMessages.data.datasets[0].data = counts
      _chartMessages.update('none')
    } else {
      _chartMessages = new Chart(ctxLine, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Messages',
            data: counts,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#2563eb',
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
          }
        }
      })
    }
  }

  // Doughnut — read vs unread
  const ctxDo = document.getElementById('chart-status')
  if (ctxDo) {
    const read   = (s.totalMsgs || 0) - (s.unreadMsgs || 0)
    const unread = s.unreadMsgs || 0
    if (_chartStatus) {
      _chartStatus.data.datasets[0].data = [read, unread]
      _chartStatus.update('none')
    } else {
      _chartStatus = new Chart(ctxDo, {
        type: 'doughnut',
        data: {
          labels: ['Read', 'Unread'],
          datasets: [{
            data: [read, unread],
            backgroundColor: ['#10b981', '#2563eb'],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } }
          }
        }
      })
    }
  }
}

// Messages
let _allMessages = []

async function loadMessages() {
  _allMessages = await fetch('/api/admin/messages').then(r => r.json()).catch(() => [])
  updateMsgBadge()
  renderMessages()
}
window.loadMessages = loadMessages

function updateMsgBadge() {
  const unreadCount = _allMessages.filter(m => !m.read).length
  const badge = document.getElementById('msg-badge')
  if (badge) {
    if (unreadCount > 0) { badge.textContent = unreadCount; badge.classList.remove('d-none') }
    else badge.classList.add('d-none')
  }
}

function renderMessages() {
  const list = document.getElementById('msg-list')
  const filter = (document.getElementById('msg-search')?.value || '').toLowerCase()
  const msgs = filter
    ? _allMessages.filter(m => m.name.toLowerCase().includes(filter) || m.email.toLowerCase().includes(filter) || m.message.toLowerCase().includes(filter))
    : _allMessages

  if (!msgs.length) {
    list.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-4">${filter ? 'No messages match your search.' : 'No messages yet.'}</td></tr>`
    return
  }

  list.innerHTML = msgs.map(m => `
    <tr id="msg-${m.id}" class="${m.read ? '' : 'bg-light'}">
      <td class="text-center align-middle">
        ${m.read ? '<i class="far fa-envelope-open text-muted"></i>' : '<i class="fas fa-envelope text-primary"></i>'}
      </td>
      <td>
        <strong>${esc(m.name)}</strong><br>
        <small class="text-muted"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></small>
      </td>
      <td class="text-muted"><small>${new Date(m.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</small></td>
      <td style="white-space:pre-wrap; font-size:14px; max-width: 400px;">${esc(m.message)}</td>
      <td class="align-middle" style="white-space:nowrap;">
        ${!m.read ? `<button onclick="markRead(${m.id})" class="btn btn-sm btn-default mr-1"><i class="fas fa-check"></i> Mark Read</button>` : ''}
        <button onclick="deleteMsg(${m.id})" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('')
}
window.renderMessages = renderMessages

async function markRead(id) {
  await fetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' })
  const msg = _allMessages.find(m => m.id === id)
  if (msg) msg.read = 1
  updateMsgBadge()
  renderMessages()
  loadDashboard()
}
window.markRead = markRead

async function markAllRead() {
  const unread = _allMessages.filter(m => !m.read)
  if (!unread.length) { toast('All messages are already read.', 'warning'); return }
  const res = await fetch('/api/admin/messages/read-all', { method: 'PATCH' })
  if (res.ok) {
    _allMessages.forEach(m => m.read = 1)
    updateMsgBadge()
    renderMessages()
    loadDashboard()
    toast(`Marked ${unread.length} message(s) as read.`)
  } else {
    toast('Failed to mark all read.', 'error')
  }
}
window.markAllRead = markAllRead

async function deleteMsg(id) {
  if (!confirm('Are you sure you want to delete this message?')) return
  try {
    const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      document.getElementById('msg-' + id)?.remove()
      toast('Message deleted.')
      loadDashboard()
    } else {
      const d = await res.json()
      toast(d.error || 'Failed to delete message.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }
}
window.deleteMsg = deleteMsg

// Localization
let i18nRows = []
let i18nLangs = []
let i18nFilter = ''
let i18nActivePage = null
const i18nDrafts = new Map()

const i18nDraftId = (page, key, lang) => JSON.stringify([page, key, lang])

function getLanguageName(code, locale = 'en') {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

async function loadI18n() {
  const sidebar = document.getElementById('i18n-sidebar')
  const content = document.getElementById('i18n-content')
  sidebar.innerHTML = '<div class="text-center text-muted p-4"><i class="fas fa-sync-alt fa-spin"></i> Loading...</div>'
  content.innerHTML = ''

  try {
    const response = await fetch('/api/admin/i18n')
    if (!response.ok) throw new Error(`Request failed (${response.status})`)
    const data = await response.json()
    i18nLangs = Array.isArray(data.langs) ? data.langs : []
    i18nRows = Array.isArray(data.rows) ? data.rows : []
  } catch (error) {
    sidebar.innerHTML = '<div class="text-center text-danger p-4">Could not load localization data. Check your connection and reload.</div>'
    content.innerHTML = ''
    toast('Could not load localization data.', 'error')
    return
  }
  
  if (!i18nActivePage && i18nRows.length > 0) {
    i18nActivePage = i18nRows[0].page
  }
  renderI18nView()
}
window.loadI18n = loadI18n

function renderI18nView() {
  const sidebar = document.getElementById('i18n-sidebar')
  const content = document.getElementById('i18n-content')

  const filter = i18nFilter.toLowerCase()
  const filtered = filter
    ? i18nRows.filter(r => r.page.includes(filter) || r.key.includes(filter) || i18nLangs.some(l => (r[l]?.value || '').toLowerCase().includes(filter)))
    : i18nRows

  const byPage = {}
  filtered.forEach(r => { if (!byPage[r.page]) byPage[r.page] = []; byPage[r.page].push(r) })

  const pages = Object.keys(byPage).sort()
  // Only show media_library tab when there's no filter active
  if (!filter) pages.push('media_library')

  if (pages.length === 0) {
    sidebar.innerHTML = '<div class="text-center text-muted p-4">No matches found</div>'
    content.innerHTML = '<div class="text-center text-muted p-5"><i class="fas fa-search fa-2x mb-3"></i><p>No content found.</p></div>'
    return
  }

  if (!pages.includes(i18nActivePage)) i18nActivePage = pages[0]

  sidebar.innerHTML = pages.map(p => {
    const safeP = p.replace(/'/g, "\\'").replace(/"/g, '&quot;')
    return `
    <a class="nav-link ${p === i18nActivePage ? 'active' : ''}" href="#" onclick="setI18nPage('${safeP}'); return false;" style="border-radius:0;">
      ${p === 'media_library' ? '<i class="fas fa-images mr-1"></i> Media Library' : esc(p)} 
      <span class="badge ${p === i18nActivePage ? 'bg-white text-dark' : 'bg-secondary'} float-right" id="badge-${esc(p)}">
        ${p === 'media_library' ? '' : (byPage[p]?.length || 0)}
      </span>
    </a>`
  }).join('')

  if (i18nActivePage === 'media_library') {
    content.innerHTML = `<h4 class="mb-4 text-capitalize border-bottom pb-2">Media Library</h4>
      <div class="row" id="media-library-grid">
        <div class="col-12 text-center text-muted p-4">Loading images...</div>
      </div>`
      
    fetch('/api/admin/images').then(r => r.json()).then(images => {
      const grid = document.getElementById('media-library-grid')
      const badge = document.getElementById('badge-media_library')
      if (badge) badge.textContent = images.length || 0
      
      if (!images || !images.length) {
        grid.innerHTML = '<div class="col-12 text-center text-muted p-4">No images found.</div>'
        return
      }
      grid.innerHTML = images.map(img => `
        <div class="col-md-4 mb-4">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-light p-2 px-3 border-bottom-0" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              <span class="key-code" title="${img}"><i class="far fa-image text-muted mr-1"></i> ${img}</span>
            </div>
            <div class="card-body p-2 d-flex flex-column align-items-center justify-content-center bg-light border-top border-bottom">
              <img src="/figma_images/${img}?t=${Date.now()}" style="max-height: 120px; max-width: 100%; object-fit: contain; border-radius: 4px;" onerror="this.style.opacity='.2'">
            </div>
            <div class="card-footer p-2 bg-white">
              <div class="custom-file mb-2">
                <input type="file" class="custom-file-input" id="file-${img.replace(/[^a-zA-Z0-9]/g, '')}" accept="image/*" onchange="uploadImage(this, '${img}')">
                <label class="custom-file-label" for="file-${img.replace(/[^a-zA-Z0-9]/g, '')}">Replace image</label>
              </div>
              <small class="text-muted d-block text-center">Replaces current file instantly</small>
              <button onclick="deleteMediaLibraryImage('${img}')" class="btn btn-sm btn-outline-danger w-100 mt-2"><i class="fas fa-trash"></i> Delete</button>
            </div>
          </div>
        </div>
      `).join('')
    }).catch(err => {
      document.getElementById('media-library-grid').innerHTML = '<div class="col-12 text-center text-danger p-4">Failed to load images.</div>'
    })
  } else {
    const rows = byPage[i18nActivePage] || []
    content.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-2">
        <h4 class="text-capitalize mb-0">${esc(i18nActivePage)}</h4>
        <span class="text-muted small">${rows.length} content key${rows.length === 1 ? '' : 's'}</span>
      </div>` + (rows.length ? rows.map(r => {
      const inputsHtml = i18nLangs.map(l => `
        <div class="col-12 col-xl-4 mb-3">
          <label class="text-muted" style="font-size:12px;">${esc(getLanguageName(l))} <code>${esc(l)}</code></label>
          <textarea class="form-control i18n-input ${i18nDrafts.has(i18nDraftId(r.page, r.key, l)) ? 'changed' : ''}" rows="3"
            data-page="${esc(r.page)}" data-key="${esc(r.key)}" data-lang="${esc(l)}"
            oninput="onCellChange(this)">${esc(i18nDrafts.get(i18nDraftId(r.page, r.key, l)) ?? r[l]?.value ?? '')}</textarea>
        </div>
      `).join('')

      return `
        <div class="card mb-4 shadow-sm">
          <div class="card-header bg-light p-2 px-3 border-bottom-0">
            <span class="key-code"><i class="fas fa-font text-muted mr-1"></i> ${esc(r.key)}</span>
          <button class="btn btn-xs btn-outline-danger float-right" onclick="deleteI18nKey('${esc(r.page)}','${esc(r.key)}')" title="Delete this key"><i class="fas fa-trash"></i></button>
          </div>
          <div class="card-body p-3">
            <div class="row">${inputsHtml}</div>
          </div>
        </div>
      `
    }).join('') : '<div class="text-muted py-4">No content keys on this page yet. Use “Add Content Key” to create one.</div>')
  }
}

async function deleteMediaLibraryImage(imgName) {
  if (!confirm(`Are you sure you want to delete ${imgName}? This cannot be undone.`)) return
  try {
    const res = await fetch(`/api/admin/images/${imgName}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Image deleted.')
      renderI18nView() // re-render media library
      loadDashboard()
    } else {
      const d = await res.json()
      toast(d.error || 'Failed to delete image.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }
}
window.deleteMediaLibraryImage = deleteMediaLibraryImage

async function uploadImage(input, targetFilename) {
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  
  const formData = new FormData()
  formData.append('image', file)
  formData.append('filename', targetFilename)

  input.nextElementSibling.textContent = 'Loading...'

  try {
    const res = await fetch('/api/admin/upload-image', {
      method: 'POST',
      body: formData
    })
    
    if (res.ok) {
      toast('Image replaced successfully.')
      renderI18nView() // refresh preview
    } else {
      const d = await res.json()
      toast(d.error || 'Failed to replace image.', 'error')
      input.nextElementSibling.textContent = 'Replace image'
    }
  } catch {
    toast('Server error.', 'error')
    input.nextElementSibling.textContent = 'Replace image'
  }
}
window.uploadImage = uploadImage

function setI18nPage(page) {
  i18nActivePage = page
  renderI18nView()
}
window.setI18nPage = setI18nPage

function onCellChange(el) {
  el.classList.add('changed')
  i18nDrafts.set(i18nDraftId(el.dataset.page, el.dataset.key, el.dataset.lang), el.value)
}
window.onCellChange = onCellChange

async function saveAllChanged() {
  if (!i18nDrafts.size) { toast('No changes to save.', 'warning'); return }
  const button = document.querySelector('#sec-localization button[onclick="saveAllChanged()"]')
  if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Saving…' }
  try {
    const responses = await Promise.all([...i18nDrafts.entries()].map(([draftId, value]) => {
      const [page, key, lang] = JSON.parse(draftId)
      return fetch('/api/admin/i18n', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, key, lang, value })
      })
    }))
    const failed = responses.find(response => !response.ok)
    if (failed) {
      let error = `Save failed (${failed.status}).`
      try { error = (await failed.json()).error || error } catch {}
      throw new Error(error)
    }
    const savedCount = i18nDrafts.size
    const activeElement = document.activeElement
    i18nDrafts.clear()
    toast(`Successfully saved ${savedCount} translation(s).`)
    await loadI18n()
    if (activeElement?.matches?.('.i18n-input')) {
      const selector = `.i18n-input[data-page="${CSS.escape(activeElement.dataset.page)}"][data-key="${CSS.escape(activeElement.dataset.key)}"][data-lang="${CSS.escape(activeElement.dataset.lang)}"]`
      document.querySelector(selector)?.focus()
    }
  } catch (err) {
    toast(err.message || 'Error saving translations. Unsaved fields are still marked.', 'error')
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Save All Changes' }
  }
}
window.saveAllChanged = saveAllChanged

let i18nLanguageMode = 'add'

function renderI18nLanguageOptions() {
  const select = document.getElementById('i18n-language-select')
  if (!select) return
  const search = (document.getElementById('i18n-language-search')?.value || '').trim().toLowerCase()
  const available = i18nLanguageMode === 'add'
    ? ISO_639_1_LANGUAGES.filter(code => !i18nLangs.some(active => active.toLowerCase() === code))
    : [...i18nLangs]
  const options = available.map(code => ({ code, label: getLanguageName(code) }))
    .filter(item => !search || item.code.includes(search) || item.label.toLowerCase().includes(search))
    .sort((a, b) => a.label.localeCompare(b.label))
  select.replaceChildren(...options.map(item => {
    const option = document.createElement('option')
    option.value = item.code
    option.textContent = `${item.label} (${item.code})`
    return option
  }))
}

function openI18nLanguageManager(mode) {
  i18nLanguageMode = mode
  const title = document.getElementById('i18n-language-modal-title')
  const help = document.getElementById('i18n-language-modal-help')
  const custom = document.getElementById('i18n-custom-language-wrap')
  const submit = document.getElementById('i18n-language-submit')
  const error = document.getElementById('i18n-language-modal-error')
  title.textContent = mode === 'add' ? 'Add a language' : 'Remove a language'
  help.textContent = mode === 'add'
    ? `Choose from all ${ISO_639_1_LANGUAGES.length} ISO 639-1 languages, or enter an ISO 639-3 / regional code.`
    : 'Choose an active language. Removing it also deletes its translations.'
  custom.classList.toggle('d-none', mode !== 'add')
  submit.textContent = mode === 'add' ? 'Add Language' : 'Remove Language'
  submit.classList.toggle('btn-danger', mode === 'remove')
  submit.classList.toggle('btn-primary', mode === 'add')
  submit.disabled = mode === 'remove' && i18nLangs.length < 2
  error.classList.add('d-none')
  document.getElementById('i18n-language-search').value = ''
  document.getElementById('i18n-custom-language-code').value = ''
  renderI18nLanguageOptions()
  window.jQuery('#i18n-language-modal').modal('show')
}

async function addI18nLanguage() { openI18nLanguageManager('add') }
window.addI18nLanguage = addI18nLanguage

async function removeI18nLanguage() { openI18nLanguageManager('remove') }
window.removeI18nLanguage = removeI18nLanguage

async function submitI18nLanguage() {
  const submit = document.getElementById('i18n-language-submit')
  const error = document.getElementById('i18n-language-modal-error')
  const customCode = document.getElementById('i18n-custom-language-code').value.trim()
  const code = i18nLanguageMode === 'add' && customCode
    ? customCode
    : document.getElementById('i18n-language-select').value
  error.classList.add('d-none')
  if (!code) {
    error.textContent = i18nLanguageMode === 'add' ? 'Choose a language or enter its code.' : 'There is no removable language selected.'
    error.classList.remove('d-none')
    return
  }
  if (i18nLanguageMode === 'remove') {
    if (i18nLangs.length < 2) {
      error.textContent = 'At least one language must remain.'
      error.classList.remove('d-none')
      return
    }
    if ([...i18nDrafts.keys()].some(draftId => JSON.parse(draftId)[2] === code)) {
      error.textContent = 'Save or discard this language’s unsaved translations before removing it.'
      error.classList.remove('d-none')
      return
    }
    if (!confirm(`Remove ${getLanguageName(code)} (${code}) and all its translations? This cannot be undone.`)) return
  }

  submit.disabled = true
  try {
    const response = await fetch(i18nLanguageMode === 'add'
      ? '/api/admin/i18n/languages'
      : `/api/admin/i18n/languages/${encodeURIComponent(code)}`, {
      method: i18nLanguageMode === 'add' ? 'POST' : 'DELETE',
      ...(i18nLanguageMode === 'add' ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      } : {})
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not update languages.')
    window.jQuery('#i18n-language-modal').modal('hide')
    toast(i18nLanguageMode === 'add' ? `Language ${data.lang} added.` : `Language ${code} removed.`)
    await loadI18n()
  } catch (error) {
    errorElementMessage(error.message || 'Could not update languages.')
  } finally {
    submit.disabled = i18nLanguageMode === 'remove' && i18nLangs.length < 2
  }
}
window.submitI18nLanguage = submitI18nLanguage

function errorElementMessage(message) {
  const error = document.getElementById('i18n-language-modal-error')
  error.textContent = message
  error.classList.remove('d-none')
}

document.getElementById('i18n-language-search')?.addEventListener('input', renderI18nLanguageOptions)

async function addI18nKey() {
  const page = (prompt('Page identifier (examples: home, about, custom-homes):', i18nActivePage && i18nActivePage !== 'media_library' ? i18nActivePage : '') || '').trim()
  if (!page) return
  const key = (prompt('Content key (examples: hero.title, footer.cta):') || '').trim()
  if (!key) return
  try {
    const response = await fetch('/api/admin/i18n/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, key, values: {} })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not add content key.')
    i18nActivePage = page
    i18nFilter = ''
    const search = document.getElementById('i18n-search')
    if (search) search.value = ''
    toast('Content key added. Enter its translations and save.')
    await loadI18n()
  } catch (error) { toast(error.message || 'Could not add content key.', 'error') }
}
window.addI18nKey = addI18nKey

async function deleteI18nKey(page, key) {
  if ([...i18nDrafts.keys()].some(draftId => {
    const [draftPage, draftKey] = JSON.parse(draftId)
    return draftPage === page && draftKey === key
  })) {
    toast('Save this key’s unsaved translations before deleting it.', 'warning')
    return
  }
  if (!confirm(`Delete “${page}.${key}” and all its translations? This cannot be undone.`)) return
  try {
    const response = await fetch('/api/admin/i18n/keys', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, key })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not delete content key.')
    toast('Content key deleted.')
    await loadI18n()
  } catch (error) { toast(error.message || 'Could not delete content key.', 'error') }
}
window.deleteI18nKey = deleteI18nKey

document.getElementById('i18n-search')?.addEventListener('input', e => {
  i18nFilter = e.target.value.trim()
  renderI18nView()
})


async function deleteImage(imgName) {
  if (!confirm(`Are you sure you want to delete ${imgName}? This cannot be undone.`)) return
  try {
    const res = await fetch(`/api/admin/images/${imgName}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Image deleted.')
      loadGallery()
      loadDashboard()
    } else {
      const d = await res.json()
      toast(d.error || 'Failed to delete image.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }
}
window.deleteImage = deleteImage

async function uploadNewImage(input) {
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  
  const formData = new FormData()
  formData.append('image', file)
  // filename will be the original file name

  input.nextElementSibling.textContent = 'Uploading...'

  try {
    const res = await fetch('/api/admin/upload-image', {
      method: 'POST',
      body: formData
    })
    const d = await res.json()
    if (res.ok) {
      toast('Image uploaded successfully.')
      input.value = ''
      input.nextElementSibling.textContent = 'Upload New Image'
      document.getElementById('gallery-grid').innerHTML = ''
      loadGallery()
      loadDashboard()
    } else {
      toast(d.error || 'Failed to upload image.', 'error')
      input.nextElementSibling.textContent = 'Upload New Image'
    }
  } catch {
    toast('Server error.', 'error')
    input.nextElementSibling.textContent = 'Upload New Image'
  }
}
window.uploadNewImage = uploadNewImage


// User modals
function openModal(id, boxId) {
  const modal = document.getElementById(id)
  const box = document.getElementById(boxId)
  modal.style.display = 'flex'
  requestAnimationFrame(() => {
    box.style.transform = 'translateY(0)'
    box.style.opacity = '1'
  })
}

function closeModal(id, boxId, onClose) {
  const modal = document.getElementById(id)
  const box = document.getElementById(boxId)
  box.style.transform = 'translateY(20px)'
  box.style.opacity = '0'
  setTimeout(() => {
    modal.style.display = 'none'
    if (onClose) onClose()
  }, 220)
}

function openAddUserModal() {
  document.getElementById('modal-user-name').value = ''
  document.getElementById('modal-user-pass').value = ''
  document.getElementById('modal-user-pass-confirm').value = ''
  document.getElementById('modal-error').classList.add('d-none')
  openModal('modal-add-user', 'modal-box')
  setTimeout(() => document.getElementById('modal-user-name').focus(), 250)
}
window.openAddUserModal = openAddUserModal

function closeAddUserModal() {
  closeModal('modal-add-user', 'modal-box')
}
window.closeAddUserModal = closeAddUserModal

function togglePassVis() {
  const inp = document.getElementById('modal-user-pass')
  const icon = document.getElementById('pass-eye-icon')
  if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash' }
  else { inp.type = 'password'; icon.className = 'fas fa-eye' }
}
window.togglePassVis = togglePassVis

function togglePassVis2() {
  const inp = document.getElementById('modal-new-pass')
  const icon = document.getElementById('pass-eye-icon2')
  if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash' }
  else { inp.type = 'password'; icon.className = 'fas fa-eye' }
}
window.togglePassVis2 = togglePassVis2

async function createUserModal() {
  const u = document.getElementById('modal-user-name').value.trim()
  const p = document.getElementById('modal-user-pass').value
  const p2 = document.getElementById('modal-user-pass-confirm').value
  const errEl = document.getElementById('modal-error')
  const btn = document.getElementById('modal-create-btn')

  errEl.classList.add('d-none')

  if (!u) { errEl.textContent = 'Username is required.'; errEl.classList.remove('d-none'); return }
  if (p.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('d-none'); return }
  if (p !== p2) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('d-none'); return }

  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Creating...'

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    const data = await res.json()
    if (res.ok) {
      closeAddUserModal()
      toast('User created successfully.')
      loadUsers()
    } else {
      errEl.textContent = data.error || 'Failed to create user.'
      errEl.classList.remove('d-none')
    }
  } catch {
    errEl.textContent = 'Server error. Please try again.'
    errEl.classList.remove('d-none')
  }
  btn.disabled = false
  btn.innerHTML = '<i class="fas fa-check mr-1"></i>Create Account'
}
window.createUserModal = createUserModal

let _changePassUserId = null

function openChangePassModal(id, username) {
  _changePassUserId = id
  document.getElementById('modal-pass-username').textContent = username
  document.getElementById('modal-new-pass').value = ''
  document.getElementById('modal-pass-error').classList.add('d-none')
  openModal('modal-change-pass', 'modal-pass-box')
  setTimeout(() => document.getElementById('modal-new-pass').focus(), 250)
}
window.openChangePassModal = openChangePassModal

function closeChangePassModal() {
  closeModal('modal-change-pass', 'modal-pass-box')
}
window.closeChangePassModal = closeChangePassModal

async function submitChangePass() {
  const newPass = document.getElementById('modal-new-pass').value
  const errEl = document.getElementById('modal-pass-error')
  errEl.classList.add('d-none')

  if (newPass.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.'
    errEl.classList.remove('d-none')
    return
  }

  try {
    const res = await fetch(`/api/admin/users/${_changePassUserId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPass })
    })
    const data = await res.json()
    if (res.ok) {
      closeChangePassModal()
      toast('Password updated successfully.')
    } else {
      errEl.textContent = data.error || 'Failed to update password.'
      errEl.classList.remove('d-none')
    }
  } catch {
    errEl.textContent = 'Server error. Please try again.'
    errEl.classList.remove('d-none')
  }
}
window.submitChangePass = submitChangePass

// Users
async function loadUsers() {
  const list = document.getElementById('users-list')
  list.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4"><i class="fas fa-sync-alt fa-spin"></i> Loading...</td></tr>'

  try {
    const users = await fetch('/api/admin/users').then(r => r.json())
    if (!users.length) {
      list.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No users found.</td></tr>'
      return
    }

    list.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><strong>${esc(u.username)}</strong></td>
        <td class="text-muted">${new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
        <td>
          <button onclick="openChangePassModal(${u.id}, '${esc(u.username)}')" class="btn btn-sm btn-default"><i class="fas fa-key"></i> Change Password</button>
          ${u.id !== 1 ? `
            <button onclick="deleteUser(${u.id}, '${esc(u.username)}')" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
          ` : '<span class="badge badge-secondary ml-2">Primary Admin</span>'}
        </td>
      </tr>
    `).join('')
  } catch (err) {
    list.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-4">Error loading users.</td></tr>'
  }
}
window.loadUsers = loadUsers



async function deleteUser(id, username) {
  if (!confirm(`Are you sure you want to delete ${username}? This cannot be undone.`)) return
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) { toast('User deleted.'); loadUsers() }
    else { const d = await res.json(); toast(d.error || 'Failed to delete user.', 'error') }
  } catch { toast('Server error', 'error') }
}
window.deleteUser = deleteUser

// ─────────────────────────────────────────────────────────────────
// Project Images — DB-driven grouped management
// ─────────────────────────────────────────────────────────────────

const PROJ_CATEGORIES = {
  'custom-homes':   'Custom Homes',
  'hospitality':    'Hospitality',
  'commercial':     'Commercial',
  'bending-stone':  '1MM Bending Stone',
  'stone-furniture':'Stone Furniture',
  'stone-blocks':   'Stone Blocks',
}

async function loadProjectImages() {
  const cat = document.getElementById('proj-category-filter')?.value || 'custom-homes'
  const grid = document.getElementById('proj-grid')
  if (!grid) return
  grid.innerHTML = '<div class="col-12 text-center text-muted p-4"><i class="fas fa-sync-alt fa-spin"></i> Loading...</div>'
  try {
    const projects = await fetch(`/api/admin/projects?category=${cat}`).then(r => r.json())
    renderProjectGroups(projects, grid, cat)
  } catch {
    grid.innerHTML = '<div class="col-12 text-danger p-4">Error loading projects.</div>'
  }
}
window.loadProjectImages = loadProjectImages

function renderProjectGroups(projects, grid, cat) {
  if (!projects.length) {
    grid.innerHTML = `
      <div class="col-12 text-center text-muted p-4">No projects yet.
        <button class="btn btn-sm btn-primary ml-2" onclick="createProject('${esc(cat)}')">+ New Project</button>
      </div>`
    return
  }

  grid.innerHTML = `
    <div class="col-12 mb-3 d-flex justify-content-end">
      <button class="btn btn-sm btn-primary" onclick="createProject('${esc(cat)}')">+ New Project</button>
    </div>
    ${projects.map((proj, projectIndex) => `
      <div class="col-12 mb-4 project-order-item" id="proj-group-${proj.id}" data-project-id="${proj.id}">
        <div class="card" style="border:1px solid #e8e2d9;">
          <div class="card-header d-flex align-items-center justify-content-between" style="background:#fbf9f4;padding:10px 16px;">
            <div class="d-flex align-items-center" style="gap:8px;flex:1;">
              <span class="project-drag-handle" draggable="true" title="Drag to reorder" aria-label="Drag ${esc(proj.name)} to reorder" style="cursor:grab;color:#84796d;font-size:1.1rem;line-height:1;user-select:none;">⠿</span>
              <span id="proj-name-label-${proj.id}" style="font-weight:700;font-size:.9rem;color:#201b17;">${esc(proj.name)}</span>
              ${projectIndex > 0 ? `<button onclick="moveProject(${proj.id},-1)" class="btn btn-xs btn-light" title="Move project earlier">↑</button>` : ''}
              ${projectIndex < projects.length - 1 ? `<button onclick="moveProject(${proj.id},1)" class="btn btn-xs btn-light" title="Move project later">↓</button>` : ''}
              <button onclick="renameProject(${proj.id})" class="btn btn-xs btn-default" style="font-size:.72rem;padding:2px 8px;">Rename</button>
            </div>
            <div class="d-flex" style="gap:6px;">
              <span class="text-muted" style="font-size:.75rem;align-self:center;">${proj.images.length} image${proj.images.length !== 1 ? 's' : ''}</span>
              <button onclick="deleteProject(${proj.id},'${esc(proj.name)}')" class="btn btn-xs btn-outline-danger" style="font-size:.72rem;padding:2px 8px;">Delete</button>
            </div>
          </div>
          <div class="card-body p-3">
            <div class="row g-2" id="proj-imgs-${proj.id}">
              ${proj.images.map((img, index) => renderProjectImageCard(proj.id, img, index, proj.images.length)).join('')}
              <div class="col-md-2 col-sm-4 col-6">
                <label class="d-flex flex-column align-items-center justify-content-center"
                  style="aspect-ratio:1;border:2px dashed #d4ccc4;border-radius:8px;cursor:pointer;color:#84796d;font-size:.75rem;background:#fbf9f4;transition:background .15s;">
                  <i class="fas fa-plus" style="font-size:1.2rem;margin-bottom:4px;"></i>
                  Add Image
                  <input type="file" accept="image/*" style="display:none;" onchange="addProjectImage(this,${proj.id})">
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('')}
  `

  let draggedProjectId = null
  grid.ondragstart = event => {
    if (!event.target.closest('.project-drag-handle')) return
    const item = event.target.closest('.project-order-item')
    if (!item) return
    draggedProjectId = item.dataset.projectId
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', draggedProjectId)
    requestAnimationFrame(() => { item.style.opacity = '.45' })
  }
  grid.ondragend = event => {
    const item = event.target.closest('.project-order-item')
    if (item) item.style.opacity = ''
    draggedProjectId = null
  }
  grid.ondragover = event => {
    const target = event.target.closest('.project-order-item')
    const dragging = draggedProjectId ? grid.querySelector(`[data-project-id="${CSS.escape(draggedProjectId)}"]`) : null
    if (!dragging || !target || dragging === target) return
    event.preventDefault()
    const bounds = target.getBoundingClientRect()
    const insertAfter = event.clientY > bounds.top + bounds.height / 2
    grid.insertBefore(dragging, insertAfter ? target.nextElementSibling : target)
  }
  grid.ondrop = async event => {
    if (!event.target.closest('.project-order-item')) return
    event.preventDefault()
    const order = [...grid.querySelectorAll('.project-order-item')]
      .map((item, sort_order) => ({ id: Number(item.dataset.projectId), sort_order }))
    await saveProjectOrder(order)
  }
}

function renderProjectImageCard(projId, img, index, count) {
  const isLand = img.is_landing === 1
  return `
    <div class="col-md-2 col-sm-4 col-6" id="proj-img-card-${img.id}">
      <div style="position:relative;aspect-ratio:1;overflow:hidden;border-radius:8px;border:2px solid ${isLand ? '#201b17' : '#e8e2d9'};">
        <img src="/figma_images/${esc(img.filename)}?t=${Date.now()}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.opacity='.2'">
        ${isLand ? '<span style="position:absolute;top:4px;left:4px;background:#201b17;color:#fbf9f4;font-size:.6rem;font-weight:700;padding:2px 6px;border-radius:3px;letter-spacing:.06em;">LAND</span>' : ''}
        <div style="position:absolute;top:4px;right:4px;display:flex;gap:3px;">
          ${index > 0 ? `<button onclick="moveProjectImage(${projId},${index},-1)" class="btn btn-xs btn-light" style="padding:2px 5px;font-size:.6rem;" title="Move earlier">↑</button>` : ''}
          ${index < count - 1 ? `<button onclick="moveProjectImage(${projId},${index},1)" class="btn btn-xs btn-light" style="padding:2px 5px;font-size:.6rem;" title="Move later">↓</button>` : ''}
          ${!isLand ? `<button onclick="setProjectLanding(${projId},${img.id})" class="btn btn-xs" style="background:rgba(32,27,23,.7);color:#fff;padding:2px 5px;font-size:.6rem;border:none;" title="Set as landing">★</button>` : ''}
          <button onclick="removeProjectImage(${projId},${img.id},'${esc(img.filename)}')" class="btn btn-xs btn-danger" style="padding:2px 5px;font-size:.6rem;" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.45);padding:3px 6px;">
          <div style="font-size:.6rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(img.filename)}</div>
        </div>
      </div>
    </div>
  `
}

async function createProject(cat) {
  const name = prompt('Project name:')
  if (!name?.trim()) return
  const res = await fetch('/api/admin/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: cat, name: name.trim() })
  })
  if (res.ok) { toast('Project created.'); loadProjectImages() }
  else { const d = await res.json(); toast(d.error || 'Error', 'error') }
}
window.createProject = createProject

async function renameProject(id) {
  const label = document.getElementById(`proj-name-label-${id}`)
  const current = label?.textContent || ''
  const name = prompt('New project name:', current)
  if (!name?.trim() || name.trim() === current) return
  const res = await fetch(`/api/admin/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  })
  if (res.ok) { if (label) label.textContent = name.trim(); toast('Renamed.') }
  else { const d = await res.json(); toast(d.error || 'Error', 'error') }
}
window.renameProject = renameProject

async function deleteProject(id, name) {
  if (!confirm(`Delete project "${name}" and all its images? This cannot be undone.`)) return
  const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' })
  if (res.ok) { toast('Project deleted.'); loadProjectImages() }
  else { const d = await res.json(); toast(d.error || 'Error', 'error') }
}
window.deleteProject = deleteProject

async function moveProject(projectId, direction) {
  const category = document.getElementById('proj-category-filter')?.value || 'custom-homes'
  const projects = await fetch(`/api/admin/projects?category=${encodeURIComponent(category)}`).then(response => response.json())
  const index = projects.findIndex(project => project.id === projectId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= projects.length) return
  ;[projects[index], projects[target]] = [projects[target], projects[index]]
  const order = projects.map((project, sort_order) => ({ id: project.id, sort_order }))
  await saveProjectOrder(order)
}

async function saveProjectOrder(order) {
  const response = await fetch('/api/admin/projects/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  })
  if (response.ok) {
    toast('Project order saved.')
    loadProjectImages()
  } else {
    toast('Could not reorder projects.', 'error')
    loadProjectImages()
  }
}
window.moveProject = moveProject

async function addProjectImage(input, projId) {
  if (!input.files[0]) return
  const label = input.closest('label')
  if (label) label.style.opacity = '.5'
  const fd = new FormData()
  fd.append('image', input.files[0])
  fd.append('is_landing', '0')
  try {
    const res = await fetch(`/api/admin/projects/${projId}/images`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      toast('Image added.')
      loadProjectImages()
    } else {
      toast(data.error || 'Upload failed.', 'error')
    }
  } catch { toast('Server error.', 'error') }
  if (label) label.style.opacity = '1'
  input.value = ''
}
window.addProjectImage = addProjectImage

async function removeProjectImage(projId, imgId, filename) {
  if (!confirm(`Remove image "${filename}"?`)) return
  const res = await fetch(`/api/admin/projects/${projId}/images/${imgId}`, { method: 'DELETE' })
  if (res.ok) {
    document.getElementById(`proj-img-card-${imgId}`)?.remove()
    toast('Image removed.')
  } else {
    const d = await res.json(); toast(d.error || 'Error', 'error')
  }
}
window.removeProjectImage = removeProjectImage

async function setProjectLanding(projId, imgId) {
  const res = await fetch(`/api/admin/projects/${projId}/images/${imgId}/landing`, { method: 'PATCH' })
  if (res.ok) { loadProjectImages(); toast('Landing image set.') }
  else { const d = await res.json(); toast(d.error || 'Error', 'error') }
}
window.setProjectLanding = setProjectLanding

async function moveProjectImage(projectId, index, direction) {
  const category = document.getElementById('proj-category-filter')?.value || 'custom-homes'
  const projects = await fetch(`/api/admin/projects?category=${encodeURIComponent(category)}`).then(response => response.json())
  const project = projects.find(item => item.id === projectId)
  if (!project) return
  const order = project.images.map(image => image.id)
  const target = index + direction
  if (target < 0 || target >= order.length) return
  ;[order[index], order[target]] = [order[target], order[index]]
  const response = await fetch(`/api/admin/projects/${projectId}/images/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  })
  if (response.ok) loadProjectImages()
  else toast('Could not reorder images.', 'error')
}
window.moveProjectImage = moveProjectImage

// SEO
const SEO_PAGES = {
  'index':          { label: 'Home',            url: '/' },
  'custom-homes':   { label: 'Custom Homes',    url: '/custom-homes' },
  'commercial':     { label: 'Commercial',      url: '/commercial' },
  'hospitality':    { label: 'Hospitality',     url: '/hospitality' },
  'bending-stone':  { label: '1MM Bending Stone', url: '/bending-stone' },
  'furniture':      { label: 'Stone Furniture', url: '/furniture' },
  'stone-decorative':{ label: 'Stone Blocks',  url: '/stone-decorative' },
  'about':          { label: 'About',           url: '/about' },
  'contact':        { label: 'Contact',         url: '/contact' },
}

let _seoData = {}
let _seoCurrentPage = 'index'
let _seoUnsaved = false

async function loadSeo() {
  try {
    const res = await fetch('/api/admin/seo')
    _seoData = await res.json()
  } catch {
    _seoData = {}
  }
  renderSeoForm()
}
window.loadSeo = loadSeo

function setSeoPage(page, el) {
  if (_seoUnsaved && !confirm('You have unsaved SEO changes. Discard them?')) return false
  _seoUnsaved = false
  _seoCurrentPage = page
  document.querySelectorAll('#seo-page-nav .nav-link').forEach(a => a.classList.remove('active'))
  if (el) el.classList.add('active')
  renderSeoForm()
  return false
}
window.setSeoPage = setSeoPage

function renderSeoForm() {
  const area = document.getElementById('seo-form-area')
  const page = _seoCurrentPage
  const info = SEO_PAGES[page] || {}
  const d = _seoData[page] || {}

  area.innerHTML = `
    <h4 class="border-bottom pb-2 mb-4">${esc(info.label || page)} <small class="text-muted" style="font-size:.75rem;">${esc(info.url || '')}</small></h4>
    
    <div class="card mb-3 shadow-sm">
      <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-heading text-muted mr-1"></i> Page Title</span></div>
      <div class="card-body p-3">
        <input type="text" id="seo-title" class="form-control" value="${esc(d.title || '')}" placeholder="e.g. Custom Homes — Irit Liberman" maxlength="70">
        <small class="text-muted d-block mt-1">Recommended: 50–70 characters. <span id="seo-title-count" class="font-weight-bold">${(d.title||'').length}</span>/70</small>
      </div>
    </div>

    <div class="card mb-3 shadow-sm">
      <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-align-left text-muted mr-1"></i> Meta Description</span></div>
      <div class="card-body p-3">
        <textarea id="seo-desc" class="form-control" rows="3" placeholder="160 character summary for search engines..." maxlength="160">${esc(d.description || '')}</textarea>
        <small class="text-muted d-block mt-1">Recommended: 120–160 characters. <span id="seo-desc-count" class="font-weight-bold">${(d.description||'').length}</span>/160</small>
      </div>
    </div>

    <div class="card mb-3 shadow-sm">
      <div class="card-header bg-light py-2"><span class="key-code"><i class="fab fa-facebook text-muted mr-1"></i> Open Graph (Social Sharing)</span></div>
      <div class="card-body p-3">
        <div class="form-group">
          <label class="text-muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">OG Title</label>
          <input type="text" id="seo-og-title" class="form-control" value="${esc(d.og_title || '')}" placeholder="Same as title or custom">
        </div>
        <div class="form-group">
          <label class="text-muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">OG Description</label>
          <textarea id="seo-og-desc" class="form-control" rows="2" placeholder="Same as description or custom">${esc(d.og_description || '')}</textarea>
        </div>
        <div class="form-group mb-0">
          <label class="text-muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">OG Image URL</label>
          <input type="text" id="seo-og-image" class="form-control" value="${esc(d.og_image || '')}" placeholder="https://yoursite.com/og-image.jpg">
        </div>
      </div>
    </div>

    <div class="card mb-3 shadow-sm">
      <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-robot text-muted mr-1"></i> Robots</span></div>
      <div class="card-body p-3">
        <select id="seo-robots" class="form-control" style="max-width:280px;">
          <option value="index, follow" ${(d.robots||'index, follow')==='index, follow'?'selected':''}>index, follow (default)</option>
          <option value="noindex, follow" ${d.robots==='noindex, follow'?'selected':''}>noindex, follow</option>
          <option value="index, nofollow" ${d.robots==='index, nofollow'?'selected':''}>index, nofollow</option>
          <option value="noindex, nofollow" ${d.robots==='noindex, nofollow'?'selected':''}>noindex, nofollow</option>
        </select>
      </div>
    </div>

    <div class="card mb-4 shadow-sm">
      <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-link text-muted mr-1"></i> Canonical URL</span></div>
      <div class="card-body p-3">
        <input type="text" id="seo-canonical" class="form-control" value="${esc(d.canonical || '')}" placeholder="https://yoursite.com${info.url || ''}">
      </div>
    </div>

    <!-- Twitter Card -->
    <div class="card mb-3 shadow-sm">
      <div class="card-header bg-light py-2"><span class="key-code"><i class="fab fa-twitter text-muted mr-1"></i> Twitter Card</span></div>
      <div class="card-body p-3">
        <div class="form-group">
          <label class="text-muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">Twitter Title</label>
          <input type="text" id="seo-tw-title" class="form-control" value="${esc(d.tw_title || '')}" placeholder="Same as OG Title or custom">
        </div>
        <div class="form-group">
          <label class="text-muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">Twitter Description</label>
          <textarea id="seo-tw-desc" class="form-control" rows="2" placeholder="Same as OG Description or custom">${esc(d.tw_description || '')}</textarea>
        </div>
        <div class="form-group mb-0">
          <label class="text-muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">Twitter Image URL</label>
          <input type="text" id="seo-tw-image" class="form-control" value="${esc(d.tw_image || '')}" placeholder="https://yoursite.com/twitter-card.jpg">
        </div>
      </div>
    </div>

    <!-- SERP Preview -->
    <div class="card mb-3 border-0" style="background:#f8f9fa;border-radius:8px;">
      <div class="card-body p-3">
        <p class="text-muted mb-2" style="font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Google Preview</p>
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <div id="serp-url" style="color:#202124;font-size:12px;line-height:18px;">yoursite.com${info.url || ''}</div>
          <div id="serp-title" style="color:#1a0dab;font-size:20px;line-height:26px;cursor:pointer;">${esc(d.title || info.label || page)}</div>
          <div id="serp-desc" style="color:#4d5156;font-size:14px;line-height:22px;">${esc(d.description || 'No description set.')}</div>
        </div>
      </div>
    </div>
  `

  // Live preview + unsaved tracking
  const markUnsaved = () => { _seoUnsaved = true }
  document.getElementById('seo-title').addEventListener('input', e => {
    document.getElementById('serp-title').textContent = e.target.value || (info.label || page)
    document.getElementById('seo-title-count').textContent = e.target.value.length
    markUnsaved()
  })
  document.getElementById('seo-desc').addEventListener('input', e => {
    document.getElementById('serp-desc').textContent = e.target.value || 'No description set.'
    document.getElementById('seo-desc-count').textContent = e.target.value.length
    markUnsaved()
  })
  ;['seo-og-title','seo-og-desc','seo-og-image','seo-robots','seo-canonical','seo-tw-title','seo-tw-desc','seo-tw-image'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', markUnsaved)
    document.getElementById(id)?.addEventListener('change', markUnsaved)
  })
}

async function saveSeo() {
  const page = _seoCurrentPage
  const payload = {
    page,
    title:          document.getElementById('seo-title')?.value || '',
    description:    document.getElementById('seo-desc')?.value || '',
    og_title:       document.getElementById('seo-og-title')?.value || '',
    og_description: document.getElementById('seo-og-desc')?.value || '',
    og_image:       document.getElementById('seo-og-image')?.value || '',
    robots:         document.getElementById('seo-robots')?.value || 'index, follow',
    canonical:      document.getElementById('seo-canonical')?.value || '',
    tw_title:       document.getElementById('seo-tw-title')?.value || '',
    tw_description: document.getElementById('seo-tw-desc')?.value || '',
    tw_image:       document.getElementById('seo-tw-image')?.value || '',
  }

  try {
    const res = await fetch('/api/admin/seo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      _seoData[page] = payload
      _seoUnsaved = false
      toast('Saved SEO for ' + (SEO_PAGES[page]?.label || page) + '.')
    } else {
      const d = await res.json()
      toast(d.error || 'Failed to save SEO.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }
}
window.saveSeo = saveSeo

// Backup & Restore
async function loadBackups() {
  const list = document.getElementById('backup-list')
  if (!list) return
  list.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3"><i class="fas fa-sync-alt fa-spin"></i> Loading...</td></tr>'
  try {
    const backups = await fetch('/api/admin/backups').then(r => r.json())
    if (!backups.length) {
      list.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3">No backups yet. Click "Create Backup" to make one.</td></tr>'
      return
    }
    list.innerHTML = backups.map(b => {
      const date = new Date(b.created).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      const sizeMB = (b.size / 1048576).toFixed(2)
      const label = b.name.includes('auto') ? '<span class="badge badge-secondary ml-1">auto</span>' :
                    b.name.includes('pre-restore') ? '<span class="badge badge-warning ml-1">pre-restore</span>' :
                    '<span class="badge badge-primary ml-1">manual</span>'
      return `<tr>
        <td style="font-size:.78rem;word-break:break-all;">${esc(b.name)}${label}</td>
        <td style="font-size:.78rem;white-space:nowrap;">${sizeMB} MB</td>
        <td style="font-size:.78rem;white-space:nowrap;">${date}</td>
        <td style="white-space:nowrap;">
          <a href="/api/admin/backups/${encodeURIComponent(b.name)}" class="btn btn-xs btn-outline-dark mr-1" download title="Download"><i class="fas fa-download"></i></a>
          <button onclick="deleteBackup('${esc(b.name)}')" class="btn btn-xs btn-outline-danger" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`
    }).join('')
  } catch {
    list.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Failed to load backups.</td></tr>'
  }
}
window.loadBackups = loadBackups

async function createBackup() {
  const btn = document.querySelector('[onclick="createBackup()"]')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Creating...' }
  try {
    const res = await fetch('/api/admin/backups', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      toast(`Backup created: ${data.filename}`)
      loadBackups()
    } else {
      toast(data.error || 'Failed to create backup.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus mr-1"></i>Create Backup' }
}
window.createBackup = createBackup

async function deleteBackup(name) {
  if (!confirm(`Delete backup "${name}"?`)) return
  try {
    const res = await fetch(`/api/admin/backups/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (res.ok) { toast('Backup deleted.'); loadBackups() }
    else { const d = await res.json(); toast(d.error || 'Failed to delete.', 'error') }
  } catch { toast('Server error.', 'error') }
}
window.deleteBackup = deleteBackup

async function restoreBackup(input) {
  const errEl = document.getElementById('restore-error')
  const okEl = document.getElementById('restore-success')
  errEl.classList.add('d-none')
  okEl.classList.add('d-none')

  if (!input.files[0]) return
  const file = input.files[0]
  if (!file.name.endsWith('.db')) {
    errEl.textContent = 'Please select a valid .db backup file.'
    errEl.classList.remove('d-none')
    return
  }

  if (!confirm(`Restore from "${file.name}"? Current data will be replaced. A pre-restore backup will be created automatically.`)) {
    input.value = ''
    return
  }

  const label = input.nextElementSibling
  if (label) label.textContent = 'Uploading...'

  const fd = new FormData()
  fd.append('backup', file)

  try {
    const res = await fetch('/api/admin/backups/restore', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      okEl.textContent = 'Restore successful! Server is restarting — please wait 5 seconds then refresh.'
      okEl.classList.remove('d-none')
      setTimeout(() => window.location.reload(), 6000)
    } else {
      errEl.textContent = data.error || 'Restore failed.'
      errEl.classList.remove('d-none')
    }
  } catch {
    errEl.textContent = 'Server error during restore.'
    errEl.classList.remove('d-none')
  }
  input.value = ''
  if (label) label.textContent = 'Choose .db file'
}
window.restoreBackup = restoreBackup

// Settings
async function loadSettings() {
  const el = document.getElementById('settings-content')
  if (!el) return
  el.innerHTML = '<div class="text-center text-muted p-4"><i class="fas fa-sync-alt fa-spin"></i> Loading...</div>'
  try {
    const [sys, smtp, siteSettings] = await Promise.all([
      fetch('/api/admin/system').then(r => r.json()),
      fetch('/api/admin/smtp').then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/site-settings').then(r => r.json()).catch(() => ({}))
    ])
    const uptime = (() => {
      const s = Math.floor(sys.uptime)
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
      return `${h}h ${m}m ${sec}s`
    })()
    const dbMB = (sys.dbSizeBytes / 1048576).toFixed(2)

    el.innerHTML = `
      <div class="card shadow-sm mb-4">
        <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-language text-muted mr-1"></i> Language Picker</span></div>
        <div class="card-body">
          <p class="text-muted mb-3" style="font-size:.875rem;">Show a custom language menu in public page headers. Languages are managed in Localization; the menu appears when at least two languages are available.</p>
          <div id="language-picker-alert"></div>
          <div class="custom-control custom-switch mb-3">
            <input type="checkbox" class="custom-control-input" id="language_picker_enabled" ${siteSettings.language_picker_enabled ? 'checked' : ''}>
            <label class="custom-control-label" for="language_picker_enabled">Show language picker on the website</label>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="saveLanguagePickerSetting()"><i class="fas fa-save mr-1"></i> Save Setting</button>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <div class="card shadow-sm mb-4">
            <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-server text-muted mr-1"></i> System Info</span></div>
            <div class="card-body p-0">
              <table class="table table-sm mb-0">
                <tbody>
                  <tr><td class="text-muted pl-3">Node.js</td><td><strong>${esc(sys.nodeVersion)}</strong></td></tr>
                  <tr><td class="text-muted pl-3">Platform</td><td><strong>${esc(sys.platform)}</strong></td></tr>
                  <tr><td class="text-muted pl-3">Uptime</td><td><strong>${uptime}</strong></td></tr>
                  <tr><td class="text-muted pl-3">DB Size</td><td><strong>${dbMB} MB</strong></td></tr>
                  <tr><td class="text-muted pl-3">Messages</td><td><strong>${sys.messages}</strong></td></tr>
                  <tr><td class="text-muted pl-3">Admin Users</td><td><strong>${sys.users}</strong></td></tr>
                  <tr><td class="text-muted pl-3">i18n Keys</td><td><strong>${sys.i18nKeys}</strong></td></tr>
                  <tr><td class="text-muted pl-3">Images</td><td><strong>${sys.images}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card shadow-sm mb-4">
            <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-shield-alt text-muted mr-1"></i> Security</span></div>
            <div class="card-body">
              <p class="text-muted mb-2" style="font-size:.875rem;">All passwords are hashed with <strong>bcrypt (cost 10)</strong>. Never stored in plain text.</p>
              <p class="text-muted mb-0" style="font-size:.875rem;">Sessions are server-side and expire on logout. Set <code>ADMIN_PASS</code> env var on first deploy to change the default password.</p>
            </div>
          </div>
          <div class="card shadow-sm mb-4">
            <div class="card-header bg-light py-2"><span class="key-code"><i class="fas fa-download text-muted mr-1"></i> Export</span></div>
            <div class="card-body">
              <p class="text-muted mb-3" style="font-size:.875rem;">Download all contact form messages as a CSV file.</p>
              <a href="/api/admin/export/messages" class="btn btn-sm btn-outline-dark"><i class="fas fa-file-csv mr-1"></i> Export Messages CSV</a>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm mb-4">
        <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
          <span class="key-code"><i class="fas fa-envelope text-muted mr-1"></i> Email / SMTP</span>
          <span class="badge ${smtp.smtp_enabled === '1' || smtp.smtp_enabled === 'true' ? 'badge-success' : 'badge-secondary'}">
            ${smtp.smtp_enabled === '1' || smtp.smtp_enabled === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div class="card-body">
          <p class="text-muted" style="font-size:.875rem;">When enabled, contact form submissions are also emailed to the address below. Messages are always saved to the Inbox regardless.</p>
          <div id="smtp-alert"></div>
          <form id="smtp-form" onsubmit="return false;">
            <div class="form-group">
              <div class="custom-control custom-switch">
                <input type="checkbox" class="custom-control-input" id="smtp_enabled" ${smtp.smtp_enabled === '1' || smtp.smtp_enabled === 'true' ? 'checked' : ''}>
                <label class="custom-control-label" for="smtp_enabled">Send email notifications for new inquiries</label>
              </div>
            </div>
            <div class="row">
              <div class="col-md-8">
                <div class="form-group">
                  <label style="font-weight:600;font-size:.8rem;color:#555;">SMTP Host</label>
                  <input type="text" class="form-control form-control-sm" id="smtp_host" placeholder="smtp.gmail.com" value="${esc(smtp.smtp_host || '')}">
                </div>
              </div>
              <div class="col-md-4">
                <div class="form-group">
                  <label style="font-weight:600;font-size:.8rem;color:#555;">Port</label>
                  <input type="number" class="form-control form-control-sm" id="smtp_port" placeholder="587" value="${esc(smtp.smtp_port || '')}">
                </div>
              </div>
            </div>
            <div class="form-group">
              <div class="custom-control custom-checkbox">
                <input type="checkbox" class="custom-control-input" id="smtp_secure" ${smtp.smtp_secure === '1' || smtp.smtp_secure === 'true' ? 'checked' : ''}>
                <label class="custom-control-label" for="smtp_secure">Use SSL/TLS (secure). Leave off for STARTTLS on port 587.</label>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6">
                <div class="form-group">
                  <label style="font-weight:600;font-size:.8rem;color:#555;">Username</label>
                  <input type="text" class="form-control form-control-sm" id="smtp_user" placeholder="you@example.com" autocomplete="off" value="${esc(smtp.smtp_user || '')}">
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-group">
                  <label style="font-weight:600;font-size:.8rem;color:#555;">Password</label>
                  <input type="password" class="form-control form-control-sm" id="smtp_pass" placeholder="${smtp.smtp_pass_set ? '•••••••• (saved — leave blank to keep)' : 'App password'}" autocomplete="new-password">
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6">
                <div class="form-group">
                  <label style="font-weight:600;font-size:.8rem;color:#555;">From Address</label>
                  <input type="email" class="form-control form-control-sm" id="smtp_from" placeholder="notifications@yourdomain.com" value="${esc(smtp.smtp_from || '')}">
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-group">
                  <label style="font-weight:600;font-size:.8rem;color:#555;">Send inquiries to</label>
                  <input type="email" class="form-control form-control-sm" id="smtp_to" placeholder="irit@eskandaristone.com" value="${esc(smtp.smtp_to || '')}">
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-primary" onclick="saveSmtp()"><i class="fas fa-save mr-1"></i> Save Settings</button>
              <button type="button" class="btn btn-sm btn-default" onclick="testSmtp()"><i class="fas fa-paper-plane mr-1"></i> Send Test Email</button>
            </div>
          </form>
        </div>
      </div>
    `
  } catch {
    el.innerHTML = '<div class="alert alert-danger">Failed to load system info.</div>'
  }
}
window.loadSettings = loadSettings

function readSmtpForm() {
  return {
    smtp_enabled: document.getElementById('smtp_enabled').checked ? '1' : '0',
    smtp_host: document.getElementById('smtp_host').value.trim(),
    smtp_port: document.getElementById('smtp_port').value.trim(),
    smtp_secure: document.getElementById('smtp_secure').checked ? '1' : '0',
    smtp_user: document.getElementById('smtp_user').value.trim(),
    smtp_pass: document.getElementById('smtp_pass').value,
    smtp_from: document.getElementById('smtp_from').value.trim(),
    smtp_to: document.getElementById('smtp_to').value.trim(),
  }
}

function smtpAlert(msg, type) {
  const el = document.getElementById('smtp-alert')
  if (!el) return
  el.innerHTML = `<div class="alert alert-${type} py-2" style="font-size:.85rem;">${esc(msg)}</div>`
}

async function saveSmtp() {
  smtpAlert('', 'info')
  try {
    const res = await fetch('/api/admin/smtp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readSmtpForm())
    })
    const data = await res.json()
    if (res.ok) {
      smtpAlert('Settings saved.', 'success')
      loadSettings()
    } else {
      smtpAlert(data.error || 'Failed to save settings.', 'danger')
    }
  } catch {
    smtpAlert('Network error.', 'danger')
  }
}
window.saveSmtp = saveSmtp

async function saveLanguagePickerSetting() {
  const alert = document.getElementById('language-picker-alert')
  if (!alert) return
  try {
    const response = await fetch('/api/admin/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language_picker_enabled: document.getElementById('language_picker_enabled').checked })
    })
    const data = await response.json().catch(() => ({}))
    let message = 'Language picker setting saved.'
    if (!response.ok) {
      message = response.status === 401
        ? 'Admin session expired. Sign in again and retry.'
        : response.status === 404
          ? 'Language settings API is missing. Restart the app or redeploy the latest backend.'
          : data.error || `Could not save setting (HTTP ${response.status}).`
    }
    alert.innerHTML = `<div class="alert alert-${response.ok ? 'success' : 'danger'} py-2" style="font-size:.85rem;">${esc(message)}</div>`
  } catch {
    alert.innerHTML = '<div class="alert alert-danger py-2" style="font-size:.85rem;">Could not reach the admin API. Restart the app or redeploy the latest backend, then sign in again.</div>'
  }
}
window.saveLanguagePickerSetting = saveLanguagePickerSetting

async function testSmtp() {
  const cfg = readSmtpForm()
  const to = cfg.smtp_to || cfg.smtp_from
  smtpAlert('Sending test email' + (to ? ' to ' + to : '') + '...', 'info')
  try {
    const res = await fetch('/api/admin/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to })
    })
    const data = await res.json()
    if (res.ok) {
      smtpAlert('Test email sent successfully.', 'success')
    } else {
      smtpAlert(data.error || 'Test failed.', 'danger')
    }
  } catch {
    smtpAlert('Network error.', 'danger')
  }
}
window.testSmtp = testSmtp

async function loadPages() {
  const list = document.getElementById('pages-list')
  try {
    const pages = await fetch('/api/admin/pages').then(r => r.json())
    if (pages.length === 0) {
      list.innerHTML = '<li class="list-group-item text-center text-muted p-4">No pages found.</li>'
      return
    }
    list.innerHTML = pages.map(p => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          <strong>${esc(p.name)}</strong>
          <br>
          <small class="text-muted">${esc(p.url)}</small>
        </div>
        <div>
          <span class="badge badge-success mr-2">Live</span>
          <a href="${esc(p.url)}" target="_blank" class="btn btn-sm btn-outline-dark"><i class="fas fa-external-link-alt"></i> Open</a>
        </div>
      </li>
    `).join('')
  } catch (err) {
    list.innerHTML = '<li class="list-group-item text-center text-danger p-4">Error loading pages.</li>'
  }
}
window.loadPages = loadPages

let _galleryImages = []

function imgCategory(name) {
  if (name.startsWith('ch-'))   return 'ch-'
  if (name.startsWith('hosp-')) return 'hosp-'
  if (name.startsWith('comm-')) return 'comm-'
  if (name.startsWith('cap-') || name.startsWith('bend-') || name.startsWith('furn-') || name.startsWith('stone-')) return 'cap-'
  return 'other'
}

function renderGalleryFilter() {
  const grid  = document.getElementById('gallery-grid')
  const cat   = document.getElementById('gallery-category')?.value || 'all'
  const q     = (document.getElementById('gallery-search')?.value || '').toLowerCase()
  const countEl = document.getElementById('gallery-count')

  const filtered = _galleryImages.filter(img => {
    const matchCat = cat === 'all' || imgCategory(img) === cat
    const matchQ   = !q || img.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  if (countEl) countEl.textContent = `${filtered.length} image${filtered.length !== 1 ? 's' : ''}`

  if (!filtered.length) {
    grid.innerHTML = '<div class="col-12 text-center text-muted p-4">No images found.</div>'
    return
  }

  grid.innerHTML = ''
  filtered.forEach(img => {
    const col = document.createElement('div')
    col.className = 'col-6 col-md-2 mb-3'
    col.innerHTML = `
      <div style="aspect-ratio:1;overflow:hidden;border-radius:8px;border:1px solid #e0d8cf;position:relative;">
        <img src="/figma_images/${img}"
          style="width:100%;height:100%;object-fit:cover"
          onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#ada398;font-size:.75rem;padding:4px;text-align:center\\'>${img}</div>'">
        <button onclick="deleteImage('${img}')" class="btn btn-sm btn-danger" style="position:absolute;top:5px;right:5px;opacity:0.85;padding:2px 6px;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div style="font-size:.7rem;color:#84796d;margin-top:.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${img}">${img}</div>
    `
    grid.appendChild(col)
  })
}
window.renderGalleryFilter = renderGalleryFilter

async function loadGallery() {
  const grid = document.getElementById('gallery-grid')
  grid.innerHTML = '<div class="col-12 text-center text-muted p-4"><i class="fas fa-sync-alt fa-spin"></i> Loading...</div>'
  try {
    const res = await fetch('/api/admin/images')
    _galleryImages = await res.json()
    renderGalleryFilter()
  } catch (err) {
    grid.innerHTML = '<div class="col-12 text-center text-danger p-4">Error loading images.</div>'
  }
}
window.loadGallery = loadGallery

// Utils
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Setup
async function doSetup() {
  const u = document.getElementById('setup-user').value.trim()
  const p = document.getElementById('setup-pass').value
  const p2 = document.getElementById('setup-pass-confirm').value
  const errEl = document.getElementById('setup-error')
  const btn = document.getElementById('setup-btn')

  errEl.classList.add('d-none')
  if (!u || u.length < 3) { errEl.textContent = 'Username must be at least 3 characters.'; errEl.classList.remove('d-none'); return }
  if (p.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.classList.remove('d-none'); return }
  if (p !== p2) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('d-none'); return }

  btn.disabled = true
  btn.textContent = 'Creating...'

  try {
    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    const data = await res.json()
    if (res.ok) {
      document.getElementById('setup-screen').classList.add('d-none')
      document.getElementById('inp-user').value = u
      document.getElementById('login-screen').classList.remove('d-none')
      toast('Account created! Please sign in.')
    } else {
      errEl.textContent = data.error || 'Setup failed.'
      errEl.classList.remove('d-none')
    }
  } catch {
    errEl.textContent = 'Server error. Please try again.'
    errEl.classList.remove('d-none')
  }
  btn.disabled = false
  btn.textContent = 'Create Account & Continue'
}
window.doSetup = doSetup

document.getElementById('setup-pass-confirm')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSetup() })

// Boot
;(async () => {
  try {
    const setup = await fetch('/api/admin/setup-status').then(r => r.json())
    if (setup.needsSetup) {
      document.getElementById('setup-screen').classList.remove('d-none')
      document.body.className = 'hold-transition login-page'
      return
    }
    const d = await fetch('/api/admin/me').then(r => r.json())
    if (d.authenticated) {
      showApp()
    } else {
      document.getElementById('login-screen').classList.remove('d-none')
      document.body.className = 'hold-transition login-page'
    }
  } catch {
    document.getElementById('login-screen').classList.remove('d-none')
    document.body.className = 'hold-transition login-page'
  }
})()
