import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { queries } from '../db.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'public', 'gallery-data')
const categories = [
  'custom-homes',
  'commercial',
  'hospitality',
  'bending-stone',
  'stone-furniture',
  'stone-blocks',
]

fs.mkdirSync(output, { recursive: true })

for (const category of categories) {
  const projects = queries.getProjectsByCategory.all(category).map(project => ({
    ...project,
    images: queries.getProjectImages.all(project.id),
  }))
  fs.writeFileSync(path.join(output, `${category}.json`), `${JSON.stringify(projects, null, 2)}\n`)
}
