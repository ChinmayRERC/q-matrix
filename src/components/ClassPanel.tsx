/**
 * Classroom panel: join a class, push/pull progress, and (as a teacher) view the
 * roster. Everything here is optional — the app stays local-first without it.
 */
import { useEffect, useState } from 'react'
import { Cloud, LogIn, RefreshCw, Users } from 'lucide-react'
import {
  applySnapshot,
  createClass,
  educatorLogin,
  fetchClass,
  joinClass,
  membership,
  pullState,
  pushState,
  setMembership,
  type Membership,
  type Roster,
} from '../lib/sync'
import { Btn, Panel, Pill } from './ui'

const TEACHER_KEY = 'qmatrix-teacher-v1'

export function ClassPanel() {
  const [member, setMember] = useState<Membership | null>(membership)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [className, setClassName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [roster, setRoster] = useState<Roster | null>(null)

  const [teacherToken, setTeacherToken] = useState<string>(() => sessionStorage.getItem(TEACHER_KEY) ?? '')

  useEffect(() => {
    if (!teacherToken) return
    fetchClass(teacherToken)
      .then(setRoster)
      .catch(() => {
        sessionStorage.removeItem(TEACHER_KEY)
        setTeacherToken('')
      })
  }, [teacherToken])

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label)
    setError('')
    setNotice('')
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const onJoin = () =>
    run('join', async () => {
      const result = await joinClass(code.trim().toUpperCase(), name.trim())
      const next: Membership = {
        classCode: result.classCode,
        learnerId: result.learnerId,
        token: result.token,
        name: result.name,
      }
      setMembership(next)
      setMember(next)
      await pushState(next)
      setNotice(`Joined ${next.classCode}. Your progress was uploaded.`)
    })

  const onPush = () =>
    run('push', async () => {
      if (!member) return
      await pushState(member)
      setNotice('Progress saved to the class.')
    })

  const onPull = () =>
    run('pull', async () => {
      if (!member) return
      const result = await pullState(member)
      if (!result.payload) {
        setNotice('Nothing stored for you yet.')
        return
      }
      applySnapshot(result.payload)
      setNotice('Class progress restored into this browser.')
    })

  const onCreate = () =>
    run('create', async () => {
      const result = await createClass(className.trim(), pin.trim())
      setNotice(`Class ${result.code} created. Share the code and PIN.`)
      setCode(result.code)
    })

  const onTeacher = () =>
    run('teacher', async () => {
      const result = await educatorLogin(code.trim().toUpperCase(), pin.trim())
      sessionStorage.setItem(TEACHER_KEY, result.token)
      setTeacherToken(result.token)
      setRoster(await fetchClass(result.token))
    })

  const input = (value: string, onChange: (v: string) => void, placeholder: string, type = 'text') => (
    <input
      className="chat-input qm-field"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  )

  return (
    <Panel
      title="Class & sync"
      sub="Optional. Progress syncs to the class server so a teacher can see the roster."
      actions={member ? <Pill tone="green">{member.classCode}</Pill> : <Pill>Local only</Pill>}
    >
      <div className="stack gap-14">
        {member ? (
          <div className="stack gap-10">
            <p className="small muted">
              Joined as <strong>{member.name}</strong> in class <span className="mono">{member.classCode}</span>.
            </p>
            <div className="row gap-8 wrap">
              <Btn variant="primary" icon={<Cloud size={14} />} onClick={onPush} disabled={!!busy}>
                {busy === 'push' ? 'Saving…' : 'Sync now'}
              </Btn>
              <Btn icon={<RefreshCw size={14} />} onClick={onPull} disabled={!!busy}>
                {busy === 'pull' ? 'Restoring…' : 'Restore from class'}
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  setMembership(null)
                  setMember(null)
                  setNotice('Left the class. Progress stays in this browser.')
                }}
              >
                Leave
              </Btn>
            </div>
          </div>
        ) : (
          <div className="qm-grid">
            <div className="qm-block">
              <div className="eyebrow">Join a class</div>
              {input(code, setCode, 'Class code')}
              {input(name, setName, 'Your name')}
              <Btn variant="primary" icon={<LogIn size={14} />} onClick={onJoin} disabled={!!busy || !code || !name}>
                {busy === 'join' ? 'Joining…' : 'Join'}
              </Btn>
            </div>
            <div className="qm-block">
              <div className="eyebrow">Create a class (teacher)</div>
              {input(className, setClassName, 'Class name, e.g. PHY 301')}
              {input(pin, setPin, 'PIN, 4–12 characters', 'password')}
              <Btn onClick={onCreate} disabled={!!busy || !className || pin.length < 4}>
                {busy === 'create' ? 'Creating…' : 'Create class'}
              </Btn>
            </div>
            <div className="qm-block">
              <div className="eyebrow">Teacher sign-in</div>
              {input(code, setCode, 'Class code')}
              {input(pin, setPin, 'PIN', 'password')}
              <Btn icon={<Users size={14} />} onClick={onTeacher} disabled={!!busy || !code || !pin}>
                {busy === 'teacher' ? 'Signing in…' : 'View roster'}
              </Btn>
            </div>
          </div>
        )}

        {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
        {notice && <p className="small" style={{ color: 'var(--green)' }}>{notice}</p>}

        {roster && (
          <div className="stack gap-10">
            <div className="row gap-8 wrap">
              <strong>{roster.className}</strong>
              <span className="tiny dim mono">{roster.classCode}</span>
              <span className="tiny dim">{roster.learners.length} learners</span>
            </div>
            <div className="qm-table-wrap">
              <table className="qm-table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>XP</th>
                    <th>Topics</th>
                    <th>Mastered</th>
                    <th>Avg mastery</th>
                    <th>Lessons</th>
                    <th>Mean gain</th>
                    <th>Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.learners.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td className="mono">{row.xp}</td>
                      <td className="mono">{row.topicsTouched}</td>
                      <td className="mono">{row.mastered}</td>
                      <td className="mono">{Math.round(row.meanMastery * 100)}%</td>
                      <td className="mono">{row.lessonsCompleted}</td>
                      <td className="mono">{row.meanGain.toFixed(2)}</td>
                      <td className="tiny dim">{row.syncedAt ? new Date(row.syncedAt * 1000).toLocaleTimeString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {roster.learners.length === 0 && <p className="tiny dim">Nobody has synced yet.</p>}
          </div>
        )}
      </div>
    </Panel>
  )
}
