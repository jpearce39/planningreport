import { useEffect, useState, type FormEvent } from 'react'

type AdminUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  createdAt: number
  projectCount: number
}

type AdminProject = {
  id: string
  userId: string
  name: string
  step: number
  createdAt: number
  updatedAt: number
  userName: string
  userEmail: string
}

type ProjectEditor = AdminProject & { reportText: string }

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...options, headers })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(payload?.error || 'Request failed')
  return payload as T
}

function formatDate(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toLocaleDateString('en-AU') : 'Never'
}

export default function AdminPanel({ currentUserId, onBack }: { currentUserId: string; onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [template, setTemplate] = useState<{ available: boolean; updatedAt: number | null }>({ available: false, updatedAt: null })
  const [editor, setEditor] = useState<ProjectEditor | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; value: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      adminApi<{ users: AdminUser[] }>('/api/admin/users'),
      adminApi<{ projects: AdminProject[] }>('/api/admin/projects'),
      adminApi<{ available: boolean; updatedAt: number | null }>('/api/admin/template'),
    ]).then(([userResult, projectResult, templateResult]) => {
      if (!active) return
      setUsers(userResult.users)
      setProjects(projectResult.projects)
      setTemplate(templateResult)
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data')
    })
    return () => { active = false }
  }, [])

  const perform = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The requested action failed')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = (userId: string, role: AdminUser['role']) => perform(async () => {
    const result = await adminApi<{ user: AdminUser }>(`/api/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, role: result.user.role } : user))
    setMessage(`Updated ${result.user.email} to ${role}.`)
  })

  const resetPassword = (user: AdminUser) => {
    if (!window.confirm(`Reset the password for ${user.email}? Their current sessions will be signed out.`)) return
    void perform(async () => {
      setTemporaryPassword(null)
      const result = await adminApi<{ temporaryPassword: string }>(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
      setTemporaryPassword({ email: user.email, value: result.temporaryPassword })
      setMessage(`Password reset for ${user.email}. Share this temporary password with them securely; it is shown only once.`)
    })
  }

  const deleteUser = (user: AdminUser) => {
    if (!window.confirm(`Permanently delete ${user.name} (${user.email}) and all ${user.projectCount} of their projects? This cannot be undone.`)) return
    void perform(async () => {
      await adminApi<void>(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      setUsers((current) => current.filter((entry) => entry.id !== user.id))
      setProjects((current) => current.filter((project) => project.userId !== user.id))
      setMessage(`Deleted ${user.email} and their projects.`)
    })
  }

  const openProject = (project: AdminProject) => perform(async () => {
    const result = await adminApi<{ project: ProjectEditor & { report: object } }>(`/api/admin/projects/${project.id}`)
    setEditor({ ...result.project, reportText: JSON.stringify(result.project.report, null, 2) })
  })

  const saveProject = (event: FormEvent) => {
    event.preventDefault()
    if (!editor) return
    void perform(async () => {
      let report: unknown
      try {
        report = JSON.parse(editor.reportText)
      } catch {
        throw new Error('Project report must contain valid JSON')
      }
      if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Project report must be a JSON object')
      const result = await adminApi<{ project: AdminProject }>(`/api/admin/projects/${editor.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editor.name, report, step: editor.step }),
      })
      setProjects((current) => current.map((project) => project.id === editor.id ? { ...project, ...result.project } : project))
      setEditor(null)
      setMessage(`Saved "${result.project.name}".`)
    })
  }

  const deleteProject = (project: AdminProject) => {
    if (!window.confirm(`Permanently delete "${project.name}" owned by ${project.userEmail}?`)) return
    void perform(async () => {
      await adminApi<void>(`/api/admin/projects/${project.id}`, { method: 'DELETE' })
      setProjects((current) => current.filter((entry) => entry.id !== project.id))
      setEditor((current) => current?.id === project.id ? null : current)
      setMessage(`Deleted "${project.name}".`)
    })
  }

  const uploadTemplate = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Choose a Word .docx file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('The template must be 10 MB or smaller.')
      return
    }
    void perform(async () => {
      const result = await adminApi<{ updatedAt: number }>('/api/admin/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        body: file,
      })
      setTemplate({ available: true, updatedAt: result.updatedAt })
      setMessage('The Word report template has been replaced.')
    })
  }

  const downloadTemplate = () => perform(async () => {
    const response = await fetch(`${apiBaseUrl}/api/admin/template/download`, { credentials: 'include' })
    if (!response.ok) {
      const payload = await response.json()
      throw new Error(payload?.error || 'Unable to download the template')
    }
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = 'planning-report-template.docx'
    link.click()
    URL.revokeObjectURL(url)
  })

  return <main className="admin-page">
    <div className="admin-heading">
      <div>
        <button className="back-link" onClick={onBack}>← Workspace</button>
        <div className="eyebrow">PLAN / VIC ADMINISTRATION</div>
        <h1>Admin panel</h1>
        <p>Manage accounts, saved projects, and the shared Word report template.</p>
      </div>
      <div className="admin-counts"><span>{users.length} accounts</span><span>{projects.length} projects</span></div>
    </div>
    {error && <p className="admin-message error" role="alert">{error}</p>}
    {message && <p className="admin-message" role="status">{message}</p>}
    {temporaryPassword && <section className="temporary-password" aria-live="polite">
      <strong>Temporary password for {temporaryPassword.email}</strong>
      <code>{temporaryPassword.value}</code>
      <p>Copy it now and share it with the user through a secure channel. It will not be shown again.</p>
      <button className="secondary" onClick={() => { void navigator.clipboard.writeText(temporaryPassword.value).then(() => setMessage('Temporary password copied.')).catch(() => setError('Unable to access the clipboard; select and copy the password manually.')) }}>Copy password</button>
    </section>}

    <section className="admin-section">
      <div className="admin-section-heading"><div><div className="eyebrow">ACCOUNTS</div><h2>User management</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>User</th><th>Projects</th><th>Created</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}>
          <td><strong>{user.name}</strong><span>{user.email}</span></td>
          <td>{user.projectCount}</td>
          <td>{formatDate(user.createdAt)}</td>
          <td><select value={user.role} disabled={busy || user.id === currentUserId} aria-label={`Role for ${user.email}`} onChange={(event) => changeRole(user.id, event.target.value as AdminUser['role'])}><option value="user">User</option><option value="admin">Admin</option></select></td>
          <td className="admin-actions">
            <button className="admin-action" disabled={busy || user.id === currentUserId} onClick={() => resetPassword(user)}>Reset password</button>
            <button className="admin-action danger" disabled={busy || user.id === currentUserId} onClick={() => deleteUser(user)}>Delete account</button>
          </td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="admin-section">
      <div className="admin-section-heading"><div><div className="eyebrow">SAVED WORK</div><h2>All projects</h2><p>Project contents are private to their owner unless viewed here by an administrator.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Project</th><th>Owner</th><th>Updated</th><th>Step</th><th>Actions</th></tr></thead>
        <tbody>{projects.map((project) => <tr key={project.id}>
          <td><strong>{project.name}</strong><span>Created {formatDate(project.createdAt)}</span></td>
          <td><strong>{project.userName}</strong><span>{project.userEmail}</span></td>
          <td>{formatDate(project.updatedAt)}</td>
          <td>{project.step + 1}</td>
          <td className="admin-actions"><button className="admin-action" disabled={busy} onClick={() => openProject(project)}>View / edit</button><button className="admin-action danger" disabled={busy} onClick={() => deleteProject(project)}>Delete</button></td>
        </tr>)}</tbody>
      </table></div>
      {!projects.length && <p className="admin-empty">No saved projects.</p>}
    </section>

    <section className="admin-section template-section">
      <div><div className="eyebrow">DOCUMENT GENERATION</div><h2>Word template</h2><p>{template.available ? `Current template · Last replaced ${formatDate(template.updatedAt)}` : 'No template has been uploaded yet.'}</p></div>
      <div className="template-actions">
        <label className="secondary template-upload">Replace template<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={(event) => { uploadTemplate(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
        {template.available && <button className="secondary" disabled={busy} onClick={downloadTemplate}>Download current template</button>}
        <span>Word .docx, maximum 10 MB. The new template applies to all future report exports.</span>
      </div>
    </section>

    {editor && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}>
      <form className="admin-project-editor" onSubmit={saveProject}>
        <button type="button" className="modal-close" onClick={() => setEditor(null)}>×</button>
        <div className="eyebrow">PROJECT EDITOR</div>
        <h2>{editor.userName}</h2><p>{editor.userEmail}</p>
        <label className="field"><span>Project name</span><input value={editor.name} maxLength={200} required onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
        <label className="field"><span>Wizard step (zero-based)</span><input type="number" min={0} step={1} value={editor.step} required onChange={(event) => setEditor({ ...editor, step: Number(event.target.value) })} /></label>
        <label className="field"><span>Report data (JSON)</span><textarea rows={18} spellCheck={false} value={editor.reportText} onChange={(event) => setEditor({ ...editor, reportText: event.target.value })} /></label>
        <div className="editor-actions"><button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save project'}</button></div>
      </form>
    </div>}
  </main>
}

export function PasswordChangePanel({ onChanged }: { onChanged: (user: { id: string; name: string; email: string; role: 'admin' | 'user'; mustChangePassword: boolean }) => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword.length < 8) { setError('Your new password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await adminApi<{ user: { id: string; name: string; email: string; role: 'admin' | 'user'; mustChangePassword: boolean } }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      onChanged(result.user)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to change password')
    } finally {
      setBusy(false)
    }
  }

  return <main className="password-change-page">
    <form className="password-change-card" onSubmit={submit}>
      <div className="eyebrow">ACCOUNT SECURITY</div>
      <h1>Choose a new password.</h1>
      <p>Your administrator issued a temporary password. Change it before continuing.</p>
      <label className="field"><span>Temporary password</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
      <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
    </form>
  </main>
}
