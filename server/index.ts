import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import express, { type Request, type Response } from 'express'
import { type AppData, type Employee, type Goal, type GoalStatus, type IqamaRecord, type SessionRecord } from './seed.ts'
import { readData, resetData, writeData } from './store.ts'

const app = express()
const port = Number(process.env.PORT ?? 4174)
const host = process.env.HOST ?? '127.0.0.1'
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')

app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/login', async (request, response) => {
  const data = await readData()
  const userId = String(request.body.userId ?? '')
  const pin = String(request.body.pin ?? '')
  const remember = Boolean(request.body.remember)
  const user = data.employees.find((employee) => employee.id === userId)

  if (!user || !user.active || !(await bcrypt.compare(pin, user.pinHash))) {
    response.status(401).json({ message: 'Invalid user or PIN.' })
    return
  }

  const session = createSession(user.id, remember)
  data.sessions = [session.record, ...data.sessions.filter((item) => item.userId !== user.id)]
  addAudit(data, user, 'login', user.name)
  await writeData(data)
  response.json({ user: publicEmployee(user), token: session.token, expiresAt: session.record.expiresAt })
})

app.post('/api/logout', async (request, response) => {
  const data = await readData()
  const session = findSession(request, data.sessions)
  if (session) {
    data.sessions = data.sessions.filter((item) => item.id !== session.id)
    await writeData(data)
  }
  response.status(204).send()
})

app.get('/api/bootstrap', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user) return

  response.json({
    employees: data.employees.map(publicEmployee),
    goals: canManageGoals(user) ? data.goals : data.goals.filter((goal) => goal.owner === user.name),
    iqamaRecords: canManageIqama(user) ? data.iqamaRecords : [],
    settings: data.settings,
    auditLog: user.role === 'super_admin' ? data.auditLog.slice(0, 80) : [],
    notifications: getUserNotifications(data, user),
    user: publicEmployee(user),
  })
})

app.get('/api/notifications', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user) return

  response.json(getUserNotifications(data, user))
})

app.patch('/api/notifications/:id/read', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user) return

  const notification = data.notifications.find(
    (item) => item.id === Number(request.params.id) && item.userId === user.id,
  )
  if (!notification) {
    response.status(404).json({ message: 'Notification was not found.' })
    return
  }

  notification.read = true
  await writeData(data)
  response.json(notification)
})

app.post('/api/notifications/read-all', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user) return

  data.notifications = data.notifications.map((notification) =>
    notification.userId === user.id ? { ...notification, read: true } : notification,
  )
  await writeData(data)
  response.json(getUserNotifications(data, user))
})

app.post('/api/employees', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireSuperAdmin(user, response)) return

  const name = String(request.body.name ?? '').trim()
  const pin = String(request.body.pin ?? '').trim()
  const id = makeEmployeeId(String(request.body.id ?? name))
  const role = normalizeRole(request.body.role) ?? 'employee'

  if (!name || !pin) {
    response.status(400).json({ message: 'Employee name and PIN are required.' })
    return
  }

  if (pin.length < 4) {
    response.status(400).json({ message: 'PIN must be at least 4 characters.' })
    return
  }

  if (data.employees.some((employee) => employee.id === id || employee.name === name)) {
    response.status(409).json({ message: 'Employee already exists.' })
    return
  }

  const employee: Employee = {
    id,
    name,
    role,
    pinHash: await bcrypt.hash(pin, 10),
    active: true,
  }

  data.employees.push(employee)
  addAudit(data, user, 'create_user', `${employee.name} (${employee.role})`)
  notifyAdmins(data, 'مستخدم جديد', `تم إنشاء حساب ${employee.name}.`, 'user')
  await writeData(data)
  response.status(201).json(publicEmployee(employee))
})

