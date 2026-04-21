/**
 * Security Audit Logger
 * نظام تسجيل الأحداث الأمنية
 * 
 * يسجل جميع العمليات الحساسة للمراجعة والتدقيق
 */

import { db } from '@/lib/db'
import { headers } from 'next/headers'
import { encrypt } from './crypto'

// أنواع الأحداث المُسجلة
export enum AuditAction {
  // أحداث المصادقة
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  SESSION_EXPIRED = 'session_expired',
  PASSWORD_CHANGE = 'password_change',
  
  // أحداث المستخدمين
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_ACTIVATED = 'user_activated',
  USER_DEACTIVATED = 'user_deactivated',
  PERMISSION_CHANGED = 'permission_changed',
  
  // أحداث المخزون
  INVENTORY_UPLOADED = 'inventory_uploaded',
  INVENTORY_DELETED = 'inventory_deleted',
  INVENTORY_EXPORTED = 'inventory_exported',
  
  // أحداث البيانات
  DATA_IMPORTED = 'data_imported',
  DATA_EXPORTED = 'data_exported',
  DATA_DELETED = 'data_deleted',
  
  // أحداث النظام
  SETTINGS_CHANGED = 'settings_changed',
  SYSTEM_ERROR = 'system_error',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // أحداث الأمان
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  CSRF_VIOLATION = 'csrf_violation'
}

// مستوى خطورة الحدث
export enum AuditSeverity {
  LOW = 'low',           // معلوماتية
  MEDIUM = 'medium',     // تحذيرية
  HIGH = 'high',         // مهمة
  CRITICAL = 'critical'  // حرجة
}

// واجهة سجل التدقيق
export interface AuditLogEntry {
  id?: string
  userId?: string
  userRole: 'admin' | 'user' | 'system'
  action: AuditAction
  entity: string
  entityId?: string
  oldData?: string
  newData?: string
  ipAddress?: string
  userAgent?: string
  severity: AuditSeverity
  details?: string
  timestamp?: Date
}

/**
 * الحصول على معلومات الطلب
 */
async function getRequestInfo(): Promise<{ ipAddress?: string; userAgent?: string }> {
  try {
    const headersList = await headers()
    const forwarded = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const cfConnectingIp = headersList.get('cf-connecting-ip')
    
    return {
      ipAddress: cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown',
      userAgent: headersList.get('user-agent') || 'unknown'
    }
  } catch {
    return { ipAddress: 'unknown', userAgent: 'unknown' }
  }
}

/**
 * تحديد مستوى الخطورة بناءً على نوع الحدث
 */
