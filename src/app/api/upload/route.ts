import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as xlsx from 'xlsx'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// ============ Rate Limiting Configuration ============
const UPLOAD_RATE_LIMIT = {
  limit: 10,           // 10 طلبات رفع
  windowMs: 60000,      // خلال دقيقة واحدة
  blockDuration: 300   // حظر 5 دقائق عند التجاوز
}

// ============ File Validation ============
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function validateFile(file: File): { valid: boolean; error?: string } {
  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))

  if (!hasValidExtension) {
    return { valid: false, error: 'نوع الملف غير مسموح. الأنواع المسموحة: XLSX, XLS' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `حجم الملف كبير جداً. الحد الأقصى: ${MAX_FILE_SIZE / 1024 / 1024}MB` }
  }

  return { valid: true }
}

// ============ Security Validation ============
function sanitizeSystem(system: string | null): string | null {
  if (!system) return null

  const allowedSystems = [
    'hoz', 'mwsal',
    'life_saving', 'narcotic', 'vaccine', 'strategic',
    'smoking', 'kidney', 'central'
  ]

  return allowedSystems.includes(system) ? system : null
}

// دالة لإنشاء الجداول إذا لم تكن موجودة
async function ensureDatabaseTables() {
  // InventoryItem table
  try {
    await db.$queryRaw`SELECT 1 FROM "InventoryItem" LIMIT 1`
    // التحقق من الأعمدة الجديدة
    const columns = await db.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'InventoryItem'
    `
    const columnNames = columns.map(c => c.column_name)
    
    if (!columnNames.includes('isSmoking')) {
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSmoking" BOOLEAN NOT NULL DEFAULT false`
    }
    if (!columnNames.includes('isKidney')) {
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isKidney" BOOLEAN NOT NULL DEFAULT false`
    }
    if (!columnNames.includes('isCentral')) {
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isCentral" BOOLEAN NOT NULL DEFAULT false`
    }
  } catch {
    console.log('Creating InventoryItem table...')
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "InventoryItem" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        system TEXT NOT NULL,
        "genericItemNumber" TEXT,
        "genericItemDescription" TEXT,
        "tradeItemNumber" TEXT,
        "customerItemNumber" TEXT,
        "totalQty" DOUBLE PRECISION DEFAULT 0,
        "holdQty" DOUBLE PRECISION DEFAULT 0,
        "availableQty" DOUBLE PRECISION DEFAULT 0,
        "expiryDate" TEXT,
        "daysToExpire" DOUBLE PRECISION DEFAULT 0,
        hold TEXT,
        "holdType" TEXT,
        "isLifeSaving" BOOLEAN DEFAULT false,
        "isNarcotic" BOOLEAN DEFAULT false,
        "isVaccine" BOOLEAN DEFAULT false,
        "isStrategic" BOOLEAN DEFAULT false,
        "isSmoking" BOOLEAN DEFAULT false,
        "isKidney" BOOLEAN DEFAULT false,
        "isCentral" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_system_idx" ON "InventoryItem" (system)`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_daysToExpire_idx" ON "InventoryItem" ("daysToExpire")`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_genericItemNumber_idx" ON "InventoryItem" ("genericItemNumber")`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_customerItemNumber_idx" ON "InventoryItem" ("customerItemNumber")`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_tradeItemNumber_idx" ON "InventoryItem" ("tradeItemNumber")`
  }

  // LifeSavingItem table
  try { await db.$queryRaw`SELECT 1 FROM "LifeSavingItem" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "LifeSavingItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "LifeSavingItem_itemNumber_idx" ON "LifeSavingItem" ("itemNumber")`
  }

  // NarcoticItem table
  try { await db.$queryRaw`SELECT 1 FROM "NarcoticItem" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "NarcoticItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "NarcoticItem_itemNumber_idx" ON "NarcoticItem" ("itemNumber")`
  }

  // VaccineItem table
  try { await db.$queryRaw`SELECT 1 FROM "VaccineItem" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "VaccineItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "VaccineItem_itemNumber_idx" ON "VaccineItem" ("itemNumber")`
  }

  // StrategicItem table
  try { await db.$queryRaw`SELECT 1 FROM "StrategicItem" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "StrategicItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "StrategicItem_itemNumber_idx" ON "StrategicItem" ("itemNumber")`
  }

  // SmokingItem table (جديد)
  try { await db.$queryRaw`SELECT 1 FROM "SmokingItem" LIMIT 1` } catch {
    console.log('Creating SmokingItem table...')
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "SmokingItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "SmokingItem_itemNumber_idx" ON "SmokingItem" ("itemNumber")`
  }

  // KidneyItem table (جديد)
  try { await db.$queryRaw`SELECT 1 FROM "KidneyItem" LIMIT 1` } catch {
    console.log('Creating KidneyItem table...')
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "KidneyItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "KidneyItem_itemNumber_idx" ON "KidneyItem" ("itemNumber")`
  }

  // CentralItem table (جديد)
  try { await db.$queryRaw`SELECT 1 FROM "CentralItem" LIMIT 1` } catch {
    console.log('Creating CentralItem table...')
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "CentralItem" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "itemNumber" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW())`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "CentralItem_itemNumber_idx" ON "CentralItem" ("itemNumber")`
  }

  // VisitorLog table
  try { await db.$queryRaw`SELECT 1 FROM "VisitorLog" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "VisitorLog" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "sessionId" TEXT NOT NULL, page TEXT NOT NULL, system TEXT, "visitedAt" TIMESTAMP NOT NULL DEFAULT NOW(), "ipAddress" TEXT)`
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "VisitorLog_visitedAt_idx" ON "VisitorLog" ("visitedAt")`
  }

  // UploadLog table
  try { await db.$queryRaw`SELECT 1 FROM "UploadLog" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "UploadLog" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "fileName" TEXT NOT NULL, system TEXT NOT NULL, "recordsCount" INTEGER DEFAULT 0, "createdAt" TIMESTAMP DEFAULT NOW())`
  }

  // AdminSession table
  try { await db.$queryRaw`SELECT 1 FROM "AdminSession" LIMIT 1` } catch {
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "AdminSession" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), token TEXT UNIQUE NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW(), "expiresAt" TIMESTAMP NOT NULL)`
  }

  console.log('All tables verified/created successfully')
}