app.patch('/api/employees/:id', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireSuperAdmin(user, response)) return

  const employee = data.employees.find((item) => item.id === request.params.id)
  if (!employee) {
    response.status(404).json({ message: 'User was not found.' })
    return
  }

  const nextRole = normalizeRole(request.body.role) ?? employee.role
  if (employee.role === 'super_admin' && nextRole !== 'super_admin') {
    const superAdminCount = data.employees.filter((item) => item.role === 'super_admin').length
    if (superAdminCount <= 1) {
      response.status(400).json({ message: 'At least one Super Admin is required.' })
      return
    }
  }

  employee.name = request.body.name === undefined ? employee.name : String(request.body.name).trim()
  employee.role = nextRole
  if (request.body.active !== undefined) {
    const nextActive = Boolean(request.body.active)
    if (!nextActive && employee.role === 'super_admin') {
      const activeSuperAdminCount = data.employees.filter(
        (item) => item.role === 'super_admin' && item.active && item.id !== employee.id,
      ).length
      if (activeSuperAdminCount < 1) {
        response.status(400).json({ message: 'At least one active Super Admin is required.' })
        return
      }
    }
    employee.active = nextActive
  }
  if (request.body.pin !== undefined) {
    const pin = String(request.body.pin).trim()
    if (pin.length < 4) {
      response.status(400).json({ message: 'PIN must be at least 4 characters.' })
      return
    }
    employee.pinHash = await bcrypt.hash(pin, 10)
  }

  addAudit(data, user, 'update_user', employee.name)
  notifyUser(data, employee.id, 'تحديث الحساب', `تم تحديث حسابك أو صلاحياتك.`, 'user')
  notifyAdmins(data, 'تحديث مستخدم', `تم تحديث حساب ${employee.name}.`, 'user', user.id)
  await writeData(data)
  response.json(publicEmployee(employee))
})

app.post('/api/goals', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireGoalManager(user, response)) return

  const progress = clampProgress(Number(request.body.progress ?? 0))
  const goal: Goal = {
    id: Date.now(),
    title: String(request.body.title ?? '').trim(),
    owner: String(request.body.owner ?? '').trim(),
    dueDate: String(request.body.dueDate ?? today()),
    progress,
    status: statusFromProgress(progress),
    description: String(request.body.description ?? '').trim(),
    activities: [],
  }

  if (!goal.title || !goal.owner) {
    response.status(400).json({ message: 'Goal title and owner are required.' })
    return
  }

  data.goals = [goal, ...data.goals]
  addAudit(data, user, 'create_goal', goal.title)
  notifyGoalOwner(data, goal.owner, 'هدف جديد', `تم تعيين هدف جديد لك: ${goal.title}`, 'goal')
  notifyManagers(data, 'هدف جديد', `تم إنشاء هدف: ${goal.title}`, 'goal', user.id)
  await writeData(data)
  response.status(201).json(goal)
})

app.patch('/api/goals/:id', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user) return

  const goalId = Number(request.params.id)
  const goal = data.goals.find((item) => item.id === goalId)

  if (!goal) {
    response.status(404).json({ message: 'Goal was not found.' })
    return
  }

  if (!canManageGoals(user) && goal.owner !== user.name) {
    response.status(403).json({ message: 'Employees can update only their own goals.' })
    return
  }

  const nextProgress =
    request.body.progress === undefined ? goal.progress : clampProgress(Number(request.body.progress))
  const nextStatus = normalizeStatus(request.body.status) ?? statusFromProgress(nextProgress, goal.status)

  if (canManageGoals(user)) {
    Object.assign(goal, {
      title: request.body.title === undefined ? goal.title : String(request.body.title).trim(),
      owner: request.body.owner === undefined ? goal.owner : String(request.body.owner).trim(),
      dueDate: request.body.dueDate === undefined ? goal.dueDate : String(request.body.dueDate),
      description:
        request.body.description === undefined
          ? goal.description
          : String(request.body.description).trim(),
    })
  }

  Object.assign(goal, {
    progress: nextStatus === 'completed' ? 100 : nextProgress,
    status: nextStatus,
  })

  addAudit(data, user, 'update_goal', goal.title)
  notifyGoalOwner(data, goal.owner, 'تحديث هدف', `تم تحديث الهدف: ${goal.title}`, 'goal')
  if (goal.status === 'at_risk') {
    notifyManagers(data, 'هدف بحاجة لمتابعة', `${goal.title} يحتاج متابعة.`, 'goal', user.id)
  }
  await writeData(data)
  response.json(goal)
})

