import { createContext, useContext, useEffect, useMemo, useState, type FormEvent } from 'react'
import { buildPrintableReportHtml } from './report-print.js'
import './App.css'

type ClauseCheck = { compliant: boolean; appealRights?: boolean; notes: string }
type StreetIntegrationCheck = { compliant: boolean; appealRights?: boolean; proposedServicesWidth: string; notes: string }
type StormwaterCheck = { compliant: boolean; appealRights?: boolean; rainwaterTank: boolean; rainwaterTankSize: string; permeablePaving: boolean; rainGardens: boolean; reuseSanitary: boolean; reuseLaundry: boolean; reuseGarden: boolean; notes: string }
type ParkingArrangement = { arrangement: string; other: string }
type TreeCanopyClause = ClauseCheck & { count: string }
type Report = {
  address: string; zone: string; zoneDescription: string; overlays: string; lga: string
  dwellings: string; storeys: string; parking: string; parkingOther: string; parkingArrangements?: ParkingArrangement[]; existing: string
  siteArea: string; frontage: string; frontageStreet: string; summary: string; coverImage: string
  siteCoverage: string; permeable: string; gardenArea: string; gardenRequirement: string; canopy: string; maxHeight: string
  ordinance: string; images: { satellite: string; satelliteBoundary: string; zoning: string; overlays: string[] }
  openSpace: { secluded: string; total: string }[]
  carParking: string
  existingTrees: { number: string; species: string; spreadHeight: string; status: string; location: string; retain: string }[]
  existingTreesNone: boolean
  streetSetback: { compliant: boolean; distance: string; notes: string }
  buildingHeightClause: { compliant: boolean; maxHeight: string; notes: string }
  sideRearSetbacks: { compliant: boolean; method: 'B2-3.1' | 'B2-3.2'; boundaries: { name: string; isSouthFacing: boolean; floors: { height: string; achieved: string }[] }[]; notes: string }
  wallsOnBoundary: { compliant: boolean; count: string; walls: { elevation: string; boundaryLength: string; achieved: string; averageHeight: string; maxHeight: string }[]; notes: string }
  siteCoverageClause: { compliant: boolean; notes: string }
  accessClause: { compliant: boolean; proposedWidth: string; treeEncroachmentPct: string; notes: string }
  treeCanopyClause: TreeCanopyClause
  frontFenceClause: ClauseCheck
  dwellingDiversityClause: ClauseCheck
  parkingLocationClause: ClauseCheck
  streetIntegration: StreetIntegrationCheck
  entryClause: ClauseCheck
  privateOpenSpaceClause: ClauseCheck
  solarAccessOpenSpaceClause: ClauseCheck
  functionalLayoutClause: ClauseCheck
  roomDepthClause: ClauseCheck
  daylightNewWindowsClause: ClauseCheck
  naturalVentilationClause: ClauseCheck
  storageClause: ClauseCheck
  accessibilityClause: ClauseCheck
  daylightExistingWindowsClause: ClauseCheck
  northFacingWindowsClause: ClauseCheck
  overshadowingSosClause: ClauseCheck
  overlookingClause: ClauseCheck
  internalViewsClause: ClauseCheck
  stormwaterManagement: StormwaterCheck
  overshadowingSolarClause: ClauseCheck
  rooftopSolarClause: ClauseCheck
  solarProtectionClause: ClauseCheck
  wasteRecyclingClause: ClauseCheck
  noiseImpactsClause: ClauseCheck
  energyEfficiencyClause: ClauseCheck
}

type Project = { id: string; name: string; report: Report; updatedAt: number }

