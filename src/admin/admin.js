
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
  if (name === 'gallery' && !_sectionLoaded.gallery) { loadGallery(); _sectionLoaded.gallery = true }
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

async function loadI18n() {
  const sidebar = document.getElementById('i18n-sidebar')
  const content = document.getElementById('i18n-content')
  sidebar.innerHTML = '<div class="text-center text-muted p-4"><i class="fas fa-sync-alt fa-spin"></i> Loading...</div>'
  content.innerHTML = ''

  const data = await fetch('/api/admin/i18n').then(r => r.json()).catch(() => ({ langs: [], rows: [] }))
  i18nLangs = data.langs
  i18nRows  = data.rows
  
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
    content.innerHTML = `<h4 class="mb-4 text-capitalize border-bottom pb-2">${i18nActivePage}</h4>` + rows.map(r => {
      const inputsHtml = i18nLangs.map(l => `
        <div class="col-md-${Math.max(12/i18nLangs.length, 4)}">
          <label class="text-muted text-uppercase" style="font-size:12px;">${l}</label>
          <textarea class="form-control i18n-input" rows="3"
            data-page="${esc(r.page)}" data-key="${esc(r.key)}" data-lang="${l}" 
            oninput="onCellChange(this)">${esc(r[l]?.value || '')}</textarea>
        </div>
      `).join('')

      return `
        <div class="card mb-4 shadow-sm">
          <div class="card-header bg-light p-2 px-3 border-bottom-0">
            <span class="key-code"><i class="fas fa-font text-muted mr-1"></i> ${esc(r.key)}</span>
          </div>
          <div class="card-body p-3">
            <div class="row">${inputsHtml}</div>
          </div>
        </div>
      `
    }).join('')
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
}
window.onCellChange = onCellChange

async function saveAllChanged() {
  const inputs = document.querySelectorAll('.i18n-input.changed')
  if (!inputs.length) { toast('No changes to save.', 'warning'); return }
  
  try {
    await Promise.all([...inputs].map(inp =>
      fetch('/api/admin/i18n', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: inp.dataset.page, key: inp.dataset.key, lang: inp.dataset.lang, value: inp.value })
      })
    ))
    inputs.forEach(i => i.classList.remove('changed'))
    toast(`Successfully saved ${inputs.length} translation(s).`)
    const updated = await fetch('/api/admin/i18n').then(r => r.json()).catch(() => null)
    if (updated) { i18nLangs = updated.langs; i18nRows = updated.rows }
  } catch (err) {
    toast('Error saving translations.', 'error')
  }
}
window.saveAllChanged = saveAllChanged

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

// Project Images