function determineSeverity(action: AuditAction): AuditSeverity {
  const severityMap: Record<AuditAction, AuditSeverity> = {
    [AuditAction.LOGIN_SUCCESS]: AuditSeverity.LOW,
    [AuditAction.LOGIN_FAILED]: AuditSeverity.MEDIUM,
    [AuditAction.LOGOUT]: AuditSeverity.LOW,
    [AuditAction.SESSION_EXPIRED]: AuditSeverity.LOW,
    [AuditAction.PASSWORD_CHANGE]: AuditSeverity.HIGH,
    
    [AuditAction.USER_CREATED]: AuditSeverity.MEDIUM,
    [AuditAction.USER_UPDATED]: AuditSeverity.MEDIUM,
    [AuditAction.USER_DELETED]: AuditSeverity.HIGH,
    [AuditAction.USER_ACTIVATED]: AuditSeverity.MEDIUM,
    [AuditAction.USER_DEACTIVATED]: AuditSeverity.MEDIUM,
    [AuditAction.PERMISSION_CHANGED]: AuditSeverity.HIGH,
    
    [AuditAction.INVENTORY_UPLOADED]: AuditSeverity.MEDIUM,
    [AuditAction.INVENTORY_DELETED]: AuditSeverity.HIGH,
    [AuditAction.INVENTORY_EXPORTED]: AuditSeverity.MEDIUM,
    
    [AuditAction.DATA_IMPORTED]: AuditSeverity.MEDIUM,
    [AuditAction.DATA_EXPORTED]: AuditSeverity.MEDIUM,
    [AuditAction.DATA_DELETED]: AuditSeverity.HIGH,
    
    [AuditAction.SETTINGS_CHANGED]: AuditSeverity.HIGH,
    [AuditAction.SYSTEM_ERROR]: AuditSeverity.HIGH,
    [AuditAction.SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL,
    
    [AuditAction.UNAUTHORIZED_ACCESS]: AuditSeverity.HIGH,
    [AuditAction.RATE_LIMIT_EXCEEDED]: AuditSeverity.MEDIUM,
    [AuditAction.INVALID_TOKEN]: AuditSeverity.HIGH,
    [AuditAction.CSRF_VIOLATION]: AuditSeverity.HIGH
  }
  
  return severityMap[action] || AuditSeverity.MEDIUM
}

/**
 * تسجيل حدث أمني
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'ipAddress' | 'userAgent' | 'severity' | 'timestamp'>): Promise<void> {
  try {
    const requestInfo = await getRequestInfo()
    const severity = determineSeverity(entry.action)
    
    // تشفير البيانات الحساسة قبل التخزين
    let encryptedOldData = entry.oldData
    let encryptedNewData = entry.newData
    
    if (entry.oldData && entry.oldData.includes('password')) {
      encryptedOldData = encrypt(entry.oldData)
    }
    if (entry.newData && entry.newData.includes('password')) {
      encryptedNewData = encrypt(entry.newData)
    }
    
    await db.auditLog.create({
      data: {
        userId: entry.userId,
        userRole: entry.userRole,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        oldData: encryptedOldData,
        newData: encryptedNewData,
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        details: entry.details
      }
    })
    
    // تسجيل الأحداث الحرجة في الـ console أيضاً
    if (severity === AuditSeverity.CRITICAL || severity === AuditSeverity.HIGH) {
      console.warn(`🔒 [AUDIT] ${entry.action} - User: ${entry.userId || 'unknown'} - IP: ${requestInfo.ipAddress} - ${entry.details || ''}`)
    }
  } catch (error) {
    console.error('Failed to log audit event:', error)
    // لا نريد أن يتوقف النظام إذا فشل التسجيل
  }
}

/**
 * تسجيل محاولة تسجيل دخول ناجحة
 */
export async function logLoginSuccess(userId: string, userRole: 'admin' | 'user'): Promise<void> {
  await logAuditEvent({
    userId,
    userRole,
    action: AuditAction.LOGIN_SUCCESS,
    entity: 'session',
    details: 'Successful login'
  })
}

/**
 * تسجيل محاولة تسجيل دخول فاشلة
 */
export async function logLoginFailed(username: string, reason: string): Promise<void> {
  await logAuditEvent({
    userRole: 'user',
    action: AuditAction.LOGIN_FAILED,
    entity: 'session',
    details: `Failed login attempt for user: ${username}. Reason: ${reason}`
  })
}

/**
 * تسجيل تسجيل الخروج
 */
export async function logLogout(userId: string, userRole: 'admin' | 'user'): Promise<void> {
  await logAuditEvent({
    userId,
    userRole,
    action: AuditAction.LOGOUT,
    entity: 'session',
    details: 'User logged out'
  })
}

/**
 * تسجيل تغيير كلمة المرور
 */
export async function logPasswordChange(userId: string, userRole: 'admin' | 'user'): Promise<void> {
  await logAuditEvent({
    userId,
    userRole,
    action: AuditAction.PASSWORD_CHANGE,
    entity: 'user',
    entityId: userId,
    details: 'Password changed successfully'
  })
}

/**
 * تسجيل إنشاء مستخدم جديد
 */
export async function logUserCreated(adminId: string, newUserId: string, username: string): Promise<void> {
  await logAuditEvent({
    userId: adminId,
    userRole: 'admin',
    action: AuditAction.USER_CREATED,
    entity: 'user',
    entityId: newUserId,
    newData: JSON.stringify({ username }),
    details: `User created: ${username}`
  })
}

/**
 * تسجيل حذف مستخدم
 */
export async function logUserDeleted(adminId: string, deletedUserId: string, username: string): Promise<void> {
  await logAuditEvent({
    userId: adminId,
    userRole: 'admin',
    action: AuditAction.USER_DELETED,
    entity: 'user',
    entityId: deletedUserId,
    oldData: JSON.stringify({ username }),
    details: `User deleted: ${username}`
  })
}

/**
 * تسجيل رفع ملف
 */
export async function logDataUpload(userId: string, fileName: string, recordsCount: number, system: string): Promise<void> {
  await logAuditEvent({
    userId,
    userRole: 'admin',
    action: AuditAction.INVENTORY_UPLOADED,
    entity: 'inventory',
    newData: JSON.stringify({ fileName, recordsCount, system }),
    details: `Uploaded ${recordsCount} records to ${system}`
  })
}

/**
 * تسجيل تصدير بيانات
 */
export async function logDataExport(userId: string, userRole: 'admin' | 'user', exportType: string, recordCount: number): Promise<void> {
  await logAuditEvent({
    userId,
    userRole,
    action: AuditAction.INVENTORY_EXPORTED,
    entity: 'inventory',
    newData: JSON.stringify({ exportType, recordCount }),
    details: `Exported ${recordCount} records as ${exportType}`
  })
}

/**
 * تسجيل نشاط مشبوه
 */
export async function logSuspiciousActivity(details: string, userId?: string): Promise<void> {
  await logAuditEvent({
    userId,
    userRole: userId ? 'user' : 'system',
    action: AuditAction.SUSPICIOUS_ACTIVITY,
    entity: 'security',
    details
  })
}

/**
 * تسجيل وصول غير مصرح
 */
export async function logUnauthorizedAccess(userId: string | undefined, resource: string, reason: string): Promise<void> {
  await logAuditEvent({
    userId,
    userRole: userId ? 'user' : 'system',
    action: AuditAction.UNAUTHORIZED_ACCESS,
    entity: resource,
    details: `Unauthorized access attempt: ${reason}`
  })
}

/**
 * الحصول على سجلات التدقيق
 */
export async function getAuditLogs(options: {
  userId?: string
  action?: AuditAction
  entity?: string
  startDate?: Date
  endDate?: Date
  severity?: AuditSeverity
  limit?: number
  offset?: number
}): Promise<{ logs: any[]; total: number }> {
  const where: any = {}
  
  if (options.userId) where.userId = options.userId
  if (options.action) where.action = options.action
  if (options.entity) where.entity = options.entity
  if (options.startDate || options.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }
  
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0
    }),
    db.auditLog.count({ where })
  ])
  
  return { logs, total }
}

/**
 * تنظيف السجلات القديمة (أكثر من 90 يوماً)
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  const result = await db.auditLog.deleteMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
      action: { notIn: [AuditAction.SUSPICIOUS_ACTIVITY, AuditAction.UNAUTHORIZED_ACCESS] }
    }
  })
  
  return result.count
}
