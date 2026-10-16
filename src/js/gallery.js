import './nav.js'
import './language-picker.js'

const imageUrl = filename => `/figma_images/${encodeURIComponent(filename)}`

function createProjectCard(project) {
  const images = project.images || []
  if (!images.length) return null
  const landing = images.find(image => image.is_landing) || images[0]
  const extras = images.filter(image => image.id !== landing.id)
  const card = document.createElement('article')
  card.className = 'project-card'
  card.dataset.lightbox = project.category
  card.dataset.extra = extras.map(image => imageUrl(image.filename)).join(',')

  const img = document.createElement('img')
  img.className = 'card-img'
  img.src = imageUrl(landing.filename)
  img.alt = project.name
  img.loading = 'lazy'
  img.decoding = 'async'
  img.width = 432
  img.height = 520
  card.append(img)

  const body = document.createElement('div')
  body.className = 'card-body card-body--dark'
  const title = document.createElement('h2')
  title.className = 'card-title'
  title.textContent = project.name
  const arrow = document.createElement('span')
  arrow.className = 'card-arrow'
  arrow.setAttribute('aria-hidden', 'true')
  arrow.textContent = '→'
  body.append(title, arrow)
  card.append(body)
  return card
}

async function loadDynamicGalleries() {
  const galleries = [...document.querySelectorAll('[data-dynamic-gallery]')]
  if (!galleries.length) return
  const categories = [...new Set(galleries.map(gallery => gallery.dataset.galleryCategory))]

  await Promise.all(categories.map(async category => {
    let projects
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(category)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Gallery API returned ${response.status}`)
      projects = await response.json()
    } catch {
      const fallback = await fetch(`/gallery-data/${encodeURIComponent(category)}.json`, { cache: 'no-cache' })
      if (!fallback.ok) throw new Error(`Could not load ${category} gallery data`)
      projects = await fallback.json()
    }

    galleries.filter(gallery => gallery.dataset.galleryCategory === category).forEach(gallery => {
      gallery.replaceChildren()
      if (gallery.dataset.galleryLayout === 'images') {
        const imageClass = gallery.dataset.imageClass || ''
        projects.flatMap(project => (project.images || []).map(image => ({ ...image, projectName: project.name }))).forEach(image => {
          const img = document.createElement('img')
          img.className = imageClass
          img.src = imageUrl(image.filename)
          img.alt = image.projectName
          img.loading = 'lazy'
          img.decoding = 'async'
          img.dataset.lightbox = category
          gallery.append(img)
        })
      } else {
        projects.forEach(project => {
          const card = createProjectCard(project)
          if (card) gallery.append(card)
        })
      }
    })
  }))

  // Lightbox binds to gallery items, so load it after the DB content is in the DOM.
  await import('./lightbox.js')
}

loadDynamicGalleries().catch(error => {
  console.error('Gallery data could not be loaded:', error)
  document.querySelectorAll('[data-dynamic-gallery]').forEach(gallery => {
    const message = document.createElement('p')
    message.className = 'page-intro'
    message.textContent = 'Gallery is temporarily unavailable.'
    gallery.replaceChildren(message)
  })
})
