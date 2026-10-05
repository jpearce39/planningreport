declare function buildPrintableReportHtml(
  report: Record<string, any>,
  title?: string,
  standard?: string,
  gardenRequirement?: string | number,
  gardenAchieved?: string | number,
  gardenClause?: string,
): string

export { buildPrintableReportHtml }
