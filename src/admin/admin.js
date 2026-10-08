
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

  ['dashboard','pages','projects','gallery','messages','localization','seo','users','settings'].forEach(s => {
    const sec = document.getElementById('sec-' + s)
    if (sec) sec.classList.add('d-none')
  })
  const active = document.getElementById('sec-' + name)
  if (active) active.classList.remove('d-none')
  
  document.querySelectorAll('.nav-sidebar .nav-link').forEach(a => a.classList.remove('active'))
  if (el) el.classList.add('active')
  
  const titles = {
    dashboard: 'Dashboard', pages: 'Pages', projects: 'Project Images', gallery: 'Media Library', messages: 'Inbox', localization: 'Content & Localization', seo: 'SEO', users: 'Admin Accounts', settings: 'Settings'
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

  // Messages line chart
  const ctxLine = document.getElementById('chart-messages')
  if (ctxLine) {
    if (_chartMessages) _chartMessages.destroy()
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

  // Doughnut — read vs unread
  const ctxDo = document.getElementById('chart-status')
  if (ctxDo) {
    if (_chartStatus) _chartStatus.destroy()
    const read   = (s.totalMsgs || 0) - (s.unreadMsgs || 0)
    const unread = s.unreadMsgs || 0
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

// Messages
async function loadMessages() {
  const msgs = await fetch('/api/admin/messages').then(r => r.json()).catch(() => [])
  
  const unreadCount = msgs.filter(m => !m.read).length
  const badge = document.getElementById('msg-badge')
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount
      badge.classList.remove('d-none')
    } else {
      badge.classList.add('d-none')
    }
  }

  const list = document.getElementById('msg-list')
  if (!msgs.length) {
    list.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No messages yet.</td></tr>'
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
      <td class="text-muted"><small>${new Date(m.created_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</small></td>
      <td style="white-space:pre-wrap; font-size:14px; max-width: 400px;">${esc(m.message)}</td>
      <td class="align-middle">
        ${!m.read ? `<button onclick="markRead(${m.id})" class="btn btn-sm btn-default"><i class="fas fa-check"></i> Mark Read</button>` : ''}
        <button onclick="deleteMsg(${m.id})" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('')
}
window.loadMessages = loadMessages

async function markRead(id) {
  await fetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' })
  loadMessages()
  loadDashboard()
}
window.markRead = markRead

async function deleteMsg(id) {
  if (!confirm('Are you sure you want to delete this message?')) return
  await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' })
  document.getElementById('msg-' + id)?.remove()
  toast('Message deleted.')
  loadDashboard()
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
  pages.push('media_library')

  if (pages.length === 0) {
    sidebar.innerHTML = '<div class="text-center text-muted p-4">No matches found</div>'
    content.innerHTML = '<div class="text-center text-muted p-5"><i class="fas fa-search fa-2x mb-3"></i><p>No content found.</p></div>'
    return
  }

  if (!pages.includes(i18nActivePage)) i18nActivePage = pages[0]

  sidebar.innerHTML = pages.map(p => `
    <a class="nav-link ${p === i18nActivePage ? 'active' : ''}" href="#" onclick="setI18nPage('${p}')" style="border-radius:0;">
      ${p === 'media_library' ? '<i class="fas fa-images mr-1"></i> Media Library' : p} 
      <span class="badge ${p === i18nActivePage ? 'bg-white text-dark' : 'bg-secondary'} float-right" id="badge-${p}">
        ${p === 'media_library' ? '' : (byPage[p]?.length || 0)}
      </span>
    </a>
  `).join('')

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
      toast(d.error || 'Replace imageilemedi.', 'error')
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
  const errEl = document.getElementById('modal-error')
  const btn = document.getElementById('modal-create-btn')

  errEl.classList.add('d-none')

  if (!u) { errEl.textContent = 'Username is required.'; errEl.classList.remove('d-none'); return }
  if (p.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('d-none'); return }

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
    { title: 'The Bird Street',   img: '58005.png' },
    { title: 'The Bird Street 2', img: '21534.png' },
    { title: 'The Bird Street 3', img: 'ac45f.png' },
    { title: 'Beverly Hills',     img: 'f9929.png' },
    { title: 'Pacific Palisades', img: 'a4e8c.png' },
    { title: 'Santa Monica',      img: 'd07f0.png' },
    { title: 'Pasadena',          img: 'ef86b.png' },
  ],
  'hospitality': [
    { title: 'Bottega Louie WeHo',       img: 'hosp-bottega-louie.jpg' },
    { title: '1 Hotel WeHo',             img: 'hosp-1hotel-weho.png' },
    { title: 'Edition WeHo',             img: 'hosp-edition-weho.jpg' },
    { title: 'Pendry WeHo',              img: 'hosp-pendry-weho.jpg' },
    { title: 'Regent Hotel Santa Monica',img: 'hosp-regent-sm.jpg' },
  ],
  'commercial': [
    { title: 'Santa Monica',          img: '6f440.png' },
    { title: 'Kurve on Wilshire',     img: '5b9aa.png' },
    { title: 'Skyview Sunset Blvd',   img: '8ab23.png' },
    { title: 'DTLA',                  img: 'comm-dtla-888.jpg' },
    { title: 'Circa DTLA',            img: '21ba2.png' },
    { title: 'AKA on Sunset Blvd',    img: 'f24af.png' },
    { title: 'Oceanwide Plaza',       img: 'e05b0.png' },
    { title: 'The Harland WeHo',      img: 'b22ac.png' },
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
            Replace
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
  const origText = label.childNodes[0].nodeValue
  label.childNodes[0].nodeValue = 'Uploading…'
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
      // Bust cache on the thumbnail
      const thumb = document.getElementById('proj-thumb-' + filename)
      if (thumb) thumb.src = `/figma_images/${filename}?t=${Date.now()}`
      toast(`Image replaced: ${filename}`)
    } else {
      toast(data.error || 'Replace failed.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }

  label.childNodes[0].nodeValue = origText
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

  // Live preview on input
  document.getElementById('seo-title').addEventListener('input', e => {
    document.getElementById('serp-title').textContent = e.target.value || (info.label || page)
    document.getElementById('seo-title-count').textContent = e.target.value.length
  })
  document.getElementById('seo-desc').addEventListener('input', e => {
    document.getElementById('serp-desc').textContent = e.target.value || 'No description set.'
    document.getElementById('seo-desc-count').textContent = e.target.value.length
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
  }

  try {
    const res = await fetch('/api/admin/seo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      _seoData[page] = payload
      toast('SEO saved for ' + (SEO_PAGES[page]?.label || page) + '.')
    } else {
      const d = await res.json()
      toast(d.error || 'Failed to save SEO.', 'error')
    }
  } catch {
    toast('Server error.', 'error')
  }
}
window.saveSeo = saveSeo

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

// Boot
;(async () => {
  try {
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