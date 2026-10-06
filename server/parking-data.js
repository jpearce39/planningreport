export function buildParkingData(report) {
  const dwellingCount = Math.max(1, Number(report.dwellings) || 1)
  const existing = Array.isArray(report.parkingArrangements) ? report.parkingArrangements : []
  const useLegacyValue = existing.length === 0
  const parkingArrangements = Array.from({ length: dwellingCount }, (_, index) => {
    const arrangement = existing[index] || {
      arrangement: useLegacyValue ? report.parking || 'Onsite parking' : 'Onsite parking',
      other: useLegacyValue ? report.parkingOther || '' : '',
    }
    const other = arrangement.arrangement === 'Other' && arrangement.other ? ` (${arrangement.other})` : ''
    return { number: `Dwelling ${index + 1}`, arrangement: arrangement.arrangement || 'Onsite parking', other }
  })

  return {
    parkingArrangements,
    parking: parkingArrangements.map(({ number, arrangement, other }) => `${number}: ${arrangement}${other}`).join('; '),
    parkingOther: '',
  }
}