const PROJECT_DATA = {
  'custom-homes': [
    { title: 'The Bird Street (landing)',   img: 'ch-birdst1-land.jpg' },
    { title: 'The Bird Street (2)',         img: 'ch-birdst1-2.jpg' },
    { title: 'The Bird Street (3)',         img: 'ch-birdst1-3.jpg' },
    { title: 'The Bird Street (4)',         img: 'ch-birdst1-4.jpg' },
    { title: 'The Bird Street (5)',         img: 'ch-birdst1-5.jpg' },
    { title: 'The Bird Street (6)',         img: 'ch-birdst1-6.jpg' },
    { title: 'The Bird Street 2 (landing)', img: 'ch-birdst2-land.jpg' },
    { title: 'The Bird Street 2 (2)',       img: 'ch-birdst2-2.jpg' },
    { title: 'The Bird Street 2 (3)',       img: 'ch-birdst2-3.jpg' },
    { title: 'The Bird Street 2 (4)',       img: 'ch-birdst2-4.jpg' },
    { title: 'The Bird Street 3 (landing)', img: 'ch-birdst3-land.jpg' },
    { title: 'The Bird Street 3 (2)',       img: 'ch-birdst3-2.jpg' },
    { title: 'Beverly Hills (landing)',     img: 'ch-bevhills-land.jpg' },
    { title: 'Beverly Hills (2)',           img: 'ch-bevhills-2.jpg' },
    { title: 'Beverly Hills (3)',           img: 'ch-bevhills-3.jpg' },
    { title: 'Beverly Hills (4)',           img: 'ch-bevhills-4.jpg' },
    { title: 'Beverly Hills (5)',           img: 'ch-bevhills-5.avif' },
    { title: 'Beverly Hills (6)',           img: 'ch-bevhills-6.avif' },
    { title: 'Beverly Hills (7)',           img: 'ch-bevhills-7.jpg' },
    { title: 'Pacific Palisades (landing)', img: 'ch-pacpal-land.jpg' },
    { title: 'Pacific Palisades (2)',       img: 'ch-pacpal-2.jpg' },
    { title: 'Pacific Palisades (3)',       img: 'ch-pacpal-3.jpg' },
    { title: 'Pacific Palisades (4)',       img: 'ch-pacpal-4.jpg' },
    { title: 'Santa Monica (landing)',      img: 'ch-santamon-land.jpg' },
    { title: 'Santa Monica (2)',            img: 'ch-santamon-2.jpg' },
    { title: 'Santa Monica (3)',            img: 'ch-santamon-3.jpg' },
    { title: 'Pasadena (landing)',          img: 'ch-pasadena-land.jpg' },
    { title: 'Pasadena (2)',                img: 'ch-pasadena-2.jpg' },
    { title: 'Pasadena (3)',                img: 'ch-pasadena-3.jpg' },
  ],
  'hospitality': [
    { title: 'Bottega Louie WeHo',       img: 'hosp-bottega-louie.jpg' },
    { title: '1 Hotel WeHo',             img: 'hosp-1hotel-weho.jpg' },
    { title: 'Edition WeHo',             img: 'hosp-edition-weho.jpg' },
    { title: 'Pendry WeHo',              img: 'hosp-pendry-weho.jpg' },
    { title: 'Regent Hotel Santa Monica',img: 'hosp-regent-sm.jpg' },
  ],
  'bending-stone': [
    { title: 'Hero image',    img: '9a808.jpg' },
    { title: 'Gallery 1',     img: '0fcbd.jpg' },
    { title: 'Gallery 2',     img: '1c524.jpg' },
    { title: 'Gallery 3',     img: '38222.jpg' },
    { title: 'Gallery 4',     img: '283b9.jpg' },
    { title: 'Gallery 5',     img: '27cbb.jpg' },
    { title: 'Gallery 6',     img: 'bb50f.jpg' },
    { title: 'Gallery 7',     img: 'c0f77.jpg' },
    { title: 'Gallery 8',     img: '660f7.jpg' },
  ],
  'furniture': [
    { title: 'Hero image',    img: 'eb5e1.jpg' },
    { title: 'Gallery 1',     img: '6326b.jpg' },
    { title: 'Gallery 2',     img: '63f0b.jpg' },
    { title: 'Gallery 3',     img: '82214.jpg' },
    { title: 'Gallery 4',     img: 'daf6b.jpg' },
    { title: 'Gallery 5',     img: 'e29e7.jpg' },
    { title: 'Gallery 6',     img: 'ebe26.jpg' },
    { title: 'Gallery 7',     img: 'fc0b9.jpg' },
  ],
  'stone-blocks': [
    { title: 'Hero image',    img: '08321.jpg' },
    { title: 'Gallery 1',     img: '33301.jpg' },
    { title: 'Gallery 2',     img: '32fa4.jpg' },
  ],
  'commercial': [
    { title: 'Santa Monica',          img: '6f440.jpg' },
    { title: 'Kurve on Wilshire',     img: '5b9aa.jpg' },
    { title: 'Skyview Sunset Blvd',   img: '8ab23.jpg' },
    { title: 'DTLA (landing)',         img: 'comm-dtla-gh.jpg' },
    { title: 'DTLA (extra 1)',         img: 'comm-dtla-888.jpg' },
    { title: 'DTLA (extra 2)',         img: 'comm-dtla-ext.jpg' },
    { title: 'Circa DTLA',            img: '21ba2.jpg' },
    { title: 'AKA on Sunset Blvd',    img: 'f24af.jpg' },
    { title: 'Oceanwide Plaza (landing)', img: 'comm-oceanwide-pic3.jpg' },
    { title: 'Oceanwide Plaza (extra 1)', img: 'e05b0.jpg' },
    { title: 'Oceanwide Plaza (extra 2)', img: 'comm-oceanwide-graffiti.jpg' },
    { title: 'The Harland WeHo',      img: 'b22ac.jpg' },
  ],
}