const blankReport: Report = { address: '', zone: '', zoneDescription: '', overlays: '', lga: '', dwellings: '2', storeys: '2', parking: 'Onsite parking', parkingOther: '', existing: 'Single storey dwelling', siteArea: '', frontage: '', frontageStreet: '', summary: '', coverImage: '', siteCoverage: '', permeable: '', gardenArea: '', gardenRequirement: '', canopy: '', maxHeight: '', ordinance: '', images: { satellite: '', satelliteBoundary: '', zoning: '', overlays: [] }, openSpace: [], carParking: 'Each dwelling has provided the required carparking space under this clause.  No visitor parking is required to be provided on site, and consequently, none has.', existingTrees: [], existingTreesNone: false, streetSetback: { compliant: true, distance: '', notes: 'Front setback compliant with planning controls.' }, buildingHeightClause: { compliant: true, maxHeight: '', notes: 'Maximum height is below the requirement of the zoning.' }, sideRearSetbacks: { compliant: true, method: 'B2-3.1', boundaries: [], notes: '' }, wallsOnBoundary: { compliant: true, count: '', walls: [], notes: 'Total wall on boundary length is within the allowable distance.' }, siteCoverageClause: { compliant: true, notes: 'Site coverage within the allowable requirements.' }, accessClause: { compliant: true, proposedWidth: '', treeEncroachmentPct: '', notes: 'Crossover width within the allowable requirement achieved.' }, treeCanopyClause: { compliant: true, count: '', notes: 'Tree canopy requirements achieved. Relevant diagramming on TP5.' }, frontFenceClause: { compliant: true, notes: 'The maximum height of the front fence is: 0.9m.' }, dwellingDiversityClause: { compliant: true, notes: 'Not applicable as less than 10 dwellings.' }, parkingLocationClause: { compliant: true, notes: 'All windows within accessways achieve 1m where sills are 1.5m.' }, streetIntegration: { compliant: true, proposedServicesWidth: '', notes: 'All dwellings provided with habitable rooms at either ground or first floor.' }, entryClause: { compliant: true, notes: 'All entry porches covered by 1.2 x 1.2 (1.44m2) canopy.' }, privateOpenSpaceClause: { compliant: true, notes: 'All dwellings supplied with minimum 25m2 S.P.O.S.' }, solarAccessOpenSpaceClause: { compliant: true, notes: 'All dwellings achieve required setbacks to achieve solar requirements to S.P.O.S.' }, functionalLayoutClause: { compliant: true, notes: 'All minimum room dimensions and areas achieved.' }, roomDepthClause: { compliant: true, notes: 'All dwellings provide dual aspect to all Living / kitchen / dining areas.' }, daylightNewWindowsClause: { compliant: true, notes: 'All new habitable room windows are provided with 3m2 clear to sky.' }, naturalVentilationClause: { compliant: true, notes: 'Relevant diagramming on TP5.' }, storageClause: { compliant: true, notes: '6m³ storage provided to all dwellings.' }, accessibilityClause: { compliant: true, notes: 'Not applicable to this application.' }, daylightExistingWindowsClause: { compliant: true, notes: 'All existing habitable room windows have been provided with 3m2 clear to sky as required.' }, northFacingWindowsClause: { compliant: true, notes: 'All north facing windows are setback appropriately from the proposal via compliant dimensions.' }, overshadowingSosClause: { compliant: true, notes: 'All shadowing calculated on TP6 - TP9. This is assessed as compliant.' }, overlookingClause: { compliant: true, notes: 'Overlooking arc annotated on plans. All relevant floor levels have been dimensioned. Screening has been annotated where required.' }, internalViewsClause: { compliant: true, notes: 'Proposal does not propose overlooking internally.' }, stormwaterManagement: { compliant: true, rainwaterTank: false, rainwaterTankSize: '', permeablePaving: false, rainGardens: false, reuseSanitary: false, reuseLaundry: false, reuseGarden: false, notes: '' }, overshadowingSolarClause: { compliant: true, notes: 'Neighbouring solar facilities are sited appropriate distance from boundary. No shadowing occurs over facilities.' }, rooftopSolarClause: { compliant: true, notes: 'Refer to dedicated area on page no. TP4 for further details.' }, solarProtectionClause: { compliant: true, notes: 'Fixed shading devices have been annotated, dimensioned and tagged on plans and shown on elevations.' }, wasteRecyclingClause: { compliant: true, notes: 'Refer to dedicated area on page no. TP5 for further details.' }, noiseImpactsClause: { compliant: true, notes: 'All mechanical plant equipment and storage have been located away from habitable windows. All have been screened in their respective yards away from public using fencing.' }, energyEfficiencyClause: { compliant: true, notes: 'Not applicable to this application.' } }
const steps = ['Project address', 'Zone & overlays', 'Development', 'Existing site', 'Site area', 'Frontage', 'Frontage street', 'Aerial context', 'Zoning map', 'Overlay maps', 'Site coverage', 'Permeable area', 'Garden area', 'Canopy area', 'Development summary', 'Private open space', 'Zone standards', 'Garden requirement', 'Car parking 52.06', 'Canopy trees 52.37', 'B2-1 Street setback', 'B2-2 Building height', 'B2-3 Side & rear setbacks', 'B2-4 Walls on boundaries', 'B2-5 Site coverage', 'B2-6 Access', 'B2-7 Tree canopy', 'B2-8 Front fence', 'B2-9 Dwelling diversity', 'B3-2 Parking location', 'B3-3 Street integration', 'B3-4 Entry', 'B3-5 Private open space', 'B3-6 Solar access to open space', 'B3-7 Functional layout', 'B3-8 Room depth', 'B3-9 Daylight to new windows', 'B3-10 Natural ventilation', 'B3-11 Storage', 'B3-12 Accessibility', 'B4-1 Daylight to existing windows', 'B4-2 Existing north-facing windows', 'B4-3 Overshadowing secluded open space', 'B4-4 Overlooking', 'B4-5 Internal views', 'B5-1 Permeability & stormwater management', 'B5-2 Overshadowing domestic solar', 'B5-3 Rooftop solar energy generation', 'B5-4 Solar protection to new north-facing windows', 'B5-5 Waste & recycling', 'B5-6 Noise impacts', 'B5-7 Energy efficiency', 'Cover image']
const appealRightsFieldByStep: Record<string, keyof Report> = {
  'B2-9 Dwelling diversity': 'dwellingDiversityClause',
  'B3-2 Parking location': 'parkingLocationClause',
  'B3-3 Street integration': 'streetIntegration',
  'B3-4 Entry': 'entryClause',
  'B3-5 Private open space': 'privateOpenSpaceClause',
  'B3-6 Solar access to open space': 'solarAccessOpenSpaceClause',
  'B3-7 Functional layout': 'functionalLayoutClause',
  'B3-8 Room depth': 'roomDepthClause',
  'B3-9 Daylight to new windows': 'daylightNewWindowsClause',
  'B3-10 Natural ventilation': 'naturalVentilationClause',
  'B3-11 Storage': 'storageClause',
  'B3-12 Accessibility': 'accessibilityClause',
  'B4-5 Internal views': 'internalViewsClause',
  'B5-1 Permeability & stormwater management': 'stormwaterManagement',
  'B5-3 Rooftop solar energy generation': 'rooftopSolarClause',
  'B5-4 Solar protection to new north-facing windows': 'solarProtectionClause',
  'B5-5 Waste & recycling': 'wasteRecyclingClause',
  'B5-6 Noise impacts': 'noiseImpactsClause',
  'B5-7 Energy efficiency': 'energyEfficiencyClause',
}
const linkedAppealRightsFieldByStep: Record<string, keyof Report> = {
  'B2-1 Street setback': 'streetSetback',
  'B2-2 Building height': 'buildingHeightClause',
  'B2-3 Side & rear setbacks': 'sideRearSetbacks',
  'B2-4 Walls on boundaries': 'wallsOnBoundary',
  'B2-5 Site coverage': 'siteCoverageClause',
  'B2-6 Access': 'accessClause',
  'B2-7 Tree canopy': 'treeCanopyClause',
  'B2-8 Front fence': 'frontFenceClause',
  'B4-1 Daylight to existing windows': 'daylightExistingWindowsClause',
  'B4-2 Existing north-facing windows': 'northFacingWindowsClause',
  'B4-3 Overshadowing secluded open space': 'overshadowingSosClause',
  'B4-4 Overlooking': 'overlookingClause',
  'B5-2 Overshadowing domestic solar': 'overshadowingSolarClause',
}
const AppealRightsContext = createContext<{ enabled: boolean; checked: boolean; setChecked: (value: boolean) => void }>({ enabled: false, checked: false, setChecked: () => undefined })
const sample = { zone: 'GRZ1', zoneDescription: 'General Residential Zone - Schedule 1', overlays: 'DDO18 — Design and Development Overlay', lga: 'MELBOURNE' }
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE_URL}${path}`
const api = async (path: string, options: RequestInit = {}) => { const response = await fetch(apiUrl(path), { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const payload = response.status === 204 ? null : await response.json(); if (!response.ok) throw new Error(payload?.error || 'Request failed'); return payload }
function withAppealRights(report: Report): Report {
  const normalized = { ...report }
  for (const field of Object.values(appealRightsFieldByStep)) {
    const clause = normalized[field] as ClauseCheck
    if (clause && typeof clause.appealRights !== 'boolean') {
      Object.assign(normalized, { [field]: { ...clause, appealRights: !clause.compliant } })
    }
  }
  return normalized
}
function parkingArrangementsFor(report: Pick<Report, 'dwellings' | 'parking' | 'parkingOther' | 'parkingArrangements'>): ParkingArrangement[] {
  const dwellingCount = Math.max(1, Number(report.dwellings) || 1)
  const existing = Array.isArray(report.parkingArrangements) ? report.parkingArrangements : []
  const useLegacyValue = existing.length === 0
  return Array.from({ length: Math.max(dwellingCount, existing.length) }, (_, index) => existing[index] || {
    arrangement: useLegacyValue ? report.parking || 'Onsite parking' : 'Onsite parking',
    other: useLegacyValue ? report.parkingOther || '' : '',
  })
}

function App() {
  const [view, setView] = useState<'home' | 'wizard' | 'report'>('home')
  const [step, setStep] = useState(0)
  const [report, setReport] = useState<Report>(() => {
    const merged = withAppealRights({ ...blankReport, images: { ...blankReport.images } })
    if (!Array.isArray(merged.existingTrees)) merged.existingTrees = []
    if (typeof merged.carParking !== 'string') merged.carParking = blankReport.carParking
    if (!merged.maxHeight) merged.maxHeight = 'None specified.'
    merged.existingTreesNone = Boolean(merged.existingTreesNone)
    return merged
  })
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [createAfterAuth, setCreateAfterAuth] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [lookupState, setLookupState] = useState('Ready to look up')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [projectsError, setProjectsError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])

  const update = (key: keyof Report, value: any) => { setSaved(false); setSaveError(''); setReport((current) => ({ ...current, [key]: value })) }
  useEffect(() => {
    localStorage.removeItem('planning-report')
    localStorage.removeItem('planning-report-step')
    api('/api/auth/me').then((result) => setUser(result.user)).catch(() => undefined)
  }, [])
  useEffect(() => {
    if (!user) return
    let active = true
    api('/api/projects').then((result) => { if (active) setProjects(result.projects) }).catch((error) => {
      if (active) setProjectsError(`Unable to load projects: ${error instanceof Error ? error.message : 'Request failed'}`)
    })
    return () => { active = false }
  }, [user])
  const save = async () => {
    setSaveError('')
    if (!user) { setSaveError('Sign in is required to save projects.'); return false }
    try {
      const result = projectId
        ? await api(`/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify({ name: report.address, report }) })
        : await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: report.address, report }) })
      setProjectId(result.project.id)
      setProjects((current) => [result.project, ...current.filter((project) => project.id !== result.project.id)])
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
      return true
    } catch (error) {
      setSaved(false)
      setSaveError(`Project could not be saved: ${error instanceof Error ? error.message : 'Request failed'}`)
      return false
    }
  }
  const goToStep = (nextStep: number) => { setStep(Math.min(Math.max(nextStep, 0), steps.length - 1)) }
  const beginProject = () => {
    setReport(withAppealRights({ ...blankReport, images: { ...blankReport.images }, maxHeight: 'None specified.' }))
    setProjectId(null)
    setSaved(false)
    setSaveError('')
    goToStep(0)
    setView('wizard')
  }
  const start = () => {
    if (!user) {
      setAuthMode('login')
      setCreateAfterAuth(true)
      setAuthOpen(true)
      return
    }
    beginProject()
  }
  const openProject = (project: Project) => { setReport(withAppealRights({ ...blankReport, ...project.report, maxHeight: project.report.maxHeight || 'None specified.' })); setProjectId(project.id); setSaved(false); setSaveError(''); setView('wizard'); goToStep(0) }
  const deleteProject = async (id: string) => {
    setProjectsError('')
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects((current) => current.filter((project) => project.id !== id))
      if (projectId === id) setProjectId(null)
    } catch (error) {
      setProjectsError(`Project could not be deleted: ${error instanceof Error ? error.message : 'Request failed'}`)
    }
  }
  const dwellings = Math.max(1, Number(report.dwellings) || 1)
  const calculatedGardenRequirement = report.siteArea && Number(report.siteArea) > 650 ? 35 : report.siteArea && Number(report.siteArea) > 500 ? 30 : report.siteArea && Number(report.siteArea) >= 400 ? 25 : 0
  const gardenRequirement = report.gardenRequirement !== undefined && report.gardenRequirement !== '' ? Number(report.gardenRequirement) : calculatedGardenRequirement
  const gardenClause = getGardenClause(report.zone)
  const gardenAchieved = report.siteArea && report.gardenArea ? Math.round((Number(report.gardenArea) / Number(report.siteArea)) * 100) : 0
  const standard = report.ordinance || (dwellings > 1 ? 'B1 — Minimum street setback: 9m\nB2 — Minimum side setback: 1m\nB3 — Maximum site coverage: 60%' : 'A1 — Minimum street setback: 9m\nA2 — Minimum side setback: 1m\nA3 — Maximum site coverage: 60%')

  const title = useMemo(() => report.address || 'Untitled planning report', [report.address])

  const authenticate = async (mode: 'login' | 'register', fields: { name: string; email: string; password: string }) => {
    const result = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(fields) })
    setUser(result.user)
    setProjectsError('')
    setProjects([])
    setAuthOpen(false)
    if (createAfterAuth) {
      setCreateAfterAuth(false)
      beginProject()
    }
  }
  const printReport = () => {
    const html = buildPrintableReportHtml(report, title, standard, gardenRequirement, gardenAchieved, gardenClause)
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')
    if (!printWindow) {
      window.print()
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      try {
        printWindow.print()
      } catch {
        window.print()
      }
    }, 250)
  }
  const exportWord = async () => {
    setExporting(true)
    try {
      const toDataUrl = async (source: string) => { if (!source || !source.startsWith('blob:')) return source; const blob = await (await fetch(source)).blob(); return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob) }) }
      const images = { satellite: await toDataUrl(report.images.satellite), satelliteBoundary: report.images.satelliteBoundary, zoning: await toDataUrl(report.images.zoning), overlays: [] as string[] }
      for (const overlay of report.images.overlays) images.overlays.push(await toDataUrl(overlay))
      const response = await fetch(apiUrl('/api/report/document'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...report, coverImage: await toDataUrl(report.coverImage), images }) })
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error([payload?.error, payload?.detail].filter(Boolean).join(': ') || 'Document export failed') }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'planning-report'}.docx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Document export failed')
    } finally {
      setExporting(false)
    }
  }
  if (view === 'report') return <ReportView report={report} title={title} standard={standard} gardenRequirement={gardenRequirement} gardenAchieved={gardenAchieved} gardenClause={gardenClause} exporting={exporting} onExportWord={exportWord} onPrintReport={printReport} onBack={() => setView('wizard')} />
  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setView('home')}><span className="brand-mark">◒</span><span>PLAN / VIC</span></button><div className="top-actions"><span className={`saved-note ${saveError ? 'save-error' : ''}`}>{saveError || (saved ? 'Saved to account' : 'Victoria planning workspace')}</span>{user ? <button className="avatar" title={`Sign out (${user.email})`} onClick={() => api('/api/auth/logout', { method: 'POST' }).then(() => { setUser(null); setProjects([]); setProjectId(null); setSaved(false); setSaveError(''); setReport(withAppealRights({ ...blankReport, images: { ...blankReport.images }, maxHeight: 'None specified.' })); setView('home') }).catch((error) => setSaveError(`Sign out failed: ${error instanceof Error ? error.message : 'Request failed'}`))}>{user.name.slice(0, 2).toUpperCase()}</button> : <><button className="auth-link" onClick={() => { setAuthMode('login'); setAuthOpen(true) }}>Sign in</button><button className="auth-cta" onClick={() => { setAuthMode('register'); setAuthOpen(true) }}>Sign up</button></>}</div></header>
    {view === 'home' ? <Home onStart={start} onLogin={() => { setAuthMode('login'); setCreateAfterAuth(false); setAuthOpen(true) }} user={user} projects={projects} projectsError={projectsError} onOpenProject={openProject} onDeleteProject={deleteProject} /> : <Wizard step={step} setStep={goToStep} report={report} update={update} save={save} saved={saved} lookupState={lookupState} setLookupState={setLookupState} onComplete={async () => { if (await save()) setView('report') }} onCancel={() => setView('home')} standard={standard} dwellings={dwellings} gardenRequirement={gardenRequirement} gardenAchieved={gardenAchieved} gardenClause={gardenClause} />}
    {authOpen && <AuthPanel mode={authMode} setMode={setAuthMode} onClose={() => { setAuthOpen(false); setCreateAfterAuth(false) }} onSubmit={authenticate} />}
  </div>
}

