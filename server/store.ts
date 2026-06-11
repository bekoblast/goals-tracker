import { mkdir, readFile, writeFile } from 'node:fs/promises'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type AppData, seedData } from './seed.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(rootDir, 'data')
const dataFile = path.join(dataDir, 'goals.json')

export async function readData(): Promise<AppData> {
  await ensureDataFile()
  const raw = await readFile(dataFile, 'utf8')
  return normalizeData(JSON.parse(raw) as AppData)
}

export async function writeData(data: AppData) {
  await mkdir(dataDir, { recursive: true })
  await writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function resetData() {
  await writeData(seedData)
  return seedData
}

async function ensureDataFile() {
  try {
    await readFile(dataFile, 'utf8')
  } catch {
    await writeData(seedData)
  }
}

function normalizeData(data: AppData): AppData {
  const seedEmployeesById = new Map(seedData.employees.map((employee) => [employee.id, employee]))
  const employees = data.employees.map((employee) => {
    const legacyPin = (employee as typeof employee & { pin?: string }).pin
    return {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      pinHash:
        employee.pinHash ??
        hashLegacyPin(legacyPin) ??
        seedEmployeesById.get(employee.id)?.pinHash ??
        bcrypt.hashSync('0000', 10),
      active: employee.active ?? true,
    }
  })

  for (const seedEmployee of seedData.employees) {
    if (!employees.some((employee) => employee.id === seedEmployee.id)) {
      employees.unshift(seedEmployee)
    }
  }

  const iqamaRecords = (data.iqamaRecords ?? []).map((record) => ({
    ...record,
    renewalHistory: record.renewalHistory ?? [],
    alertedThresholds: record.alertedThresholds ?? [],
  }))

  return {
    ...data,
    employees,
    iqamaRecords,
    auditLog: data.auditLog ?? [],
    sessions: data.sessions ?? [],
    notifications: data.notifications ?? [],
    settings: {
      iqamaAlertDays: data.settings?.iqamaAlertDays ?? seedData.settings.iqamaAlertDays,
    },
  }
}

function hashLegacyPin(pin?: string) {
  return pin ? bcrypt.hashSync(pin, 10) : undefined
}
