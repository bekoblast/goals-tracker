import bcrypt from 'bcryptjs'

export type Role = 'super_admin' | 'manager' | 'employee'
export type GoalStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed'

export type Employee = {
  id: string
  name: string
  role: Role
  pinHash: string
  active: boolean
}

export type AuditEntry = {
  id: number
  actorId: string
  actorName: string
  action: string
  target: string
  date: string
}

export type NotificationRecord = {
  id: number
  userId: string
  title: string
  message: string
  date: string
  read: boolean
  type: string
}

export type ActivityItem = {
  id: number
  text: string
  author: string
  date: string
}

export type Goal = {
  id: number
  title: string
  owner: string
  dueDate: string
  progress: number
  status: GoalStatus
  description: string
  activities: ActivityItem[]
}

export type AppData = {
  employees: Employee[]
  goals: Goal[]
  auditLog: AuditEntry[]
  sessions: SessionRecord[]
  notifications: NotificationRecord[]
}

export type SessionRecord = {
  id: string
  userId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
  remember: boolean
}

export const seedData: AppData = {
  employees: [
    { id: 'admin', name: 'المشرف العام', role: 'super_admin', pinHash: hashSeedPin('0000'), active: true },
    { id: 'manager', name: 'المدير', role: 'manager', pinHash: hashSeedPin('1111'), active: true },
    { id: 'amina', name: 'أمينة', role: 'employee', pinHash: hashSeedPin('2222'), active: true },
    { id: 'omar', name: 'عمر', role: 'employee', pinHash: hashSeedPin('3333'), active: true },
    { id: 'sara', name: 'سارة', role: 'employee', pinHash: hashSeedPin('4444'), active: true },
    { id: 'khalid', name: 'خالد', role: 'employee', pinHash: hashSeedPin('5555'), active: true },
    { id: 'maya', name: 'مايا', role: 'employee', pinHash: hashSeedPin('6666'), active: true },
  ],
  goals: [
    {
      id: 1,
      title: 'إطلاق آلية متابعة العملاء',
      owner: 'أمينة',
      dueDate: '2026-06-15',
      progress: 72,
      status: 'in_progress',
      description: 'إنشاء آلية أسبوعية بسيطة لمتابعة طلبات العملاء النشطة.',
      activities: [
        {
          id: 101,
          text: 'تم تجهيز قائمة العملاء وتصنيف الطلبات حسب الأولوية.',
          author: 'أمينة',
          date: '2026-05-08',
        },
        {
          id: 102,
          text: 'راجع المدير الآلية وطلب إضافة خطوة تسليم واضحة.',
          author: 'المدير',
          date: '2026-05-09',
        },
      ],
    },
    {
      id: 2,
      title: 'تجهيز تقرير الأداء الشهري',
      owner: 'عمر',
      dueDate: '2026-05-30',
      progress: 45,
      status: 'in_progress',
      description: 'جمع أرقام الفريق وتجهيز ملخص قصير جاهز للمدير.',
      activities: [
        {
          id: 201,
          text: 'تم جمع أرقام الأسبوع الأول من العمليات والمبيعات.',
          author: 'عمر',
          date: '2026-05-07',
        },
      ],
    },
    {
      id: 3,
      title: 'تقليل طلبات الدعم المفتوحة',
      owner: 'سارة',
      dueDate: '2026-05-20',
      progress: 28,
      status: 'at_risk',
      description: 'إغلاق أقدم طلبات الدعم وإظهار المعوقات بوضوح.',
      activities: [
        {
          id: 301,
          text: 'تم تحديد 6 طلبات متوقفة تحتاج إلى موافقة المدير.',
          author: 'سارة',
          date: '2026-05-09',
        },
      ],
    },
    {
      id: 4,
      title: 'إكمال قائمة التهيئة للموظفين الجدد',
      owner: 'مايا',
      dueDate: '2026-05-18',
      progress: 100,
      status: 'completed',
      description: 'إنهاء قائمة التهيئة للموظف الجديد والتأكد من الصلاحيات.',
      activities: [
        {
          id: 401,
          text: 'تم تأكيد جميع الصلاحيات وبنود قائمة التهيئة.',
          author: 'مايا',
          date: '2026-05-06',
        },
      ],
    },
  ],
  auditLog: [],
  sessions: [],
  notifications: [],
}

function hashSeedPin(pin: string) {
  return bcrypt.hashSync(pin, 10)
}
