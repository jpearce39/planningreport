import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDevelopmentSummary } from '../shared/development-summary.js'

test('builds a development summary from dwelling, storey, parking, and selected answers', () => {
  const summary = buildDevelopmentSummary({
    dwellings: '3',
    storeys: '1',
    parkingArrangements: [
      { arrangement: 'Onsite parking', other: '' },
      { arrangement: 'Other', other: 'Tandem parking' },
      { arrangement: 'No onsite parking', other: '' },
    ],
    summarySposAccess: 'Ground floor courtyard and balcony access',
    summaryVehicleAccess: 'Reuse existing crossover and new crossover',
    summaryFacade: 'Modern',
  })

  assert.equal(summary, 'The proposal includes the construction of 3 single-storey dwellings, with a mix of ground floor courtyard and balcony access to private open space. Vehicle access will be provided via reuse of the existing crossover and a proposed new crossover. Parking is provided as follows: Dwelling 1: onsite parking; Dwelling 2: Tandem parking; Dwelling 3: no onsite parking. The façade provides a modern presence to the street, incorporating clean lines and contemporary materials to blend seamlessly with the surrounding environment.')
})

test('uses singular dwelling wording and includes only selected optional statements', () => {
  assert.equal(buildDevelopmentSummary({
    dwellings: '1',
    storeys: '2',
    parkingArrangements: [{ arrangement: 'Onsite parking', other: '' }],
  }), 'The proposal includes the construction of 1 double-storey dwelling. Parking is provided as follows: Dwelling 1: onsite parking.')
})

test('uses legacy parking fields when per-dwelling arrangements are absent', () => {
  assert.match(buildDevelopmentSummary({
    dwellings: '2',
    storeys: '3',
    parking: 'Other',
    parkingOther: 'Car stacker system',
  }), /Dwelling 1: Car stacker system/)
})
