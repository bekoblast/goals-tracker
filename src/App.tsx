import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  DatabaseBackup,
  Download,
  Filter,
  HelpCircle,
  IdCard,
  LayoutDashboard,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
} from 'lucide-react'
import './App.css'

type Role = 'super_admin' | 'manager' | 'employee'
type GoalStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed'
type ModuleView = 'overview' | 'goals' | 'iqama'

type Employee = {
  id: string
  name: string
  role: Role
  active: boolean
}

type AuditEntry = {
  id: number
  actorId: string
  actorName: string
  action: string
  target: string
  date: string
}

type NotificationItem = {
  id: number
  userId: string
  title: string
  message: string
  date: string
  read: boolean
  type: string
}

type Goal = {
  id: number
  title: string
  owner: string
  dueDate: string
  progress: number
  status: GoalStatus
  description: string
  activities: ActivityItem[]
}

type ActivityItem = {
  id: number
  text: string
  author: string
  date: string
}

type AppData = {
  employees: Employee[]
  goals: Goal[]
  auditLog: AuditEntry[]
  notifications: NotificationItem[]
}

type LoginResponse = {
  user: Employee
  token: string
  expiresAt: string
}

const emptyGoal = {
  title: '',
  owner: '',
  dueDate: new Date().toISOString().slice(0, 10),
  progress: 0,
  description: '',
}

type GoalDraft = typeof emptyGoal

const emptyEmployee = {
  name: '',
  id: '',
  pin: '',
  role: 'employee' as Role,
}

const statusLabels: Record<GoalStatus, string> = {
  not_started: 'لم يبدأ',
  in_progress: 'قيد التنفيذ',
  at_risk: 'بحاجة لمتابعة',
  completed: 'مكتمل',
}

const roleGuides: Record<Role, { title: string; intro: string; steps: string[]; tips: string[] }> = {
  super_admin: {
    title: 'دليل المشرف العام',
    intro: 'هذه المساحة تساعدك على إدارة النظام بأمان ومتابعة أهم العمليات.',
    steps: [
      'أضف المستخدمين وحدد دور كل مستخدم من قسم إضافة مستخدم.',
      'راجع قائمة المستخدمين لتغيير الأدوار أو تعطيل الحسابات غير المستخدمة.',
      'استخدم النسخ الاحتياطي قبل أي تغيير كبير أو قبل نقل التطبيق إلى خادم آخر.',
      'استعد نسخة احتياطية فقط من ملف موثوق تم تنزيله من نفس التطبيق.',
      'راجع سجل التدقيق لمعرفة من قام بكل عملية مهمة ومتى حدثت.',
    ],
    tips: [
      'اترك دائما مشرفا عاما واحدا نشطا على الأقل.',
      'استخدم التهيئة الجديدة بحذر لأنها تعيد بيانات التطبيق إلى وضع البداية.',
    ],
  },
  manager: {
    title: 'دليل المدير',
    intro: 'هذه المساحة تساعدك على إنشاء الأهداف ومتابعة تقدم الفريق بسهولة.',
    steps: [
      'أنشئ هدفا جديدا من قسم إنشاء هدف واختر الموظف المسؤول عنه.',
      'افتح أي هدف من القائمة لمراجعة التفاصيل والأنشطة ونسبة الإنجاز.',
      'استخدم زر التعديل لتحديث العنوان أو الموظف أو تاريخ الاستحقاق أو الملاحظات.',
      'تابع تقرير الفريق لمعرفة متوسط الإنجاز والأهداف المتأخرة أو التي تحتاج متابعة.',
      'نزّل التقرير عند الحاجة لمشاركته أو حفظ نسخة خارج التطبيق.',
    ],
    tips: [
      'اكتب أهدافا قصيرة وواضحة حتى يعرف الموظف المطلوب بالضبط.',
      'راجع الأهداف المتأخرة أولا لأنها تظهر بتنبيه واضح في القائمة.',
    ],
  },
  employee: {
    title: 'دليل الموظف',
    intro: 'هذه المساحة تعرض أهدافك فقط وتساعدك على توثيق ما أنجزته.',
    steps: [
      'اختر الهدف من القائمة لعرض التفاصيل ونسبة الإنجاز.',
      'حدّث نسبة الإنجاز عند تقدم العمل حتى يرى المدير الحالة الفعلية.',
      'غيّر الحالة إلى بحاجة لمتابعة إذا واجهت عائقا يحتاج تدخل المدير.',
      'سجّل النشاط بعد كل خطوة مهمة قمت بها لإكمال الهدف.',
      'تابع تاريخ الاستحقاق والتنبيهات لمعرفة الأولويات اليومية.',
    ],
    tips: [
      'اكتب النشاط بصيغة واضحة: ماذا تم، وما النتيجة، وهل يوجد عائق؟',
      'لا تنتظر نهاية الأسبوع لتحديث الإنجاز، التحديثات الصغيرة مفيدة جدا.',
    ],
  },
}

