import Database from 'better-sqlite3'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(resolve(DATA_DIR, 'nigar.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    read       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pages (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    file TEXT NOT NULL,
    url  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS i18n (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    page    TEXT NOT NULL,
    key     TEXT NOT NULL,
    lang    TEXT NOT NULL DEFAULT 'en',
    value   TEXT NOT NULL,
    UNIQUE(page, key, lang)
  );

  CREATE TABLE IF NOT EXISTS i18n_languages (
    code TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name     TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename   TEXT NOT NULL,
    is_landing INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS seo (
    page           TEXT PRIMARY KEY,
    title          TEXT DEFAULT '',
    description    TEXT DEFAULT '',
    og_title       TEXT DEFAULT '',
    og_description TEXT DEFAULT '',
    og_image       TEXT DEFAULT '',
    robots         TEXT DEFAULT 'index, follow',
    canonical      TEXT DEFAULT '',
    tw_title       TEXT DEFAULT '',
    tw_description TEXT DEFAULT '',
    tw_image       TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
`)

// Migrations — add columns that may not exist in older DBs
;['tw_title','tw_description','tw_image'].forEach(col => {
  try { db.exec(`ALTER TABLE seo ADD COLUMN ${col} TEXT DEFAULT ''`) } catch {}
})

// Migration — seed projects table if empty
const projCount = db.prepare('SELECT COUNT(*) as c FROM projects').get()
if (projCount.c === 0) {
  const insProj = db.prepare('INSERT INTO projects (category, name, sort_order) VALUES (?,?,?)')
  const insImg  = db.prepare('INSERT INTO project_images (project_id, filename, is_landing, sort_order) VALUES (?,?,?,?)')

  const seed = [
    { cat: 'custom-homes', name: 'The Bird Street', images: [
      { f: 'ch-birdst1-land.jpg', land: 1 }, { f: 'ch-birdst1-2.jpg' }, { f: 'ch-birdst1-3.jpg' },
      { f: 'ch-birdst1-4.jpg' }, { f: 'ch-birdst1-5.jpg' }, { f: 'ch-birdst1-6.jpg' }
    ]},
    { cat: 'custom-homes', name: 'The Bird Street 2', images: [
      { f: 'ch-birdst2-land.jpg', land: 1 }, { f: 'ch-birdst2-2.jpg' }, { f: 'ch-birdst2-3.jpg' }, { f: 'ch-birdst2-4.jpg' }
    ]},
    { cat: 'custom-homes', name: 'The Bird Street 3', images: [
      { f: 'ch-birdst3-land.jpg', land: 1 }, { f: 'ch-birdst3-2.jpg' }
    ]},
    { cat: 'custom-homes', name: 'Beverly Hills', images: [
      { f: 'ch-bevhills-land.jpg', land: 1 }, { f: 'ch-bevhills-2.jpg' }, { f: 'ch-bevhills-3.jpg' },
      { f: 'ch-bevhills-4.jpg' }, { f: 'ch-bevhills-5.avif' }, { f: 'ch-bevhills-6.avif' }, { f: 'ch-bevhills-7.jpg' }
    ]},
    { cat: 'custom-homes', name: 'Pacific Palisades', images: [
      { f: 'ch-pacpal-land.jpg', land: 1 }, { f: 'ch-pacpal-2.jpg' }, { f: 'ch-pacpal-3.jpg' }, { f: 'ch-pacpal-4.jpg' }
    ]},
    { cat: 'custom-homes', name: 'Pasadena', images: [
      { f: 'ch-pasadena-land.jpg', land: 1 }, { f: 'ch-pasadena-2.jpg' }, { f: 'ch-pasadena-3.jpg' }
    ]},
    { cat: 'hospitality', name: 'Bottega Louie WeHo', images: [
      { f: 'hosp-bottega-louie.jpg', land: 1 }, { f: 'hosp-bottega-bar.jpg' }, { f: 'hosp-bottega-front.jpg' }
    ]},
    { cat: 'hospitality', name: '1 Hotel WeHo', images: [
      { f: 'hosp-1hotel-weho.jpg', land: 1 }, { f: 'hosp-1hotel-2.jpg' }, { f: 'hosp-1hotel-3.jpg' }, { f: 'hosp-1hotel-4.jpg' }
    ]},
    { cat: 'hospitality', name: 'Edition WeHo', images: [
      { f: 'hosp-edition-weho.jpg', land: 1 }, { f: 'hosp-edition-2.jpg' }, { f: 'hosp-edition-3.jpg' }, { f: 'hosp-edition-4.jpg' }
    ]},
    { cat: 'hospitality', name: 'Pendry WeHo', images: [
      { f: 'hosp-pendry-weho.jpg', land: 1 }, { f: 'hosp-pendry-2.jpg' }, { f: 'hosp-pendry-3.jpg' }, { f: 'hosp-pendry-4.jpg' }
    ]},
    { cat: 'hospitality', name: 'Regent Hotel Santa Monica', images: [
      { f: 'hosp-regent-sm.jpg', land: 1 }, { f: 'hosp-regent-2.jpg' }, { f: 'hosp-regent-3.jpg' }, { f: 'hosp-regent-4.jpg' }
    ]},
    { cat: 'commercial', name: 'Kurve on Wilshire', images: [{ f: '5b9aa.jpg', land: 1 }]},
    { cat: 'commercial', name: 'Oceanwide Plaza', images: [
      { f: 'comm-oceanwide-pic3.jpg', land: 1 }, { f: 'e05b0.jpg' }, { f: 'comm-oceanwide-graffiti.jpg' }
    ]},
    { cat: 'commercial', name: 'Skyview Sunset Boulevard', images: [{ f: '8ab23.jpg', land: 1 }]},
    { cat: 'commercial', name: 'DTLA', images: [
      { f: 'comm-dtla-gh.jpg', land: 1 }, { f: 'comm-dtla-888.jpg' }, { f: 'comm-dtla-ext.jpg' }
    ]},
    { cat: 'commercial', name: 'Circa DTLA', images: [{ f: '21ba2.jpg', land: 1 }]},
    { cat: 'commercial', name: 'AKA on Sunset Blvd', images: [{ f: 'f24af.jpg', land: 1 }]},
    { cat: 'commercial', name: 'The Harland WeHo', images: [{ f: 'b22ac.jpg', land: 1 }]},
    { cat: 'bending-stone', name: '1MM Bending Stone', images: [
      { f: '9a808.jpg', land: 1 }, { f: '0fcbd.jpg' }, { f: '1c524.jpg' }, { f: '38222.jpg' },
      { f: '283b9.jpg' }, { f: '27cbb.jpg' }, { f: 'bb50f.jpg' }, { f: 'c0f77.jpg' }, { f: '660f7.jpg' }
    ]},
    { cat: 'stone-furniture', name: 'Stone Furniture', images: [
      { f: 'eb5e1.jpg', land: 1 }, { f: '6326b.jpg' }, { f: '63f0b.jpg' }, { f: '82214.jpg' },
      { f: 'daf6b.jpg' }, { f: 'e29e7.jpg' }, { f: 'ebe26.jpg' }, { f: 'fc0b9.jpg' }
    ]},
    { cat: 'stone-blocks', name: 'Stone Blocks', images: [
      { f: '08321.jpg', land: 1 }, { f: '33301.jpg' }, { f: '32fa4.jpg' }
    ]},
  ]

  seed.forEach((proj, pi) => {
    const { lastInsertRowid: pid } = insProj.run(proj.cat, proj.name, pi)
    proj.images.forEach((img, ii) => {
      insImg.run(pid, img.f, img.land ? 1 : 0, ii)
    })
  })
}

// One-time ordering migration: put Oceanwide Plaza first in Commercial while
// preserving the relative order of the other projects.
const oceanwideOrderMigration = 'commercial-oceanwide-first-v1'
const oceanwideOrderApplied = db.prepare('SELECT 1 FROM settings WHERE key=?').get(oceanwideOrderMigration)
if (!oceanwideOrderApplied) {
  const reorderCommercial = db.transaction(() => {
    const projects = db.prepare("SELECT id, name FROM projects WHERE category='commercial' ORDER BY sort_order, id").all()
    const oceanwide = projects.filter(project => project.name.toLowerCase() === 'oceanwide plaza')
    const ordered = [...oceanwide, ...projects.filter(project => project.name.toLowerCase() !== 'oceanwide plaza')]
    const updateSort = db.prepare('UPDATE projects SET sort_order=? WHERE id=?')
    ordered.forEach((project, sortOrder) => updateSort.run(sortOrder, project.id))
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(oceanwideOrderMigration, '1')
  })
  reorderCommercial()
}

// Migration — ensure project title i18n keys exist in older DBs
;[
  ['custom-homes','project.bird-street',    'en','THE BIRD STREET'],
  ['custom-homes','project.bird-street-2',  'en','THE BIRD STREET 2'],
  ['custom-homes','project.bird-street-3',  'en','THE BIRD STREET 3'],
  ['custom-homes','project.beverly-hills',  'en','BEVERLY HILLS'],
  ['custom-homes','project.pacific-palisades','en','PACIFIC PALISADES'],
  ['custom-homes','project.pasadena',       'en','PASADENA'],
  ['hospitality','project.bottega-louie',   'en','BOTTEGA LOUIE WEHO'],
  ['hospitality','project.1-hotel-weho',    'en','1 HOTEL WEHO'],
  ['hospitality','project.edition-weho',    'en','EDITION WEHO'],
  ['hospitality','project.pendry-weho',     'en','PENDRY WEHO'],
  ['hospitality','project.regent-hotel',    'en','REGENT HOTEL SANTA MONICA'],
  ['commercial','project.kurve-wilshire',   'en','KURVE ON WILSHIRE'],
  ['commercial','project.skyview-sunset',   'en','SKYVIEW SUNSET BOULEVARD'],
  ['commercial','project.dtla',             'en','DTLA (DOWNTOWN LOS ANGELES)'],
  ['commercial','project.circa-dtla',       'en','CIRCA DTLA'],
  ['commercial','project.aka-sunset',       'en','AKA ON SUNSET BLVD'],
  ['commercial','project.oceanwide-plaza',  'en','OCEANWIDE PLAZA'],
  ['commercial','project.harland-weho',     'en','THE HARLAND WEHO'],
].forEach(([page,key,lang,value]) => {
  try {
    db.prepare('INSERT OR IGNORE INTO i18n (page,key,lang,value) VALUES (?,?,?,?)').run(page,key,lang,value)
  } catch {}
})

// No default admin seed — first-run setup screen handles this


const pageCount = db.prepare('SELECT COUNT(*) as c FROM pages').get()
if (pageCount.c === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO pages (slug,name,file,url) VALUES (?,?,?,?)')
  ;[
    ['home',             'Home',              'index.html',            '/'],
    ['custom-homes',     'Custom Homes',      'custom-homes.html',     '/custom-homes'],
    ['commercial',       'Commercial',        'commercial.html',       '/commercial'],
    ['hospitality',      'Hospitality',       'hospitality.html',      '/hospitality'],
    ['bending-stone',    '1MM Bending Stone', 'bending-stone.html',    '/bending-stone'],
    ['furniture',        'Stone Furniture',   'furniture.html',        '/furniture'],
    ['stone-decorative', 'Stone Blocks',      'stone-decorative.html', '/stone-decorative'],
    ['about',            'About Irit',        'about.html',            '/about'],
    ['contact',          'Contact',           'contact.html',          '/contact'],
  ].forEach(r => ins.run(...r))
}


const i18nCount = db.prepare('SELECT COUNT(*) as c FROM i18n').get()
if (i18nCount.c === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO i18n (page,key,lang,value) VALUES (?,?,?,?)')

  const rows = [
    // nav
    ['nav','experience',        'en','Projects'],
    ['nav','experience',        'tr','Seçili Deneyimler'],
    ['nav','experience',        'de','Ausgewählte Projekte'],
    ['nav','capabilities',      'en','Capabilities'],
    ['nav','capabilities',      'tr','Yetenekler'],
    ['nav','capabilities',      'de','Fähigkeiten'],
    ['nav','about',             'en','About Irit'],
    ['nav','about',             'tr','Irit Hakkında'],
    ['nav','about',             'de','Über Irit'],
    ['nav','contact',           'en','Contact'],
    ['nav','contact',           'tr','İletişim'],
    ['nav','contact',           'de','Kontakt'],
    ['nav','discuss',           'en','Discuss a Project'],
    ['nav','discuss',           'tr','Proje Görüşelim'],
    ['nav','discuss',           'de','Projekt besprechen'],

    // home
    ['home','hero.title',       'en','The Right Stone Is Already Out There.'],
    ['home','hero.title',       'tr','Doğru Taş Zaten Orada.'],
    ['home','hero.title',       'de','Der richtige Stein ist bereits da.'],
    ['home','hero.subtitle',    'en',"Let's Bring It Home."],
    ['home','hero.subtitle',    'tr','Eve Getirelim.'],
    ['home','hero.subtitle',    'de','Bringen wir ihn nach Hause.'],
    ['home','hero.cta',         'en','Discuss a Project'],
    ['home','hero.cta',         'tr','Proje Görüşelim'],
    ['home','hero.cta',         'de','Projekt besprechen'],
    ['home','scale.eyebrow',    'en','01 / Project Scale'],
    ['home','scale.eyebrow',    'tr','01 / Proje Ölçeği'],
    ['home','scale.eyebrow',    'de','01 / Projektumfang'],
    ['home','scale.title',      'en','When the Scale Is Right, the Possibilities Open Up.'],
    ['home','scale.title',      'tr','Ölçek Doğru Olduğunda Olasılıklar Açılır.'],
    ['home','scale.title',      'de','Wenn der Maßstab stimmt, eröffnen sich Möglichkeiten.'],
    ['home','scale.intro',      'en','Big projects need a different approach. Irit goes straight to the source — quarries, factories, the people who actually make the material. For custom homes, hotels, and commercial builds that can\'t afford to guess.'],
    ['home','scale.intro',      'tr','Büyük özel konutlar, otelcilik ve ticari projeler için doğrudan malzeme tedariki.'],
    ['home','scale.intro',      'de','Direktbeschaffung für große Privatresidenzen, Hospitality- und Gewerbeprojekte.'],
    ['home','philosophy.eyebrow','en','02 / Philosophy'],
    ['home','philosophy.eyebrow','tr','02 / Felsefe'],
    ['home','philosophy.eyebrow','de','02 / Philosophie'],
    ['home','philosophy.title', 'en','Beyond What Is Readily Available.'],
    ['home','philosophy.title', 'tr','Hazırın Ötesinde.'],
    ['home','philosophy.title', 'de','Jenseits des Verfügbaren.'],
    ['home','materials.label',  'en','Natural Stone · Porcelain Tile · Quartz in Substantial Quantities'],
    ['home','materials.label',  'tr','Doğal Taş · Porselen Fayans · Büyük Miktarlarda Kuvars'],
    ['home','materials.label',  'de','Naturstein · Keramikfliesen · Quarz in großen Mengen'],

    // footer
    ['footer','cta.label',      'en','Ready to Start?'],
    ['footer','cta.label',      'tr','Başlamaya Hazır mısınız?'],
    ['footer','cta.label',      'de','Bereit anzufangen?'],
    ['footer','cta.heading',    'en',"Let's Find the Right Material for Your Project."],
    ['footer','cta.heading',    'tr','Projeniz İçin Doğru Malzemeyi Bulalım.'],
    ['footer','cta.heading',    'de','Finden wir das richtige Material für Ihr Projekt.'],
    ['footer','cta.btn',        'en','Discuss a Project'],
    ['footer','cta.btn',        'tr','Proje Görüşelim'],
    ['footer','cta.btn',        'de','Projekt besprechen'],

    // contact
    ['contact','eyebrow',       'en','Got a Project in Mind?'],
    ['contact','eyebrow',       'tr','Aklınızda Bir Proje mi Var?'],
    ['contact','eyebrow',       'de','Haben Sie ein Projekt im Sinn?'],
    ['contact','headline',      'en',"Let's Talk"],
    ['contact','headline',      'tr','Konuşalım'],
    ['contact','headline',      'de','Sprechen wir'],
    ['contact','phone.label',   'en','Phone Number'],
    ['contact','phone.label',   'tr','Telefon Numarası'],
    ['contact','phone.label',   'de','Telefonnummer'],
    ['contact','email.label',   'en','Email Address'],
    ['contact','email.label',   'tr','E-posta Adresi'],
    ['contact','email.label',   'de','E-Mail-Adresse'],
    ['contact','address.label', 'en','Address'],
    ['contact','address.label', 'tr','Adres'],
    ['contact','address.label', 'de','Adresse'],

    // about
    ['about','headline',        'en','Experience Matters.'],
    ['about','headline',        'tr','Deneyim Önemlidir.'],
    ['about','headline',        'de','Erfahrung zählt.'],
    ['about','intro1',          'en','Good stone is everywhere. Knowing what to do with it — that\'s harder. Irit has spent over 15 years in fabrication and installation. She\'s seen what gets missed, what gets damaged, what gets reordered at the last minute.'],
    ['about','intro1',          'tr','Güzel malzeme sadece bir başlangıçtır. Irit, seçim ve montaj arasında neler ters gidebileceğini bilir.'],
    ['about','intro1',          'de','Schönes Material ist nur der Anfang. Irit weiß, was zwischen Auswahl und Einbau schiefgehen kann.'],
    ['about','quote',           'en','Anyone can find the stone. Irit makes sure it actually works.'],
    ['about','quote',           'tr','Tüm projeyi gören deneyim.'],
    ['about','quote',           'de','Erfahrung, die das gesamte Projekt im Blick hat.'],
    ['about','cta.heading',     'en',"Find What You're Looking For."],
    ['about','cta.heading',     'tr','Aradığınızı Bulun.'],
    ['about','cta.heading',     'de','Finden Sie, was Sie suchen.'],
    ['about','bring.label',     'en','What Irit Brings'],
    ['about','bring.label',     'tr','Irit\'in Sundukları'],
    ['about','bring.label',     'de','Was Irit mitbringt'],
    ['about','art1.title',      'en','15+ Years in the Field'],
    ['about','art1.title',      'tr','15+ Yıllık Deneyim'],
    ['about','art1.title',      'de','15+ Jahre Erfahrung'],
    ['about','art1.text',       'en','More than 15 years inside stone fabrication and installation have sharpened her eye for what can go wrong.'],
    ['about','art1.text',       'tr','15 yılı aşkın taş işleme ve montaj deneyimi, nelerin ters gidebileceğini görme yetisini keskinleştirdi.'],
    ['about','art1.text',       'de','Über 15 Jahre in der Steinbearbeitung haben ihren Blick für mögliche Fehler geschärft.'],
    ['about','art2.title',      'en','Global Quarry Access'],
    ['about','art2.title',      'tr','Global Taş Ocağı Erişimi'],
    ['about','art2.title',      'de','Globaler Steinbruchzugang'],
    ['about','art3.title',      'en','Execution Insight'],
    ['about','art3.title',      'tr','Uygulama Uzmanlığı'],
    ['about','art3.title',      'de','Ausführungskompetenz'],
    ['about','art4.title',      'en','End-to-End Delivery'],
    ['about','art4.title',      'tr','Uçtan Uca Teslimat'],
    ['about','art4.title',      'de','End-to-End-Lieferung'],

    // page titles
    ['custom-homes',    'title','en','Custom Homes'],
    ['custom-homes',    'title','tr','Özel Konutlar'],
    ['custom-homes',    'title','de','Privatvillen'],
    ['commercial',      'title','en','Commercial'],
    ['commercial',      'title','tr','Ticari'],
    ['commercial',      'title','de','Gewerbe'],
    ['hospitality',     'title','en','Hospitality'],
    ['hospitality',     'title','tr','Otelcilik'],
    ['hospitality',     'title','de','Hotellerie'],
    ['bending-stone',   'title','en','1MM Bending Stone'],
    ['bending-stone',   'title','tr','1MM Bükülür Taş'],
    ['bending-stone',   'title','de','1MM Biegestein'],
    ['bending-stone',   'intro','en','Ultra-thin flexible stone for curves, columns, and surfaces where conventional slabs cannot follow the architecture.'],
    ['bending-stone',   'intro','tr','Eğriler, sütunlar ve konvansiyonel levhaların takip edemediği yüzeyler için ultra ince esnek taş.'],
    ['bending-stone',   'intro','de','Ultradünner, flexibler Stein für Kurven, Säulen und Oberflächen, denen konventionelle Platten nicht folgen können.'],
    ['furniture',       'title','en','Stone Furniture'],
    ['furniture',       'title','tr','Taş Mobilya'],
    ['furniture',       'title','de','Steinmöbel'],
    ['furniture',       'intro','en','Sculptural stone pieces and custom furnishings sourced for interiors that need material presence beyond standard catalog options.'],
    ['furniture',       'intro','tr','Standart katalog seçeneklerinin ötesinde malzeme varlığı ihtiyacı duyan mekânlar için heykelsi taş parçalar.'],
    ['furniture',       'intro','de','Skulpturale Steinstücke für Räume, die mehr als Standardkatalog-Optionen benötigen.'],
    ['stone-decorative','title','en','Stone Blocks'],
    ['stone-decorative','title','tr','Taş Bloklar'],
    ['stone-decorative','title','de','Steinblöcke'],
    ['stone-decorative','intro','en','Solid blocks and decorative stone volumes selected for architectural features, landscape, and statement interiors.'],
    ['stone-decorative','intro','tr','Mimari özellikler, peyzaj ve çarpıcı iç mekânlar için seçilmiş sağlam bloklar.'],
    ['stone-decorative','intro','de','Massivblöcke für architektonische Akzente, Landschaftsgestaltung und markante Innenräume.'],

    // nav items
    ['nav','custom-homes',       'en','CUSTOM HOMES'],
    ['nav','custom-homes',       'tr','ÖZEL KONUTLAR'],
    ['nav','custom-homes',       'de','PRIVATVILLEN'],
    ['nav','commercial',         'en','COMMERCIAL'],
    ['nav','commercial',         'tr','TİCARİ'],
    ['nav','commercial',         'de','GEWERBE'],
    ['nav','hospitality',        'en','HOSPITALITY'],
    ['nav','hospitality',        'tr','OTELCİLİK'],
    ['nav','hospitality',        'de','HOTELLERIE'],
    ['nav','bending-stone',      'en','1MM BENDING STONE'],
    ['nav','bending-stone',      'tr','1MM BÜKÜLEN TAŞ'],
    ['nav','bending-stone',      'de','1MM BIEGESTEIN'],
    ['nav','stone-blocks',       'en','STONE BLOCKS'],
    ['nav','stone-blocks',       'tr','TAŞ BLOKLAR'],
    ['nav','stone-blocks',       'de','STEINBLÖCKE'],
    ['nav','stone-furniture',    'en','STONE FURNITURE'],
    ['nav','stone-furniture',    'tr','TAŞ MOBİLYA'],
    ['nav','stone-furniture',    'de','STEINMÖBEL'],

    // home extras
    ['home','hero.continue',        'en','Continue'],
    ['home','hero.continue',        'tr','Devam'],
    ['home','hero.continue',        'de','Weiter'],
    ['home','materials.stone',      'en','Natural Stone'],
    ['home','materials.stone',      'tr','Doğal Taş'],
    ['home','materials.stone',      'de','Naturstein'],
    ['home','materials.porcelain',  'en','Porcelain Tile'],
    ['home','materials.porcelain',  'tr','Porselen Fayans'],
    ['home','materials.porcelain',  'de','Keramikfliesen'],
    ['home','materials.quartz',     'en','Quartz in Substantial Quantities'],
    ['home','materials.quartz',     'tr','Büyük Miktarlarda Kuvars'],
    ['home','materials.quartz',     'de','Quarz in großen Mengen'],
    ['home','scale.material-list',  'en','Natural Stone. Porcelain Tile. Quartz in Substantial Quantities.'],
    ['home','scale.material-list',  'tr','Doğal Taş. Porselen Fayans. Büyük Miktarlarda Kuvars.'],
    ['home','scale.material-list',  'de','Naturstein. Keramikfliesen. Quarz in großen Mengen.'],
    ['home','scale.benefit1',       'en','More choice.'],
    ['home','scale.benefit1',       'tr','Daha fazla seçenek.'],
    ['home','scale.benefit1',       'de','Mehr Auswahl.'],
    ['home','scale.benefit2',       'en','Markup layers removed.'],
    ['home','scale.benefit2',       'tr','Ara kâr katmanları kaldırıldı.'],
    ['home','scale.benefit2',       'de','Aufschlagsebenen entfernt.'],
    ['home','scale.benefit3',       'en','Greater control over quality, consistency, budget, and delivery.'],
    ['home','scale.benefit3',       'tr','Kalite, tutarlılık, bütçe ve teslimat üzerinde daha fazla kontrol.'],
    ['home','scale.benefit3',       'de','Mehr Kontrolle über Qualität, Konsistenz, Budget und Lieferung.'],
    ['home','philosophy.figcaption','en','Materials selected with intention'],
    ['home','philosophy.figcaption','tr','Bilinçle seçilmiş malzemeler'],
    ['home','philosophy.figcaption','de','Bewusst ausgewählte Materialien'],
    ['home','philosophy.copy1',     'en','I\'ve been doing this long enough to know that the right material exists for every project. You just have to know where to look — and who to call.'],
    ['home','philosophy.copy1',     'tr','Her projenin kendine ait bir malzeme olduğuna inanıyorum — bütünlük ve güzel bir şey yaratma niyetiyle çalışıldığında doğru kapılar açılır.'],
    ['home','philosophy.copy1',     'de','Ich glaube, jedes Projekt hat sein eigenes Material — wenn wir mit Integrität arbeiten, öffnen sich die richtigen Türen.'],
    ['home','philosophy.copy2',     'en','Whether it\'s a spec on a drawing or something that doesn\'t exist yet, I start the same way — by listening. What\'s the space, what\'s the budget, what\'s it supposed to feel like when it\'s done.'],
    ['home','philosophy.copy2',     'tr','Standart özelliklerden özel konseptlere kadar her arayış dinlemekle başlar — tasarımı, ölçeği, uygulamayı ve projenin ne olması gerektiğini anlamak.'],
    ['home','philosophy.copy2',     'de','Von Standardspezifikationen bis zu individuellen Konzepten beginnt jede Suche mit Zuhören.'],
    ['home','philosophy.assurance', 'en','I won\'t push you toward something that doesn\'t fit. If it\'s not right, we keep looking. That\'s just how I work.'],
    ['home','philosophy.assurance', 'tr','Uzlaşmaya zorlamak yok. Sadece düşünceli rehberlik, dürüst ilişkiler ve doğru malzemenin projenize ulaşacağına dair sessiz bir güven.'],
    ['home','philosophy.assurance', 'de','Kein Druck zu einigen. Nur durchdachte Begleitung, ehrliche Beziehungen und stilles Vertrauen.'],

    // custom homes — project titles
    ['custom-homes','project.bird-street',    'en','THE BIRD STREET'],
    ['custom-homes','project.bird-street-2',  'en','THE BIRD STREET 2'],
    ['custom-homes','project.bird-street-3',  'en','THE BIRD STREET 3'],
    ['custom-homes','project.beverly-hills',  'en','BEVERLY HILLS'],
    ['custom-homes','project.pacific-palisades','en','PACIFIC PALISADES'],
    ['custom-homes','project.pasadena',       'en','PASADENA'],

    // hospitality — project titles
    ['hospitality','project.bottega-louie',   'en','BOTTEGA LOUIE WEHO'],
    ['hospitality','project.1-hotel-weho',    'en','1 HOTEL WEHO'],
    ['hospitality','project.edition-weho',    'en','EDITION WEHO'],
    ['hospitality','project.pendry-weho',     'en','PENDRY WEHO'],
    ['hospitality','project.regent-hotel',    'en','REGENT HOTEL SANTA MONICA'],

    // commercial — project titles
    ['commercial','project.kurve-wilshire',   'en','KURVE ON WILSHIRE'],
    ['commercial','project.skyview-sunset',   'en','SKYVIEW SUNSET BOULEVARD'],
['commercial','project.dtla',             'en','DTLA (DOWNTOWN LOS ANGELES)'],
    ['commercial','project.circa-dtla',       'en','CIRCA DTLA'],
    ['commercial','project.aka-sunset',       'en','AKA ON SUNSET BLVD'],
    ['commercial','project.oceanwide-plaza',  'en','OCEANWIDE PLAZA'],
    ['commercial','project.harland-weho',     'en','THE HARLAND WEHO'],
  ]

  rows.forEach(r => ins.run(...r))
}

// Preserve languages in the admin even when a translation has not been entered yet.
db.prepare('INSERT OR IGNORE INTO i18n_languages (code) SELECT DISTINCT lang FROM i18n').run()

export default db
export const queries = {
  // Users
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username=?'),
  getUsers:      db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at ASC'),
  insertUser:    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)'),
  updateUserPass:db.prepare('UPDATE users SET password=? WHERE id=?'),
  deleteUser:    db.prepare('DELETE FROM users WHERE id=? AND id != 1'), // prevent deleting initial admin

  // Messages
  getMessages:   db.prepare('SELECT * FROM messages ORDER BY created_at DESC'),
  insertMessage: db.prepare('INSERT INTO messages (name,email,message) VALUES (?,?,?)'),
  deleteMessage: db.prepare('DELETE FROM messages WHERE id=?'),
  markRead:      db.prepare('UPDATE messages SET read=1 WHERE id=?'),
  unreadCount:   db.prepare('SELECT COUNT(*) as c FROM messages WHERE read=0'),

  // Settings
  getSettings:   db.prepare('SELECT key, value FROM settings'),
  getSetting:    db.prepare('SELECT value FROM settings WHERE key=?'),
  setSetting:    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),

  // Pages
  getPages:      db.prepare('SELECT * FROM pages ORDER BY id'),

  // SEO
  getSeoAll:    db.prepare('SELECT * FROM seo'),
  getSeoByPage: db.prepare('SELECT * FROM seo WHERE page=?'),
  upsertSeo:    db.prepare(`
    INSERT INTO seo (page,title,description,og_title,og_description,og_image,robots,canonical,tw_title,tw_description,tw_image)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(page) DO UPDATE SET
      title=excluded.title, description=excluded.description,
      og_title=excluded.og_title, og_description=excluded.og_description,
      og_image=excluded.og_image, robots=excluded.robots, canonical=excluded.canonical,
      tw_title=excluded.tw_title, tw_description=excluded.tw_description, tw_image=excluded.tw_image
  `),

  // Projects
  getProjectsByCategory: db.prepare('SELECT * FROM projects WHERE category=? ORDER BY sort_order,id'),
  getAllProjects: db.prepare('SELECT * FROM projects ORDER BY category, sort_order, id'),
  getProjectImages: db.prepare('SELECT * FROM project_images WHERE project_id=? ORDER BY sort_order,id'),
  insertProject: db.prepare('INSERT INTO projects (category,name,sort_order) VALUES (?,?,?)'),
  updateProjectName: db.prepare('UPDATE projects SET name=? WHERE id=?'),
  deleteProject: db.prepare('DELETE FROM projects WHERE id=?'),
  insertProjectImage: db.prepare('INSERT INTO project_images (project_id,filename,is_landing,sort_order) VALUES (?,?,?,?)'),
  setLanding: db.prepare('UPDATE project_images SET is_landing=CASE WHEN id=? THEN 1 ELSE 0 END WHERE project_id=?'),
  deleteProjectImage: db.prepare('DELETE FROM project_images WHERE id=?'),
  getProjectImageById: db.prepare('SELECT * FROM project_images WHERE id=?'),
  getProjectById: db.prepare('SELECT * FROM projects WHERE id=?'),
  updateProjectSort: db.prepare('UPDATE projects SET sort_order=? WHERE id=?'),
  updateImageSort: db.prepare('UPDATE project_images SET sort_order=? WHERE id=?'),

  // I18N
  getI18nByLang: db.prepare('SELECT * FROM i18n WHERE lang=? ORDER BY page,key'),
  getI18nAll:    db.prepare('SELECT * FROM i18n ORDER BY page,key,lang'),
  allKeys:       db.prepare('SELECT DISTINCT page,key FROM i18n ORDER BY page,key'),
  getEntry:      db.prepare('SELECT * FROM i18n WHERE page=? AND key=? AND lang=?'),
  upsert:        db.prepare(`
    INSERT INTO i18n (page,key,lang,value) VALUES (?,?,?,?)
    ON CONFLICT(page,key,lang) DO UPDATE SET value=excluded.value
  `),
  deleteEntry:   db.prepare('DELETE FROM i18n WHERE id=?'),
  getLangs:      db.prepare('SELECT code AS lang FROM i18n_languages ORDER BY sort_order, code'),
}
