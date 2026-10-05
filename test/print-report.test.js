import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrintableReportHtml } from '../src/report-print.js'

test('print formatter produces a dedicated report document', () => {
  const html = buildPrintableReportHtml({
    address: '12 Example Street, Carlton VIC 3053',
    zone: 'GRZ1',
    zoneDescription: 'General Residential Zone - Schedule 1',
    overlays: 'DDO18',
    lga: 'MELBOURNE',
    summary: 'A compact residential proposal with landscaped setbacks.',
    siteArea: '612',
    frontage: '15.2',
    siteCoverage: '320',
    gardenArea: '180',
  }, 'Planning report', 'A1 — Minimum street setback: 9m', '25', '29', '32.08')

  assert.match(html, /TOWN PLANNING REPORT/i)
  assert.match(html, /12 Example Street, Carlton VIC 3053/)
  assert.match(html, /Project overview/i)
  assert.match(html, /Site metrics/i)
  assert.match(html, /A1 — Minimum street setback: 9m/i)
})
