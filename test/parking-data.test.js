import assert from 'node:assert/strict'
import test from 'node:test'
import { buildParkingData } from '../server/parking-data.js'

test('builds separate parking arrangements for each dwelling', () => {
  const result = buildParkingData({
    dwellings: '3',
    parkingArrangements: [
      { arrangement: 'Onsite parking', other: '' },
      { arrangement: 'No onsite parking', other: '' },
      { arrangement: 'Other', other: 'Car stacker system' },
    ],
  })

  assert.deepEqual(result.parkingArrangements, [
    { number: 'Dwelling 1', arrangement: 'Onsite parking', other: '' },
    { number: 'Dwelling 2', arrangement: 'No onsite parking', other: '' },
    { number: 'Dwelling 3', arrangement: 'Other', other: ' (Car stacker system)' },
  ])
  assert.equal(result.parking, 'Dwelling 1: Onsite parking; Dwelling 2: No onsite parking; Dwelling 3: Other (Car stacker system)')
})

test('migrates legacy parking values across the proposed dwellings', () => {
  const result = buildParkingData({ dwellings: '2', parking: 'Other', parkingOther: 'Car stacker system' })

  assert.equal(result.parkingArrangements.length, 2)
  assert.equal(result.parkingArrangements[0].arrangement, 'Other')
  assert.equal(result.parkingArrangements[1].other, ' (Car stacker system)')
})