function Home({ onStart, onLogin, user, projects, projectsError, onOpenProject, onDeleteProject }: { onStart: () => void; onLogin: () => void; user: { id: string; name: string; email: string } | null; projects: Project[]; projectsError: string; onOpenProject: (project: Project) => void; onDeleteProject: (id: string) => void }) {
  const cards = user
    ? projects.map((project) => ({ key: project.id, name: project.name || 'Untitled planning report', detail: `Saved project · Updated ${new Date(project.updatedAt).toLocaleDateString('en-AU')}`, onOpen: () => onOpenProject(project), onDelete: () => onDeleteProject(project.id) }))
    : []
  return <main className="home"><section className="hero"><div className="eyebrow">VICTORIA / RESIDENTIAL DEVELOPMENT</div><h1>Planning reports,<br /><em>made legible.</em></h1><p>Build a clear, evidence-led town planning report from site facts to final schedule in one guided workspace.</p><div className="hero-actions"><button className="primary" onClick={onStart}>Create project <span>↗</span></button>{user ? <span className="account-status">Signed in as {user.name}</span> : <button className="text-button" onClick={onLogin}>Sign in to manage projects <span>→</span></button>}</div></section><section className="project-area"><div className="section-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Recent projects</h2></div><span className="project-count">{String(cards.length).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</span></div>{projectsError && <p className="auth-error">{projectsError}</p>}{cards.length ? cards.map((card) => <ProjectCard key={card.key} name={card.name} detail={card.detail} onOpen={card.onOpen} onDelete={card.onDelete} />) : <article className="project-card" onClick={onStart}><div className="project-icon">⌂</div><div className="project-info"><h3>{user ? 'Start your first project' : 'Sign in to view your projects'}</h3><p>{user ? 'A guided 19-step workflow for your next application' : 'Projects are saved to your account, not on this device.'}</p></div><span className="project-arrow">→</span></article>}<div className="workspace-foot"><span>Vicmap connected</span><span className="dot"></span><span>Projects saved to your account</span><a href="#documentation">Read documentation ↗</a></div></section></main>
}

function ProjectCard({ name, detail, onOpen, onDelete }: { name: string; detail: string; onOpen: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return <article className="project-card confirming"><div className="project-info"><h3>Are you sure?</h3><p>Delete {name}? This permanently removes the project and can't be undone.</p></div><div className="confirm-actions"><button className="confirm-cancel" onClick={() => setConfirming(false)}>Cancel</button><button className="confirm-delete" onClick={onDelete}>Delete</button></div></article>
  return <article className="project-card" onClick={onOpen}><div className="project-icon">⌂</div><div className="project-info"><h3>{name}</h3><p>{detail}</p></div><button className="project-delete" aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={(event) => { event.stopPropagation(); setConfirming(true) }}>×</button><span className="project-arrow">→</span></article>
}

function Wizard({ step, setStep, report, update, save, saved, lookupState, setLookupState, onComplete, onCancel, standard, dwellings, gardenRequirement, gardenAchieved, gardenClause }: any) {
  const isLast = step === steps.length - 1
  const [standardsState, setStandardsState] = useState('Ready to scrape')
  useEffect(() => {
    const continueOnEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (!(target instanceof HTMLInputElement) || !target.closest('.form-content')) return
      if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'color', 'range'].includes(target.type)) return
      event.preventDefault()
      if (step === steps.length - 1) onComplete()
      else setStep(step + 1)
    }
    document.addEventListener('keydown', continueOnEnter)
    return () => document.removeEventListener('keydown', continueOnEnter)
  }, [step, setStep, onComplete])
  const lookup = async () => { setLookupState('Querying Vicmap…'); try { const result = await api(`/api/vicmap/lookup?address=${encodeURIComponent(report.address)}`); const parcel = result.parcel; if (parcel.zone) update('zone', parcel.zone); if (parcel.zoneDescription) update('zoneDescription', parcel.zoneDescription); if (parcel.overlays) update('overlays', parcel.overlays); if (parcel.lga) update('lga', parcel.lga); if (parcel.siteArea) update('siteArea', String(Math.round(Number(parcel.siteArea)))); if (result.maps) update('images', { satellite: result.maps.satellite || '', satelliteBoundary: result.maps.satelliteBoundary || '', zoning: result.maps.zoning || '', overlays: result.maps.overlays || [] }); if (!report.frontageStreet) update('frontageStreet', formatStreetName(report.address)); setLookupState(parcel.zone ? 'Vicmap match found' : result.planningControlsAvailable ? 'Overlays found — zone unavailable, enter manually' : 'Parcel found — enter zone manually') } catch { setReportDefaults(report, update); setLookupState('Vicmap unavailable — edit manually') } }
  const scrapeStandards = async () => { setStandardsState('Scraping planning scheme…'); try { const result = await api(`/api/planning/standards?lga=${encodeURIComponent(report.lga)}&zone=${encodeURIComponent(report.zone)}&dwellings=${dwellings}`); if (result.text) update('ordinance', result.text); if (result.maxHeight) update('maxHeight', result.maxHeight); setStandardsState(result.message) } catch (error) { if (!report.maxHeight) update('maxHeight', 'None specified.'); setStandardsState(error instanceof Error ? error.message : 'Scrape failed — enter manually') } }
  return <main className="wizard"><aside className="stepper"><div className="eyebrow">NEW PROJECT</div><h2>Report builder</h2><div className="step-list">{steps.map((name, index) => <button key={name} className={index === step ? 'active' : index < step ? 'complete' : ''} onClick={() => index <= step && setStep(index)}><span>{index < step ? '✓' : String(index + 1).padStart(2, '0')}</span>{name}</button>)}</div><div className="step-footer"><span className="dot green"></span>Save this project to your account</div></aside><section className="form-pane"><div className="form-top"><button className="back-link" onClick={onCancel}>← Projects</button><span>Step {String(step + 1).padStart(2, '0')} of {steps.length}</span></div><div className="form-content"><div className="eyebrow">{String(step + 1).padStart(2, '0')} / {steps.length}</div><h1>{steps[step]}</h1><p className="step-intro">{step === 0 ? 'Start with the site address. We will use it to find the parcel and planning controls.' : 'Capture the site detail that will anchor this report.'}</p><StepContent step={step} report={report} update={update} lookup={lookup} lookupState={lookupState} standard={standard} dwellings={dwellings} gardenRequirement={gardenRequirement} gardenAchieved={gardenAchieved} gardenClause={gardenClause} standardsState={standardsState} scrapeStandards={scrapeStandards} /><div className="form-nav"><button className="secondary" onClick={async () => { if (await save()) onCancel() }}>Save & exit</button><span>{saved ? 'Saved to account' : 'Save this project to return to it later'}</span><button className="primary" onClick={() => isLast ? onComplete() : setStep(step + 1)}>{isLast ? 'Complete report' : 'Continue'} <span>→</span></button></div></div></section></main>
}

