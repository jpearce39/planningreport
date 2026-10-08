const floorNames = [
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Fifth Floor',
  'Sixth Floor',
  'Seventh Floor',
  'Eighth Floor',
  'Ninth Floor',
  'Tenth Floor',
]

function getFloorName(index) {
  if (floorNames[index]) return floorNames[index]
  const floorNumber = index + 1
  const lastTwoDigits = floorNumber % 100
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[floorNumber % 10] || 'th')
  return `${floorNumber}${suffix} Floor`
}

function requiredSetbackB231(height) {
  const value = Number(height) || 0
  if (value <= 3.6) return 1
  if (value <= 6.9) return +(1 + 0.3 * (value - 3.6)).toFixed(2)
  return +(value - 4.91).toFixed(2)
}

function requiredSetbackB232(height, isSouthFacing) {
  const value = Number(height) || 0
  if (!isSouthFacing) return value > 11 ? 4.5 : 3
  return value > 11 ? 9 : 6
}

export function buildSideRearSetbackData(boundaries, method) {
  const sideRearBoundaries = (boundaries || []).map((boundary) => {
    const isSouthFacing = Boolean(boundary.isSouthFacing)
    const floors = (boundary.floors || []).map((floor, index) => ({
      floorName: getFloorName(index),
      height: floor.height || '',
      requiredSetback: floor.height
        ? method === 'B2-3.1'
          ? requiredSetbackB231(floor.height)
          : requiredSetbackB232(floor.height, isSouthFacing)
        : '',
      achievedSetback: floor.achieved || '',
    }))
    const floorsText = floors.map(({ floorName, height, requiredSetback, achievedSetback }) =>
      `${floorName}: ${height || '—'} m height → required ${requiredSetback !== '' ? `${requiredSetback} m` : '—'}, achieved ${achievedSetback || '—'} m.`
    ).join('\n') || '(no floors)'
    const southLabel = method === 'B2-3.2'
      ? isSouthFacing ? 'south-facing (between S 30° W and S 30° E)' : 'not south-facing'
      : ''

    return {
      name: boundary.name || '(unnamed boundary)',
      southLabel,
      floors,
      floorsText,
    }
  })
  const sideRearSetbackRows = sideRearBoundaries.flatMap((boundary) => boundary.floors.map((floor) => ({
    boundaryName: boundary.name,
    southLabel: boundary.southLabel,
    ...floor,
  })))

  return { sideRearBoundaries, sideRearSetbackRows }
}
