import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { buildDevelopmentDescription } from '../server/development-description.js'
import { buildDevelopmentSummary } from '../shared/development-summary.js'
import { buildSideRearSetbackData } from '../server/side-rear-setback-data.js'

const docsPath = path.join(process.cwd(), 'docs', 'template-tags.md')
const starterTemplatePath = path.join(process.cwd(), 'server', 'build-starter-template.mjs')
const wordTemplatePath = path.join(process.cwd(), 'server', 'template.docx')

const requiredDocTags = [
  '{siteCoveragePercent}',
  '{siteCoveragePercentage}',
  '{%coverImage}',
  '{permeableAreaPercent}',
  '{permeableAreaPercentage}',
  '{canopyAreaPercent}',
  '{canopyAreaPercentage}',
  '{frontFenceCompliant}',
  '{frontFenceAppealRights}',
  '{dwellingDiversityCompliant}',
  '{dwellingDiversityAppealRights}',
  '{parkingLocationCompliant}',
  '{parkingLocationAppealRights}',
  '{streetIntegrationCompliant}',
  '{streetIntegrationAppealRights}',
  '{entryClauseCompliant}',
  '{entryClauseAppealRights}',
  '{privateOpenSpaceCompliant}',
  '{privateOpenSpaceAppealRights}',
  '{stormwaterCompliant}',
  '{stormwaterAppealRights}',
  '{energyEfficiencyCompliant}',
  '{energyEfficiencyAppealRights}',
  '{gardenRequirementArea}',
  '{canopyRequiredArea}',
  '{treeCanopyCount}',
  '{dwellingCountText}',
  '{storeyDescription}',
  '{dwellingPlural}',
  '{#sideRearSetbackRows}',
  '{boundaryName}',
  '{floorName}',
  '{requiredSetback}',
  '{achievedSetback}',
  '{/sideRearSetbackRows}',
  '{#parkingArrangements}',
  '{number}',
  '{arrangement}',
  '{other}',
  '{/parkingArrangements}',
]

test('template reference documents the later clause tags', () => {
  const docs = fs.readFileSync(docsPath, 'utf8')
  for (const tag of requiredDocTags) {
    assert.ok(docs.includes(tag), `Missing template tag ${tag} in docs/template-tags.md`)
  }
})

test('starter template uses dynamic compliance tags for later clauses', () => {
  const template = fs.readFileSync(starterTemplatePath, 'utf8')
  assert.ok(template.includes('{%coverImage}'), 'Cover image tag missing from starter template')
  assert.ok(template.includes('{frontFenceCompliant}'), 'B2-8 front fence compliance tag missing from starter template')
  assert.ok(template.includes('{frontFenceAppealRights}'), 'B2-8 front fence appeal-rights tag missing from starter template')
  assert.ok(template.includes('{stormwaterCompliant}'), 'B5-1 stormwater compliance tag missing from starter template')
  assert.ok(template.includes('{energyEfficiencyCompliant}'), 'B5-7 energy efficiency compliance tag missing from starter template')
  assert.ok(template.includes('{siteCoveragePercent}'), 'Site coverage percent tag missing from starter template')
  assert.ok(template.includes('{permeableAreaPercent}'), 'Permeable area percent tag missing from starter template')
  assert.ok(template.includes('{canopyAreaPercent}'), 'Canopy area percent tag missing from starter template')
  assert.ok(template.includes('{gardenRequirementArea}'), 'Garden requirement area tag missing from starter template')
  assert.ok(template.includes('{canopyRequiredArea}'), 'Canopy required area tag missing from starter template')
  assert.ok(template.includes('{treeCanopyCount}'), 'Tree canopy count tag missing from starter template')
  assert.ok(template.includes('{dwellingCountText} {storeyDescription}-STOREY DWELLING{dwellingPlural}'), 'Cover development description tags missing from starter template')
  assert.ok(template.includes('{#sideRearSetbackRows}{boundaryName} ({southLabel})'), 'B2-3 table row loop missing from starter template')
  assert.ok(template.includes('{floorName}'), 'Named B2-3 floor tag missing from starter template')
  assert.ok(template.includes('{requiredSetback}'), 'B2-3 required setback tag missing from starter template')
  assert.ok(template.includes('{achievedSetback}'), 'B2-3 achieved setback tag missing from starter template')
  assert.ok(template.includes('{#parkingArrangements}'), 'Per-dwelling parking loop missing from starter template')
  assert.ok(template.includes('{number}: {arrangement}{other}'), 'Per-dwelling parking fields missing from starter template')
  assert.ok(template.includes('{/parkingArrangements}'), 'Per-dwelling parking loop closing tag missing from starter template')
})