app.delete('/api/goals/:id', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireGoalManager(user, response)) return

  const goalId = Number(request.params.id)
  const before = data.goals.length
  const deletedGoal = data.goals.find((goal) => goal.id === goalId)
  data.goals = data.goals.filter((goal) => goal.id !== goalId)

  if (data.goals.length === before) {
    response.status(404).json({ message: 'Goal was not found.' })
    return
  }

  addAudit(data, user, 'delete_goal', deletedGoal?.title ?? String(goalId))
  if (deletedGoal) {
    notifyGoalOwner(data, deletedGoal.owner, 'حذف هدف', `تم حذف الهدف: ${deletedGoal.title}`, 'goal')
    notifyManagers(data, 'حذف هدف', `تم حذف الهدف: ${deletedGoal.title}`, 'goal', user.id)
  }
  await writeData(data)
  response.status(204).send()
})

app.post('/api/goals/:id/activities', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user) return

  const goalId = Number(request.params.id)
  const goal = data.goals.find((item) => item.id === goalId)

  if (!goal) {
    response.status(404).json({ message: 'Goal was not found.' })
    return
  }

  if (!canManageGoals(user) && goal.owner !== user.name) {
    response.status(403).json({ message: 'Employees can log activity only for their own goals.' })
    return
  }

  const text = String(request.body.text ?? '').trim()
  if (!text) {
    response.status(400).json({ message: 'Activity text is required.' })
    return
  }

  const activity = {
    id: Date.now(),
    text,
    author: user.name,
    date: today(),
  }

  goal.activities = [activity, ...goal.activities]
  addAudit(data, user, 'add_activity', goal.title)
  notifyManagers(data, 'نشاط جديد', `${user.name} أضاف نشاطا على هدف: ${goal.title}`, 'activity', user.id)
  await writeData(data)
  response.status(201).json(activity)
})

app.get('/api/iqama', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireIqamaManager(user, response)) return

  response.json(data.iqamaRecords)
})

app.post('/api/iqama', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireIqamaManager(user, response)) return

  const record = iqamaFromRequest(request.body)
  if (!record.employeeId || !record.iqamaNumber || !record.expiryDate) {
    response.status(400).json({ message: 'Employee, Iqama number, and expiry date are required.' })
    return
  }
  if (!data.employees.some((employee) => employee.id === record.employeeId && employee.active)) {
    response.status(400).json({ message: 'The selected employee is not active.' })
    return
  }
  if (data.iqamaRecords.some((item) => item.employeeId === record.employeeId || item.iqamaNumber === record.iqamaNumber)) {
    response.status(409).json({ message: 'An Iqama record already exists for this employee or number.' })
    return
  }

  data.iqamaRecords = [record, ...data.iqamaRecords]
  const employee = data.employees.find((item) => item.id === record.employeeId)
  addAudit(data, user, 'create_iqama', employee?.name ?? record.iqamaNumber)
  notifyIqamaStatus(data, record, employee?.name ?? record.iqamaNumber, user.id)
  await writeData(data)
  response.status(201).json(record)
})

app.patch('/api/iqama/:id', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireIqamaManager(user, response)) return

  const record = data.iqamaRecords.find((item) => item.id === Number(request.params.id))
  if (!record) {
    response.status(404).json({ message: 'Iqama record was not found.' })
    return
  }

  const previousExpiryDate = record.expiryDate
  Object.assign(record, {
    iqamaNumber: request.body.iqamaNumber === undefined ? record.iqamaNumber : String(request.body.iqamaNumber).trim(),
    nationality: request.body.nationality === undefined ? record.nationality : String(request.body.nationality).trim(),
    jobTitle: request.body.jobTitle === undefined ? record.jobTitle : String(request.body.jobTitle).trim(),
    issueDate: request.body.issueDate === undefined ? record.issueDate : String(request.body.issueDate),
    expiryDate: request.body.expiryDate === undefined ? record.expiryDate : String(request.body.expiryDate),
    notes: request.body.notes === undefined ? record.notes : String(request.body.notes).trim(),
    updatedAt: new Date().toISOString(),
  })
  if (record.expiryDate !== previousExpiryDate) record.alertedThresholds = []

  const employee = data.employees.find((item) => item.id === record.employeeId)
  addAudit(data, user, 'update_iqama', employee?.name ?? record.iqamaNumber)
  notifyIqamaStatus(data, record, employee?.name ?? record.iqamaNumber, user.id)
  await writeData(data)
  response.json(record)
})

