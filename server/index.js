import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { initializeDatabase, pool } from './database.js'
import puppeteer from 'puppeteer'
import chromium from '@sparticuz/chromium'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import ImageModule from 'docxtemplater-image-module-free'
import { appealRightsLabel, complianceLabel } from './document-compliance.js'
import { buildParkingData } from './parking-data.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const allowedOrigins = new Set((process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean))
const sessionCookieAttributes = `HttpOnly; Path=/; SameSite=${process.env.NODE_ENV === 'production' ? 'None; Secure' : 'Lax'}`
const templateFile = path.resolve('server', 'template.docx')
const vicmapUrl = 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/arcgis/rest/services/Vicmap_Parcel/FeatureServer/0/query'
const planningUrl = 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/arcgis/rest/services/Vicmap_Planning/FeatureServer'
const geocoderUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates'
const imageryUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'
const serviceSpatialReference = '3857'

app.use(express.json({ limit: '25mb' }))
app.use((request, response, next) => {
  const origin = request.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.vary('Origin')
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

function id() { return crypto.randomUUID() }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }
}
function validPassword(password, user) {
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.salt).hash, 'hex'), Buffer.from(user.passwordHash, 'hex'))
}
function cookieValue(request, name) {
  return (request.headers.cookie || '').split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1]
}
async function userFromRequest(request) {
  const token = cookieValue(request, 'plan_vic_session')
  if (!token) return null
  const result = await pool.query(
    'SELECT users.id, users.name, users.email FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.token = $1 AND sessions.expires_at > $2',
    [token, Date.now()],
  )
  return result.rows[0] || null
}
async function requireUser(request, response, next) {
  const user = await userFromRequest(request)
  if (!user) return response.status(401).json({ error: 'Authentication required' })
  request.user = user
  next()
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email } }
function zoneClause(zone) {
  const normalized = String(zone || '').trim().toUpperCase()
  const match = normalized.match(/^(GRZ|NRZ|RGZ)(\d+)$/)
  if (!match) return null
  const clause = { GRZ: '32.08', NRZ: '32.09', RGZ: '32.07' }[match[1]]
  return { clause, schedule: `s${match[2]}`, zone: normalized }
}
async function launchBrowser() {
  const useBundledChromium = !process.env.PUPPETEER_EXECUTABLE_PATH && process.platform === 'linux'
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (useBundledChromium ? await chromium.executablePath() : await puppeteer.executablePath())
  return puppeteer.launch({ headless: true, executablePath, args: useBundledChromium ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'] })
}
async function scrapePlanningStandards(lga, zone, dwellings) {
  const mapping = zoneClause(zone)
  if (!mapping) return { supported: false, rows: [], text: '', message: 'This zone prefix is not supported for automatic scraping. Enter the table data manually.' }
  const url = `https://planning-schemes.app.planning.vic.gov.au/${encodeURIComponent(String(lga).trim().toUpperCase())}/ordinance/${mapping.clause}-${mapping.schedule}`
  const prefix = Number(dwellings) > 1 ? 'B' : 'A'
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForFunction(() => [...document.querySelectorAll('table')].some((table) => table.matches('table.ordinance-section__table.clause-1') || [...table.querySelectorAll('tr:first-child th, tr:first-child td')].some((cell) => cell.innerText.trim().toLowerCase() === 'standard')), { timeout: 30000 })
    const rows = await page.$$eval('table.ordinance-section__table.clause-1, table.table-style-2', (tables, rowPrefix) => {
      const table = tables.find((candidate) => [...candidate.querySelectorAll('tr:first-child th, tr:first-child td')].some((cell) => cell.innerText.trim().toLowerCase() === 'standard'))
      if (!table) return []
      let label = ''
      const tableRows = [...table.querySelectorAll('tr')].slice(1).map((row) => {
        const cells = [...row.querySelectorAll('th,td')].map((cell) => cell.innerText.replace(/\s+/g, ' ').trim())
        if (cells.length > 2) { label = cells[0]; return cells }
        return label ? [label, ...cells] : cells
      })
      return tableRows.map((cells) => ({ cells, standardIndex: cells.findIndex((cell) => new RegExp(`(?:^|\\s|and )${rowPrefix}\\d+(?:-\\d+)?\\b`, 'i').test(cell)) })).filter(({ standardIndex }) => standardIndex >= 0).map(({ cells, standardIndex }) => { const standard = cells[standardIndex].match(new RegExp(`${rowPrefix}\\d+(?:-\\d+)?`, 'i'))?.[0] || cells[standardIndex]; return { standard, values: cells, text: cells.map((cell, index) => index === standardIndex ? standard : cell).join(' | ') } })
    }, prefix)
    const maxHeight = await page.$$eval('.ordinance-section__content', (sections) => {
      const section = sections.find((candidate) => [...candidate.querySelectorAll('h2, h3')].some((heading) => /maximum building height/i.test(heading.innerText)))
      if (!section) return ''
      const heading = [...section.querySelectorAll('h2, h3')].find((candidate) => /maximum building height/i.test(candidate.innerText))
      const value = heading?.closest('.heading-wrapper')?.nextElementSibling?.innerText
      return value?.replace(/\s+/g, ' ').trim() || ''
    })
    return { supported: true, url, zone: mapping.zone, clause: mapping.clause, schedule: mapping.schedule, filter: prefix, rows, text: rows.map((row) => row.text).join('\n'), maxHeight: maxHeight || 'None specified.', message: rows.length ? 'Planning standards scraped successfully' : 'The table loaded but no matching standards were found' }
  } finally {
    await browser.close()
  }
}
function geodesicAreaFromWebMercator(geometry) {
  if (!geometry?.rings?.length) return null
  const radius = 6378137
  const ringArea = (ring) => {
    let area = 0
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [x1, y1] = ring[index]
      const [x2, y2] = ring[index + 1]
      const longitude1 = x1 / radius
      const longitude2 = x2 / radius
      const latitude1 = 2 * Math.atan(Math.exp(y1 / radius)) - Math.PI / 2
      const latitude2 = 2 * Math.atan(Math.exp(y2 / radius)) - Math.PI / 2
      area += (longitude2 - longitude1) * (2 + Math.sin(latitude1) + Math.sin(latitude2))
    }
    return area * radius ** 2 / 2
  }
  return Math.round(Math.abs(geometry.rings.reduce((total, ring) => total + ringArea(ring), 0)) * 100) / 100
}
async function queryPlanningLayer(layerId, geometry) {
  const query = new URLSearchParams({ f: 'json', where: '1=1', geometry: JSON.stringify(geometry), geometryType: 'esriGeometryPolygon', inSR: serviceSpatialReference, spatialRel: 'esriSpatialRelIntersects', outFields: 'zone_code,zone_description,lga,scheme_code', returnGeometry: 'true', outSR: serviceSpatialReference })
  const result = await fetch(`${planningUrl}/${layerId}/query?${query}`)
  if (!result.ok) throw new Error(`Vicmap Planning layer ${layerId} responded with ${result.status}`)
  const payload = await result.json()
  if (payload.error) throw new Error(payload.error.message || `Vicmap Planning layer ${layerId} returned an error`)
  return payload.features || []
}
async function queryPlanningLayerOrEmpty(layerId, geometry) {
  try {
    return await queryPlanningLayer(layerId, geometry)
  } catch (error) {
    console.warn(`Vicmap Planning layer ${layerId} unavailable, continuing without it: ${error.message}`)
    return []
  }
}
function geometryExtent(geometry) {
  const points = geometry?.rings?.flat() || []
  if (!points.length) return null
  return points.reduce(([xmin, ymin, xmax, ymax], [x, y]) => [Math.min(xmin, x), Math.min(ymin, y), Math.max(xmax, x), Math.max(ymax, y)], [Infinity, Infinity, -Infinity, -Infinity])
}
function expandExtent(extent, padding = 0.15) {
  const [xmin, ymin, xmax, ymax] = extent
  const width = xmax - xmin || 1
  const height = ymax - ymin || 1
  const pad = Math.max(width, height) * padding
  return [xmin - pad, ymin - pad, xmax + pad, ymax + pad]
}
function imageExtent(geometry) {
  const extent = geometryExtent(geometry)
  if (!extent) return null
  let [xmin, ymin, xmax, ymax] = expandExtent(extent, 2)
  const targetAspect = 900 / 600
  const width = xmax - xmin
  const height = ymax - ymin
  const currentAspect = width / height
  if (currentAspect < targetAspect) {
    const targetWidth = height * targetAspect
    const center = (xmin + xmax) / 2
    xmin = center - targetWidth / 2
    xmax = center + targetWidth / 2
  } else if (currentAspect > targetAspect) {
    const targetHeight = width / targetAspect
    const center = (ymin + ymax) / 2
    ymin = center - targetHeight / 2
    ymax = center + targetHeight / 2
  }
  return [xmin, ymin, xmax, ymax]
}
function svgMap(features, color, label, sharedExtent = null) {
  const geometries = features.map((feature) => feature.geometry).filter(Boolean)
  const extents = geometries.map(geometryExtent).filter(Boolean)
  if (!extents.length) return ''
  const extent = sharedExtent || expandExtent(extents.reduce(([xmin, ymin, xmax, ymax], [featureXmin, featureYmin, featureXmax, featureYmax]) => [Math.min(xmin, featureXmin), Math.min(ymin, featureYmin), Math.max(xmax, featureXmax), Math.max(ymax, featureYmax)], [Infinity, Infinity, -Infinity, -Infinity]))
  const [xmin, ymin, xmax, ymax] = extent
  const width = 900
  const height = 600
  const project = ([x, y]) => `${((x - xmin) / (xmax - xmin)) * width},${height - ((y - ymin) / (ymax - ymin)) * height}`
  const paths = geometries.flatMap((geometry) => geometry.rings.map((ring) => `<path d="M ${ring.map(project).join(' L ')} Z"/>`)).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><g fill="${color}" fill-opacity=".46" stroke="${color}" stroke-width="4">${paths}</g><path d="M 0 ${height / 2} H ${width} M ${width / 2} 0 V ${height}" stroke="#fff" stroke-width="3" opacity=".75"/><text x="28" y="54" font-family="monospace" font-size="22" fill="#fff" stroke="#172c2a" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${label}</text><text x="28" y="580" font-family="monospace" font-size="15" fill="#fff" stroke="#172c2a" stroke-width="3" paint-order="stroke" stroke-linejoin="round">VICMAP PLANNING / SPATIAL INTERSECT</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
function boundaryOverlayUrl(geometry) {
  const extent = imageExtent(geometry)
  if (!extent) return ''
  const [xmin, ymin, xmax, ymax] = extent
  const width = 900
  const height = 600
  const project = ([x, y]) => `${((x - xmin) / (xmax - xmin)) * width},${height - ((y - ymin) / (ymax - ymin)) * height}`
  const paths = (geometry.rings || []).map((ring) => `<path d="M ${ring.map(project).join(' L ')} Z"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><g fill="#d8f15a" fill-opacity=".18" stroke="#172c2a" stroke-width="18" stroke-linejoin="round">${paths}</g><g fill="none" stroke="#ef553d" stroke-width="10" stroke-linejoin="round">${paths}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
function satelliteImageUrl(geometry) {
  const extent = imageExtent(geometry)
  if (!extent) return ''
  const [xmin, ymin, xmax, ymax] = extent
  return `${imageryUrl}?${new URLSearchParams({ f: 'image', bbox: [xmin, ymin, xmax, ymax].join(','), bboxSR: serviceSpatialReference, imageSR: serviceSpatialReference, size: '900,600', format: 'png', pixelType: 'U8', noDataInterpretation: 'esriNoDataMatchAny', interpolation: 'RSP_BilinearInterpolation' })}`
}
async function geocodeAddress(address) {
  const query = new URLSearchParams({ f: 'json', singleLine: address, outSR: '4326', maxLocations: '5' })
  const result = await fetch(`${geocoderUrl}?${query}`)
  if (!result.ok) throw new Error(`ArcGIS geocoder responded with ${result.status}`)
  const payload = await result.json()
  const candidate = payload.candidates?.find((item) => item.location?.x && item.location?.y)
  if (!candidate) return null
  return { address: candidate.address, longitude: candidate.location.x, latitude: candidate.location.y, score: candidate.score }
}
async function queryParcel(point) {
  const query = new URLSearchParams({ f: 'json', where: '1=1', geometry: JSON.stringify({ x: point.longitude, y: point.latitude, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true', outSR: serviceSpatialReference })
  const result = await fetch(`${vicmapUrl}?${query}`)
  if (!result.ok) throw new Error(`Vicmap Parcel responded with ${result.status}`)
  const payload = await result.json()
  if (payload.error) throw new Error(payload.error.message || 'Vicmap Parcel returned an error')
  return payload.features?.[0] || null
}

app.post('/api/auth/register', async (request, response) => {
  const { name, email, password } = request.body || {}
  if (!name || !email || !password || password.length < 8) return response.status(400).json({ error: 'Name, email and a password of at least 8 characters are required' })
  const normalizedEmail = email.trim().toLowerCase()
  const credentials = hashPassword(password)
  const user = { id: id(), name: name.trim(), email: normalizedEmail, passwordHash: credentials.hash, salt: credentials.salt, createdAt: Date.now() }
  try {
    await pool.query('INSERT INTO users (id, name, email, password_hash, salt, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [user.id, user.name, user.email, user.passwordHash, user.salt, user.createdAt])
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'An account with that email already exists' })
    throw error
  }
  return createSession(response, user)
})

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body || {}
  const result = await pool.query('SELECT id, name, email, password_hash AS "passwordHash", salt FROM users WHERE email = $1', [String(email || '').trim().toLowerCase()])
  const user = result.rows[0]
  if (!user || !validPassword(String(password || ''), user)) return response.status(401).json({ error: 'Email or password is incorrect' })
  return createSession(response, user)
})

async function createSession(response, user) {
  const token = id()
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30
  await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [Date.now()])
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, user.id, expiresAt])
  response.setHeader('Set-Cookie', `plan_vic_session=${token}; ${sessionCookieAttributes}; Max-Age=2592000`)
  return response.json({ user: publicUser(user) })
}

app.post('/api/auth/logout', async (request, response) => {
  const token = cookieValue(request, 'plan_vic_session')
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token])
  response.setHeader('Set-Cookie', `plan_vic_session=; ${sessionCookieAttributes}; Max-Age=0`)
  response.sendStatus(204)
})
app.get('/api/auth/me', async (request, response) => {
  const user = await userFromRequest(request)
  response.json({ user: user ? publicUser(user) : null })
})

app.get('/api/projects', requireUser, async (request, response) => {
  const result = await pool.query('SELECT id, user_id AS "userId", name, report, current_step AS step, created_at::double precision AS "createdAt", updated_at::double precision AS "updatedAt" FROM projects WHERE user_id = $1 ORDER BY updated_at DESC', [request.user.id])
  response.json({ projects: result.rows })
})
app.post('/api/projects', requireUser, async (request, response) => {
  const project = { id: id(), userId: request.user.id, name: request.body.name || request.body.address || 'Untitled planning report', report: request.body.report || {}, step: Number.isInteger(request.body.step) && request.body.step >= 0 ? request.body.step : 0, createdAt: Date.now(), updatedAt: Date.now() }
  await pool.query('INSERT INTO projects (id, user_id, name, report, current_step, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)', [project.id, project.userId, project.name, JSON.stringify(project.report), project.step, project.createdAt, project.updatedAt])
  response.status(201).json({ project })
})
app.put('/api/projects/:projectId', requireUser, async (request, response) => {
  const updatedAt = Date.now()
  const result = await pool.query(
    'UPDATE projects SET report = COALESCE($1::jsonb, report), name = COALESCE($2, name), current_step = COALESCE($3, current_step), updated_at = $4 WHERE id = $5 AND user_id = $6 RETURNING id, user_id AS "userId", name, report, current_step AS step, created_at::double precision AS "createdAt", updated_at::double precision AS "updatedAt"',
    [request.body.report ? JSON.stringify(request.body.report) : null, request.body.name || null, Number.isInteger(request.body.step) && request.body.step >= 0 ? request.body.step : null, updatedAt, request.params.projectId, request.user.id],
  )
  if (!result.rowCount) return response.status(404).json({ error: 'Project not found' })
  response.json({ project: result.rows[0] })
})
app.delete('/api/projects/:projectId', requireUser, async (request, response) => {
  const result = await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [request.params.projectId, request.user.id])
  if (!result.rowCount) return response.status(404).json({ error: 'Project not found' })
  response.sendStatus(204)
})

app.get('/api/vicmap/lookup', async (request, response) => {
  const address = String(request.query.address || '').trim()
  if (!address) return response.status(400).json({ error: 'An address is required' })
  try {
    const geocoded = await geocodeAddress(address)
    if (!geocoded) return response.status(404).json({ error: 'The address could not be geocoded' })
    const feature = await queryParcel(geocoded)
    if (!feature) return response.status(404).json({ error: 'No Vicmap parcel found for this address' })
    const attributes = feature.attributes || {}
    const [zoneFeatures, overlayFeatures] = await Promise.all([queryPlanningLayerOrEmpty(3, feature.geometry), queryPlanningLayerOrEmpty(2, feature.geometry)])
    const zoneAttributes = zoneFeatures[0]?.attributes || {}
    const zone = zoneAttributes.zone_code || ''
    const zoneDescription = zoneAttributes.zone_description || ''
    const overlays = [...new Map(overlayFeatures.map(({ attributes: overlay }) => [`${overlay.zone_code}-${overlay.zone_description}`, `${overlay.zone_code} — ${overlay.zone_description}`])).values()].join('\n')
    const lga = zoneAttributes.lga || overlayFeatures[0]?.attributes?.lga || ''
    const geodesicSiteArea = geodesicAreaFromWebMercator(feature.geometry)
    const sharedMapExtent = imageExtent(feature.geometry)
    const overlayGroups = [...new Map(overlayFeatures.map((feature) => [`${feature.attributes.zone_code}-${feature.attributes.zone_description}`, []])).keys()].map((key) => overlayFeatures.filter((feature) => `${feature.attributes.zone_code}-${feature.attributes.zone_description}` === key))
    response.json({ address: geocoded.address, location: geocoded, parcel: { zone, zoneDescription, overlays, lga, siteArea: geodesicSiteArea ?? attributes.SHAPE__AREA ?? attributes.Shape__Area ?? '', geometry: feature.geometry || null, spatialReference: serviceSpatialReference }, maps: { satellite: satelliteImageUrl(feature.geometry), satelliteBoundary: boundaryOverlayUrl(feature.geometry), zoning: svgMap(zoneFeatures, '#d77c62', `${zone || 'ZONE'} / ${zoneDescription || 'ZONING'}`, sharedMapExtent), overlays: overlayGroups.map((group) => svgMap(group, '#6b9c7d', `${group[0]?.attributes.zone_code || 'OVERLAY'} / ${group[0]?.attributes.zone_description || ''}`, sharedMapExtent)).filter(Boolean) }, planningControlsAvailable: Boolean(zone || zoneDescription || overlays), message: zone || zoneDescription || overlays ? 'Parcel and planning controls found' : 'Parcel found; no planning controls intersected this parcel', raw: { parcel: attributes, geodesicSiteArea, zone: zoneAttributes, overlays: overlayFeatures.map(({ attributes: overlay }) => overlay) } })
  } catch (error) {
    response.status(502).json({ error: 'Vicmap lookup failed', detail: error.message })
  }
})

app.get('/api/planning/standards', async (request, response) => {
  const lga = String(request.query.lga || '').trim()
  const zone = String(request.query.zone || '').trim()
  const dwellings = Number(request.query.dwellings || 1)
  if (!lga || !zone) return response.status(400).json({ error: 'LGA and zone are required' })
  try {
    response.json(await scrapePlanningStandards(lga, zone, dwellings))
  } catch (error) {
    response.status(502).json({ error: 'Planning standards scrape failed', detail: error.message })
  }
})

async function renderMapImage(browser, base, overlay) {
  if (!base && !overlay) return null
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 900, height: 600 })
    const layer = (src, zIndex) => src ? `<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:${zIndex}">` : ''
    await page.setContent(`<!doctype html><body style="margin:0;background:#dfe5ce"><div style="position:relative;width:900px;height:600px;overflow:hidden">${layer(base, 0)}${layer(overlay, 1)}</div></body>`, { waitUntil: 'networkidle0', timeout: 60000 })
    const element = await page.$('div')
    const screenshot = await element.screenshot({ type: 'png' })
    return `data:image/png;base64,${screenshot.toString('base64')}`
  } finally {
    await page.close()
  }
}
function requiredSetbackB231(height) { const h = Number(height) || 0; if (h <= 3.6) return 1; if (h <= 6.9) return +(1 + 0.3 * (h - 3.6)).toFixed(2); return +(h - 4.91).toFixed(2) }
function requiredSetbackB232(height, isSouthFacing) { const h = Number(height) || 0; if (!isSouthFacing) return h > 11 ? 4.5 : 3; return h > 11 ? 9 : 6 }
function allowableWallOnBoundary(boundaryLength) { const bl = Number(boundaryLength) || 0; if (!bl) return ''; return +(10 + 0.25 * bl).toFixed(2) }
function maxCoveragePercent(zone) { const z = String(zone || '').trim().toUpperCase(); if (z.startsWith('NRZ')) return 60; if (z.startsWith('GRZ')) return 65; if (z.startsWith('RGZ') || z.startsWith('MUZ') || z.startsWith('HCTZ')) return 70; return 60 }
function maxCrossoverWidth(frontage) { const f = Number(frontage) || 0; if (!f) return ''; return +(f < 20 ? f * 0.4 : f * 0.33).toFixed(2) }
function documentData(report) {
  const siteArea = Number(report.siteArea) || 0
  const gardenArea = Number(report.gardenArea) || 0
  const canopyArea = Number(report.canopy) || 0
  const zone = String(report.zone || '').trim().toUpperCase()
  const gardenClause = zone.startsWith('GRZ') ? '32.08' : zone.startsWith('NRZ') ? '32.09' : zone.startsWith('RGZ') ? '32.07' : 'the applicable zone schedule'
  const calculatedRequirement = siteArea > 650 ? 35 : siteArea > 500 ? 30 : siteArea >= 400 ? 25 : 0
  const gardenRequirement = report.gardenRequirement !== undefined && report.gardenRequirement !== '' ? report.gardenRequirement : calculatedRequirement || ''
  const gardenAchieved = siteArea && gardenArea ? Math.round((gardenArea / siteArea) * 100) : ''
  const canopyRequired = siteArea >= 1500 ? 20 : siteArea >= 1000 ? 15 : siteArea > 0 ? 10 : ''
  const canopyAchieved = siteArea && canopyArea ? Math.round((canopyArea / siteArea) * 100) : ''
  const gardenRequirementArea = siteArea && gardenRequirement !== '' ? (siteArea * Number(gardenRequirement || 0)) / 100 : ''
  const canopyRequiredArea = siteArea && canopyRequired !== '' ? (siteArea * Number(canopyRequired || 0)) / 100 : ''
  const siteCoveragePercent = siteArea && Number(report.siteCoverage) ? Math.round((Number(report.siteCoverage) / siteArea) * 1000) / 10 : ''
  const permeableAreaPercent = siteArea && Number(report.permeable) ? Math.round((Number(report.permeable) / siteArea) * 1000) / 10 : ''
  const canopyAreaPercent = siteArea && canopyArea ? Math.round((canopyArea / siteArea) * 1000) / 10 : ''
  const ss = report.streetSetback || { compliant: false, distance: '', notes: '' }
  const bh = report.buildingHeightClause || { compliant: false, maxHeight: '', notes: '' }
  const srs = report.sideRearSetbacks || { compliant: false, method: 'B2-3.1', boundaries: [], notes: '' }
  const wb = report.wallsOnBoundary || { compliant: false, count: '', walls: [], notes: '' }
  const sc = report.siteCoverageClause || { compliant: false, notes: '' }
  const ac = report.accessClause || { compliant: false, proposedWidth: '', treeEncroachmentPct: '', notes: '' }
  const streetSetbackNotes = (ss.notes || '').trim() || 'Front setback compliant with planning controls.'
  const buildingHeightNotes = (bh.notes || '').trim() || 'Maximum height is below the requirement of the zoning.'
  const sideRearBoundaries = (srs.boundaries || []).map((boundary) => {
    const isSouthFacing = Boolean(boundary.isSouthFacing)
    const calc = (height) => srs.method === 'B2-3.1' ? requiredSetbackB231(height) : requiredSetbackB232(height, isSouthFacing)
    const floorsText = (boundary.floors || []).map((floor, index) => `Floor ${index + 1}: ${floor.height || '—'} m height → required ${floor.height ? `${calc(floor.height)} m` : '—'}, achieved ${floor.achieved || '—'} m.`).join('\n') || '(no floors)'
    const southLabel = srs.method === 'B2-3.2' ? `${isSouthFacing ? 'south-facing (between S 30° W and S 30° E)' : 'not south-facing'}` : ''
    return { name: boundary.name || '(unnamed boundary)', southLabel, floorsText }
  })
  const data = {
    title: report.address || 'Untitled planning report',
    date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    coverImage: report.coverImage || '',
    ...buildParkingData(report),
    gardenClause, gardenRequirement, gardenRequirementArea, gardenAchieved, canopyRequired, canopyRequiredArea, canopyAchieved,
    siteCoveragePercent,
    siteCoveragePercentage: siteCoveragePercent,
    permeableAreaPercent,
    permeableAreaPercentage: permeableAreaPercent,
    canopyAreaPercent,
    canopyAreaPercentage: canopyAreaPercent,
    streetSetbackDistance: ss.distance || '',
    hasSecondaryStreetFrontage: Boolean(ss.hasSecondaryFrontage && ss.secondaryDistance),
    secondaryStreetSetbackDistance: ss.secondaryDistance || '',
    streetSetbackNotes,
    streetSetbackCompliant: complianceLabel(ss.compliant),
    streetSetbackAppealRights: appealRightsLabel(ss, true),
    buildingHeightValue: bh.maxHeight || '',
    buildingHeightNotes,
    buildingHeightCompliant: complianceLabel(bh.compliant),
    buildingHeightAppealRights: appealRightsLabel(bh, true),
    sideRearSetbacksMethod: srs.method || 'B2-3.1',
    sideRearSetbacksNotes: (srs.notes || '').trim() || 'All setbacks have been assessed as per their relevance to the boundary. All setbacks and heights are deemed compliant.',
    sideRearSetbacksCompliant: complianceLabel(srs.compliant),
    sideRearSetbacksAppealRights: appealRightsLabel(srs, true),
    sideRearBoundaries,
    wallsOnBoundaryCompliant: complianceLabel(wb.compliant),
    wallsOnBoundaryAppealRights: appealRightsLabel(wb, true),
    wallsOnBoundaryCount: wb.count || String((wb.walls || []).length),
    wallsOnBoundaryNotes: (wb.notes || '').trim() || 'Total wall on boundary length is within the allowable distance.',
    wallsOnBoundary: (wb.walls || []).map((wall) => ({
      elevation: wall.elevation || '',
      boundaryLength: wall.boundaryLength || '',
      allowable: allowableWallOnBoundary(wall.boundaryLength),
      achieved: wall.achieved || '',
      averageHeight: wall.averageHeight || '',
      maxHeight: wall.maxHeight || '',
    })),
    siteCoverageAchieved: siteCoveragePercent,
    siteCoverageAllowed: maxCoveragePercent(report.zone || ''),
    siteCoverageCompliant: complianceLabel(sc.compliant),
    siteCoverageAppealRights: appealRightsLabel(sc, true),
    siteCoverageNotes: (sc.notes || '').trim() || 'Site coverage within the allowable requirements.',
    accessCompliant: complianceLabel(ac.compliant),
    accessAppealRights: appealRightsLabel(ac, true),
    accessAllowedWidth: maxCrossoverWidth(report.frontage),
    accessAllowedPercent: Number(report.frontage) && Number(report.frontage) < 20 ? 40 : (Number(report.frontage) ? 33 : 0),
    accessProposedWidth: ac.proposedWidth || '',
    accessTreeEncroachmentPct: ac.treeEncroachmentPct || '',
    accessNotes: (ac.notes || '').trim() || 'Crossover width within the allowable requirement achieved.',
    treeCanopyCompliant: complianceLabel((report.treeCanopyClause || {}).compliant),
    treeCanopyAppealRights: appealRightsLabel(report.treeCanopyClause || {}, true),
    treeCanopyCount: report.treeCanopyClause?.count || '',
    treeCanopyNotes: report.treeCanopyClause?.notes || 'Tree canopy requirements achieved. Relevant diagramming on TP5.',
    frontFenceCompliant: complianceLabel(report.frontFenceClause?.compliant),
    frontFenceAppealRights: appealRightsLabel(report.frontFenceClause || {}, true),
    frontFenceNotes: report.frontFenceClause?.notes || 'The maximum height of the front fence is: 0.9m.',
    dwellingDiversityCompliant: complianceLabel(report.dwellingDiversityClause?.compliant),
    dwellingDiversityAppealRights: appealRightsLabel(report.dwellingDiversityClause || {}),
    dwellingDiversityNotes: report.dwellingDiversityClause?.notes || 'Not applicable as less than 10 dwellings.',
    parkingLocationCompliant: complianceLabel(report.parkingLocationClause?.compliant),
    parkingLocationAppealRights: appealRightsLabel(report.parkingLocationClause || {}),
    parkingLocationNotes: report.parkingLocationClause?.notes || 'All windows within accessways achieve 1m where sills are 1.5m.',
    streetIntegrationCompliant: complianceLabel(report.streetIntegration?.compliant),
    streetIntegrationAppealRights: appealRightsLabel(report.streetIntegration || {}),
    streetIntegrationAllowedWidth: maxCrossoverWidth
      ? report.frontage ? +(Number(report.frontage) * 0.2).toFixed(2) : ''
      : '', // 20% of frontage
    streetIntegrationProposedWidth: report.streetIntegration?.proposedServicesWidth || '',
    streetIntegrationNotes: report.streetIntegration?.notes || 'All dwellings provided with habitable rooms at either ground or first floor.',
    entryClauseCompliant: complianceLabel(report.entryClause?.compliant),
    entryClauseAppealRights: appealRightsLabel(report.entryClause || {}),
    entryNotes: report.entryClause?.notes || 'All entry porches covered by 1.2 x 1.2 (1.44m2) canopy.',
    privateOpenSpaceCompliant: complianceLabel(report.privateOpenSpaceClause?.compliant),
    privateOpenSpaceAppealRights: appealRightsLabel(report.privateOpenSpaceClause || {}),
    privateOpenSpaceNotes: report.privateOpenSpaceClause?.notes || 'All dwellings supplied with minimum 25m2 S.P.O.S.',
    solarAccessOpenSpaceCompliant: complianceLabel(report.solarAccessOpenSpaceClause?.compliant),
    solarAccessOpenSpaceAppealRights: appealRightsLabel(report.solarAccessOpenSpaceClause || {}),
    solarAccessOpenSpaceNotes: report.solarAccessOpenSpaceClause?.notes || 'All dwellings achieve required setbacks to achieve solar requirements to S.P.O.S.',
    functionalLayoutCompliant: complianceLabel(report.functionalLayoutClause?.compliant),
    functionalLayoutAppealRights: appealRightsLabel(report.functionalLayoutClause || {}),
    functionalLayoutNotes: report.functionalLayoutClause?.notes || 'All minimum room dimensions and areas achieved.',
    roomDepthCompliant: complianceLabel(report.roomDepthClause?.compliant),
    roomDepthAppealRights: appealRightsLabel(report.roomDepthClause || {}),
    roomDepthNotes: report.roomDepthClause?.notes || 'All dwellings provide dual aspect to all Living / kitchen / dining areas.',
    daylightNewWindowsCompliant: complianceLabel(report.daylightNewWindowsClause?.compliant),
    daylightNewWindowsAppealRights: appealRightsLabel(report.daylightNewWindowsClause || {}),
    daylightNewWindowsNotes: report.daylightNewWindowsClause?.notes || 'All new habitable room windows are provided with 3m2 clear to sky.',
    naturalVentilationCompliant: complianceLabel(report.naturalVentilationClause?.compliant),
    naturalVentilationAppealRights: appealRightsLabel(report.naturalVentilationClause || {}),
    naturalVentilationNotes: report.naturalVentilationClause?.notes || 'Relevant diagramming on TP5.',
    storageCompliant: complianceLabel(report.storageClause?.compliant),
    storageAppealRights: appealRightsLabel(report.storageClause || {}),
    storageNotes: report.storageClause?.notes || '6m³ storage provided to all dwellings.',
    accessibilityCompliant: complianceLabel(report.accessibilityClause?.compliant),
    accessibilityAppealRights: appealRightsLabel(report.accessibilityClause || {}),
    accessibilityNotes: report.accessibilityClause?.notes || 'Not applicable to this application.',
    daylightExistingWindowsCompliant: complianceLabel(report.daylightExistingWindowsClause?.compliant),
    daylightExistingWindowsAppealRights: appealRightsLabel(report.daylightExistingWindowsClause || {}, true),
    daylightExistingWindowsNotes: report.daylightExistingWindowsClause?.notes || 'All existing habitable room windows have been provided with 3m2 clear to sky as required.',
    northFacingWindowsCompliant: complianceLabel(report.northFacingWindowsClause?.compliant),
    northFacingWindowsAppealRights: appealRightsLabel(report.northFacingWindowsClause || {}, true),
    northFacingWindowsNotes: report.northFacingWindowsClause?.notes || 'All north facing windows are setback appropriately from the proposal via compliant dimensions.',
    overshadowingSosCompliant: complianceLabel(report.overshadowingSosClause?.compliant),
    overshadowingSosAppealRights: appealRightsLabel(report.overshadowingSosClause || {}, true),
    overshadowingSosNotes: report.overshadowingSosClause?.notes || 'All shadowing calculated on TP6 - TP9. This is assessed as compliant.',
    overlookingCompliant: complianceLabel(report.overlookingClause?.compliant),
    overlookingAppealRights: appealRightsLabel(report.overlookingClause || {}, true),
    overlookingNotes: report.overlookingClause?.notes || 'Overlooking arc annotated on plans. All relevant floor levels have been dimensioned. Screening has been annotated where required.',
    internalViewsCompliant: complianceLabel(report.internalViewsClause?.compliant),
    internalViewsAppealRights: appealRightsLabel(report.internalViewsClause || {}),
    internalViewsNotes: report.internalViewsClause?.notes || 'Proposal does not propose overlooking internally.',
    stormwaterCompliant: complianceLabel(report.stormwaterManagement?.compliant),
    stormwaterAppealRights: appealRightsLabel(report.stormwaterManagement || {}),
    stormwaterManagementSystems: [
      report.stormwaterManagement?.rainwaterTank ? `Rainwater tank${report.stormwaterManagement.rainwaterTankSize ? ` (${report.stormwaterManagement.rainwaterTankSize} L)` : ''}` : '',
      report.stormwaterManagement?.permeablePaving ? 'Permeable paving' : '',
      report.stormwaterManagement?.rainGardens ? 'Rain gardens' : '',
    ].filter(Boolean).join(', ') || '—',
    stormwaterAreasReuse: [
      report.stormwaterManagement?.reuseSanitary ? 'Sanitary flushing' : '',
      report.stormwaterManagement?.reuseLaundry ? 'Laundry' : '',
      report.stormwaterManagement?.reuseGarden ? 'Garden watering' : '',
    ].filter(Boolean).join(', ') || '—',
    stormwaterRainwaterTankSize: report.stormwaterManagement?.rainwaterTankSize || '',
    stormwaterNotes: ((report.stormwaterManagement || {}).notes || '').trim(),
    overshadowingSolarCompliant: complianceLabel(report.overshadowingSolarClause?.compliant),
    overshadowingSolarAppealRights: appealRightsLabel(report.overshadowingSolarClause || {}, true),
    overshadowingSolarNotes: report.overshadowingSolarClause?.notes || 'Neighbouring solar facilities are sited appropriate distance from boundary. No shadowing occurs over facilities.',
    rooftopSolarCompliant: complianceLabel(report.rooftopSolarClause?.compliant),
    rooftopSolarAppealRights: appealRightsLabel(report.rooftopSolarClause || {}),
    rooftopSolarNotes: report.rooftopSolarClause?.notes || 'Refer to dedicated area on page no. TP4 for further details.',
    solarProtectionCompliant: complianceLabel(report.solarProtectionClause?.compliant),
    solarProtectionAppealRights: appealRightsLabel(report.solarProtectionClause || {}),
    solarProtectionNotes: report.solarProtectionClause?.notes || 'Fixed shading devices have been annotated, dimensioned and tagged on plans and shown on elevations.',
    wasteRecyclingCompliant: complianceLabel(report.wasteRecyclingClause?.compliant),
    wasteRecyclingAppealRights: appealRightsLabel(report.wasteRecyclingClause || {}),
    wasteRecyclingNotes: report.wasteRecyclingClause?.notes || 'Refer to dedicated area on page no. TP5 for further details.',
    noiseImpactsCompliant: complianceLabel(report.noiseImpactsClause?.compliant),
    noiseImpactsAppealRights: appealRightsLabel(report.noiseImpactsClause || {}),
    noiseImpactsNotes: report.noiseImpactsClause?.notes || 'All mechanical plant equipment and storage have been located away from habitable windows. All have been screened in their respective yards away from public using fencing.',
    energyEfficiencyCompliant: complianceLabel(report.energyEfficiencyClause?.compliant),
    energyEfficiencyAppealRights: appealRightsLabel(report.energyEfficiencyClause || {}),
    energyEfficiencyNotes: report.energyEfficiencyClause?.notes || 'Not applicable to this application.',
    openSpace: (report.openSpace || []).map((space, index) => ({ label: `Dwelling ${index + 1}`, secluded: space.secluded || '', total: space.total || '' })),
    existingTrees: (report.existingTrees || []).map((tree) => ({ number: tree.number || '', species: tree.species || '', spreadHeight: tree.spreadHeight || '', status: tree.status || '', location: tree.location || '', retain: tree.retain || '' })),
    noExistingTrees: Boolean(report.existingTreesNone)
  }
  for (const key of ['address', 'zone', 'zoneDescription', 'overlays', 'lga', 'dwellings', 'storeys', 'existing', 'siteArea', 'frontage', 'frontageStreet', 'siteCoverage', 'permeable', 'gardenArea', 'canopy', 'maxHeight', 'summary', 'ordinance', 'carParking']) data[key] = report[key] || ''
  return data
}

app.post('/api/report/document', async (request, response) => {
  if (!fs.existsSync(templateFile)) return response.status(400).json({ error: 'No Word template found. Add your template to server/template.docx — see docs/template-tags.md for the available tags.' })
  try {
    const report = request.body || {}
    const images = report.images || {}
    const data = documentData(report)
    const overlaySources = (images.overlays || []).filter(Boolean).slice(0, 4)
    if (images.satellite || images.satelliteBoundary || images.zoning || overlaySources.length) {
      const browser = await launchBrowser()
      try {
        data.satelliteImage = await renderMapImage(browser, images.satellite, images.satelliteBoundary)
        data.zoningMap = await renderMapImage(browser, images.satellite, images.zoning)
        for (const [index, overlay] of overlaySources.entries()) data[`overlayMap${index + 1}`] = await renderMapImage(browser, images.satellite, overlay)
      } finally {
        await browser.close()
      }
    }
    const imageModule = new ImageModule({
      centered: false,
      fileType: 'docx',
      getImage: (tagValue) => {
        const source = typeof tagValue === 'string' && tagValue.includes(',') ? tagValue.split(',')[1] : tagValue
        return Buffer.from(source, 'base64')
      },
      getSize: (img, tagValue, tagName) => {
        const name = String(tagName || '').toLowerCase()
        return name.includes('cover') ? [540, 320] : [480, 320]
      },
    })
    const zip = new PizZip(fs.readFileSync(templateFile, 'binary'))
    const doc = new Docxtemplater(zip, { modules: [imageModule], linebreaks: true, paragraphLoop: true })
    doc.render(data)
    const outputZip = doc.getZip()
    let drawingId = 0
    const fixedXml = outputZip.file('word/document.xml').asText().replace(/<wp:docPr id="\d+"/g, () => `<wp:docPr id="${++drawingId}"`)
    outputZip.file('word/document.xml', fixedXml)
    const buffer = outputZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    response.setHeader('Content-Disposition', 'attachment; filename="planning-report.docx"')
    response.send(buffer)
  } catch (error) {
    response.status(502).json({ error: 'Document generation failed', detail: error.message })
  }
})

initializeDatabase().then(() => {
  app.listen(port, () => console.log(`PLAN / VIC API listening on http://localhost:${port}`))
}).catch((error) => {
  console.error('Failed to initialize PostgreSQL:', error)
  process.exit(1)
})