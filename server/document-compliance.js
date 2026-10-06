export function complianceLabel(value) {
  return value ? 'Yes' : 'No'
}

export function appealRightsLabel(clause, linkedToCompliance = false) {
  const appealRights = linkedToCompliance || typeof clause?.appealRights !== 'boolean'
    ? !clause?.compliant
    : clause.appealRights
  return complianceLabel(appealRights)
}