app.post('/api/iqama/:id/renewals', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireIqamaManager(user, response)) return

  const record = data.iqamaRecords.find((item) => item.id === Number(request.params.id))
  if (!record) {
    response.status(404).json({ message: 'Iqama record was not found.' })
    return
  }

  const newExpiryDate = String(request.body.newExpiryDate ?? '')
  const note = String(request.body.note ?? '').trim()
  if (!newExpiryDate) {
    response.status(400).json({ message: 'New expiry date is required.' })
    return
  }

  record.renewalHistory = [
    {
      id: Date.now(),
      previousExpiryDate: record.expiryDate,
      newExpiryDate,
      note,
      author: user.name,
      date: new Date().toISOString(),
    },
    ...record.renewalHistory,
  ]
  record.expiryDate = newExpiryDate
  record.notes = note || record.notes
  record.alertedThresholds = []
  record.updatedAt = new Date().toISOString()

  const employee = data.employees.find((item) => item.id === record.employeeId)
  addAudit(data, user, 'renew_iqama', employee?.name ?? record.iqamaNumber)
  notifyManagers(data, 'تم تجديد إقامة', `تم تحديث تاريخ انتهاء إقامة ${employee?.name ?? record.iqamaNumber}.`, 'iqama', user.id)
  notifyIqamaStatus(data, record, employee?.name ?? record.iqamaNumber, user.id)
  await writeData(data)
  response.json(record)
})

app.delete('/api/iqama/:id', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireIqamaManager(user, response)) return

  const record = data.iqamaRecords.find((item) => item.id === Number(request.params.id))
  if (!record) {
    response.status(404).json({ message: 'Iqama record was not found.' })
    return
  }

  data.iqamaRecords = data.iqamaRecords.filter((item) => item.id !== record.id)
  const employee = data.employees.find((item) => item.id === record.employeeId)
  addAudit(data, user, 'delete_iqama', employee?.name ?? record.iqamaNumber)
  await writeData(data)
  response.status(204).send()
})

app.patch('/api/settings/iqama-alerts', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireSuperAdmin(user, response)) return

  const values = Array.isArray(request.body.iqamaAlertDays) ? request.body.iqamaAlertDays : []
  const iqamaAlertDays = [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 365))]
    .sort((a, b) => b - a)
  if (iqamaAlertDays.length === 0) {
    response.status(400).json({ message: 'At least one valid alert threshold is required.' })
    return
  }

  data.settings.iqamaAlertDays = iqamaAlertDays
  addAudit(data, user, 'update_iqama_alerts', iqamaAlertDays.join(', '))
  await writeData(data)
  response.json(data.settings)
})

app.post('/api/reset', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireSuperAdmin(user, response)) return

  addAudit(data, user, 'reset_data', 'fresh initialization')
  const reset = await resetData()
  const resetWithAudit = {
    ...reset,
    sessions: [],
    notifications: [],
    auditLog: [
      {
        id: Date.now(),
        actorId: user.id,
        actorName: user.name,
        action: 'reset_data',
        target: 'fresh initialization',
        date: new Date().toISOString(),
      },
    ],
  }
  notifyAdmins(resetWithAudit, 'تهيئة التطبيق', 'تمت تهيئة بيانات التطبيق من جديد.', 'system')
  await writeData(resetWithAudit)
  response.json({
    employees: resetWithAudit.employees.map(publicEmployee),
    goals: resetWithAudit.goals,
    iqamaRecords: resetWithAudit.iqamaRecords,
    settings: resetWithAudit.settings,
    auditLog: resetWithAudit.auditLog,
    notifications: getUserNotifications(resetWithAudit, user),
    user: publicEmployee(user),
  })
})