function parseExcelDate(value: any): Date | null {
  if (!value) return null
  if (typeof value === 'number') {
    const d = new Date(1899, 11, 30)
    return new Date(d.getTime() + value * 24 * 60 * 60 * 1000)
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) return parsed
  }
  return null
}

function calculateDaysFromBBD(bbd: any): number {
  if (!bbd) return 999
  const expiry = parseExcelDate(bbd)
  if (!expiry) return 999
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(bbd: any): string | null {
  if (!bbd) return null
  const date = parseExcelDate(bbd)
  if (!date) return bbd?.toString() || null
  return date.toISOString().split('T')[0]
}

function safeString(value: any): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

async function parseExcel(buffer: Buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName])
}

async function checkAuth() {
  try {
    const cookieStore = await import('next/headers').then(m => m.cookies())
    const cookies = await cookieStore
    return !!cookies.get('admin_session')?.value
  } catch {
    return false
  }
}

// Helper function to process special items list
async function processSpecialItems(
  system: string,
  data: any[],
  model: string,
  fieldName: string
) {
  // 1. إعادة تعيين جميع البنود لهذا التصنيف إلى false
  await db.inventoryItem.updateMany({
    data: { [fieldName]: false }
  })
  
  // 2. حذف الجدول القديم
  await (db as any)[model].deleteMany()
  
  const insertedItems = new Set<string>()
  let recordsCount = 0
  
  for (const row of data) {
    const genericNum = safeString(row['Generic Item Number'])
    const customerCode = safeString(row['Customer Item Code'])
    
    if (genericNum && !insertedItems.has(genericNum)) {
      await (db as any)[model].create({ data: { itemNumber: genericNum } })
      insertedItems.add(genericNum)
      recordsCount++
    }
    if (customerCode && !insertedItems.has(customerCode)) {
      await (db as any)[model].create({ data: { itemNumber: customerCode } })
      insertedItems.add(customerCode)
    }
  }

  // 3. تحديث البنود الموجودة فقط
  const allNumbers = Array.from(insertedItems)
  if (allNumbers.length > 0) {
    await db.inventoryItem.updateMany({
      where: {
        OR: [
          { genericItemNumber: { in: allNumbers } },
          { customerItemNumber: { in: allNumbers } },
          { tradeItemNumber: { in: allNumbers } }
        ]
      },
      data: { [fieldName]: true }
    })
  }
  
  return recordsCount
}