test('Word cover page uses dynamic dwelling and storey description tags', () => {
  const zip = new PizZip(fs.readFileSync(wordTemplatePath))
  const xml = zip.file('word/document.xml').asText()
  const headingIndex = xml.indexOf('DEVELOPMENT OF ')
  const paragraphStart = xml.lastIndexOf('<w:p', headingIndex)
  const paragraphEnd = xml.indexOf('</w:p>', headingIndex)
  const coverHeading = xml.slice(paragraphStart, paragraphEnd)

  assert.ok(coverHeading.includes('{dwellingCountText} {storeyDescription}'))
  assert.ok(coverHeading.includes('-STOREY DWELLING{dwellingPlural}'))
  assert.ok(!coverHeading.includes('(S)'))
})

test('Word B2-3 table renders one row per named floor', () => {
  const zip = new PizZip(fs.readFileSync(wordTemplatePath))
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  const { sideRearBoundaries, sideRearSetbackRows } = buildSideRearSetbackData([
    { name: 'North Boundary', floors: [{ height: '3.89', achieved: '1.1' }, { height: '6.82', achieved: '2' }] },
    { name: 'East Boundary', floors: [{ height: '4.13', achieved: '3.05' }] },
  ], 'B2-3.1')
  doc.render({ sideRearBoundaries, sideRearSetbackRows })
  const text = doc.getZip().file('word/document.xml').asText().replace(/<[^>]+>/g, '')

  for (const value of ['North Boundary', 'East Boundary', 'Ground Floor', 'First Floor', '3.89 m', '1.09 m', '1.1 m', '4.13 m']) {
    assert.ok(text.includes(value), `Missing rendered B2-3 table value: ${value}`)
  }
  assert.ok(!text.includes('{sideRearSetbackRows}'))
})

test('Word template renders the generated development summary', () => {
  const zip = new PizZip(fs.readFileSync(wordTemplatePath))
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  const summary = buildDevelopmentSummary({
    dwellings: '2',
    storeys: '2',
    summarySposAccess: 'Balcony access',
    summaryVehicleAccess: 'New crossover',
    summaryFacade: 'Traditional',
    parkingArrangements: [
      { arrangement: 'Onsite parking', other: '' },
      { arrangement: 'Onsite parking', other: '' },
    ],
  })
  doc.render({ summary })
  const text = doc.getZip().file('word/document.xml').asText().replace(/<[^>]+>/g, '')

  assert.ok(text.includes(summary))
  assert.ok(text.includes('traditional presence to the street'))
})

test('Word cover page renders singular, plural, and numeric dwelling counts correctly', () => {
  const examples = [
    { dwellings: '1', storeys: '1', expected: 'ONE SINGLE-STOREY DWELLING' },
    { dwellings: '2', storeys: '2', expected: 'TWO DOUBLE-STOREY DWELLINGS' },
    { dwellings: '10', storeys: '4', expected: '10 FOUR-STOREY DWELLINGS' },
  ]

  for (const example of examples) {
    const zip = new PizZip(fs.readFileSync(wordTemplatePath))
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
    doc.render({
      ...buildDevelopmentDescription(example),
      dwellings: example.dwellings,
      storeys: example.storeys,
      existingTrees: [],
      openSpace: [],
      parkingArrangements: [],
      sideRearBoundaries: [],
      sideRearSetbackRows: [],
      wallsOnBoundary: [],
      noExistingTrees: false,
    })
    const text = doc.getZip().file('word/document.xml').asText().replace(/<[^>]+>/g, '')

    assert.ok(text.includes(`DEVELOPMENT OF ${example.expected} WITH ONSITE PARKING`), `Unexpected rendered heading for ${example.dwellings} dwellings`)
  }
})
