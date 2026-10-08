type SummaryParkingArrangement = {
  arrangement: string
  other: string
}

type DevelopmentSummaryInput = {
  dwellings?: string
  storeys?: string
  parking?: string
  parkingOther?: string
  parkingArrangements?: SummaryParkingArrangement[]
  summarySposAccess?: string
  summaryVehicleAccess?: string
  summaryFacade?: string
}

export function buildDevelopmentSummary(report: DevelopmentSummaryInput): string
