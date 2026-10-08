import express from 'express'
import session from 'express-session'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import fs from 'fs'
import { createServer as createViteServer } from 'vite'
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

  // Pages
  app.get('/api/admin/pages', requireAuth, (_req, res) => {
    res.json([
      { name: 'Home', url: '/' },
      { name: 'Custom Homes', url: '/custom-homes' },
      { name: 'Commercial', url: '/commercial' },
      { name: 'Hospitality', url: '/hospitality' },
      { name: '1MM Bending Stone', url: '/bending-stone' },
      { name: 'Furniture', url: '/furniture' },
      { name: 'Stone Decorative', url: '/stone-decorative' },
      { name: 'About', url: '/about' },
      { name: 'Contact', url: '/contact' }
    ])
  })

  // Messages
  app.get('/api/admin/messages', requireAuth, (_req, res) => {
    res.json(queries.getMessages.all())
  })

  app.patch('/api/admin/messages/:id/read', requireAuth, (req, res) => {
    queries.markRead.run(req.params.id)
    res.json({ ok: true })
  })

  app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
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
    const { page, title, description, og_title, og_description, og_image, robots, canonical } = req.body
    if (!page) return res.status(400).json({ error: 'page is required' })
    queries.upsertSeo.run(page, title||'', description||'', og_title||'', og_description||'', og_image||'', robots||'index, follow', canonical||'')
    res.json({ ok: true })
  })

  // Static
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'mpa',
    })

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

    app.use(express.static(distPath))
    PROD_PAGES.forEach(slug => {
      app.get('/' + slug, (_req, res) => res.sendFile(resolve(distPath, slug + '.html')))
    })
    app.get('/', (_req, res) => res.sendFile(resolve(distPath, 'index.html')))
    app.get('*', (_req, res) => res.status(404).sendFile(resolve(distPath, 'index.html')))
  }

  app.listen(PORT, () => {
    console.log(`\n  Server → http://localhost:${PORT}`)
    console.log(`  Admin  → http://localhost:${PORT}/admin/\n`)
  })
}

main()
