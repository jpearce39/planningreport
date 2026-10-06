import assert from 'node:assert/strict'
import test from 'node:test'
import { appealRightsLabel, complianceLabel } from '../server/document-compliance.js'

test('compliance labels reflect the checkbox value', () => {
  assert.equal(complianceLabel(true), 'Yes')
  assert.equal(complianceLabel(false), 'No')
})

test('appeal rights are independent unless explicitly linked to compliance', () => {
  assert.equal(appealRightsLabel({ compliant: true, appealRights: true }), 'Yes')
  assert.equal(appealRightsLabel({ compliant: true, appealRights: false }), 'No')
  assert.equal(appealRightsLabel({ compliant: true, appealRights: true }, true), 'No')
  assert.equal(appealRightsLabel({ compliant: false }), 'Yes')
})