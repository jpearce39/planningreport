import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDevelopmentDescription } from '../server/development-description.js'

test('spells out dwelling counts below ten and pluralizes dwelling', () => {
  assert.deepEqual(buildDevelopmentDescription({ dwellings: '1', storeys: '1' }), {
    dwellingCountText: 'ONE',
    storeyDescription: 'SINGLE',
    dwellingPlural: '',
  })
  assert.deepEqual(buildDevelopmentDescription({ dwellings: '3', storeys: '2' }), {
    dwellingCountText: 'THREE',
    storeyDescription: 'DOUBLE',
    dwellingPlural: 'S',
  })
  assert.equal(buildDevelopmentDescription({ dwellings: '9', storeys: '3' }).dwellingCountText, 'NINE')
})

test('keeps counts of ten or more numeric and describes higher single-digit storey counts', () => {
  assert.deepEqual(buildDevelopmentDescription({ dwellings: '10', storeys: '4' }), {
    dwellingCountText: '10',
    storeyDescription: 'FOUR',
    dwellingPlural: 'S',
  })
})

test('leaves blank counts blank without treating them as zero', () => {
  assert.deepEqual(buildDevelopmentDescription({ dwellings: '', storeys: '' }), {
    dwellingCountText: '',
    storeyDescription: '',
    dwellingPlural: 'S',
  })
})