function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => readStoredSession()?.user ?? null)
  const [sessionToken, setSessionToken] = useState(() => readStoredSession()?.token ?? '')
  const [loginUserId, setLoginUserId] = useState('manager')
  const [loginPin, setLoginPin] = useState('1111')
  const [rememberMe, setRememberMe] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState(0)
  const [ownerFilter, setOwnerFilter] = useState('الكل')
  const [statusFilter, setStatusFilter] = useState('الكل')
  const [search, setSearch] = useState('')
  const [goalDraft, setGoalDraft] = useState(emptyGoal)
  const [editGoalDraft, setEditGoalDraft] = useState<GoalDraft | null>(null)
  const [employeeDraft, setEmployeeDraft] = useState(emptyEmployee)
  const [activityDraft, setActivityDraft] = useState('')
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [activeModule, setActiveModule] = useState<ModuleView>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const role = currentUser?.role ?? 'employee'
  const canManageGoals = role === 'manager' || role === 'super_admin'
  const canManageUsers = role === 'super_admin'
  const unreadNotifications = notifications.filter((notification) => !notification.read).length

  const people = useMemo(
    () =>
      employees
        .filter((employee) => employee.role === 'employee' && employee.active)
        .map((employee) => employee.name),
    [employees],
  )

  useEffect(() => {
    if (sessionToken) {
      void loadData(sessionToken)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData(token = sessionToken) {
    if (!token) return
    setIsLoading(true)
    setError('')
    try {
      const data = await api<AppData>('/api/bootstrap', {}, token)
      const firstEmployee = data.employees.find((employee) => employee.role === 'employee')?.name ?? ''
      setEmployees(data.employees)
      setGoals(data.goals)
      setAuditLog(data.auditLog ?? [])
      setNotifications(data.notifications ?? [])
      setSelectedGoalId(data.goals[0]?.id ?? 0)
      setGoalDraft((current) => ({ ...current, owner: current.owner || firstEmployee }))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem('team-goals.session')
        setCurrentUser(null)
        setSessionToken('')
        setGoals([])
        setEmployees([])
        setAuditLog([])
        setNotifications([])
        setSelectedGoalId(0)
        setError('انتهت الجلسة. سجل الدخول مرة أخرى.')
        return
      }
      setError('تعذر الاتصال بالخادم. تأكد أن خدمة API تعمل.')
    } finally {
      setIsLoading(false)
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const data = await api<LoginResponse>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ userId: loginUserId, pin: loginPin, remember: rememberMe }),
      })
      localStorage.setItem('team-goals.session', JSON.stringify(data))
      setCurrentUser(data.user)
      setSessionToken(data.token)
      await loadData(data.token)
    } catch {
      setError('بيانات الدخول غير صحيحة.')
    }
  }

  function logout() {
    if (sessionToken) {
      void api('/api/logout', { method: 'POST' }, sessionToken)
    }
    localStorage.removeItem('team-goals.session')
    setCurrentUser(null)
    setSessionToken('')
    setGoals([])
    setEmployees([])
    setAuditLog([])
    setNotifications([])
    setSelectedGoalId(0)
  }

  const visibleGoals = useMemo(() => {
    const roleFiltered = canManageGoals ? goals : goals.filter((goal) => goal.owner === currentUser?.name)

    return roleFiltered.filter((goal) => {
      const matchesOwner = ownerFilter === 'الكل' || goal.owner === ownerFilter
      const matchesStatus = statusFilter === 'الكل' || goal.status === statusFilter
      const term = search.trim().toLowerCase()
      const matchesSearch =
        !term || `${goal.title} ${goal.owner} ${goal.description}`.toLowerCase().includes(term)

      return matchesOwner && matchesStatus && matchesSearch
    })
  }, [canManageGoals, currentUser?.name, goals, ownerFilter, search, statusFilter])

  const selectedGoal =
    visibleGoals.find((goal) => goal.id === selectedGoalId) ?? visibleGoals[0] ?? goals[0]

  const metrics = useMemo(() => {
    const scope = canManageGoals ? goals : goals.filter((goal) => goal.owner === currentUser?.name)
    const average =
      scope.length === 0
        ? 0
        : Math.round(scope.reduce((sum, goal) => sum + goal.progress, 0) / scope.length)
    const completed = scope.filter((goal) => goal.status === 'completed').length
    const atRisk = scope.filter((goal) => goal.status === 'at_risk').length
    const activities = scope.reduce((sum, goal) => sum + goal.activities.length, 0)

    return { average, completed, atRisk, total: scope.length, activities }
  }, [canManageGoals, currentUser?.name, goals])

  const latestActivities = useMemo(() => {
    const scope = canManageGoals ? goals : goals.filter((goal) => goal.owner === currentUser?.name)

    return scope
      .flatMap((goal) =>
        goal.activities.map((item) => ({
          ...item,
          goalTitle: goal.title,
        })),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(0, 6)
  }, [canManageGoals, currentUser?.name, goals])

  const employeeReports = useMemo(() => {
    return people.map((person) => {
      const employeeGoals = goals.filter((goal) => goal.owner === person)
      const total = employeeGoals.length
      const average =
        total === 0
          ? 0
          : Math.round(employeeGoals.reduce((sum, goal) => sum + goal.progress, 0) / total)
      const completed = employeeGoals.filter((goal) => goal.status === 'completed').length
      const atRisk = employeeGoals.filter((goal) => goal.status === 'at_risk').length
      const overdue = employeeGoals.filter((goal) => getDueInfo(goal).className === 'due-overdue').length
      const activities = employeeGoals.reduce((sum, goal) => sum + goal.activities.length, 0)

      return {
        person,
        total,
        average,
        completed,
        atRisk,
        overdue,
        activities,
      }
    })
  }, [goals, people])

  const createGoal = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentUser) return
    setError('')
    try {
      const goal = await api<Goal>('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ ...goalDraft, owner: goalDraft.owner || people[0] }),
      }, sessionToken)
      setGoals((current) => [goal, ...current])
      setSelectedGoalId(goal.id)
      setGoalDraft({ ...emptyGoal, owner: people[0] ?? '' })
    } catch {
      setError('لم يتم إنشاء الهدف. راجع البيانات وحاول مرة أخرى.')
    }
  }

  const createEmployee = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentUser) return

    setError('')
    try {
      const employee = await api<Employee>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(employeeDraft),
      }, sessionToken)
      setEmployees((current) => [...current, employee])
      setGoalDraft((current) => ({ ...current, owner: current.owner || employee.name }))
      setEmployeeDraft(emptyEmployee)
    } catch {
      setError('تعذر إضافة الموظف. تأكد أن الاسم أو معرف الدخول غير مستخدم.')
    }
  }

  const updateUserRole = async (userId: string, nextRole: Role) => {
    if (!currentUser) return

    setError('')
    try {
      const employee = await api<Employee>(`/api/employees/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      }, sessionToken)
      setEmployees((current) => current.map((item) => (item.id === employee.id ? employee : item)))
      if (currentUser.id === employee.id) {
        setCurrentUser(employee)
      }
    } catch {
      setError('تعذر تعديل دور المستخدم. يجب أن يبقى مشرف عام واحد على الأقل.')
    }
  }

  const toggleUserActive = async (employee: Employee) => {
    if (!currentUser) return

    setError('')
    try {
      const updated = await api<Employee>(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !employee.active }),
      }, sessionToken)
      setEmployees((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (currentUser.id === updated.id) {
        setCurrentUser(updated)
      }
    } catch {
      setError('تعذر تغيير حالة المستخدم. يجب أن يبقى مشرف عام نشط واحد على الأقل.')
    }
  }

  const downloadBackup = async () => {
    if (!currentUser) return

    setError('')
    try {
      const response = await fetch('/api/backup', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      if (!response.ok) throw new Error('Backup failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `goals-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('تعذر إنشاء النسخة الاحتياطية.')
    }
  }

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) return
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    try {
      const backup = JSON.parse(await file.text()) as AppData
      const data = await api<AppData>('/api/restore', {
        method: 'POST',
        body: JSON.stringify(backup),
      }, sessionToken)
      setEmployees(data.employees)
      setGoals(data.goals)
      setAuditLog(data.auditLog ?? [])
      setNotifications(data.notifications ?? [])
      setSelectedGoalId(data.goals[0]?.id ?? 0)
      event.target.value = ''
    } catch {
      setError('تعذر استعادة النسخة الاحتياطية. تأكد من صحة الملف.')
    }
  }

  const loadNotifications = async () => {
    if (!sessionToken) return
    try {
      const nextNotifications = await api<NotificationItem[]>('/api/notifications', {}, sessionToken)
      setNotifications(nextNotifications)
    } catch {
      setError('تعذر تحميل الإشعارات.')
    }
  }

  const markNotificationRead = async (notificationId: number) => {
    if (!sessionToken) return
    try {
      const updated = await api<NotificationItem>(
        `/api/notifications/${notificationId}/read`,
        { method: 'PATCH' },
        sessionToken,
      )
      setNotifications((current) =>
        current.map((notification) => (notification.id === updated.id ? updated : notification)),
      )
    } catch {
      setError('تعذر تحديث الإشعار.')
    }
  }

  const markAllNotificationsRead = async () => {
    if (!sessionToken) return
    try {
      const nextNotifications = await api<NotificationItem[]>(
        '/api/notifications/read-all',
        { method: 'POST' },
        sessionToken,
      )
      setNotifications(nextNotifications)
    } catch {
      setError('تعذر تحديث الإشعارات.')
    }
  }

  const exportReport = () => {
    const summaryRows = employeeReports.map((report) => [
      report.person,
      report.total,
      `${report.average}%`,
      report.completed,
      report.atRisk,
      report.overdue,
      report.activities,
    ])

    const goalRows = goals.map((goal) => {
      const due = getDueInfo(goal)
      return [
        goal.title,
        goal.owner,
        statusLabels[goal.status],
        `${goal.progress}%`,
        formatDate(goal.dueDate),
        due.label,
        goal.activities.length,
        goal.description,
      ]
    })

    const rows = [
      ['تقرير الفريق'],
      ['الموظف', 'الأهداف', 'متوسط الإنجاز', 'مكتملة', 'بحاجة لمتابعة', 'متأخرة', 'الأنشطة'],
      ...summaryRows,
      [],
      ['تفاصيل الأهداف'],
      ['الهدف', 'الموظف', 'الحالة', 'نسبة الإنجاز', 'تاريخ الاستحقاق', 'حالة الاستحقاق', 'عدد الأنشطة', 'الملاحظات'],
      ...goalRows,
    ]

    downloadCsv(`team-goals-report-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const openEditGoal = (goal: Goal) => {
    setEditGoalDraft({
      title: goal.title,
      owner: goal.owner,
      dueDate: goal.dueDate,
      progress: goal.progress,
      description: goal.description,
    })
  }

  const saveGoalDetails = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentUser || !selectedGoal || !editGoalDraft) return

    setError('')
    try {
      const goal = await api<Goal>(`/api/goals/${selectedGoal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editGoalDraft),
      }, sessionToken)
      replaceGoal(goal)
      setEditGoalDraft(null)
    } catch {
      setError('تعذر حفظ تعديلات الهدف.')
    }
  }

  const updateGoalProgress = async (goalId: number, progress: number) => {
    if (!currentUser) return
    setGoals((current) =>
      current.map((goal) =>
        goal.id === goalId ? { ...goal, progress, status: statusFromProgress(progress, goal.status) } : goal,
      ),
    )

    try {
      const goal = await api<Goal>(`/api/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ progress }),
      }, sessionToken)
      replaceGoal(goal)
    } catch {
      setError('تعذر حفظ نسبة الإنجاز.')
    }
  }

  const setGoalStatus = async (goalId: number, status: GoalStatus) => {
    if (!currentUser) return
    const progress = status === 'completed' ? 100 : selectedGoal?.progress
    setGoals((current) =>
      current.map((goal) =>
        goal.id === goalId
          ? { ...goal, status, progress: status === 'completed' ? 100 : goal.progress }
          : goal,
      ),
    )

    try {
      const goal = await api<Goal>(`/api/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, progress }),
      }, sessionToken)
      replaceGoal(goal)
    } catch {
      setError('تعذر حفظ حالة الهدف.')
    }
  }

  const addActivity = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentUser || !selectedGoal || activityDraft.trim().length === 0) return

    setError('')
    try {
      const activity = await api<ActivityItem>(`/api/goals/${selectedGoal.id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          text: activityDraft.trim(),
        }),
      }, sessionToken)

      setGoals((current) =>
        current.map((goal) =>
          goal.id === selectedGoal.id
            ? { ...goal, activities: [activity, ...goal.activities] }
            : goal,
        ),
      )
      setActivityDraft('')
    } catch {
      setError('تعذر تسجيل النشاط.')
    }
  }

  const deleteGoal = async (goalId: number) => {
    if (!currentUser) return
    setError('')
    try {
      await api(`/api/goals/${goalId}`, { method: 'DELETE' }, sessionToken)
      const remaining = goals.filter((goal) => goal.id !== goalId)
      setGoals(remaining)
      setEditGoalDraft(null)
      setSelectedGoalId(remaining[0]?.id ?? 0)
    } catch {
      setError('تعذر حذف الهدف.')
    }
  }

  const resetDemoData = async () => {
    if (!currentUser) return
    setError('')
    try {
      const data = await api<AppData>('/api/reset', { method: 'POST' }, sessionToken)
      setEmployees(data.employees)
      setGoals(data.goals)
      setAuditLog(data.auditLog ?? [])
      setNotifications(data.notifications ?? [])
      setSelectedGoalId(data.goals[0]?.id ?? 0)
    } catch {
      setError('تعذر إعادة بيانات التجربة.')
    }
  }

  const replaceGoal = (goal: Goal) => {
    setGoals((current) => current.map((item) => (item.id === goal.id ? goal : item)))
  }

  if (!currentUser) {
    return (
      <main className="login-shell">
        <form className="login-card" onSubmit={(event) => void login(event)}>
          <img className="login-logo" src="/logo1.png" alt="شعار الشركة" />
          <div>
            <p className="eyebrow">تسجيل الدخول</p>
            <h1>مسار الأهداف</h1>
            <p>اختر المستخدم وأدخل رمز الدخول للمتابعة.</p>
          </div>

          {error && <p className="error-banner">{error}</p>}

          <label>
            معرف الدخول
            <input
              onChange={(event) => setLoginUserId(event.target.value)}
              placeholder="manager"
              value={loginUserId}
            />
          </label>
          <label>
            رمز الدخول
            <input
              inputMode="numeric"
              onChange={(event) => setLoginPin(event.target.value)}
              type="password"
              value={loginPin}
            />
          </label>
          <label className="remember-row">
            <input
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            تذكرني لمدة 30 يوم
          </label>
          <button type="submit">دخول</button>
          <p className="login-hint">بيانات التجربة: admin / 0000، manager / 1111، amina / 2222.</p>
        </form>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/logo1.png" alt="شعار الشركة" />
          <div>
            <strong>مسار الأهداف</strong>
            <span>متابعة أهداف الفريق ببساطة</span>
          </div>
        </div>

        <div className="role-switch" aria-label="المستخدم الحالي">
          <button className="active" type="button">
            <UsersRound size={17} />
            {currentUser.name}
          </button>
          <span className="nav-section-label">مساحات العمل</span>
          <button
            className={activeModule === 'overview' ? 'active' : ''}
            onClick={() => setActiveModule('overview')}
            type="button"
          >
            <LayoutDashboard size={17} />
            لوحة المعلومات
          </button>
          <button
            className={activeModule === 'goals' ? 'active' : ''}
            onClick={() => setActiveModule('goals')}
            type="button"
          >
            <ClipboardList size={17} />
            مسار الأهداف
          </button>
          <button
            className={activeModule === 'iqama' ? 'active' : ''}
            onClick={() => setActiveModule('iqama')}
            type="button"
          >
            <IdCard size={17} />
            متابعة الإقامات
          </button>
          <span className="nav-section-label">أدوات مشتركة</span>
          <button onClick={() => setIsGuideOpen(true)} type="button">
            <HelpCircle size={17} />
            دليل الاستخدام
          </button>
          <button onClick={() => {
            setIsNotificationsOpen(true)
            void loadNotifications()
          }} type="button">
            <Bell size={17} />
            الإشعارات
            {unreadNotifications > 0 && <b className="notification-count">{unreadNotifications}</b>}
          </button>
          <button onClick={logout} type="button">تسجيل الخروج</button>
        </div>

        <div className="employee-picker">
          الصلاحية
          <strong>{roleLabel(role)}</strong>
        </div>

        <div className="side-panel">
          <span>تركيز اليوم</span>
          <strong>{metrics.average}% متوسط الإنجاز</strong>
          <p>
            {metrics.atRisk === 0
              ? 'لا توجد أهداف بحاجة لمتابعة.'
              : `${metrics.atRisk} هدف بحاجة لمتابعة.`}
          </p>
        </div>
      </aside>

      {activeModule === 'overview' ? (
        <GeneralDashboard
          activeEmployees={employees.filter((employee) => employee.active).length}
          metrics={metrics}
          notifications={notifications}
          onOpenModule={setActiveModule}
          recentActivities={latestActivities}
          role={role}
        />
      ) : activeModule === 'iqama' ? (
        <IqamaModulePlaceholder onBack={() => setActiveModule('overview')} />
      ) : (
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{canManageGoals ? `مساحة ${roleLabel(role)}` : `مساحة ${currentUser.name}`}</p>
            <h1>تابع الأهداف، أنشطة العمل، ونسبة الإنجاز في مكان واحد بسيط.</h1>
          </div>
          <div className="topbar-actions">
            <button className="soft-button" onClick={() => void loadData(sessionToken)} type="button">
              <RefreshCw size={18} />
              تحديث
            </button>
            {canManageGoals && (
              <button className="soft-button" onClick={exportReport} type="button">
                <Download size={18} />
                تنزيل التقرير
              </button>
            )}
            {canManageUsers && (
              <>
                <button className="soft-button" onClick={() => void downloadBackup()} type="button">
                  <Download size={18} />
                  نسخة احتياطية
                </button>
                <label className="soft-button file-action">
                  <Upload size={18} />
                  استعادة
                  <input accept="application/json" onChange={(event) => void restoreBackup(event)} type="file" />
                </label>
                <button className="soft-button danger-soft" onClick={() => void resetDemoData()} type="button">
                  <Sparkles size={18} />
                  تهيئة جديدة
                </button>
              </>
            )}
          </div>
        </header>

        {error && <p className="error-banner">{error}</p>}
        {isLoading && <p className="empty-state">جاري تحميل بيانات الفريق...</p>}

        <section className="metric-grid" aria-label="ملخص الأهداف">
          <MetricCard icon={<ClipboardList />} label="الأهداف النشطة" value={metrics.total.toString()} />
          <MetricCard icon={<BarChart3 />} label="متوسط التقدم" value={`${metrics.average}%`} />
          <MetricCard icon={<CheckCircle2 />} label="المكتملة" value={metrics.completed.toString()} />
          <MetricCard icon={<Activity />} label="الأنشطة المسجلة" value={metrics.activities.toString()} />
        </section>

        {canManageGoals && (
          <section className="panel report-panel">
            <div className="panel-title">
              <div>
                <h2>تقرير الفريق</h2>
                <p>ملخص سريع يساعد المدير على معرفة حالة كل موظف.</p>
              </div>
              <BarChart3 size={22} />
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الأهداف</th>
                    <th>متوسط الإنجاز</th>
                    <th>مكتملة</th>
                    <th>بحاجة لمتابعة</th>
                    <th>متأخرة</th>
                    <th>الأنشطة</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeReports.map((report) => (
                    <tr key={report.person}>
                      <td>
                        <strong>{report.person}</strong>
                      </td>
                      <td>{report.total}</td>
                      <td>
                        <div className="mini-progress">
                          <span style={{ width: `${report.average}%` }} />
                        </div>
                        <b>{report.average}%</b>
                      </td>
                      <td>{report.completed}</td>
                      <td className={report.atRisk > 0 ? 'warning-cell' : ''}>{report.atRisk}</td>
                      <td className={report.overdue > 0 ? 'danger-cell' : ''}>{report.overdue}</td>
                      <td>{report.activities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="content-grid">
          <section className="panel goal-list-panel">
            <div className="panel-title">
              <div>
                <h2>الأهداف</h2>
                <p>صفّي الأهداف، اختر هدفا، وحدّث العمل الذي يتحرك عليه الفريق.</p>
              </div>
              <ClipboardList size={22} />
            </div>

            <div className="filters">
              <label className="search-box">
                <Search size={17} />
                <input
                  aria-label="البحث في الأهداف"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث عن هدف أو موظف"
                  value={search}
                />
              </label>
              <label>
                <Filter size={16} />
                <select
                  disabled={!canManageGoals}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                  value={!canManageGoals ? 'الكل' : ownerFilter}
                >
                  <option>الكل</option>
                  {people.map((person) => (
                    <option key={person}>{person}</option>
                  ))}
                </select>
              </label>
              <label>
                <Filter size={16} />
                <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                  <option>الكل</option>
                  <option value="not_started">لم يبدأ</option>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="at_risk">بحاجة لمتابعة</option>
                  <option value="completed">مكتمل</option>
                </select>
              </label>
            </div>

            <div className="goal-list">
              {visibleGoals.map((goal) => (
                (() => {
                  const due = getDueInfo(goal)
                  return (
                <button
                  className={`${selectedGoal?.id === goal.id ? 'goal-card selected' : 'goal-card'} card-${due.className}`}
                  key={goal.id}
                  onClick={() => setSelectedGoalId(goal.id)}
                  type="button"
                >
                  <div>
                    <strong>{goal.title}</strong>
                    <span>{goal.owner} · الاستحقاق {formatDate(goal.dueDate)}</span>
                  </div>
                  <ProgressBar progress={goal.progress} />
                  <div className="goal-card-foot">
                    <StatusPill status={goal.status} />
                    <span className={`due-pill ${due.className}`}>{due.label}</span>
                    <b>{goal.progress}%</b>
                  </div>
                </button>
                  )
                })()
              ))}
              {visibleGoals.length === 0 && (
                <p className="empty-state">لا توجد أهداف مطابقة لهذا العرض.</p>
              )}
            </div>
          </section>

          <section className="panel detail-panel">
            {selectedGoal ? (
              <>
                <div className="panel-title">
                  <div>
                    <h2>{selectedGoal.title}</h2>
                    <p>{selectedGoal.description}</p>
                  </div>
                  {canManageGoals && (
                    <div className="row-actions">
                      <button
                        aria-label="تعديل الهدف"
                        className="icon-button"
                        onClick={() => openEditGoal(selectedGoal)}
                        type="button"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        aria-label="حذف الهدف"
                        className="icon-button danger"
                        onClick={() => void deleteGoal(selectedGoal.id)}
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="detail-meta">
                  <span>
                    <UserRound size={16} />
                    {selectedGoal.owner}
                  </span>
                  <span>
                    <CalendarDays size={16} />
                    {formatDate(selectedGoal.dueDate)}
                  </span>
                  <span className={`due-meta ${getDueInfo(selectedGoal).className}`}>
                    {getDueInfo(selectedGoal).label}
                  </span>
                  <StatusPill status={selectedGoal.status} />
                </div>

                {editGoalDraft && canManageGoals && (
                  <form className="goal-form edit-goal-form" onSubmit={(event) => void saveGoalDetails(event)}>
                    <label>
                      عنوان الهدف
                      <input
                        onChange={(event) =>
                          setEditGoalDraft({ ...editGoalDraft, title: event.target.value })
                        }
                        required
                        value={editGoalDraft.title}
                      />
                    </label>
                    <label>
                      الموظف
                      <select
                        onChange={(event) =>
                          setEditGoalDraft({ ...editGoalDraft, owner: event.target.value })
                        }
                        required
                        value={editGoalDraft.owner}
                      >
                        {people.map((person) => (
                          <option key={person}>{person}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      تاريخ الاستحقاق
                      <input
                        onChange={(event) =>
                          setEditGoalDraft({ ...editGoalDraft, dueDate: event.target.value })
                        }
                        type="date"
                        value={editGoalDraft.dueDate}
                      />
                    </label>
                    <label>
                      نسبة الإنجاز
                      <input
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setEditGoalDraft({ ...editGoalDraft, progress: Number(event.target.value) })
                        }
                        type="number"
                        value={editGoalDraft.progress}
                      />
                    </label>
                    <label className="wide-field">
                      ملاحظات
                      <textarea
                        onChange={(event) =>
                          setEditGoalDraft({ ...editGoalDraft, description: event.target.value })
                        }
                        rows={3}
                        value={editGoalDraft.description}
                      />
                    </label>
                    <div className="form-actions wide-field">
                      <button type="submit">حفظ التعديلات</button>
                      <button className="secondary-form-button" onClick={() => setEditGoalDraft(null)} type="button">
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}

                <div className="progress-editor">
                  <div>
                    <span>نسبة الإنجاز</span>
                    <strong>{selectedGoal.progress}%</strong>
                  </div>
                  <input
                    aria-label="نسبة إنجاز الهدف"
                    max="100"
                    min="0"
                    onChange={(event) =>
                      void updateGoalProgress(selectedGoal.id, Number(event.target.value))
                    }
                    type="range"
                    value={selectedGoal.progress}
                  />
                  <ProgressBar progress={selectedGoal.progress} />
                </div>

                <div className="status-controls">
                  {(['not_started', 'in_progress', 'at_risk', 'completed'] as GoalStatus[]).map((status) => (
                    <button
                      className={selectedGoal.status === status ? 'active' : ''}
                      key={status}
                      onClick={() => void setGoalStatus(selectedGoal.id, status)}
                      type="button"
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>

                <form className="activity-form" onSubmit={(event) => void addActivity(event)}>
                  <label>
                    إضافة نشاط
                    <textarea
                      onChange={(event) => setActivityDraft(event.target.value)}
                      placeholder="ما النشاط الذي تم تنفيذه لدفع هذا الهدف للأمام؟"
                      rows={3}
                      value={activityDraft}
                    />
                  </label>
                  <button type="submit">
                    <CirclePlus size={18} />
                    تسجيل النشاط
                  </button>
                </form>

                <div className="activity-list">
                  {selectedGoal.activities.map((item) => (
                    <article className="activity-item" key={item.id}>
                      <div>
                        <strong>{item.author}</strong>
                        <span>{formatDate(item.date)}</span>
                      </div>
                      <p>{item.text}</p>
                    </article>
                  ))}
                  {selectedGoal.activities.length === 0 && (
                    <p className="empty-state">لم يتم تسجيل أي أنشطة بعد.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">أنشئ هدفا للبدء.</p>
            )}
          </section>
        </section>

        <section className="lower-grid">
          {canManageGoals && (
            <>
              <section className="panel create-panel">
                <div className="panel-title">
                  <div>
                    <h2>إنشاء هدف</h2>
                    <p>يمكن للمدير إضافة هدف وتعيينه للموظف المناسب.</p>
                  </div>
                  <CirclePlus size={22} />
                </div>

                <form className="goal-form" onSubmit={(event) => void createGoal(event)}>
                  <label>
                    عنوان الهدف
                    <input
                      onChange={(event) => setGoalDraft({ ...goalDraft, title: event.target.value })}
                      placeholder="مثال: إنهاء التقرير الربعي"
                      required
                      value={goalDraft.title}
                    />
                  </label>
                  <label>
                    الموظف
                    <select
                      onChange={(event) => setGoalDraft({ ...goalDraft, owner: event.target.value })}
                      required
                      value={goalDraft.owner}
                    >
                      {people.map((person) => (
                        <option key={person}>{person}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    تاريخ الاستحقاق
                    <input
                      onChange={(event) => setGoalDraft({ ...goalDraft, dueDate: event.target.value })}
                      type="date"
                      value={goalDraft.dueDate}
                    />
                  </label>
                  <label>
                    نسبة الإنجاز عند البداية
                    <input
                      max="100"
                      min="0"
                      onChange={(event) =>
                        setGoalDraft({ ...goalDraft, progress: Number(event.target.value) })
                      }
                      type="number"
                      value={goalDraft.progress}
                    />
                  </label>
                  <label className="wide-field">
                    ملاحظات
                    <textarea
                      onChange={(event) =>
                        setGoalDraft({ ...goalDraft, description: event.target.value })
                      }
                      placeholder="اكتب وصفا قصيرا وواضحا للنتيجة المطلوبة"
                      rows={3}
                      value={goalDraft.description}
                    />
                  </label>
                  <button type="submit">
                    <CirclePlus size={18} />
                    إضافة الهدف
                  </button>
                </form>
              </section>

              {canManageUsers && (
              <section className="panel create-panel">
                <div className="panel-title">
                  <div>
                    <h2>إضافة مستخدم</h2>
                    <p>أنشئ حسابا جديدا وحدد دوره في النظام.</p>
                  </div>
                  <UsersRound size={22} />
                </div>

                <form className="goal-form" onSubmit={(event) => void createEmployee(event)}>
                  <label>
                    اسم المستخدم
                    <input
                      onChange={(event) =>
                        setEmployeeDraft({ ...employeeDraft, name: event.target.value })
                      }
                      placeholder="مثال: نورة"
                      required
                      value={employeeDraft.name}
                    />
                  </label>
                  <label>
                    معرف الدخول
                    <input
                      onChange={(event) =>
                        setEmployeeDraft({ ...employeeDraft, id: event.target.value })
                      }
                      placeholder="مثال: nora"
                      value={employeeDraft.id}
                    />
                  </label>
                  <label>
                    الدور
                    <select
                      onChange={(event) =>
                        setEmployeeDraft({ ...employeeDraft, role: event.target.value as Role })
                      }
                      value={employeeDraft.role}
                    >
                      <option value="employee">موظف</option>
                      <option value="manager">مدير</option>
                      <option value="super_admin">مشرف عام</option>
                    </select>
                  </label>
                  <label>
                    رمز PIN
                    <input
                      inputMode="numeric"
                      minLength={4}
                      onChange={(event) =>
                        setEmployeeDraft({ ...employeeDraft, pin: event.target.value })
                      }
                      placeholder="مثال: 7777"
                      required
                      type="password"
                      value={employeeDraft.pin}
                    />
                  </label>
                  <button type="submit">
                    <CirclePlus size={18} />
                    إضافة المستخدم
                  </button>
                </form>
              </section>
              )}
            </>
          )}

          {canManageUsers && (
            <section className="panel feed-panel">
              <div className="panel-title">
                <div>
                  <h2>إدارة النظام</h2>
                  <p>صلاحيات المشرف العام للنسخ الاحتياطي والاستعادة والتهيئة.</p>
                </div>
                <DatabaseBackup size={22} />
              </div>
              <div className="admin-actions">
                <button onClick={() => void downloadBackup()} type="button">
                  <Download size={18} />
                  تنزيل نسخة احتياطية
                </button>
                <label>
                  <Upload size={18} />
                  استعادة من ملف
                  <input accept="application/json" onChange={(event) => void restoreBackup(event)} type="file" />
                </label>
                <button className="danger-admin-action" onClick={() => void resetDemoData()} type="button">
                  <Sparkles size={18} />
                  تهيئة التطبيق
                </button>
              </div>
            </section>
          )}

          {canManageUsers && (
            <section className="panel feed-panel">
              <div className="panel-title">
                <div>
                  <h2>المستخدمون والصلاحيات</h2>
                  <p>غيّر دور أي مستخدم مع الحفاظ على وجود مشرف عام واحد على الأقل.</p>
                </div>
                <UsersRound size={22} />
              </div>

              <div className="user-list">
                {employees.map((employee) => (
                  <article className={employee.active ? 'user-row' : 'user-row inactive'} key={employee.id}>
                    <div>
                      <strong>{employee.name}</strong>
                      <span>{employee.id} · {employee.active ? 'نشط' : 'غير نشط'}</span>
                    </div>
                    <select
                      onChange={(event) => void updateUserRole(employee.id, event.target.value as Role)}
                      value={employee.role}
                    >
                      <option value="employee">موظف</option>
                      <option value="manager">مدير</option>
                      <option value="super_admin">مشرف عام</option>
                    </select>
                    <button
                      className={employee.active ? 'deactivate-button' : 'activate-button'}
                      onClick={() => void toggleUserActive(employee)}
                      type="button"
                    >
                      {employee.active ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {canManageUsers && (
            <section className="panel feed-panel">
              <div className="panel-title">
                <div>
                  <h2>سجل التدقيق</h2>
                  <p>آخر العمليات المهمة داخل النظام.</p>
                </div>
                <ClipboardList size={22} />
              </div>

              <div className="audit-list">
                {auditLog.map((entry) => (
                  <article className="audit-row" key={entry.id}>
                    <div>
                      <strong>{auditLabel(entry.action)}</strong>
                      <span>{entry.target}</span>
                    </div>
                    <p>
                      {entry.actorName} · {formatDateTime(entry.date)}
                    </p>
                  </article>
                ))}
                {auditLog.length === 0 && <p className="empty-state">لا توجد عمليات مسجلة بعد.</p>}
              </div>
            </section>
          )}

          <section className="panel feed-panel">
            <div className="panel-title">
              <div>
                <h2>آخر الأنشطة</h2>
                <p>خط زمني سريع لما يحدث على مستوى الأهداف.</p>
              </div>
              <Activity size={22} />
            </div>

            <div className="feed-list">
              {latestActivities.map((item) => (
                <article className="feed-item" key={item.id}>
                  <span>{item.goalTitle}</span>
                  <strong>{item.text}</strong>
                  <p>
                    {item.author} · {formatDate(item.date)}
                  </p>
                </article>
              ))}
              {latestActivities.length === 0 && <p className="empty-state">لا توجد أنشطة بعد.</p>}
            </div>
          </section>
        </section>
      </section>
      )}

      {isGuideOpen && <GuideModal onClose={() => setIsGuideOpen(false)} role={role} />}
      {isNotificationsOpen && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setIsNotificationsOpen(false)}
          onMarkAllRead={() => void markAllNotificationsRead()}
          onMarkRead={(id) => void markNotificationRead(id)}
        />
      )}
    </main>
  )
}

function GeneralDashboard({
  activeEmployees,
  metrics,
  notifications,
  onOpenModule,
  recentActivities,
  role,
}: {
  activeEmployees: number
  metrics: { average: number; completed: number; atRisk: number; total: number; activities: number }
  notifications: NotificationItem[]
  onOpenModule: (module: ModuleView) => void
  recentActivities: Array<ActivityItem & { goalTitle: string }>
  role: Role
}) {
  const unreadNotifications = notifications.filter((notification) => !notification.read)

  return (
    <section className="workspace hub-workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">لوحة المعلومات العامة · {roleLabel(role)}</p>
          <h1>كل ما يحتاجه فريقك في مساحة تشغيل واحدة واضحة.</h1>
        </div>
      </header>

      <section className="metric-grid" aria-label="الملخص العام">
        <MetricCard icon={<UsersRound />} label="الموظفون النشطون" value={activeEmployees.toString()} />
        <MetricCard icon={<ClipboardList />} label="إجمالي الأهداف" value={metrics.total.toString()} />
        <MetricCard icon={<BarChart3 />} label="متوسط إنجاز الأهداف" value={`${metrics.average}%`} />
        <MetricCard icon={<Bell />} label="تنبيهات غير مقروءة" value={unreadNotifications.length.toString()} />
      </section>

      <section className="hub-module-grid" aria-label="وحدات النظام">
        <button className="hub-module-card" onClick={() => onOpenModule('goals')} type="button">
          <div className="hub-module-icon goals-module-icon">
            <ClipboardList size={24} />
          </div>
          <div>
            <span>وحدة فعالة</span>
            <h2>مسار الأهداف</h2>
            <p>إدارة أهداف الفريق، الأنشطة، نسب الإنجاز، والتقارير.</p>
          </div>
          <div className="module-stats">
            <strong>{metrics.total} أهداف</strong>
            <strong>{metrics.atRisk} بحاجة لمتابعة</strong>
          </div>
        </button>

        <button className="hub-module-card iqama-module-card" onClick={() => onOpenModule('iqama')} type="button">
          <div className="hub-module-icon iqama-module-icon">
            <IdCard size={24} />
          </div>
          <div>
            <span>قيد التطوير</span>
            <h2>متابعة الإقامات</h2>
            <p>متابعة تواريخ انتهاء الإقامات، التجديدات، والتنبيهات المهمة.</p>
          </div>
          <div className="module-stats">
            <strong>جاهز للمرحلة التالية</strong>
          </div>
        </button>
      </section>

      <section className="hub-summary-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>تنبيهات تحتاج انتباها</h2>
              <p>ملخص موحد لأهم ما يحتاج متابعة عبر الوحدات.</p>
            </div>
            <Bell size={22} />
          </div>
          <div className="hub-alert-list">
            {metrics.atRisk > 0 && (
              <button onClick={() => onOpenModule('goals')} type="button">
                <span className="hub-alert-dot warning-dot" />
                <div>
                  <strong>{metrics.atRisk} هدف بحاجة لمتابعة</strong>
                  <p>افتح مسار الأهداف لمراجعة التفاصيل.</p>
                </div>
              </button>
            )}
            {unreadNotifications.slice(0, 4).map((notification) => (
              <article key={notification.id}>
                <span className="hub-alert-dot info-dot" />
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>
              </article>
            ))}
            {metrics.atRisk === 0 && unreadNotifications.length === 0 && (
              <p className="empty-state">لا توجد تنبيهات عاجلة حاليا.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>آخر أنشطة الفريق</h2>
              <p>أحدث الحركات المسجلة في الوحدات الحالية.</p>
            </div>
            <Activity size={22} />
          </div>
          <div className="feed-list">
            {recentActivities.slice(0, 5).map((item) => (
              <article className="feed-item" key={item.id}>
                <span>{item.goalTitle}</span>
                <strong>{item.text}</strong>
                <p>{item.author} · {formatDate(item.date)}</p>
              </article>
            ))}
            {recentActivities.length === 0 && <p className="empty-state">لا توجد أنشطة مسجلة بعد.</p>}
          </div>
        </section>
      </section>
    </section>
  )
}

function IqamaModulePlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <section className="workspace hub-workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">وحدة جديدة</p>
          <h1>متابعة الإقامات</h1>
        </div>
        <button className="soft-button" onClick={onBack} type="button">
          <LayoutDashboard size={18} />
          العودة للوحة المعلومات
        </button>
      </header>

      <section className="panel iqama-placeholder">
        <div className="hub-module-icon iqama-module-icon">
          <IdCard size={28} />
        </div>
        <h2>الأساس جاهز، والخطوة التالية هي بيانات الإقامات.</h2>
        <p>
          سنضيف سجلات الموظفين، تواريخ الانتهاء، حالات التجديد، التنبيهات، والصلاحيات الخاصة بهذه الوحدة.
        </p>
        <div className="placeholder-status-grid">
          <span>ساري</span>
          <span>ينتهي قريبا</span>
          <span>منتهي</span>
        </div>
      </section>
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <article className="metric-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function GuideModal({ onClose, role }: { onClose: () => void; role: Role }) {
  const guide = roleGuides[role]

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="panel-title">
          <div>
            <h2 id="guide-title">{guide.title}</h2>
            <p>{guide.intro}</p>
          </div>
          <button className="modal-close-button" onClick={onClose} type="button" aria-label="إغلاق الدليل">
            إغلاق
          </button>
        </div>

        <div className="guide-grid">
          <div>
            <h3>كيف تستخدم التطبيق؟</h3>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3>نصائح سريعة</h3>
            <ul>
              {guide.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

function NotificationsModal({
  notifications,
  onClose,
  onMarkAllRead,
  onMarkRead,
}: {
  notifications: NotificationItem[]
  onClose: () => void
  onMarkAllRead: () => void
  onMarkRead: (id: number) => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="guide-modal notifications-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
        <div className="panel-title">
          <div>
            <h2 id="notifications-title">الإشعارات</h2>
            <p>آخر التنبيهات المهمة المرتبطة بدورك ومهامك.</p>
          </div>
          <div className="modal-actions-inline">
            <button className="modal-close-button secondary-modal-button" onClick={onMarkAllRead} type="button">
              تعليم الكل كمقروء
            </button>
            <button className="modal-close-button" onClick={onClose} type="button">
              إغلاق
            </button>
          </div>
        </div>

        <div className="notifications-list">
          {notifications.map((notification) => (
            <article className={notification.read ? 'notification-item read' : 'notification-item'} key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <span>{formatDateTime(notification.date)}</span>
              </div>
              {!notification.read && (
                <button onClick={() => onMarkRead(notification.id)} type="button">
                  مقروء
                </button>
              )}
            </article>
          ))}
          {notifications.length === 0 && <p className="empty-state">لا توجد إشعارات حاليا.</p>}
        </div>
      </section>
    </div>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="progress-track" aria-hidden="true">
      <span style={{ width: `${progress}%` }} />
    </div>
  )
}

function StatusPill({ status }: { status: GoalStatus }) {
  return <span className={`status-pill ${statusClass(status)}`}>{statusLabels[status]}</span>
}

function getDueInfo(goal: Goal) {
  if (goal.status === 'completed') {
    return { className: 'due-complete', label: 'مكتمل' }
  }

  const today = startOfDay(new Date())
  const dueDate = startOfDay(new Date(`${goal.dueDate}T00:00:00`))
  const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) {
    return { className: 'due-overdue', label: `متأخر ${Math.abs(days)} يوم` }
  }

  if (days === 0) {
    return { className: 'due-today', label: 'مستحق اليوم' }
  }

  if (days <= 7) {
    return { className: 'due-soon', label: `باقي ${days} يوم` }
  }

  return { className: 'due-normal', label: `باقي ${days} يوم` }
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function statusClass(status: GoalStatus) {
  return {
    not_started: 'not-started',
    in_progress: 'in-progress',
    at_risk: 'at-risk',
    completed: 'completed',
  }[status]
}

function statusFromProgress(progress: number, fallback: GoalStatus = 'in_progress'): GoalStatus {
  if (progress <= 0) return 'not_started'
  if (progress >= 100) return 'completed'
  if (fallback === 'at_risk') return 'at_risk'
  return 'in_progress'
}

function roleLabel(role: Role) {
  return {
    super_admin: 'مشرف عام',
    manager: 'مدير',
    employee: 'موظف',
  }[role]
}

function auditLabel(action: string) {
  return {
    login: 'تسجيل دخول',
    create_user: 'إنشاء مستخدم',
    update_user: 'تعديل مستخدم',
    create_goal: 'إنشاء هدف',
    update_goal: 'تعديل هدف',
    delete_goal: 'حذف هدف',
    add_activity: 'إضافة نشاط',
    backup_data: 'نسخة احتياطية',
    restore_data: 'استعادة بيانات',
    reset_data: 'تهيئة البيانات',
  }[action] ?? action
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-SA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ar-SA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number) {
  const text = String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem('team-goals.session')
    return raw ? (JSON.parse(raw) as LoginResponse) : null
  } catch {
    return null
  }
}

async function api<T = void>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new ApiError(response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

class ApiError extends Error {
  status: number

  constructor(status: number) {
    super(`Request failed: ${status}`)
    this.status = status
  }
}

export default App
