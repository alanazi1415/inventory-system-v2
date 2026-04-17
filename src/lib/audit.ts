/**
 * Audit Log Utility
 * لتسجيل العمليات في النظام
 */

import { db } from './db'

export type AuditAction = 
  | 'login' 
  | 'logout' 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'upload' 
  | 'export'
  | 'approve'

export type AuditEntity = 
  | 'user' 
  | 'inventory' 
  | 'movement' 
  | 'alternatives'
  | 'delivery'
  | 'admin'
  | 'auth'

interface AuditLogData {
  userId?: string
  userRole: 'admin' | 'user'
  action: AuditAction
  entity: AuditEntity
  entityId?: string
  oldData?: any
  newData?: any
  ipAddress?: string
  userAgent?: string
  details?: string
}

/**
 * تسجيل عملية في سجل التدقيق
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: data.userId,
        userRole: data.userRole,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        oldData: data.oldData ? JSON.stringify(data.oldData) : null,
        newData: data.newData ? JSON.stringify(data.newData) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        details: data.details
      }
    })
  } catch (error) {
    // لا نريد أن يفشل التطبيق إذا فشل تسجيل السجل
    console.error('Failed to create audit log:', error)
  }
}

/**
 * الحصول على عنوان IP من الطلب
 */
export function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  return undefined
}

/**
 * الحصول على معلومات المتصفح
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * تسجيل عملية تسجيل دخول
 */
export async function logLogin(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  request: Request,
  success: boolean
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'login',
    entity: 'auth',
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details: success ? 'تم تسجيل الدخول بنجاح' : 'فشل تسجيل الدخول'
  })
}

/**
 * تسجيل عملية تسجيل خروج
 */
export async function logLogout(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  request: Request
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'logout',
    entity: 'auth',
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details: 'تم تسجيل الخروج'
  })
}

/**
 * تسجيل عملية إنشاء
 */
export async function logCreate(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  entity: AuditEntity,
  entityId: string,
  newData: any,
  request: Request,
  details?: string
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'create',
    entity,
    entityId,
    newData,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details
  })
}

/**
 * تسجيل عملية تحديث
 */
export async function logUpdate(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  entity: AuditEntity,
  entityId: string,
  oldData: any,
  newData: any,
  request: Request,
  details?: string
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'update',
    entity,
    entityId,
    oldData,
    newData,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details
  })
}

/**
 * تسجيل عملية حذف
 */
export async function logDelete(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  entity: AuditEntity,
  entityId: string,
  oldData: any,
  request: Request,
  details?: string
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'delete',
    entity,
    entityId,
    oldData,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details
  })
}

/**
 * تسجيل عملية رفع ملف
 */
export async function logUpload(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  entity: AuditEntity,
  fileName: string,
  recordsCount: number,
  request: Request
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'upload',
    entity,
    newData: { fileName, recordsCount },
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details: `تم رفع ملف: ${fileName} (${recordsCount} سجل)`
  })
}

/**
 * تسجيل عملية موافقة
 */
export async function logApprove(
  userId: string | undefined,
  userRole: 'admin' | 'user',
  entity: AuditEntity,
  entityId: string,
  request: Request,
  details?: string
): Promise<void> {
  await logAudit({
    userId,
    userRole,
    action: 'approve',
    entity,
    entityId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    details
  })
}