function loadProjectImages() {
  const cat = document.getElementById('proj-category-filter')?.value || 'custom-homes'
  const grid = document.getElementById('proj-grid')
  if (!grid) return
  const projects = PROJECT_DATA[cat] || []

  grid.innerHTML = projects.map(p => `
    <div class="col-md-4 col-sm-6 mb-4">
      <div class="card h-100 shadow-sm">
        <div style="position:relative;aspect-ratio:4/3;overflow:hidden;background:#f0f0f0;">
          <img
            src="/figma_images/${esc(p.img)}"
            alt="${esc(p.title)}"
            id="proj-thumb-${esc(p.img)}"
            style="width:100%;height:100%;object-fit:cover;display:block;transition:opacity .2s;"
            onerror="this.style.opacity='.15'"
          >
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.45) 0%,transparent 60%);pointer-events:none;"></div>
          <span style="position:absolute;bottom:10px;left:12px;color:#fff;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-shadow:0 1px 3px rgba(0,0,0,.5);">${esc(p.title)}</span>
        </div>
        <div class="card-body p-2 d-flex align-items-center justify-content-between">
          <span class="text-muted" style="font-size:.75rem;word-break:break-all;">${esc(p.img)}</span>
          <label class="btn btn-sm btn-primary mb-0 ml-2" style="cursor:pointer;white-space:nowrap;font-size:.78rem;">
            <span class="btn-label-text">Replace</span>
            <input type="file" accept="image/*" style="display:none;" onchange="replaceProjectImage(this,'${esc(p.img)}')">
          </label>
        </div>
      </div>
    </div>
  `).join('')
}
window.loadProjectImages = loadProjectImages

async function replaceProjectImage(input, filename) {
  if (!input.files[0]) return
  const label = input.parentElement
  const textSpan = label.querySelector('span.btn-label-text')
  if (textSpan) textSpan.textContent = 'Uploading…'
  label.classList.add('disabled')

  const fd = new FormData()
  fd.append('image', input.files[0])

  try {
    const res = await fetch(`/api/admin/images/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      body: fd
    })
    const data = await res.json()
    if (res.ok) {
      const thumb = document.getElementById('proj-thumb-' + filename)
      if (thumb) thumb.src = `/figma_images/${filename}?t=${Date.now()}`
      toast(`Image replaced: ${filename}`)
    } else {
      toast(data.error || 'Replace failed.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }

  if (textSpan) textSpan.textContent = 'Replace'
  label.classList.remove('disabled')
  input.value = ''
}
window.replaceProjectImage = replaceProjectImage

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
    const sys = await fetch('/api/admin/system').then(r => r.json())
    const uptime = (() => {
      const s = Math.floor(sys.uptime)
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
      return `${h}h ${m}m ${sec}s`
    })()
    const dbMB = (sys.dbSizeBytes / 1048576).toFixed(2)

    el.innerHTML = `
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
    `
  } catch {
    el.innerHTML = '<div class="alert alert-danger">Failed to load system info.</div>'
  }
}
window.loadSettings = loadSettings

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

async function loadGallery() {
  const grid = document.getElementById('gallery-grid')
  
  try {
    const res = await fetch('/api/admin/images')
    const images = await res.json()
    
    if (!images || images.length === 0) {
      grid.innerHTML = '<div class="col-12 text-center text-muted p-4">No images found.</div>'
      return
    }

    grid.innerHTML = ''
    images.forEach(img => {
      const col = document.createElement('div')
      col.className = 'col-6 col-md-3 mb-3'
      col.innerHTML = `
        <div style="aspect-ratio:1;overflow:hidden;border-radius:8px;border:1px solid #e0d8cf;position:relative;">
          <img src="/figma_images/${img}"
            style="width:100%;height:100%;object-fit:cover"
            onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#ada398;font-size:.75rem\\'>${img}</div>'">
          <button onclick="deleteImage('${img}')" class="btn btn-sm btn-danger" style="position:absolute;top:5px;right:5px;opacity:0.8;padding:2px 6px;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div style="font-size:.72rem;color:#84796d;margin-top:.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${img}</div>
      `
      grid.appendChild(col)
    })
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