export async function POST(request: NextRequest) {
  try {
    // ============ 1. Rate Limiting ============
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') || 'unknown'

    const rateLimitResult = checkRateLimit(`upload:${clientIp}`, UPLOAD_RATE_LIMIT)

    if (!rateLimitResult.success) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`)
      return rateLimitResponse(rateLimitResult)
    }

    await ensureDatabaseTables()

    const isAuth = await checkAuth()
    if (!isAuth) {
      return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const system = formData.get('system') as string

    if (!file || !system) {
      return NextResponse.json({ error: 'الملف والنظام مطلوبان' }, { status: 400 })
    }

    // ============ 2. التحقق من النظام ============
    const sanitizedSystem = sanitizeSystem(system)
    if (!sanitizedSystem) {
      return NextResponse.json({ error: 'نظام غير صالح' }, { status: 400 })
    }

    // ============ 3. التحقق من الملف ============
    const fileValidation = validateFile(file)
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await parseExcel(buffer)
    let recordsCount = 0

    console.log('Upload started:', { system: sanitizedSystem, fileName: file.name, rows: (data as any[]).length })

    if (sanitizedSystem === 'hoz' || sanitizedSystem === 'mwsal') {
      await db.inventoryItem.deleteMany({ where: { system: sanitizedSystem } })

      // Get all special items lists
      const [lifeSaving, narcotic, vaccine, strategic, smoking, kidney, central] = await Promise.all([
        db.lifeSavingItem.findMany().catch(() => []),
        db.narcoticItem.findMany().catch(() => []),
        db.vaccineItem.findMany().catch(() => []),
        db.strategicItem.findMany().catch(() => []),
        db.$queryRaw<any[]>`SELECT * FROM "SmokingItem"`.catch(() => []),
        db.$queryRaw<any[]>`SELECT * FROM "KidneyItem"`.catch(() => []),
        db.$queryRaw<any[]>`SELECT * FROM "CentralItem"`.catch(() => []),
      ])

      const lifeSavingSet = new Set(lifeSaving.map(i => i.itemNumber))
      const narcoticSet = new Set(narcotic.map(i => i.itemNumber))
      const vaccineSet = new Set(vaccine.map(i => i.itemNumber))
      const strategicSet = new Set(strategic.map(i => i.itemNumber))
      const smokingSet = new Set(smoking.map(i => i.itemNumber))
      const kidneySet = new Set(kidney.map(i => i.itemNumber))
      const centralSet = new Set(central.map(i => i.itemNumber))

      const items = (data as any[]).map(row => {
        const genericNum = safeString(row['Generic Item Number'])
        const tradeNum = safeString(row['Trade Item Number'])
        const customerCode = safeString(row['Customer Item Code'])
        
        const totalQty = parseFloat(row['Total Qty']) || 0
        const availQty = parseFloat(row['Avail Qty']) || 0
        
        const holdValue = safeString(row['Hold'])
        const holdType = safeString(row['Hold Type'])
        const isOnHold = holdValue?.toUpperCase() === 'YES'
        const holdQty = isOnHold ? (totalQty - availQty > 0 ? totalQty - availQty : totalQty) : 0

        const bbd = row['BBD']
        const expiryDate = formatDate(bbd)
        const daysToExpire = calculateDaysFromBBD(bbd)

        return {
          system: sanitizedSystem,
          genericItemNumber: genericNum,
          genericItemDescription: safeString(row['Generic Item description']),
          tradeItemNumber: tradeNum,
          customerItemNumber: customerCode,
          totalQty,
          holdQty,
          availableQty: availQty,
          expiryDate,
          daysToExpire,
          hold: holdValue,
          holdType: isOnHold ? holdType : null,
          isLifeSaving: lifeSavingSet.has(genericNum || '') || lifeSavingSet.has(customerCode || '') || lifeSavingSet.has(tradeNum || ''),
          isNarcotic: narcoticSet.has(genericNum || '') || narcoticSet.has(customerCode || '') || narcoticSet.has(tradeNum || ''),
          isVaccine: vaccineSet.has(genericNum || '') || vaccineSet.has(customerCode || '') || vaccineSet.has(tradeNum || ''),
          isStrategic: strategicSet.has(genericNum || '') || strategicSet.has(customerCode || '') || strategicSet.has(tradeNum || ''),
          isSmoking: smokingSet.has(genericNum || '') || smokingSet.has(customerCode || '') || smokingSet.has(tradeNum || ''),
          isKidney: kidneySet.has(genericNum || '') || kidneySet.has(customerCode || '') || kidneySet.has(tradeNum || ''),
          isCentral: centralSet.has(genericNum || '') || centralSet.has(customerCode || '') || centralSet.has(tradeNum || ''),
        }
      })

      const batchSize = 500
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await db.inventoryItem.createMany({ data: batch })
      }
      recordsCount = items.length

    } else if (sanitizedSystem === 'life_saving') {
      recordsCount = await processSpecialItems(sanitizedSystem, data as any[], 'lifeSavingItem', 'isLifeSaving')
    } else if (sanitizedSystem === 'narcotic') {
      recordsCount = await processSpecialItems(sanitizedSystem, data as any[], 'narcoticItem', 'isNarcotic')
    } else if (sanitizedSystem === 'vaccine') {
      recordsCount = await processSpecialItems(sanitizedSystem, data as any[], 'vaccineItem', 'isVaccine')
    } else if (sanitizedSystem === 'strategic') {
      recordsCount = await processSpecialItems(sanitizedSystem, data as any[], 'strategicItem', 'isStrategic')
    } else if (sanitizedSystem === 'smoking') {
      // بنود التدخين
      // 1. إعادة تعيين جميع البنود إلى غير تدخين
      await db.inventoryItem.updateMany({
        data: { isSmoking: false }
      })
      
      // 2. حذف الجدول القديم
      await db.$executeRaw`DELETE FROM "SmokingItem"`
      
      const rows = data as any[]
      const insertedItems = new Set<string>()
      
      for (const row of rows) {
        const genericNum = safeString(row['Generic Item Number'])
        const customerCode = safeString(row['Customer Item Code'])
        
        if (genericNum && !insertedItems.has(genericNum)) {
          await db.$executeRaw`INSERT INTO "SmokingItem" (id, "itemNumber", "createdAt") VALUES (gen_random_uuid(), ${genericNum}, NOW())`
          insertedItems.add(genericNum)
          recordsCount++
        }
        if (customerCode && !insertedItems.has(customerCode)) {
          await db.$executeRaw`INSERT INTO "SmokingItem" (id, "itemNumber", "createdAt") VALUES (gen_random_uuid(), ${customerCode}, NOW())`
          insertedItems.add(customerCode)
        }
      }

      // 3. تحديث البنود الموجودة فقط
      const allNumbers = Array.from(insertedItems)
      if (allNumbers.length > 0) {
        await db.inventoryItem.updateMany({
          where: {
            OR: [
              { genericItemNumber: { in: allNumbers } },
              { customerItemNumber: { in: allNumbers } },
              { tradeItemNumber: { in: allNumbers } }
            ]
          },
          data: { isSmoking: true }
        })
      }
    } else if (sanitizedSystem === 'kidney') {
      // بنود الكلى
      // 1. إعادة تعيين جميع البنود إلى غير كلى
      await db.inventoryItem.updateMany({
        data: { isKidney: false }
      })
      
      // 2. حذف الجدول القديم
      await db.$executeRaw`DELETE FROM "KidneyItem"`
      
      const rows = data as any[]
      const insertedItems = new Set<string>()
      
      for (const row of rows) {
        const genericNum = safeString(row['Generic Item Number'])
        const customerCode = safeString(row['Customer Item Code'])
        
        if (genericNum && !insertedItems.has(genericNum)) {
          await db.$executeRaw`INSERT INTO "KidneyItem" (id, "itemNumber", "createdAt") VALUES (gen_random_uuid(), ${genericNum}, NOW())`
          insertedItems.add(genericNum)
          recordsCount++
        }
        if (customerCode && !insertedItems.has(customerCode)) {
          await db.$executeRaw`INSERT INTO "KidneyItem" (id, "itemNumber", "createdAt") VALUES (gen_random_uuid(), ${customerCode}, NOW())`
          insertedItems.add(customerCode)
        }
      }

      // 3. تحديث البنود الموجودة فقط
      const allNumbers = Array.from(insertedItems)
      if (allNumbers.length > 0) {
        await db.inventoryItem.updateMany({
          where: {
            OR: [
              { genericItemNumber: { in: allNumbers } },
              { customerItemNumber: { in: allNumbers } },
              { tradeItemNumber: { in: allNumbers } }
            ]
          },
          data: { isKidney: true }
        })
      }
    } else if (sanitizedSystem === 'central') {
      // البنود المركزية
      // 1. إعادة تعيين جميع البنود إلى غير مركزية
      await db.inventoryItem.updateMany({
        data: { isCentral: false }
      })
      
      // 2. حذف الجدول القديم
      await db.$executeRaw`DELETE FROM "CentralItem"`
      
      const rows = data as any[]
      const insertedItems = new Set<string>()
      
      for (const row of rows) {
        const genericNum = safeString(row['Generic Item Number'])
        const customerCode = safeString(row['Customer Item Code'])
        
        if (genericNum && !insertedItems.has(genericNum)) {
          await db.$executeRaw`INSERT INTO "CentralItem" (id, "itemNumber", "createdAt") VALUES (gen_random_uuid(), ${genericNum}, NOW())`
          insertedItems.add(genericNum)
          recordsCount++
        }
        if (customerCode && !insertedItems.has(customerCode)) {
          await db.$executeRaw`INSERT INTO "CentralItem" (id, "itemNumber", "createdAt") VALUES (gen_random_uuid(), ${customerCode}, NOW())`
          insertedItems.add(customerCode)
        }
      }

      // 3. تحديث البنود الموجودة فقط
      const allNumbers = Array.from(insertedItems)
      if (allNumbers.length > 0) {
        await db.inventoryItem.updateMany({
          where: {
            OR: [
              { genericItemNumber: { in: allNumbers } },
              { customerItemNumber: { in: allNumbers } },
              { tradeItemNumber: { in: allNumbers } }
            ]
          },
          data: { isCentral: true }
        })
      }
    }

    await db.uploadLog.create({
      data: { fileName: file.name, system: sanitizedSystem, recordsCount }
    }).catch(() => {})

    console.log('Upload completed:', { system: sanitizedSystem, recordsCount })

    return NextResponse.json({ 
      success: true, 
      message: `تم رفع ${recordsCount} سجل بنجاح`,
      recordsCount 
    })

  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء رفع الملف', 
      details: e.message 
    }, { status: 500 })
  }
}