app.get('/api/backup', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireSuperAdmin(user, response)) return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  addAudit(data, user, 'backup_data', 'download backup')
  notifyAdmins(data, 'نسخة احتياطية', `${user.name} قام بتنزيل نسخة احتياطية.`, 'system', user.id)
  await writeData(data)
  response.setHeader('Content-Disposition', `attachment; filename="goals-backup-${stamp}.json"`)
  response.json(data)
})

app.post('/api/restore', async (request, response) => {
  const data = await readData()
  const user = requireUser(request, response, data)
  if (!user || !requireSuperAdmin(user, response)) return

  const restored = request.body
  if (!isAppData(restored)) {
    response.status(400).json({ message: 'Invalid backup file.' })
    return
  }

  const restoredWithAudit = {
    ...restored,
    sessions: [],
    notifications: [],
    auditLog: [
      {
        id: Date.now(),
        actorId: user.id,
        actorName: user.name,
        action: 'restore_data',
        target: 'backup file',
        date: new Date().toISOString(),
      },
      ...(restored.auditLog ?? []),
    ],
  }
  notifyAdmins(restoredWithAudit, 'استعادة بيانات', 'تمت استعادة البيانات من نسخة احتياطية.', 'system')
  await writeData(restoredWithAudit)
  const nextData = await readData()
  response.json({
    employees: nextData.employees.map(publicEmployee),
    goals: nextData.goals,
    iqamaRecords: nextData.iqamaRecords,
    settings: nextData.settings,
    auditLog: nextData.auditLog.slice(0, 80),
    notifications: getUserNotifications(nextData, user),
    user: publicEmployee(user),
  })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, host, () => {
  console.log(`Goal tracker running at http://${host}:${port}`)
})

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeStatus(value: unknown): GoalStatus | undefined {
  return ['not_started', 'in_progress', 'at_risk', 'completed'].includes(String(value))
    ? (value as GoalStatus)
    : undefined
}

function normalizeRole(value: unknown): Employee['role'] | undefined {
  return ['super_admin', 'manager', 'employee'].includes(String(value))
    ? (value as Employee['role'])
    : undefined
}

function statusFromProgress(progress: number, fallback: GoalStatus = 'in_progress'): GoalStatus {
  if (progress <= 0) return 'not_started'
  if (progress >= 100) return 'completed'
  if (fallback === 'at_risk') return 'at_risk'
  return 'in_progress'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function makeEmployeeId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')

  return normalized || `employee-${Date.now()}`
}

function requireUser(request: Request, response: Response, data: { employees: Employee[]; sessions: SessionRecord[] }) {
  const session = findSession(request, data.sessions)
  const user = session ? data.employees.find((employee) => employee.id === session.userId && employee.active) : null

  if (!session || !user) {
    response.status(401).json({ message: 'Login is required.' })
    return null
  }

  return user
}

function requireGoalManager(user: Employee, response: Response) {
  if (!canManageGoals(user)) {
    response.status(403).json({ message: 'Manager access is required.' })
    return false
  }

  return true
}

function requireSuperAdmin(user: Employee, response: Response) {
  if (user.role !== 'super_admin') {
    response.status(403).json({ message: 'Super Admin access is required.' })
    return false
  }

  return true
}

function requireIqamaManager(user: Employee, response: Response) {
  if (!canManageIqama(user)) {
    response.status(403).json({ message: 'Iqama manager access is required.' })
    return false
  }

  return true
}

function canManageGoals(user: Employee) {
  return user.role === 'super_admin' || user.role === 'manager'
}

function canManageIqama(user: Employee) {
  return user.role === 'super_admin' || user.role === 'manager'
}

function publicEmployee(employee: Employee) {
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    active: employee.active,
  }
}

function addAudit(data: { auditLog?: unknown[] }, user: Employee, action: string, target: string) {
  const entry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    actorId: user.id,
    actorName: user.name,
    action,
    target,
    date: new Date().toISOString(),
  }

  data.auditLog = [entry, ...((data.auditLog as typeof entry[] | undefined) ?? [])].slice(0, 500)
}

