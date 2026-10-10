import express from 'express'
import session from 'express-session'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import compression from 'compression'
// vite is loaded dynamically only in dev mode (it's a devDependency)
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import db, { queries } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV !== 'production'
const PORT = process.env.PORT || 3000

// Multer
const uploadDir = resolve(__dirname, 'public/figma_images')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Override the image with the specified name in the request
    const filename = req.body.filename || file.originalname
    cb(null, filename)
  }
})
const upload = multer({ storage })

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

async function main() {
  const app = express()

  app.use(compression())
  app.use(express.json())
  app.use(session({
    secret: process.env.SESSION_SECRET || 'nigar-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }
  }))

  // Upload
  app.post('/api/admin/upload-image', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
    res.json({ ok: true, filename: req.file.filename })
  })

  // Images
  app.get('/api/admin/images/count', requireAuth, (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to read directory' })
      const count = files.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)).length
      res.json({ count })
    })
  })
  app.get('/api/admin/images', requireAuth, (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to read directory' })
      const images = files.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f))
      res.json(images)
    })
  })
  // Replace an existing image in-place (keeps same filename)
  app.put('/api/admin/images/:name', requireAuth, upload.single('image'), (req, res) => {
    const name = req.params.name
    const filePath = resolve(uploadDir, name)
    if (!filePath.startsWith(uploadDir)) return res.status(403).json({ error: 'Forbidden' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    // Remove old file then rename uploaded temp file to original name
    fs.unlink(filePath, () => {
      fs.rename(req.file.path, filePath, err => {
        if (err) return res.status(500).json({ error: 'Failed to replace file.' })
        res.json({ ok: true, filename: name })
      })
    })
  })

  app.delete('/api/admin/images/:name', requireAuth, (req, res) => {
    const filePath = resolve(uploadDir, req.params.name)
    // Basic security check to prevent directory traversal
    if (!filePath.startsWith(uploadDir)) return res.status(403).json({ error: 'Forbidden' })
    
    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).json({ error: 'Failed to delete file' })
      res.json({ ok: true })
    })
  })

  // Auth
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Eksik bilgi' })

    const user = queries.getUserByUsername.get(username)
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.authenticated = true
      req.session.userId = user.id
      req.session.username = user.username
      return res.json({ ok: true })
    }
    res.status(401).json({ error: 'Wrong username or password.' })
  })

  app.post('/api/admin/logout', (req, res) => {
    req.session.destroy()
    res.json({ ok: true })
  })

  app.get('/api/admin/me', (req, res) => {
    res.json({
      authenticated: !!req.session?.authenticated,
      username: req.session?.username,
      unread: queries.unreadCount.get().c
    })
  })

  // Users
  app.get('/api/admin/users', requireAuth, (req, res) => {
    res.json(queries.getUsers.all())
  })

  app.post('/api/admin/users', requireAuth, (req, res) => {
    const { username, password } = req.body
    if (!username || !password || password.length < 6) {
      return res.status(400).json({ error: 'Invalid username or password (min 6 chars)' })
    }
    try {
      const hash = bcrypt.hashSync(password, 10)
      const result = queries.insertUser.run(username, hash)
      res.json({ ok: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' })
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/admin/users/:id/password', requireAuth, (req, res) => {
    const { password } = req.body
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' })
    const hash = bcrypt.hashSync(password, 10)
    queries.updateUserPass.run(hash, req.params.id)
    res.json({ ok: true })
  })

  app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
    // Prevent self-deletion or deleting the primary admin
    if (req.params.id == 1 || req.params.id == req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete this account' })
    }
    queries.deleteUser.run(req.params.id)
    res.json({ ok: true })
  })

  // Projects API
  // GET all projects for a category
  app.get('/api/admin/projects', requireAuth, (req, res) => {
    const cat = req.query.category
    const projects = cat
      ? queries.getProjectsByCategory.all(cat)
      : queries.getAllProjects.all()
    const result = projects.map(p => ({
      ...p,
      images: queries.getProjectImages.all(p.id)
    }))
    res.json(result)
  })

  // POST create project
  app.post('/api/admin/projects', requireAuth, (req, res) => {
    const { category, name } = req.body
    if (!category || !name) return res.status(400).json({ error: 'category and name required' })
    const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM projects WHERE category=?').get(category)
    const sort = (maxSort.m || 0) + 1
    const { lastInsertRowid } = queries.insertProject.run(category, name.trim(), sort)
    res.json({ ok: true, id: lastInsertRowid })
  })

  // PATCH rename project
  app.patch('/api/admin/projects/:id', requireAuth, (req, res) => {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    queries.updateProjectName.run(name.trim(), req.params.id)
    res.json({ ok: true })
  })

  // DELETE project (also deletes images via CASCADE)
  app.delete('/api/admin/projects/:id', requireAuth, (req, res) => {
    queries.deleteProject.run(req.params.id)
    res.json({ ok: true })
  })

  // POST add image to project
  const projImgUpload = multer({ storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, Date.now() + ext)
    }
  })})

  app.post('/api/admin/projects/:id/images', requireAuth, projImgUpload.single('image'), (req, res) => {
    const proj = queries.getProjectById.get(req.params.id)
    if (!proj) return res.status(404).json({ error: 'Project not found' })
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const isLanding = req.body.is_landing === '1' ? 1 : 0
    const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM project_images WHERE project_id=?').get(proj.id)
    const sort = (maxSort.m || 0) + 1
    const { lastInsertRowid } = queries.insertProjectImage.run(proj.id, req.file.filename, isLanding, sort)
    if (isLanding) queries.setLanding.run(lastInsertRowid, proj.id)
    res.json({ ok: true, id: lastInsertRowid, filename: req.file.filename })
  })

  // DELETE image from project
  app.delete('/api/admin/projects/:id/images/:imgId', requireAuth, (req, res) => {
    const img = queries.getProjectImageById.get(req.params.imgId)
    if (!img) return res.status(404).json({ error: 'Image not found' })
    // Delete file from disk
    try { fs.unlinkSync(resolve(uploadDir, img.filename)) } catch {}
    queries.deleteProjectImage.run(req.params.imgId)
    res.json({ ok: true })
  })

  // PATCH set landing image
  app.patch('/api/admin/projects/:id/images/:imgId/landing', requireAuth, (req, res) => {
    const img = queries.getProjectImageById.get(req.params.imgId)
    if (!img) return res.status(404).json({ error: 'Image not found' })
    queries.setLanding.run(req.params.imgId, req.params.id)
    res.json({ ok: true })
  })

  // PATCH reorder projects
  app.patch('/api/admin/projects/reorder', requireAuth, (req, res) => {
    const { order } = req.body // array of {id, sort_order}
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' })
    order.forEach(({ id, sort_order }) => queries.updateProjectSort.run(sort_order, id))
    res.json({ ok: true })
  })

  // Backup
  const BACKUP_DIR = resolve(__dirname, 'data/backups')
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

  function createBackup(label = 'manual') {
    const dbFile = resolve(__dirname, 'data/nigar.db')
    if (!fs.existsSync(dbFile)) throw new Error('Database not found.')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `backup-${ts}-${label}.db`
    const dest = resolve(BACKUP_DIR, filename)
    fs.copyFileSync(dbFile, dest)
    // Keep only last 30 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .sort()
    if (files.length > 30) {
      files.slice(0, files.length - 30).forEach(f => {
        try { fs.unlinkSync(resolve(BACKUP_DIR, f)) } catch {}
      })
    }
    return filename
  }

  // Auto daily backup — runs every 24h
  function scheduleDailyBackup() {
    const now = new Date()
    const next = new Date(now)
    next.setHours(3, 0, 0, 0) // 3 AM
    if (next <= now) next.setDate(next.getDate() + 1)
    const delay = next - now
    setTimeout(() => {
      try { createBackup('auto') } catch {}
      setInterval(() => { try { createBackup('auto') } catch {} }, 24 * 60 * 60 * 1000)
    }, delay)
  }
  scheduleDailyBackup()

  app.get('/api/admin/backups', requireAuth, (_req, res) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .sort().reverse()
        .map(f => {
          const stat = fs.statSync(resolve(BACKUP_DIR, f))
          return { name: f, size: stat.size, created: stat.mtime.toISOString() }
        })
      res.json(files)
    } catch { res.json([]) }
  })

  app.post('/api/admin/backups', requireAuth, (_req, res) => {
    try {
      const filename = createBackup('manual')
      res.json({ ok: true, filename })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/admin/backups/:name', requireAuth, (req, res) => {
    const name = path.basename(req.params.name)
    if (!name.endsWith('.db') || name.includes('..')) return res.status(400).json({ error: 'Invalid filename.' })
    const file = resolve(BACKUP_DIR, name)
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Backup not found.' })
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.sendFile(file)
  })

  app.delete('/api/admin/backups/:name', requireAuth, (req, res) => {
    const name = path.basename(req.params.name)
    if (!name.endsWith('.db') || name.includes('..')) return res.status(400).json({ error: 'Invalid filename.' })
    const file = resolve(BACKUP_DIR, name)
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Backup not found.' })
    fs.unlinkSync(file)
    res.json({ ok: true })
  })

  // Restore backup (replaces current DB, requires server restart)
  const backupUpload = multer({ dest: resolve(__dirname, 'data/backups/tmp') })
  app.post('/api/admin/backups/restore', requireAuth, backupUpload.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
    try {
      const dbFile = resolve(__dirname, 'data/nigar.db')
      try { createBackup('pre-restore') } catch {}
      fs.copyFileSync(req.file.path, dbFile)
      try { fs.unlinkSync(req.file.path) } catch {}
      res.json({ ok: true })
      // Graceful restart so DB re-initializes
      setTimeout(() => process.exit(0), 800)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // First-run setup
  app.get('/api/admin/setup-status', (_req, res) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c
    res.json({ needsSetup: count === 0 })
  })

  app.post('/api/admin/setup', (req, res) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c
    if (count > 0) return res.status(403).json({ error: 'Setup already completed.' })
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })
    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    const hash = bcrypt.hashSync(password, 10)
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash)
    res.json({ ok: true })
  })

  // Pages
  app.get('/api/admin/pages', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT slug, name, url FROM pages ORDER BY id').all()
    res.json(rows)
  })

  // Messages
  app.get('/api/admin/messages', requireAuth, (_req, res) => {
    res.json(queries.getMessages.all())
  })

  app.patch('/api/admin/messages/:id/read', requireAuth, (req, res) => {
    queries.markRead.run(req.params.id)
    res.json({ ok: true })
  })

  app.patch('/api/admin/messages/read-all', requireAuth, (_req, res) => {
    db.prepare('UPDATE messages SET read = 1 WHERE read = 0').run()
    res.json({ ok: true })
  })

  app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
    const row = db.prepare('SELECT id FROM messages WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Message not found.' })
    queries.deleteMessage.run(req.params.id)
    res.json({ ok: true })
  })

  app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body
    if (!name || !email || !message) return res.status(400).json({ error: 'Eksik alan.' })
    queries.insertMessage.run(name, email, message)
    res.json({ ok: true })
  })

  // i18n
  app.get('/api/i18n/:lang', (req, res) => {
    const rows = queries.getI18nByLang.all(req.params.lang)
    const out = {}
    rows.forEach(r => {
      if (!out[r.page]) out[r.page] = {}
      out[r.page][r.key] = r.value
    })
    res.json(out)
  })

  app.get('/api/i18n', (req, res) => {
    res.json(queries.getI18nAll.all())
  })

  app.get('/api/admin/i18n', requireAuth, (_req, res) => {
    const langs = queries.getLangs.all().map(r => r.lang)
    const all   = queries.getI18nAll.all()

    const map = {}
    all.forEach(r => {
      const k = `${r.page}||${r.key}`
      if (!map[k]) map[k] = { page: r.page, key: r.key }
      map[k][r.lang] = { value: r.value, id: r.id }
    })

    res.json({ langs, rows: Object.values(map) })
  })

  app.put('/api/admin/i18n', requireAuth, (req, res) => {
    const { page, key, lang, value } = req.body
    if (!page || !key || !lang || value === undefined) return res.status(400).json({ error: 'Eksik alan.' })
    queries.upsert.run(page, key, lang, value)
    res.json({ ok: true })
  })

  app.delete('/api/admin/i18n/:id', requireAuth, (req, res) => {
    queries.deleteEntry.run(req.params.id)
    res.json({ ok: true })
  })

  // Stats
  app.get('/api/admin/stats', requireAuth, (_req, res) => {
    const totalMsgs = db.prepare('SELECT COUNT(*) as c FROM messages').get().c
    const unreadMsgs = db.prepare('SELECT COUNT(*) as c FROM messages WHERE read=0').get().c
    const i18nKeys = db.prepare('SELECT COUNT(DISTINCT page||key) as c FROM i18n').get().c
    const recent = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5').all()

    // Messages per day for last 30 days
    const daily = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM messages
      WHERE created_at >= date('now','-30 days')
      GROUP BY day ORDER BY day ASC
    `).all()

    res.json({ totalMsgs, unreadMsgs, i18nKeys, recent, daily })
  })

  // Settings / system info
  app.get('/api/admin/system', requireAuth, (_req, res) => {
    const dbFile = resolve(__dirname, 'data/nigar.db')
    let dbSize = 0
    try { dbSize = fs.statSync(dbFile).size } catch {}

    const msgCount   = db.prepare('SELECT COUNT(*) as c FROM messages').get().c
    const userCount  = db.prepare('SELECT COUNT(*) as c FROM users').get().c
    const i18nCount  = db.prepare('SELECT COUNT(*) as c FROM i18n').get().c
    const imageCount = (() => {
      try { return fs.readdirSync(uploadDir).filter(f => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f)).length } catch { return 0 }
    })()

    res.json({
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      dbSizeBytes: dbSize,
      messages: msgCount,
      users: userCount,
      i18nKeys: i18nCount,
      images: imageCount,
      buildDate: new Date().toISOString()
    })
  })

  // Export messages as CSV
  app.get('/api/admin/export/messages', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT id, name, email, message, read, created_at FROM messages ORDER BY created_at DESC').all()
    const header = ['ID', 'Name', 'Email', 'Message', 'Read', 'Date']
    const csv = [header, ...rows.map(r => [
      r.id,
      `"${(r.name||'').replace(/"/g,'""')}"`,
      `"${(r.email||'').replace(/"/g,'""')}"`,
      `"${(r.message||'').replace(/"/g,'""')}"`,
      r.read ? 'Yes' : 'No',
      r.created_at
    ])].map(row => row.join(',')).join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="messages.csv"')
    res.send(csv)
  })

  // SEO
  app.get('/api/admin/seo', requireAuth, (_req, res) => {
    const rows = queries.getSeoAll.all()
    const out = {}
    rows.forEach(r => { out[r.page] = r })
    res.json(out)
  })

  app.get('/api/seo/:page', (req, res) => {
    const row = queries.getSeoByPage.get(req.params.page)
    res.json(row || {})
  })

  app.put('/api/admin/seo', requireAuth, (req, res) => {
    const { page, title, description, og_title, og_description, og_image, robots, canonical, tw_title, tw_description, tw_image } = req.body
    if (!page) return res.status(400).json({ error: 'page is required' })
    queries.upsertSeo.run(page, title||'', description||'', og_title||'', og_description||'', og_image||'', robots||'index, follow', canonical||'', tw_title||'', tw_description||'', tw_image||'')
    res.json({ ok: true })
  })

  // Static
  if (isDev) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'mpa',
    })

    // Serve public images with cache headers in dev
    app.use('/figma_images', express.static(resolve(__dirname, 'public/figma_images'), {
      maxAge: '7d'
    }))

    const CLEAN_PAGES = ['custom-homes','commercial','hospitality','bending-stone','furniture','stone-decorative','about','contact']

    // Redirect /page.html → /page (both dev and prod)
    app.use((req, res, next) => {
      const match = req.path.match(/^\/([a-z0-9-]+)\.html$/)
      if (match && CLEAN_PAGES.includes(match[1])) {
        return res.redirect(301, '/' + match[1])
      }
      next()
    })

    // Rewrite clean URL → .html for Vite dev server
    app.use((req, res, next) => {
      const p = req.path
      if (p.includes('.') || p === '/') return next()
      const slug = p.replace(/^\//, '').replace(/\/$/, '')
      if (CLEAN_PAGES.includes(slug)) {
        req.url = req.url.replace(p, '/' + slug + '.html')
      }
      next()
    })

    app.use(vite.middlewares)
  } else {
    const distPath = resolve(__dirname, 'dist')
    const PROD_PAGES = ['custom-homes','commercial','hospitality','bending-stone','furniture','stone-decorative','about','contact']

    // Redirect .html → clean URL in production too
    app.use((req, res, next) => {
      const match = req.path.match(/^\/([a-z0-9-]+)\.html$/)
      if (match && PROD_PAGES.includes(match[1])) {
        return res.redirect(301, '/' + match[1])
      }
      next()
    })

    // Long-lived cache for hashed assets (JS/CSS — Vite adds content hash to filename)
    app.use('/assets', express.static(resolve(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }))

    // Images: revalidate always so replaced images appear immediately
    app.use('/figma_images', express.static(resolve(distPath, 'figma_images'), {
      etag: true,
      lastModified: true,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate')
      }
    }))

    // HTML pages: never cache — always serve latest
    const htmlHeaders = (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      next()
    }

    app.use(express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.setHeader('Pragma', 'no-cache')
          res.setHeader('Expires', '0')
        }
      }
    }))

    PROD_PAGES.forEach(slug => {
      app.get('/' + slug, htmlHeaders, (_req, res) => res.sendFile(resolve(distPath, slug + '.html')))
    })
    app.get('/', htmlHeaders, (_req, res) => res.sendFile(resolve(distPath, 'index.html')))
    app.get('/{*path}', (req, res) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
      res.status(404).sendFile(resolve(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Server → http://0.0.0.0:${PORT}`)
    console.log(`  Admin  → http://0.0.0.0:${PORT}/admin/\n`)
  })
}

main()
