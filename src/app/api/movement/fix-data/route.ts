import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// التحقق من صلاحية الأدمن
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      if (adminSession && adminSession.expiresAt > new Date()) {
        return true
      }
    }
    return false
  } catch (error) {
    console.error('Admin auth check error:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const body = await request.json()
    const system = body.system || 'mwsal'
    
    console.log(`Fixing movement data for system: ${system}`)
    
    // 1. البحث عن السجلات المكررة
    const duplicates = await db.$queryRaw<{ 
      genericItemNumber: string; 
      count: bigint 
    }[]>`
      SELECT "genericItemNumber", COUNT(*) as count
      FROM "ItemMovement"
      WHERE "system" = ${system}
      GROUP BY "genericItemNumber"
      HAVING COUNT(*) > 1
    `
    
    console.log(`Found ${duplicates.length} duplicate item numbers`)
    
    let fixedCount = 0
    let deletedCount = 0
    
    // 2. معالجة كل تكرار
    for (const dup of duplicates) {
      // جلب جميع السجلات لهذا البند
      const items = await db.itemMovement.findMany({
        where: { 
          genericItemNumber: dup.genericItemNumber,
          system 
        },
        orderBy: [
          { transactionCount: 'desc' },
          { createdAt: 'desc' }
        ]
      })
      
      if (items.length > 1) {
        // الاحتفاظ بالسجل الأفضل (أكبر عدد معاملات أو أحدث)
        const keepItem = items[0]
        const deleteIds = items.slice(1).map(i => i.id)
        
        // دمج البيانات من السجلات المحذوفة
        let mergedQty = items.reduce((sum, i) => sum + (i.totalQtyDispatched || 0), 0)
        let mergedTransactions = items.reduce((sum, i) => sum + (i.transactionCount || 0), 0)
        
        // تحديث السجل المحفوظ بالبيانات المدمجة إذا كان أفضل
        if (mergedQty > keepItem.totalQtyDispatched || mergedTransactions > keepItem.transactionCount) {
          await db.$executeRaw`
            UPDATE "ItemMovement"
            SET 
              "totalQtyDispatched" = ${mergedQty},
              "transactionCount" = ${mergedTransactions},
              "avgQtyPerTransaction" = ${mergedTransactions > 0 ? mergedQty / mergedTransactions : 0},
              "syncedFromInventory" = false,
              "updatedAt" = NOW()
            WHERE "id" = ${keepItem.id}
          `
        }
        
        // حذف السجلات المكررة
        await db.itemMovement.deleteMany({
          where: {
            id: { in: deleteIds }
          }
        })
        
        deletedCount += deleteIds.length
        fixedCount++
      }
    }
    
    // 3. إعادة تصنيف جميع البنود
    const thresholds = await db.movementThresholds.findUnique({
      where: { system }
    })
    
    const veryFastMinTransactions = thresholds?.veryFastMinTransactions || 50
    const veryFastMinQty = thresholds?.veryFastMinQty || 5000
    const fastMinTransactions = thresholds?.fastMinTransactions || 20
    const fastMinQty = thresholds?.fastMinQty || 2000
    const mediumMinTransactions = thresholds?.mediumMinTransactions || 10
    const mediumMinQty = thresholds?.mediumMinQty || 500
    const slowMinTransactions = thresholds?.slowMinTransactions || 3
    
    // تحديث التصنيفات
    const updatedClassifications = await db.$executeRaw`
      UPDATE "ItemMovement"
      SET 
        "autoMovementClass" = CASE
          WHEN "transactionCount" >= ${veryFastMinTransactions} AND "totalQtyDispatched" >= ${veryFastMinQty} THEN 'سريع جداً'
          WHEN "transactionCount" >= ${fastMinTransactions} AND "totalQtyDispatched" >= ${fastMinQty} THEN 'سريع'
          WHEN "transactionCount" >= ${mediumMinTransactions} AND "totalQtyDispatched" >= ${mediumMinQty} THEN 'متوسط'
          WHEN "transactionCount" >= ${slowMinTransactions} THEN 'بطيء'
          ELSE 'عديم الحركة'
        END,
        "movementScore" = ("transactionCount" * 10) + ("totalQtyDispatched" / 100),
        "updatedAt" = NOW()
      WHERE "system" = ${system}
    `
    
    console.log(`Updated classifications for ${updatedClassifications} items`)
    
    return NextResponse.json({
      success: true,
      message: 'تم إصلاح البيانات بنجاح',
      stats: {
        duplicatesFound: duplicates.length,
        duplicatesFixed: fixedCount,
        recordsDeleted: deletedCount,
        classificationsUpdated: updatedClassifications
      }
    })
    
  } catch (error: any) {
    console.error('Fix data error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في إصلاح البيانات',
      details: error.message
    }, { status: 500 })
  }
}
