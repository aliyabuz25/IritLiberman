# Irit Liberman Studio

Portfolio website for Irit Liberman — global material sourcing & procurement for custom homes, hospitality, and commercial projects.

**Live site:** https://irit-liberman.vercel.app *(or your custom domain)*

## About

Irit Liberman is a global material sourcing and procurement specialist based in Los Angeles. The site showcases 18 projects across three categories:

- **Custom Homes** — 6 projects (The Bird Street, The Bird Street 2, The Bird Street 3, Beverly Hills, Pacific Palisades, Pasadena)
- **Hospitality** — 5 projects (Bottega Louie WeHo, 1 Hotel WeHo, Edition WeHo, Pendry WeHo, Regent Hotel Santa Monica)
- **Commercial** — 7 projects (Kurve on Wilshire, Skyview Sunset Blvd, DTLA, Circa DTLA, AKA on Sunset Blvd, Oceanwide Plaza, The Harland WeHo)

## Stack

- **Frontend:** Vite MPA, vanilla HTML/CSS/JS
- **Backend:** Express.js + better-sqlite3 (SQLite)
- **Admin:** OctoCMS Lite — custom admin panel with media management, SEO, content editing, and user management

## Features

- Clean URLs (`/about`, `/custom-homes`, etc.)
- Multi-language content (EN, TR, DE) via SQLite i18n
- Lightbox gallery on project pages
- Contact form with inbox in admin panel
- SEO meta tags editable per-page from admin
- Project image replacement via admin panel (no code changes needed)

## Getting started

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`. On the first visit to `/admin/` with an empty database, create the initial admin username and password. There is no default admin account.

## Project structure

```
src/
  *.html          — pages (9 pages)
  admin/          — OctoCMS Lite admin panel
  js/             — nav, gallery, lightbox, i18n
  styles/         — nav, lightbox, footer-cta CSS
public/
  figma_images/   — all site images
data/
  nigar.db        — SQLite database (gitignored)
tests/
  admin.spec.js   — Playwright UI tests (24 tests)
  api.spec.js     — Playwright API tests (17 tests)
server.js         — Express server & REST API
db.js             — database schema, seed data & queries
```

## Build & deploy

```bash
npm run build     # outputs to dist/
npm run preview   # serve built files locally
```

Deployable to Vercel, Railway, Fly.io, or any Node.js host.
