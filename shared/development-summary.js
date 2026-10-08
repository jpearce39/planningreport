const storeyDescriptions = {
  1: 'single-storey',
  2: 'double-storey',
  3: 'triple-storey',
}

const sposDescriptions = {
  'Ground floor access to courtyard': 'with ground floor access to a private courtyard',
  'Balcony access': 'with balcony access to private open space',
  'Ground floor courtyard and balcony access': 'with a mix of ground floor courtyard and balcony access to private open space',
}

const vehicleAccessDescriptions = {
  'Reuse existing crossover': 'reuse of the existing crossover',
  'New crossover': 'a proposed new crossover',
  'Reuse existing crossover and new crossover': 'reuse of the existing crossover and a proposed new crossover',
}

const facadeDescriptions = {
  Modern: 'modern presence to the street, incorporating clean lines and contemporary materials',
  Traditional: 'traditional presence to the street, incorporating established architectural forms and tested materials',
}

function parkingDescription(report) {
  const dwellings = Math.max(1, Number(report.dwellings) || 1)
  const arrangements = Array.isArray(report.parkingArrangements) ? report.parkingArrangements : []
  const parking = Array.from({ length: Math.max(dwellings, arrangements.length) }, (_, index) => {
    const arrangement = arrangements[index] || {
      arrangement: report.parking || 'Onsite parking',
      other: report.parkingOther || '',
    }
    const description = arrangement.arrangement === 'Other'
      ? arrangement.other || 'other parking'
      : arrangement.arrangement || 'Onsite parking'
    const label = arrangement.arrangement === 'Other' ? description : description.toLowerCase()
    return `Dwelling ${index + 1}: ${label}`
  })
  return `Parking is provided as follows: ${parking.join('; ')}.`
}

export function buildDevelopmentSummary(report) {
  const dwellingCount = Math.max(1, Number(report.dwellings) || 1)
  const storeyCount = Number(report.storeys)
  const storeyDescription = storeyDescriptions[storeyCount] || (report.storeys ? `${report.storeys}-storey` : '')
  const dwellingLabel = dwellingCount === 1 ? 'dwelling' : 'dwellings'
  const dwellingPhrase = `${dwellingCount} ${storeyDescription ? `${storeyDescription} ` : ''}${dwellingLabel}`
  const parts = [`The proposal includes the construction of ${dwellingPhrase}`]
  const spos = sposDescriptions[report.summarySposAccess]
  const vehicleAccess = vehicleAccessDescriptions[report.summaryVehicleAccess]
  const facade = facadeDescriptions[report.summaryFacade]

  if (spos) parts[0] += `, ${spos}`
  parts[0] += '.'
  if (vehicleAccess) parts.push(`Vehicle access will be provided via ${vehicleAccess}.`)
  parts.push(parkingDescription(report))
  if (facade) parts.push(`The façade provides a ${facade} to blend seamlessly with the surrounding environment.`)

  return parts.join(' ')
}