function getUserNotifications(data: AppData, user: Employee) {
  return data.notifications.filter((notification) => notification.userId === user.id).slice(0, 80)
}

function addNotification(data: AppData, userId: string, title: string, message: string, type: string) {
  data.notifications = [
    {
      id: Date.now() + Math.floor(Math.random() * 1000),
      userId,
      title,
      message,
      type,
      read: false,
      date: new Date().toISOString(),
    },
    ...(data.notifications ?? []),
  ].slice(0, 800)
}

function notifyUser(data: AppData, userId: string, title: string, message: string, type: string) {
  const user = data.employees.find((employee) => employee.id === userId && employee.active)
  if (user) addNotification(data, user.id, title, message, type)
}

function notifyGoalOwner(data: AppData, ownerName: string, title: string, message: string, type: string) {
  const owner = data.employees.find((employee) => employee.name === ownerName && employee.active)
  if (owner) addNotification(data, owner.id, title, message, type)
}

function notifyManagers(data: AppData, title: string, message: string, type: string, exceptUserId?: string) {
  for (const employee of data.employees) {
    if ((employee.role === 'manager' || employee.role === 'super_admin') && employee.active && employee.id !== exceptUserId) {
      addNotification(data, employee.id, title, message, type)
    }
  }
}

function notifyAdmins(data: AppData, title: string, message: string, type: string, exceptUserId?: string) {
  for (const employee of data.employees) {
    if (employee.role === 'super_admin' && employee.active && employee.id !== exceptUserId) {
      addNotification(data, employee.id, title, message, type)
    }
  }
}

function iqamaFromRequest(body: Record<string, unknown>): IqamaRecord {
  return {
    id: Date.now(),
    employeeId: String(body.employeeId ?? '').trim(),
    iqamaNumber: String(body.iqamaNumber ?? '').trim(),
    nationality: String(body.nationality ?? '').trim(),
    jobTitle: String(body.jobTitle ?? '').trim(),
    issueDate: String(body.issueDate ?? ''),
    expiryDate: String(body.expiryDate ?? ''),
    notes: String(body.notes ?? '').trim(),
    updatedAt: new Date().toISOString(),
    renewalHistory: [],
    alertedThresholds: [],
  }
}

function notifyIqamaStatus(data: AppData, record: IqamaRecord, employeeName: string, exceptUserId?: string) {
  const days = daysUntil(record.expiryDate)
  const threshold = [...data.settings.iqamaAlertDays].sort((a, b) => a - b).find((value) => days <= value)
  if (days >= 0 && (!threshold || record.alertedThresholds.includes(threshold))) return
  if (days < 0 && record.alertedThresholds.includes(-1)) return

  const message =
    days < 0
      ? `إقامة ${employeeName} منتهية منذ ${Math.abs(days)} يوم.`
      : `إقامة ${employeeName} تنتهي خلال ${days} يوم.`
  notifyManagers(data, days < 0 ? 'إقامة منتهية' : 'إقامة تنتهي قريبا', message, 'iqama', exceptUserId)
  record.alertedThresholds = [...record.alertedThresholds, days < 0 ? -1 : threshold!]
}

function daysUntil(value: string) {
  const target = new Date(`${value}T00:00:00`).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today.getTime()) / 86_400_000)
}

function createSession(userId: string, remember: boolean) {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (remember ? 30 : 0.5) * 24 * 60 * 60 * 1000)
  const record: SessionRecord = {
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    remember,
  }

  return { token, record }
}

function findSession(request: Request, sessions: SessionRecord[]) {
  const authorization = request.header('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const tokenHash = hashToken(token)
  const now = Date.now()
  return sessions.find((session) => session.tokenHash === tokenHash && new Date(session.expiresAt).getTime() > now)
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function isAppData(value: unknown): value is { employees: Employee[]; goals: Goal[]; auditLog?: unknown[] } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { employees?: unknown; goals?: unknown }
  return Array.isArray(candidate.employees) && Array.isArray(candidate.goals)
}
