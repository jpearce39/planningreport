import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSideRearSetbackData } from '../server/side-rear-setback-data.js'

test('builds named floor records and table-ready rows for B2-3.1', () => {
  const result = buildSideRearSetbackData([
    {
      name: 'North Boundary',
      floors: [
        { height: '3.89', achieved: '1.1' },
        { height: '6.82', achieved: '2' },
      ],
    },
    {
      name: 'East Boundary',
      floors: [{ height: '4.13', achieved: '3.05' }],
    },
  ], 'B2-3.1')

  assert.deepEqual(result.sideRearBoundaries[0].floors, [
    { floorName: 'Ground Floor', height: '3.89', requiredSetback: 1.09, achievedSetback: '1.1' },
    { floorName: 'First Floor', height: '6.82', requiredSetback: 1.97, achievedSetback: '2' },
  ])
  assert.deepEqual(result.sideRearSetbackRows.map(({ boundaryName, floorName }) => ({ boundaryName, floorName })), [
    { boundaryName: 'North Boundary', floorName: 'Ground Floor' },
    { boundaryName: 'North Boundary', floorName: 'First Floor' },
    { boundaryName: 'East Boundary', floorName: 'Ground Floor' },
  ])
  assert.match(result.sideRearBoundaries[0].floorsText, /Ground Floor: 3\.89 m height/)
})

test('calculates south-facing B2-3.2 setbacks and supports higher floor numbers', () => {
  const result = buildSideRearSetbackData([
    {
      name: 'South Boundary',
      isSouthFacing: true,
      floors: [
        { height: '11', achieved: '6' },
        { height: '11.1', achieved: '9' },
        { height: '12', achieved: '10' },
      ],
    },
  ], 'B2-3.2')

  assert.equal(result.sideRearSetbackRows[0].requiredSetback, 6)
  assert.equal(result.sideRearSetbackRows[1].requiredSetback, 9)
  assert.equal(result.sideRearSetbackRows[2].floorName, 'Second Floor')
  assert.equal(result.sideRearSetbackRows[0].southLabel, 'south-facing (between S 30° W and S 30° E)')
})

test('keeps missing floor values blank in the table-ready data', () => {
  const result = buildSideRearSetbackData([
    { floors: [{ height: '', achieved: '' }] },
  ], 'B2-3.1')

  assert.deepEqual(result.sideRearSetbackRows[0], {
    boundaryName: '(unnamed boundary)',
    southLabel: '',
    floorName: 'Ground Floor',
    height: '',
    requiredSetback: '',
    achievedSetback: '',
  })
})