function setReportDefaults(report: Report, update: (key: keyof Report, value: string) => void) { if (!report.zone) update('zone', sample.zone); if (!report.zoneDescription) update('zoneDescription', sample.zoneDescription); if (!report.overlays) update('overlays', sample.overlays); if (!report.lga) update('lga', sample.lga); if (!report.siteArea) update('siteArea', '612'); if (!report.frontageStreet) update('frontageStreet', formatStreetName(report.address)) }

function formatStreetName(address: string) { return (address.split(',')[0] || '').replace(/^\s*\d+[A-Za-z]?\s+/, '').trim().toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Main Street' }
function getGardenClause(zone: string) { const prefix = zone.trim().toUpperCase(); if (prefix.startsWith('GRZ')) return '32.08'; if (prefix.startsWith('NRZ')) return '32.09'; if (prefix.startsWith('RGZ')) return '32.07'; return 'the applicable zone schedule' }

function Field({ label, value, onChange, placeholder, type = 'text', hint }: any) { return <label className="field"><span>{label}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{hint && <small>{hint}</small>}</label> }
function Options({ value, onChange, options }: any) { return <div className="options">{options.map((option: string) => <button type="button" key={option} className={value === option ? 'selected' : ''} onClick={() => onChange(option)}><span className="radio"></span>{option}</button>)}</div> }
function OverlayFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const fields = value ? value.split(/\r?\n/).map((overlay) => overlay.trim()) : ['']
  const overlays = fields.filter(Boolean)
  const updateOverlay = (index: number, nextValue: string) => onChange(fields.map((overlay, fieldIndex) => fieldIndex === index ? nextValue : overlay).join('\n'))
  const removeOverlay = (index: number) => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index).join('\n'))
  return <div className="overlay-fields"><div className="overlay-heading"><span className="group-label">Overlay(s)</span><span className="overlay-count">{overlays.length} found</span></div>{fields.map((overlay, index) => <div className="overlay-row" key={index}><Field label={`Overlay ${index + 1}`} value={overlay} onChange={(nextValue: string) => updateOverlay(index, nextValue)} placeholder="e.g. LSIO — Land Subject to Inundation Overlay" />{fields.length > 1 && <button type="button" className="remove-overlay" aria-label={`Remove overlay ${index + 1}`} onClick={() => removeOverlay(index)}>×</button>}</div>)}<button type="button" className="add-overlay" onClick={() => onChange([...fields, ''].join('\n'))}>＋ Add overlay</button></div>
}
function TreeFields({ value, onChange }: { value: { number: string; species: string; spreadHeight: string; status: string; location: string; retain: string }[]; onChange: (value: { number: string; species: string; spreadHeight: string; status: string; location: string; retain: string }[]) => void }) {
  const trees = value || []
  const updateTree = (index: number, key: 'number' | 'species' | 'spreadHeight' | 'status' | 'location' | 'retain', nextValue: string) => onChange(trees.map((tree, treeIndex) => treeIndex === index ? { ...tree, [key]: nextValue } : tree))
  const removeTree = (index: number) => onChange(trees.filter((_, treeIndex) => treeIndex !== index))
  const addTree = () => onChange([...trees, { number: '', species: '', spreadHeight: '', status: '', location: '', retain: '' }])
  return <div className="overlay-fields"><div className="overlay-heading"><span className="group-label">Existing canopy trees</span><span className="overlay-count">{trees.length} added</span></div>{trees.map((tree, index) => <div className="tree-card" key={index}><div className="tree-card-head"><span className="data-label">TREE {index + 1}</span>{trees.length > 1 && <button type="button" className="remove-overlay" aria-label={`Remove tree ${index + 1}`} onClick={() => removeTree(index)}>×</button>}</div><div className="tree-fields"><Field label="Tree number" value={tree.number} onChange={(nextValue: string) => updateTree(index, 'number', nextValue)} placeholder="e.g. T1" /><Field label="Species" value={tree.species} onChange={(nextValue: string) => updateTree(index, 'species', nextValue)} placeholder="e.g. Quercus robur (English Oak)" /><Field label="Spread × height" value={tree.spreadHeight} onChange={(nextValue: string) => updateTree(index, 'spreadHeight', nextValue)} placeholder="e.g. 8m × 12m" /><Field label="Status" value={tree.status} onChange={(nextValue: string) => updateTree(index, 'status', nextValue)} placeholder="e.g. Healthy" /><Field label="Location" value={tree.location} onChange={(nextValue: string) => updateTree(index, 'location', nextValue)} placeholder="e.g. Front yard" /><Field label="Retain / remove" value={tree.retain} onChange={(nextValue: string) => updateTree(index, 'retain', nextValue)} placeholder="Retain" /></div></div>)}<button type="button" className="add-overlay" onClick={addTree}>＋ Add tree</button></div>
}
function requiredSetbackB231(height: string) { const h = Number(height) || 0; if (h <= 3.6) return 1; if (h <= 6.9) return +(1 + 0.3 * (h - 3.6)).toFixed(2); return +(h - 4.91).toFixed(2) }
function requiredSetbackB232(height: string, isSouthFacing: boolean) { const h = Number(height) || 0; if (!isSouthFacing) return h > 11 ? 4.5 : 3; return h > 11 ? 9 : 6 }
function CompliancePanel({ compliant, onChange, body }: { compliant: boolean; onChange: (value: boolean) => void; body: React.ReactNode }) {
  const appealRights = useContext(AppealRightsContext)
  return <div className="compliance-card"><div className="compliance"><label className="toggle compliance-check"><input type="checkbox" checked={Boolean(compliant)} onChange={(event) => onChange(event.target.checked)} /><span className="compliance-label">Compliant with the requirements of this clause</span></label>{appealRights.enabled && <label className="toggle appeal-control"><input type="checkbox" checked={appealRights.checked} onChange={(event) => appealRights.setChecked(event.target.checked)} /><span>Appeal rights apply</span></label>}<span className={'appeal-rights ' + (appealRights.checked ? 'appeal-yes' : 'appeal-no')}>APPEAL RIGHTS: {appealRights.checked ? 'YES' : 'NO'}</span></div><div className="compliance-body">{body}</div></div>
}
function NotesField({ value, defaultText, onChange, label = 'Further information' }: { value: string; defaultText: string; onChange: (value: string) => void; label?: string }) {
  const effective = value && value.trim() ? value : defaultText
  return <label className="field"><span>{label}</span><textarea value={effective} onChange={(event) => onChange(event.target.value)} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label>
}
function SimpleClause({ clause, setClause, defaultNotes }: { clause: ClauseCheck; setClause: (patch: Partial<ClauseCheck>) => void; defaultNotes: string }) {
  return <CompliancePanel compliant={clause.compliant} onChange={(value) => setClause({ compliant: value })} body={<NotesField value={clause.notes} defaultText={defaultNotes} onChange={(value) => setClause({ notes: value })} />} />
}
function BoundaryFields({ value, method, onChange }: { value: { name: string; isSouthFacing: boolean; floors: { height: string; achieved: string }[] }[]; method: 'B2-3.1' | 'B2-3.2'; onChange: (value: { name: string; isSouthFacing: boolean; floors: { height: string; achieved: string }[] }[]) => void }) {
  const calcHeight = (height: string, isSouthFacing: boolean) => method === 'B2-3.1' ? requiredSetbackB231(height) : requiredSetbackB232(height, isSouthFacing)
  const updateBoundary = (index: number, patch: Partial<{ name: string; isSouthFacing: boolean; floors: { height: string; achieved: string }[] }>) => onChange(value.map((boundary, boundaryIndex) => boundaryIndex === index ? { ...boundary, ...patch } : boundary))
  const removeBoundary = (index: number) => onChange(value.filter((_, boundaryIndex) => boundaryIndex !== index))
  const addBoundary = () => onChange([...value, { name: '', isSouthFacing: false, floors: [{ height: '', achieved: '' }] }])
  const addFloor = (index: number) => updateBoundary(index, { floors: [...value[index].floors, { height: '', achieved: '' }] })
  const updateFloor = (index: number, floorIndex: number, patch: Partial<{ height: string; achieved: string }>) => updateBoundary(index, { floors: value[index].floors.map((floor, current) => current === floorIndex ? { ...floor, ...patch } : floor) })
  const removeFloor = (index: number, floorIndex: number) => updateBoundary(index, { floors: value[index].floors.filter((_, current) => current !== floorIndex) })
  return <div className="overlay-fields"><div className="overlay-heading"><span className="group-label">Boundaries</span><span className="overlay-count">{value.length} added</span></div>{value.map((boundary, index) => <div className="tree-card" key={index}><div className="tree-card-head"><span className="data-label">BOUNDARY {index + 1}</span>{value.length > 1 && <button type="button" className="remove-overlay" aria-label={`Remove boundary ${index + 1}`} onClick={() => removeBoundary(index)}>×</button>}</div><Field label="Boundary name" value={boundary.name} onChange={(nextValue: string) => updateBoundary(index, { name: nextValue })} placeholder="e.g. North boundary" />{method === 'B2-3.2' && <label className="toggle"><input type="checkbox" checked={Boolean(boundary.isSouthFacing)} onChange={(event) => updateBoundary(index, { isSouthFacing: event.target.checked })} /><span>This boundary is to the south of the building (between south 30° west and south 30° east)</span></label>}<div className="overlay-heading"><span className="group-label">Floors</span><span className="overlay-count">{boundary.floors.length} added</span></div>{boundary.floors.map((floor, floorIndex) => <div className="floor-card" key={floorIndex}><div className="tree-card-head"><span className="data-label">FLOOR {floorIndex + 1}</span>{boundary.floors.length > 1 && <button type="button" className="remove-overlay" aria-label={`Remove floor ${floorIndex + 1}`} onClick={() => removeFloor(index, floorIndex)}>×</button>}</div><div className="tree-fields"><Field label="Height" value={floor.height} onChange={(nextValue: string) => updateFloor(index, floorIndex, { height: nextValue })} type="number" placeholder="e.g. 3.89" hint="Metres" /><div className="metric"><span>Required setback</span><strong>{floor.height ? `${calcHeight(floor.height, boundary.isSouthFacing)} m` : '—'}</strong></div><Field label="Achieved setback" value={floor.achieved} onChange={(nextValue: string) => updateFloor(index, floorIndex, { achieved: nextValue })} type="number" placeholder="e.g. 1.20" hint="Metres" /></div></div>)}<button type="button" className="add-overlay" onClick={() => addFloor(index)}>＋ Add floor</button></div>)}<button type="button" className="add-overlay" onClick={addBoundary}>＋ Add boundary</button></div>
}
function allowableWallOnBoundary(boundaryLength: string) { const bl = Number(boundaryLength) || 0; if (!bl) return ''; return +(10 + 0.25 * bl).toFixed(2) }
function maxCoveragePercent(zone: string) { const z = String(zone || '').trim().toUpperCase(); if (z.startsWith('NRZ')) return 60; if (z.startsWith('GRZ')) return 65; if (z.startsWith('RGZ') || z.startsWith('MUZ') || z.startsWith('HCTZ')) return 70; return 60 }
function maxCrossoverWidth(frontage: string) { const f = Number(frontage) || 0; if (!f) return ''; return +(f < 20 ? f * 0.4 : f * 0.33).toFixed(2) }
function WallFields({ value, onChange }: { value: { elevation: string; boundaryLength: string; achieved: string; averageHeight: string; maxHeight: string }[]; onChange: (value: { elevation: string; boundaryLength: string; achieved: string; averageHeight: string; maxHeight: string }[]) => void }) {
  const updateWall = (index: number, patch: Partial<{ elevation: string; boundaryLength: string; achieved: string; averageHeight: string; maxHeight: string }>) => onChange(value.map((wall, wallIndex) => wallIndex === index ? { ...wall, ...patch } : wall))
  const removeWall = (index: number) => onChange(value.filter((_, wallIndex) => wallIndex !== index))
  const addWall = () => onChange([...value, { elevation: '', boundaryLength: '', achieved: '', averageHeight: '', maxHeight: '' }])
  return <div className="overlay-fields"><div className="overlay-heading"><span className="group-label">Walls on boundary</span><span className="overlay-count">{value.length} added</span></div>{value.map((wall, index) => <div className="wall-card" key={index}><div className="tree-card-head"><span className="data-label">WALL {index + 1}</span>{value.length > 1 && <button type="button" className="remove-overlay" aria-label={`Remove wall ${index + 1}`} onClick={() => removeWall(index)}>×</button>}</div><div className="wall-fields"><Field label="Elevation" value={wall.elevation} onChange={(nextValue: string) => updateWall(index, { elevation: nextValue })} placeholder="e.g. NORTH ELEVATION" /><div className="wall-row"><Field label="Boundary length" value={wall.boundaryLength} onChange={(nextValue: string) => updateWall(index, { boundaryLength: nextValue })} type="number" placeholder="e.g. 69.90" hint="Metres" /><div className="metric"><span>Allowable wall on boundary</span><strong>{wall.boundaryLength ? `${allowableWallOnBoundary(wall.boundaryLength)} m` : '—'}</strong></div><Field label="Achieved wall on boundary" value={wall.achieved} onChange={(nextValue: string) => updateWall(index, { achieved: nextValue })} type="number" placeholder="e.g. 8.40" hint="Metres" /></div><div className="wall-row"><Field label="Average height" value={wall.averageHeight} onChange={(nextValue: string) => updateWall(index, { averageHeight: nextValue })} type="number" placeholder="e.g. 7.20" hint="Metres" /><Field label="Maximum height" value={wall.maxHeight} onChange={(nextValue: string) => updateWall(index, { maxHeight: nextValue })} type="number" placeholder="e.g. 8.40" hint="Metres" /><div /></div></div></div>)}<button type="button" className="add-overlay" onClick={addWall}>＋ Add wall</button></div>
}
function StepContent(props: any) {
  const { step, report, update } = props
  const field = appealRightsFieldByStep[steps[step]] || linkedAppealRightsFieldByStep[steps[step]]
  const enabled = Boolean(appealRightsFieldByStep[steps[step]])
  const clause = field ? report[field] as ClauseCheck : undefined
  const checked = enabled && typeof clause?.appealRights === 'boolean' ? clause.appealRights : !clause?.compliant
  const setChecked = (value: boolean) => {
    if (enabled && field && clause) update(field, { ...clause, appealRights: value })
  }
  return <AppealRightsContext.Provider value={{ enabled, checked, setChecked }}><StepContentBody {...props} /></AppealRightsContext.Provider>
}

