const numberWords = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE']

function countText(value) {
  const text = String(value ?? '').trim()
  const count = Number(text)
  return text && Number.isInteger(count) && count >= 0 && count < numberWords.length
    ? numberWords[count]
    : text
}

export function buildDevelopmentDescription(report) {
  const dwellingText = String(report.dwellings ?? '').trim()
  const dwellingCount = Number(dwellingText)
  const storeyText = String(report.storeys ?? '').trim()
  const storeyCount = Number(storeyText)
  const storeyWords = {
    1: 'SINGLE',
    2: 'DOUBLE',
    3: 'TRIPLE',
  }

  return {
    dwellingCountText: countText(report.dwellings),
    storeyDescription: storeyText && Number.isInteger(storeyCount) && storeyCount >= 1 && storeyCount < numberWords.length
      ? storeyWords[storeyCount] || numberWords[storeyCount]
      : storeyText,
    dwellingPlural: dwellingText && dwellingCount === 1 ? '' : 'S',
  }
}
