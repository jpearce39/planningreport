import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const docsPath = path.join(process.cwd(), 'docs', 'template-tags.md')
const starterTemplatePath = path.join(process.cwd(), 'server', 'build-starter-template.mjs')

const requiredDocTags = [
  '{siteCoveragePercent}',
  '{siteCoveragePercentage}',
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
]

test('template reference documents the later clause tags', () => {
  const docs = fs.readFileSync(docsPath, 'utf8')
  for (const tag of requiredDocTags) {
    assert.ok(docs.includes(tag), `Missing template tag ${tag} in docs/template-tags.md`)
  }
})

test('starter template uses dynamic compliance tags for later clauses', () => {
  const template = fs.readFileSync(starterTemplatePath, 'utf8')
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
})