function StepContentBody({ step: displayStep, report, update, lookup, lookupState, standard, dwellings, gardenRequirement, gardenAchieved, gardenClause, standardsState, scrapeStandards }: any) {
  // Preserve the existing content-case indexes after combining the height step.
  const step = displayStep >= 17 ? displayStep + 1 : displayStep
  if (step === 0) return <div className="stack"><Field label="Project address" value={report.address} onChange={(v: string) => update('address', v)} placeholder="12 Example Street, Carlton VIC 3053" hint="Use the street address for the parcel you are assessing." /><button className="lookup" onClick={lookup}>⌕ {lookupState}</button></div>
  if (step === 1) return <div className="stack"><div className="data-card"><span className="data-label">VICMAP RESULT / {report.lga || 'AWAITING LOOKUP'}</span><Field label="Zone code" value={report.zone} onChange={(v: string) => update('zone', v)} placeholder="GRZ1" /><Field label="Zone description" value={report.zoneDescription} onChange={(v: string) => update('zoneDescription', v)} placeholder="General Residential Zone" /><OverlayFields value={report.overlays} onChange={(v: string) => update('overlays', v)} /></div><p className="question">Does this look right? Edit any field if the Vicmap result needs correcting.</p></div>
  if (step === 2) { const arrangements = parkingArrangementsFor(report); const updateArrangement = (index: number, patch: Partial<ParkingArrangement>) => { const next = [...arrangements]; next[index] = { ...next[index], ...patch }; update('parkingArrangements', next) }; return <div className="stack"><Field label="Proposed dwellings" value={report.dwellings} onChange={(v: string) => update('dwellings', v)} type="number" placeholder="2" /><Field label="Development storeys" value={report.storeys} onChange={(v: string) => update('storeys', v)} type="number" placeholder="2" /><span className="group-label">Parking arrangement by dwelling</span>{Array.from({ length: dwellings }, (_, index) => { const parking = arrangements[index]; return <div className="data-card space-card" key={index}><span className="data-label">DWELLING {index + 1} / PARKING</span><Options value={parking.arrangement} onChange={(value: string) => updateArrangement(index, { arrangement: value })} options={['Onsite parking', 'No onsite parking', 'Other']} />{parking.arrangement === 'Other' && <Field label={`Describe parking arrangement for dwelling ${index + 1}`} value={parking.other} onChange={(value: string) => updateArrangement(index, { other: value })} placeholder="e.g. Car stacker system" />}</div>})}</div> }
  if (step === 3) return <Options value={report.existing} onChange={(v: string) => update('existing', v)} options={['Single storey dwelling', 'Double storey dwelling', 'Vacant']} />
  if (step === 4) return <div className="stack"><Field label="Site area" value={report.siteArea} onChange={(v: string) => update('siteArea', v)} type="number" placeholder="612" hint="Square metres (m²)" /><SiteAreaMap report={report} /><p className="question">The red boundary shows the parcel used for the site area calculation. You can replace the area above if required.</p></div>
  if (step === 5) return <Field label="Site frontage" value={report.frontage} onChange={(v: string) => update('frontage', v)} type="number" placeholder="15.2" hint="Metres" />
  if (step === 6) { const extractedStreet = formatStreetName(report.address); return <div className="stack"><Field label="Frontage presents to" value={report.frontageStreet || extractedStreet} onChange={(v: string) => update('frontageStreet', v)} placeholder="Example Street" hint="Street number removed and each word capitalised from the project address. Edit the field if the frontage is a different street." /></div> }
  if (step === 7) return <ImagePanel type="satellite" label="Satellite context" report={report} update={update} />
  if (step === 8) return <ImagePanel type="zoning" label="Zoning map" report={report} update={update} />
  if (step === 9) return <ImagePanel type="overlay" label="Overlay map" report={report} update={update} />
  if (step === 10) return <Field label="Site coverage" value={report.siteCoverage} onChange={(v: string) => update('siteCoverage', v)} type="number" placeholder="320" hint="Square metres (m²)" />
  if (step === 11) return <Field label="Permeable area" value={report.permeable} onChange={(v: string) => update('permeable', v)} type="number" placeholder="145" hint="Square metres (m²)" />
  if (step === 12) return <Field label="Garden area" value={report.gardenArea} onChange={(v: string) => update('gardenArea', v)} type="number" placeholder="190" hint="Square metres (m²)" />
  if (step === 13) return <Field label="Canopy area" value={report.canopy} onChange={(v: string) => update('canopy', v)} type="number" placeholder="42" hint="Square metres (m²)" />
  if (step === 14) return <label className="field"><span>Development summary</span><textarea value={report.summary} onChange={(e) => update('summary', e.target.value)} placeholder="Describe the proposed development, built form, landscape response and key site outcomes in up to 500 words." rows={10}></textarea><small>{report.summary.split(/\s+/).filter(Boolean).length} / 500 words</small></label>
  if (step === 15) return <div className="stack">{Array.from({ length: dwellings }, (_, index) => { const space = report.openSpace[index] || { secluded: '', total: '' }; return <div className="data-card space-card" key={index}><span className="data-label">DWELLING {index + 1}</span><Field label="Secluded private open space" value={space.secluded} onChange={(v: string) => { const next = [...report.openSpace]; next[index] = { ...space, secluded: v }; update('openSpace', next as any) }} type="number" placeholder="25" hint="Square metres (m²)" /><Field label="Total private open space" value={space.total} onChange={(v: string) => { const next = [...report.openSpace]; next[index] = { ...space, total: v }; update('openSpace', next as any) }} type="number" placeholder="40" hint="Square metres (m²)" /></div> })}</div>
  if (step === 16) return <div className="stack"><div className="data-card"><span className="data-label">ORDINANCE / {report.zone || 'ZONE'}</span><textarea value={report.ordinance} onChange={(e) => update('ordinance', e.target.value)} placeholder={standard} rows={6}></textarea><small>Values starting with {dwellings > 1 ? 'B' : 'A'} are scraped from the Standard column for {report.zone || 'this zone'}.</small><button type="button" className="lookup" onClick={scrapeStandards}>⌕ {standardsState}</button><Field label="Maximum building height" value={report.maxHeight} onChange={(value: string) => update('maxHeight', value)} placeholder="None specified." hint="Scraped from this zone schedule where available; edit if needed." /></div><p className="question">Review the scraped standards and maximum building height above. Edit either value manually if it is not correct.</p></div>
  if (step === 18) return <div className="requirement"><label className="metric editable-metric"><span>Minimum garden area requirement</span><div className="percentage-input"><input type="number" min="0" max="100" value={report.gardenRequirement !== undefined && report.gardenRequirement !== '' ? report.gardenRequirement : gardenRequirement || ''} onChange={(event) => update('gardenRequirement', event.target.value)} /><b>%</b></div></label><div className="metric"><strong>{gardenAchieved || '—'}%</strong><span>Achieved garden area</span></div><p>Based on a site area of <b>{report.siteArea || '—'} m²</b>, the minimum requirement is calculated under Clause {gardenClause}. Edit the percentage above if the schedule or site circumstances require a correction.</p></div>
  if (step === 19) return <label className="field"><span>Have the required car parking spaces been provided under Clause 52.06?</span><textarea value={report.carParking} onChange={(event) => update('carParking', event.target.value)} rows={5}></textarea><small>Pre-filled — edit if the proposal differs.</small></label>
  if (step === 20) { const siteAreaNum = Number(report.siteArea) || 0; const canopyNum = Number(report.canopy) || 0; const requiredPct = siteAreaNum >= 1500 ? 20 : siteAreaNum >= 1000 ? 15 : siteAreaNum > 0 ? 10 : 0; const canopyAchieved = siteAreaNum && canopyNum ? Math.round((canopyNum / siteAreaNum) * 100) : 0; return <div className="stack"><div className="data-card"><span className="data-label">CLAUSE 52.37 / EXISTING CANOPY TREES (ARBORIST)</span><label className="toggle"><input type="checkbox" checked={Boolean(report.existingTreesNone)} onChange={(event) => { update('existingTreesNone', event.target.checked); if (event.target.checked) update('existingTrees', []) }} />There are no existing canopy trees on this site - confirm this instead of listing trees.</label>{report.existingTreesNone ? <p className="question">Noted. No existing canopy trees will be listed.<button type="button" className="text-button" onClick={() => update('existingTreesNone', false)}>Switch back to listing trees <span>→</span></button></p> : <TreeFields value={report.existingTrees} onChange={(value) => update('existingTrees', value)} />}</div><div className="data-card"><span className="data-label">CLAUSE 52.37 / NEW CANOPY TREE AREA (LANDSCAPE PLAN)</span><div className="canopy-grid"><div className="metric"><span>Required canopy</span><strong>{requiredPct || '—'}%</strong></div><div className="metric"><strong>{canopyAchieved || '—'}%</strong><span>Achieved canopy</span></div><div className="metric"><strong>{canopyNum || '—'} m²</strong><span>Canopy area</span></div></div><p className="question">Under Clause 52.37, lots under 1000 m² require 10% canopy area, lots 1000–1500 m² require 15%, and lots 1500 m² or greater require 20%.</p></div></div> }
  if (step === 21) { const ss = report.streetSetback; const setSS = (patch: Partial<typeof ss>) => update('streetSetback', { ...ss, ...patch }); const ssNotes = ss.notes && ss.notes.trim() ? ss.notes : 'Front setback compliant with planning controls.'; return <CompliancePanel compliant={ss.compliant} onChange={(value) => setSS({ compliant: value })} body={<div className="stack"><Field label="Distance setback from primary frontage" value={ss.distance} onChange={(value: string) => setSS({ distance: value })} type="number" placeholder="e.g. 9.0" hint="Metres" /><label className="field"><span>Further information</span><textarea value={ssNotes} onChange={(event) => setSS({ notes: event.target.value })} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label></div>} /> }
  if (step === 22) { const bh = report.buildingHeightClause; const setBH = (patch: Partial<typeof bh>) => update('buildingHeightClause', { ...bh, ...patch }); const bhNotes = bh.notes && bh.notes.trim() ? bh.notes : 'Maximum height is below the requirement of the zoning.'; return <CompliancePanel compliant={bh.compliant} onChange={(value) => setBH({ compliant: value })} body={<div className="stack"><Field label="Maximum height of the proposal" value={bh.maxHeight} onChange={(value: string) => setBH({ maxHeight: value })} type="number" placeholder="e.g. 9.00" hint="Metres" /><label className="field"><span>Further information</span><textarea value={bhNotes} onChange={(event) => setBH({ notes: event.target.value })} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label></div>} /> }
  if (step === 23) { const srs = report.sideRearSetbacks; const setSRS = (patch: Partial<typeof srs>) => update('sideRearSetbacks', { ...srs, ...patch }); const srsNotes = srs.notes && srs.notes.trim() ? srs.notes : 'All setbacks have been assessed as per their relevance to the boundary. All setbacks and heights are deemed compliant.'; return <div className="stack"><CompliancePanel compliant={srs.compliant} onChange={(value) => setSRS({ compliant: value })} body={<div className="data-card"><span className="data-label">METHOD</span><span className="group-label">Select which method applies</span><Options value={srs.method} onChange={(value: 'B2-3.1' | 'B2-3.2') => setSRS({ method: value })} options={['B2-3.1', 'B2-3.2']} /><p className="question">{srs.method === 'B2-3.1' ? 'B2-3.1 setback = max(1 m, 1 m + 0.3 × (height − 3.6 m) for 3.6 < h ≤ 6.9, then 1 m + 0.3 × 3.3 + 1 × (height − 6.9 m) for h > 6.9).' : 'B2-3.2 setback = 3 m up to 11 m height (or 4.5 m above), or 6 m up to 11 m (or 9 m above) for boundaries south of the building between S 30° W and S 30° E.'}</p></div>} /><BoundaryFields value={srs.boundaries} method={srs.method} onChange={(value) => setSRS({ boundaries: value })} /><label className="field"><span>Further information</span><textarea value={srsNotes} onChange={(event) => setSRS({ notes: event.target.value })} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label></div> }
  if (step === 24) { const wb = report.wallsOnBoundary; const setWB = (patch: Partial<typeof wb>) => update('wallsOnBoundary', { ...wb, ...patch }); const wbNotes = wb.notes && wb.notes.trim() ? wb.notes : 'Total wall on boundary length is within the allowable distance.'; const wallCount = wb.count ? Number(wb.count) || 0 : wb.walls.length; return <div className="stack"><CompliancePanel compliant={wb.compliant} onChange={(value) => setWB({ compliant: value })} body={<div className="stack"><Field label="Number of proposed walls on boundary" value={wb.count} onChange={(value: string) => setWB({ count: value })} type="number" placeholder="e.g. 2" hint="Independent from the wall cards below — used to declare intent before filling in details" /><span className="group-label">Per-wall details</span><WallFields value={wb.walls} onChange={(value) => setWB({ walls: value })} /></div>} /><p className="question">Allowable wall on boundary per Standard B2-4 = 10 m + 25% × boundary length. Walls added: {wallCount} (declared) / {wb.walls.length} (filled).</p><label className="field"><span>Further information</span><textarea value={wbNotes} onChange={(event) => setWB({ notes: event.target.value })} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label></div> }
  if (step === 25) { const sc = report.siteCoverageClause; const setSC = (patch: Partial<typeof sc>) => update('siteCoverageClause', { ...sc, ...patch }); const scNotes = sc.notes && sc.notes.trim() ? sc.notes : 'Site coverage within the allowable requirements.'; const scArea = Number(report.siteCoverage) || 0; const siteAreaNum = Number(report.siteArea) || 0; const achieved = siteAreaNum && scArea ? Math.round((scArea / siteAreaNum) * 1000) / 10 : 0; const allowed = maxCoveragePercent(report.zone); return <div className="stack"><CompliancePanel compliant={sc.compliant} onChange={(value) => setSC({ compliant: value })} body={<><div className="canopy-grid"><div className="metric"><span>Computed site coverage</span><strong>{achieved ? `${achieved}%` : '—'}</strong></div><div className="metric"><span>Maximum allowable ({report.zone || 'default'})</span><strong>{allowed}%</strong></div><div className="metric"><span>Status</span><strong>{achieved && achieved <= allowed ? 'COMPLIANT' : achieved ? 'EXCEEDS' : '—'}</strong></div></div><p className="question">Based on the site area (step 5) and the site coverage area (step 11), converted to a percentage of lot area. Maximum allowable is 60% in NRZ, 65% in GRZ, and 70% in RGZ/MUZ/HCTZ (other zones default to 60%).</p></>} /><label className="field"><span>Further information</span><textarea value={scNotes} onChange={(event) => setSC({ notes: event.target.value })} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label></div> }
  if (step === 26) { const ac = report.accessClause; const setAC = (patch: Partial<typeof ac>) => update('accessClause', { ...ac, ...patch }); const acNotes = ac.notes && ac.notes.trim() ? ac.notes : 'Crossover width within the allowable requirement achieved.'; const frontageNum = Number(report.frontage) || 0; const allowedWidth = frontageNum ? maxCrossoverWidth(report.frontage) : ''; return <div className="stack"><CompliancePanel compliant={ac.compliant} onChange={(value) => setAC({ compliant: value })} body={<><div className="canopy-grid"><div className="metric"><span>Street frontage</span><strong>{report.frontage ? `${report.frontage} m` : '—'}</strong></div><div className="metric"><span>Allowable crossover width</span><strong>{allowedWidth ? `${allowedWidth} m (${frontageNum < 20 ? '40%' : '33%'})` : '—'}</strong></div><div className="metric"><span>Status</span><strong>{ac.proposedWidth && allowedWidth && Number(ac.proposedWidth) <= Number(allowedWidth) ? 'COMPLIANT' : '—'}</strong></div></div><Field label="Proposed crossover width" value={ac.proposedWidth} onChange={(value: string) => setAC({ proposedWidth: value })} type="number" placeholder="e.g. 4.50" hint="Metres" /><Field label="Tree encroachment percentage" value={ac.treeEncroachmentPct} onChange={(value: string) => setAC({ treeEncroachmentPct: value })} type="number" placeholder="e.g. 5" hint="Percent (%) of the crossover area" /><p className="question">Allowable crossover width is 33% of the street frontage, or 40% if the street frontage is less than 20 metres.</p></>} /><label className="field"><span>Further information</span><textarea value={acNotes} onChange={(event) => setAC({ notes: event.target.value })} rows={5}></textarea><small>Pre-filled — edit if needed.</small></label></div> }
  if (step === 27) { const tc = report.treeCanopyClause; const setTC = (patch: Partial<typeof tc>) => update('treeCanopyClause', { ...tc, ...patch }); const sa = Number(report.siteArea) || 0; const cn = Number(report.canopy) || 0; const canopyReqPct = sa >= 1500 ? 20 : sa >= 1000 ? 15 : sa > 0 ? 10 : 0; const canopyAchPct = sa && cn ? Math.round((cn / sa) * 100) : 0; return <CompliancePanel compliant={tc.compliant} onChange={(value) => setTC({ compliant: value })} body={<><div className="canopy-grid"><div className="metric"><span>Required canopy</span><strong>{canopyReqPct || '—'}%</strong></div><div className="metric"><span>Achieved canopy</span><strong>{canopyAchPct || '—'}%</strong></div><div className="metric"><span>Status</span><strong>{canopyAchPct && canopyReqPct && canopyAchPct >= canopyReqPct ? 'COMPLIANT' : '—'}</strong></div></div><Field label="Number of canopy trees proposed" value={tc.count} onChange={(value: string) => setTC({ count: value })} type="number" placeholder="e.g. 8" hint="Total trees proposed to satisfy canopy requirements" /><NotesField value={tc.notes} defaultText="Tree canopy requirements achieved. Relevant diagramming on TP5." onChange={(value) => setTC({ notes: value })} /></>} /> }
  if (step === 28) { const x = report.frontFenceClause; const setX = (patch: Partial<typeof x>) => update('frontFenceClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="The maximum height of the front fence is: 0.9m." /> }
  if (step === 29) { const x = report.dwellingDiversityClause; const setX = (patch: Partial<typeof x>) => update('dwellingDiversityClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Not applicable as less than 10 dwellings." /> }
  if (step === 30) { const x = report.parkingLocationClause; const setX = (patch: Partial<typeof x>) => update('parkingLocationClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All windows within accessways achieve 1m where sills are 1.5m." /> }
  if (step === 31) { const si = report.streetIntegration; const setSI = (patch: Partial<typeof si>) => update('streetIntegration', { ...si, ...patch }); const frontageNum = Number(report.frontage) || 0; const allowedServices = frontageNum ? +(frontageNum * 0.2).toFixed(2) : ''; return <CompliancePanel compliant={si.compliant} onChange={(value) => setSI({ compliant: value })} body={<><div className="canopy-grid"><div className="metric"><span>Site width (frontage)</span><strong>{frontageNum ? `${frontageNum} m` : '—'}</strong></div><div className="metric"><span>Allowable services width (20%)</span><strong>{allowedServices ? `${allowedServices} m` : '—'}</strong></div><div className="metric"><span>Status</span><strong>{si.proposedServicesWidth && allowedServices && Number(si.proposedServicesWidth) <= Number(allowedServices) ? 'COMPLIANT' : '—'}</strong></div></div><Field label="Proposed services width" value={si.proposedServicesWidth} onChange={(value: string) => setSI({ proposedServicesWidth: value })} type="number" placeholder="e.g. 3.0" hint="Metres" /><NotesField value={si.notes} defaultText="All dwellings provided with habitable rooms at either ground or first floor." onChange={(value) => setSI({ notes: value })} /></>} /> }
  if (step === 32) { const x = report.entryClause; const setX = (patch: Partial<typeof x>) => update('entryClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All entry porches covered by 1.2 x 1.2 (1.44m2) canopy." /> }
  if (step === 33) { const x = report.privateOpenSpaceClause; const setX = (patch: Partial<typeof x>) => update('privateOpenSpaceClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All dwellings supplied with minimum 25m2 S.P.O.S." /> }
  if (step === 34) { const x = report.solarAccessOpenSpaceClause; const setX = (patch: Partial<typeof x>) => update('solarAccessOpenSpaceClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All dwellings achieve required setbacks to achieve solar requirements to S.P.O.S." /> }
  if (step === 35) { const x = report.functionalLayoutClause; const setX = (patch: Partial<typeof x>) => update('functionalLayoutClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All minimum room dimensions and areas achieved." /> }
  if (step === 36) { const x = report.roomDepthClause; const setX = (patch: Partial<typeof x>) => update('roomDepthClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All dwellings provide dual aspect to all Living / kitchen / dining areas." /> }
  if (step === 37) { const x = report.daylightNewWindowsClause; const setX = (patch: Partial<typeof x>) => update('daylightNewWindowsClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All new habitable room windows are provided with 3m2 clear to sky." /> }
  if (step === 38) { const x = report.naturalVentilationClause; const setX = (patch: Partial<typeof x>) => update('naturalVentilationClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Relevant diagramming on TP5." /> }
  if (step === 39) { const x = report.storageClause; const setX = (patch: Partial<typeof x>) => update('storageClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="6m³ storage provided to all dwellings." /> }
  if (step === 40) { const x = report.accessibilityClause; const setX = (patch: Partial<typeof x>) => update('accessibilityClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Not applicable to this application." /> }
  if (step === 41) { const x = report.daylightExistingWindowsClause; const setX = (patch: Partial<typeof x>) => update('daylightExistingWindowsClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All existing habitable room windows have been provided with 3m2 clear to sky as required." /> }
  if (step === 42) { const x = report.northFacingWindowsClause; const setX = (patch: Partial<typeof x>) => update('northFacingWindowsClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All north facing windows are setback appropriately from the proposal via compliant dimensions." /> }
  if (step === 43) { const x = report.overshadowingSosClause; const setX = (patch: Partial<typeof x>) => update('overshadowingSosClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All shadowing calculated on TP6 - TP9. This is assessed as compliant." /> }
  if (step === 44) { const x = report.overlookingClause; const setX = (patch: Partial<typeof x>) => update('overlookingClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Overlooking arc annotated on plans. All relevant floor levels have been dimensioned. Screening has been annotated where required." /> }
  if (step === 45) { const x = report.internalViewsClause; const setX = (patch: Partial<typeof x>) => update('internalViewsClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Proposal does not propose overlooking internally." /> }
  if (step === 46) { const sm = report.stormwaterManagement; const setSM = (patch: Partial<typeof sm>) => update('stormwaterManagement', { ...sm, ...patch }); return <CompliancePanel compliant={sm.compliant} onChange={(value) => setSM({ compliant: value })} body={<><div className="data-card"><span className="data-label">MANAGEMENT SYSTEMS PROPOSED</span><label className="toggle"><input type="checkbox" checked={sm.rainwaterTank} onChange={(event) => setSM({ rainwaterTank: event.target.checked })} /><span>Rainwater tank</span></label>{sm.rainwaterTank && <Field label="Rainwater tank size" value={sm.rainwaterTankSize} onChange={(value: string) => setSM({ rainwaterTankSize: value })} type="number" placeholder="e.g. 5000" hint="Litres" />}<label className="toggle"><input type="checkbox" checked={sm.permeablePaving} onChange={(event) => setSM({ permeablePaving: event.target.checked })} /><span>Permeable paving</span></label><label className="toggle"><input type="checkbox" checked={sm.rainGardens} onChange={(event) => setSM({ rainGardens: event.target.checked })} /><span>Rain gardens</span></label></div><div className="data-card"><span className="data-label">AREAS OF REUSE</span><label className="toggle"><input type="checkbox" checked={sm.reuseSanitary} onChange={(event) => setSM({ reuseSanitary: event.target.checked })} /><span>Sanitary flushing</span></label><label className="toggle"><input type="checkbox" checked={sm.reuseLaundry} onChange={(event) => setSM({ reuseLaundry: event.target.checked })} /><span>Laundry</span></label><label className="toggle"><input type="checkbox" checked={sm.reuseGarden} onChange={(event) => setSM({ reuseGarden: event.target.checked })} /><span>Garden watering</span></label></div><NotesField value={sm.notes} defaultText="" onChange={(value) => setSM({ notes: value })} /></>} /> }
  if (step === 47) { const x = report.overshadowingSolarClause; const setX = (patch: Partial<typeof x>) => update('overshadowingSolarClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Neighbouring solar facilities are sited appropriate distance from boundary. No shadowing occurs over facilities." /> }
  if (step === 48) { const x = report.rooftopSolarClause; const setX = (patch: Partial<typeof x>) => update('rooftopSolarClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Refer to dedicated area on page no. TP4 for further details." /> }
  if (step === 49) { const x = report.solarProtectionClause; const setX = (patch: Partial<typeof x>) => update('solarProtectionClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Fixed shading devices have been annotated, dimensioned and tagged on plans and shown on elevations." /> }
  if (step === 50) { const x = report.wasteRecyclingClause; const setX = (patch: Partial<typeof x>) => update('wasteRecyclingClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Refer to dedicated area on page no. TP5 for further details." /> }
  if (step === 51) { const x = report.noiseImpactsClause; const setX = (patch: Partial<typeof x>) => update('noiseImpactsClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="All mechanical plant equipment and storage have been located away from habitable windows. All have been screened in their respective yards away from public using fencing." /> }
  if (step === 52) { const x = report.energyEfficiencyClause; const setX = (patch: Partial<typeof x>) => update('energyEfficiencyClause', { ...x, ...patch }); return <SimpleClause clause={x} setClause={setX} defaultNotes="Not applicable to this application." /> }
  if (displayStep === steps.length - 1) { return <div className="stack"><div className="image-panel"><div className={`map-card ${report.coverImage ? 'has-image' : 'visual-satellite'}`} style={{ minHeight: 260 }}><img className="map-image" src={report.coverImage || ''} alt="Cover image preview" style={{ display: report.coverImage ? 'block' : 'none' }} />{!report.coverImage && <><div className="map-grid"></div><div className="map-pin">+</div></>}{report.coverImage && <span className="map-caption">COVER IMAGE / REPORT FRONT PAGE</span>}</div><p className="question">Upload a cover image for the front page. It is scaled to the report cover size when exported to Word.</p><label className="upload">＋ Upload cover image<input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) update('coverImage', URL.createObjectURL(e.target.files[0])) }} /></label>{report.coverImage && <button type="button" className="text-button" onClick={() => update('coverImage', '')}>Remove cover image <span>→</span></button>}</div></div> }
  return null
}

function ImagePanel({ type, label, report, update }: any) { const isOverlay = type === 'overlay'; const isSatellite = type === 'satellite'; const isPlanningLayer = type === 'zoning' || isOverlay; const sources = isOverlay ? (report.images.overlays.length ? report.images.overlays : ['']) : [report.images[type] || '']; const replaceImage = (index: number, file: File) => { const imageUrl = URL.createObjectURL(file); if (isOverlay) update('images', { ...report.images, overlays: report.images.overlays.map((source: string, imageIndex: number) => imageIndex === index ? imageUrl : source) }); else update('images', { ...report.images, [type]: imageUrl }); }; return <div className="stack">{sources.map((source: string, index: number) => <div className="image-panel" key={`${type}-${index}`}><div className={`map-card ${source ? 'has-image' : `visual-${type}`}`}>{isPlanningLayer && report.images.satellite && <img className="map-image map-base" src={report.images.satellite} alt="Satellite context" />}{source ? <img className={`map-image ${isPlanningLayer ? 'map-layer' : ''}`} src={source} alt={`${label} map ${index + 1}`} /> : <><div className="map-grid"></div><div className="map-pin">+</div></>}{isSatellite && report.images.satelliteBoundary && <img className="map-boundary" src={report.images.satelliteBoundary} alt="Parcel boundary overlay" />}<span className="map-caption">{label.toUpperCase()} {isOverlay ? `${index + 1} / ` : ''}/ 200M CONTEXT</span></div><p className="question">Review the generated image. Replace it if the context is incorrect.</p><label className="upload">＋ Replace with your own image<input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) replaceImage(index, e.target.files[0]) }} /></label></div>)}</div> }
function SiteAreaMap({ report }: any) { const satellite = report.images.satellite; const boundary = report.images.satelliteBoundary; return <div className={`map-card site-area-map ${satellite ? 'has-image' : 'visual-satellite'}`}>{satellite ? <img className="map-image" src={satellite} alt="Satellite image of the site" /> : <><div className="map-grid"></div><div className="map-pin">+</div></>}{boundary && <img className="map-boundary" src={boundary} alt="Parcel boundary overlay" />}<span className="map-caption">SITE PARCEL / SATELLITE CONTEXT</span><span className="area-badge">{report.siteArea ? `${report.siteArea} m²` : 'Awaiting lookup'}</span></div> }

function AuthPanel({ mode, setMode, onClose, onSubmit }: { mode: 'login' | 'register'; setMode: (mode: 'login' | 'register') => void; onClose: () => void; onSubmit: (mode: 'login' | 'register', fields: { name: string; email: string; password: string }) => Promise<void> }) {
  const [fields, setFields] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await onSubmit(mode, fields) } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Unable to authenticate') } finally { setBusy(false) } }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="auth-panel" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="eyebrow">PLAN / VIC ACCOUNT</div><h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2><p>{mode === 'login' ? 'Sign in to sync projects across devices.' : 'Keep your planning drafts safe and accessible.'}</p>{mode === 'register' && <Field label="Name" value={fields.name} onChange={(value: string) => setFields({ ...fields, name: value })} placeholder="John Doe" />}{<Field label="Email" value={fields.email} onChange={(value: string) => setFields({ ...fields, email: value })} placeholder="you@example.com" type="email" />}<Field label="Password" value={fields.password} onChange={(value: string) => setFields({ ...fields, password: value })} placeholder="At least 8 characters" type="password" />{error && <p className="auth-error">{error}</p>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button><button type="button" className="text-button auth-switch" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Already have an account'} <span>→</span></button></form></div>
}

function ReportView({ report, title, standard, gardenRequirement, gardenAchieved, gardenClause, exporting, onExportWord, onPrintReport, onBack }: any) { return <main className="report"><div className="report-head"><button className="back-link" onClick={onBack}>← Edit report</button><div className="report-actions"><button className="secondary" onClick={onExportWord} disabled={exporting}>{exporting ? 'Exporting…' : 'Word document'}</button><button className="secondary" onClick={onPrintReport}>Print / PDF</button></div></div><div className="report-title"><div className="eyebrow">TOWN PLANNING REPORT / DRAFT</div><h1>{title}</h1><p>Prepared for residential development assessment · Victoria</p></div><div className="report-grid"><section><h2>Project overview</h2><dl><dt>Address</dt><dd>{report.address || 'Not provided'}</dd><dt>Zone</dt><dd>{report.zone} · {report.zoneDescription}</dd><dt>Overlay(s)</dt><dd>{report.overlays || 'None identified'}</dd><dt>Local government</dt><dd>{report.lga || 'Not provided'}</dd></dl><h2>Development summary</h2><p className="body-copy">{report.summary || 'No summary has been entered yet.'}</p><h2>Site metrics</h2><div className="metrics"><Metric label="Site area" value={report.siteArea} /><Metric label="Frontage" value={report.frontage} suffix="m" /><Metric label="Site coverage" value={report.siteCoverage} /><Metric label="Garden area" value={report.gardenArea} /></div></section><aside><div className="report-note"><span className="eyebrow">GARDEN AREA</span><strong>{gardenAchieved || '—'}%</strong><p>{gardenRequirement ? `Minimum ${gardenRequirement}% required under Clause ${gardenClause}.` : 'Minimum requirement to be confirmed.'}</p></div><div className="report-note dark"><span className="eyebrow">ZONE STANDARDS</span><pre>{standard}</pre></div></aside></div><footer>PLAN / VIC · Working draft · {new Date().toLocaleDateString('en-AU')}</footer></main> }
function Metric({ label, value, suffix = 'm²' }: any) { return <div><span>{label}</span><strong>{value || '—'}{value && suffix}</strong></div> }

export default App
