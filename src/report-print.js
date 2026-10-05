function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildPrintableReportHtml(report, title, standard, gardenRequirement, gardenAchieved, gardenClause) {
  const safeTitle = escapeHtml(title || 'Untitled planning report')
  const safeAddress = escapeHtml(report.address || 'Not provided')
  const safeZone = escapeHtml(report.zone || 'Not provided')
  const safeZoneDescription = escapeHtml(report.zoneDescription || 'Not provided')
  const safeOverlays = escapeHtml(report.overlays || 'None identified')
  const safeLga = escapeHtml(report.lga || 'Not provided')
  const safeSummary = escapeHtml(report.summary || 'No summary has been entered yet.')
  const siteArea = escapeHtml(report.siteArea || '—')
  const frontage = escapeHtml(report.frontage || '—')
  const siteCoverage = escapeHtml(report.siteCoverage || '—')
  const gardenArea = escapeHtml(report.gardenArea || '—')
  const safeStandard = escapeHtml(standard || 'No zone standards entered.')
  const safeGardenRequirement = escapeHtml(gardenRequirement ? `Minimum ${gardenRequirement}% required under Clause ${gardenClause}.` : 'Minimum requirement to be confirmed.')
  const safeGardenAchieved = escapeHtml(gardenAchieved || '—')

  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      :root {
        --ink: #17202a;
        --muted: #5c6b73;
        --panel: #f5f7f4;
        --divider: #d9e1df;
        --accent: #1a5f5d;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
      body {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .report-sheet {
        width: min(100%, 980px);
        border: 1px solid var(--divider);
        background: #ffffff;
        box-shadow: 0 8px 30px rgba(23, 32, 42, 0.08);
        padding: 48px 56px 30px;
      }
      .eyebrow {
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 12px;
      }
      h1 {
        margin: 0;
        font-size: 36px;
        line-height: 1.2;
        font-weight: 700;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 18px;
        color: var(--accent);
      }
      .subhead {
        margin-top: 6px;
        color: var(--muted);
        font-size: 14px;
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.75fr) minmax(220px, 0.8fr);
        gap: 28px;
        margin-top: 28px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--divider);
        border-radius: 12px;
        padding: 18px 20px;
      }
      dl {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 10px 18px;
        margin: 0;
      }
      dt {
        font-weight: 700;
        color: var(--muted);
      }
      dd {
        margin: 0;
        color: var(--ink);
      }
      .body-copy {
        margin: 0;
        line-height: 1.7;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(120px, 1fr));
        gap: 14px;
        margin-top: 16px;
      }
      .metric {
        padding: 14px 12px;
        border: 1px solid var(--divider);
        border-radius: 10px;
        background: #fff;
        min-height: 72px;
      }
      .metric span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 6px;
      }
      .metric strong {
        font-size: 22px;
      }
      .note {
        border-left: 4px solid var(--accent);
        background: #eff4f3;
        padding: 18px 18px 16px;
        border-radius: 8px;
      }
      .note strong {
        display: block;
        font-size: 29px;
        margin-top: 8px;
      }
      .note p {
        margin: 14px 0 0;
        line-height: 1.5;
      }
      .zone-standards {
        margin-top: 18px;
        white-space: pre-wrap;
        line-height: 1.6;
        font-size: 13px;
        color: var(--ink);
      }
      .footer {
        margin-top: 28px;
        padding-top: 14px;
        border-top: 1px solid var(--divider);
        color: var(--muted);
        font-size: 12px;
        display: flex;
        justify-content: space-between;
      }
      @media print {
        body { padding: 0; }
        .report-sheet { box-shadow: none; border: none; width: 100%; }
      }
    </style>
  </head>
  <body>
    <main class="report-sheet">
      <div class="eyebrow">Town planning report / draft</div>
      <h1>${safeTitle}</h1>
      <p class="subhead">Prepared for residential development assessment · Victoria</p>

      <div class="grid">
        <section>
          <h2>Project overview</h2>
          <dl>
            <dt>Address</dt><dd>${safeAddress}</dd>
            <dt>Zone</dt><dd>${safeZone} · ${safeZoneDescription}</dd>
            <dt>Overlay(s)</dt><dd>${safeOverlays}</dd>
            <dt>Local government</dt><dd>${safeLga}</dd>
          </dl>

          <div style="margin-top: 28px;">
            <h2>Development summary</h2>
            <p class="body-copy">${safeSummary}</p>
          </div>

          <div style="margin-top: 28px;">
            <h2>Site metrics</h2>
            <div class="metrics">
              <div class="metric"><span>Site area</span><strong>${siteArea} m²</strong></div>
              <div class="metric"><span>Frontage</span><strong>${frontage} m</strong></div>
              <div class="metric"><span>Site coverage</span><strong>${siteCoverage} m²</strong></div>
              <div class="metric"><span>Garden area</span><strong>${gardenArea} m²</strong></div>
            </div>
          </div>
        </section>

        <aside>
          <div class="note">
            <span class="eyebrow">Garden area</span>
            <strong>${safeGardenAchieved}%</strong>
            <p>${safeGardenRequirement}</p>
          </div>

          <div class="panel" style="margin-top: 18px;">
            <div class="eyebrow">Zone standards</div>
            <pre class="zone-standards">${safeStandard}</pre>
          </div>
        </aside>
      </div>

      <footer class="footer">
        <span>PLAN / VIC · Working draft</span>
        <span>${new Date().toLocaleDateString('en-AU')}</span>
      </footer>
    </main>
  </body>
</html>`
}
