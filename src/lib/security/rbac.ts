/**
 * RBAC (Role-Based Access Control) Module
 * نظام التحكم في الصلاحيات المبني على الأدوار
 * 
 * يوفر تحكم دقيق في الصلاحيات مع دعم الوراثة والشروط
 */

import { db } from '@/lib/db'

// تعريف الأدوار المتاحة
export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

// تعريف الصلاحيات المتاحة
export enum Permission {
  // صلاحيات المخزون
  VIEW_INVENTORY = 'view:inventory',
  EDIT_INVENTORY = 'edit:inventory',
  DELETE_INVENTORY = 'delete:inventory',
  UPLOAD_INVENTORY = 'upload:inventory',
  EXPORT_INVENTORY = 'export:inventory',
  
  // صلاحيات التقارير
  VIEW_REPORTS = 'view:reports',
  GENERATE_REPORTS = 'generate:reports',
  EXPORT_REPORTS = 'export:reports',
  
  // صلاحيات المستخدمين
  VIEW_USERS = 'view:users',
  CREATE_USERS = 'create:users',
  EDIT_USERS = 'edit:users',
  DELETE_USERS = 'delete:users',
  MANAGE_PERMISSIONS = 'manage:permissions',
  
  // صلاحيات الإعدادات
  VIEW_SETTINGS = 'view:settings',
  EDIT_SETTINGS = 'edit:settings',
  
  // صلاحيات الحركة
  VIEW_MOVEMENT = 'view:movement',
  CLASSIFY_MOVEMENT = 'classify:movement',
  EDIT_MOVEMENT_SETTINGS = 'edit:movement:settings',
  
  // صلاحيات البدائل
  VIEW_ALTERNATIVES = 'view:alternatives',
  EDIT_ALTERNATIVES = 'edit:alternatives',
  
  // صلاحيات التوصيل
  VIEW_DELIVERY = 'view:delivery',
  EDIT_DELIVERY = 'edit:delivery',
  
  // صلاحيات سجلات التدقيق
  VIEW_AUDIT_LOGS = 'view:audit:logs',
  EXPORT_AUDIT_LOGS = 'export:audit:logs',
  
  // صلاحيات النظام
  MANAGE_SYSTEM = 'manage:system',
  VIEW_SYSTEM_STATS = 'view:system:stats'
}

// خريطة صلاحيات كل دور
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission), // الأدمن لديه جميع الصلاحيات
  
  [Role.MANAGER]: [
    Permission.VIEW_INVENTORY,
    Permission.EDIT_INVENTORY,
    Permission.UPLOAD_INVENTORY,
    Permission.EXPORT_INVENTORY,
    Permission.VIEW_REPORTS,
    Permission.GENERATE_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_USERS,
    Permission.CREATE_USERS,
    Permission.EDIT_USERS,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_SETTINGS,
    Permission.VIEW_MOVEMENT,
    Permission.CLASSIFY_MOVEMENT,
    Permission.EDIT_MOVEMENT_SETTINGS,
    Permission.VIEW_ALTERNATIVES,
    Permission.EDIT_ALTERNATIVES,
    Permission.VIEW_DELIVERY,
    Permission.EDIT_DELIVERY,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_SYSTEM_STATS
  ],
  
  [Role.USER]: [
    Permission.VIEW_INVENTORY,
    Permission.EXPORT_INVENTORY,
    Permission.VIEW_REPORTS,
    Permission.VIEW_MOVEMENT,
    Permission.VIEW_ALTERNATIVES,
    Permission.VIEW_DELIVERY
  ],
  
  [Role.VIEWER]: [
    Permission.VIEW_INVENTORY,
    Permission.VIEW_REPORTS,
    Permission.VIEW_MOVEMENT,
    Permission.VIEW_ALTERNATIVES,
    Permission.VIEW_DELIVERY
  ]
}

// واجهة المستخدم مع الصلاحيات
export interface UserWithPermissions {
  id: string
  username: string
  name: string
  role: Role
  permissions: Permission[]
  isActive: boolean
}

/**
 * الحصول على صلاحيات دور معين
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * التحقق مما إذا كان الدور يملك صلاحية معينة
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * التحقق مما إذا كان المستخدم يملك صلاحية معينة
 */
export function hasPermission(user: UserWithPermissions, permission: Permission): boolean {
  if (!user.isActive) return false
  return user.permissions.includes(permission)
}

/**
 * التحقق مما إذا كان المستخدم يملك أي صلاحية من قائمة
 */
export function hasAnyPermission(user: UserWithPermissions, permissions: Permission[]): boolean {
  if (!user.isActive) return false
  return permissions.some(p => user.permissions.includes(p))
}

/**
 * التحقق مما إذا كان المستخدم يملك جميع الصلاحيات
 */
export function hasAllPermissions(user: UserWithPermissions, permissions: Permission[]): boolean {
  if (!user.isActive) return false
  return permissions.every(p => user.permissions.includes(p))
}

/**
 * تحويل صلاحيات المستخدم من قاعدة البيانات إلى مصفوفة
 */
export function mapUserPermissions(user: any): Permission[] {
  const permissions: Permission[] = []
  
  // صلاحيات العرض الأساسية
  if (user.canViewInventory) permissions.push(Permission.VIEW_INVENTORY)
  if (user.canViewReports) permissions.push(Permission.VIEW_REPORTS)
  if (user.canViewMovement) permissions.push(Permission.VIEW_MOVEMENT)
  if (user.canViewAlternatives) permissions.push(Permission.VIEW_ALTERNATIVES)
  if (user.canViewDelivery) permissions.push(Permission.VIEW_DELIVERY)
  
  // صلاحيات التعديل
  if (user.canEditMovementSettings) permissions.push(Permission.EDIT_MOVEMENT_SETTINGS)
  if (user.canClassifyMovement) permissions.push(Permission.CLASSIFY_MOVEMENT)
  
  // صلاحيات إضافية يمكن إضافتها حسب الحاجة
  
  return permissions
}

/**
 * تحديد دور المستخدم بناءً على صلاحياته
 */
export function determineUserRole(user: any): Role {
  // إذا كان لديه صلاحيات تعديل متقدمة، فهو مدير
  if (user.canEditMovementSettings && user.canClassifyMovement) {
    return Role.MANAGER
  }
  
  // إذا كان لديه صلاحيات عرض فقط، فهو مستخدم عادي
  if (user.canViewInventory && user.canViewReports) {
    return Role.USER
  }
  
  // الافتراضي: عارض
  return Role.VIEWER
}

/**
 * إنشاء كائن المستخدم مع الصلاحيات
 */
export function createUserWithPermissions(dbUser: any): UserWithPermissions {
  const role = determineUserRole(dbUser)
  const basePermissions = getRolePermissions(role)
  const customPermissions = mapUserPermissions(dbUser)
  
  // دمج الصلاحيات الأساسية مع الصلاحيات المخصصة
  const allPermissions = [...new Set([...basePermissions, ...customPermissions])]
  
  return {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    role,
    permissions: allPermissions,
    isActive: dbUser.isActive
  }
}

/**
 * التحقق من صلاحية مع المسار والطريقة
 * للتحقق من الوصول إلى API endpoints
 */
export function checkApiPermission(
  user: UserWithPermissions,
  method: string,
  path: string
): { allowed: boolean; reason?: string } {
  // تعيين الصلاحيات المطلوبة لكل مسار
  const permissionMap: Record<string, Record<string, Permission>> = {
    '/api/inventory': {
      GET: Permission.VIEW_INVENTORY,
      POST: Permission.UPLOAD_INVENTORY,
      PUT: Permission.EDIT_INVENTORY,
      DELETE: Permission.DELETE_INVENTORY
    },
    '/api/users': {
      GET: Permission.VIEW_USERS,
      POST: Permission.CREATE_USERS,
      PUT: Permission.EDIT_USERS,
      DELETE: Permission.DELETE_USERS
    },
    '/api/movement': {
      GET: Permission.VIEW_MOVEMENT,
      POST: Permission.CLASSIFY_MOVEMENT,
      PUT: Permission.EDIT_MOVEMENT_SETTINGS
    },
    '/api/alternatives': {
      GET: Permission.VIEW_ALTERNATIVES,
      POST: Permission.EDIT_ALTERNATIVES,
      DELETE: Permission.EDIT_ALTERNATIVES
    },
    '/api/delivery-schedule': {
      GET: Permission.VIEW_DELIVERY,
      POST: Permission.EDIT_DELIVERY,
      PUT: Permission.EDIT_DELIVERY
    },
    '/api/export': {
      GET: Permission.EXPORT_INVENTORY
    },
    '/api/stats': {
      GET: Permission.VIEW_SYSTEM_STATS
    }
  }
  
  // البحث عن الصلاحية المطلوبة
  for (const [routePath, methods] of Object.entries(permissionMap)) {
    if (path.startsWith(routePath)) {
      const requiredPermission = methods[method]
      if (requiredPermission && !hasPermission(user, requiredPermission)) {
        return {
          allowed: false,
          reason: `Missing permission: ${requiredPermission}`
        }
      }
    }
  }
  
  return { allowed: true }
}

/**
 * الحصول على قائمة الصلاحيات المتاحة
 */
export function getAvailablePermissions(): { key: Permission; label: string; category: string }[] {
  return [
    // صلاحيات المخزون
    { key: Permission.VIEW_INVENTORY, label: 'عرض المخزون', category: 'المخزون' },
    { key: Permission.EDIT_INVENTORY, label: 'تعديل المخزون', category: 'المخزون' },
    { key: Permission.DELETE_INVENTORY, label: 'حذف المخزون', category: 'المخزون' },
    { key: Permission.UPLOAD_INVENTORY, label: 'رفع ملفات المخزون', category: 'المخزون' },
    { key: Permission.EXPORT_INVENTORY, label: 'تصدير المخزون', category: 'المخزون' },
    
    // صلاحيات التقارير
    { key: Permission.VIEW_REPORTS, label: 'عرض التقارير', category: 'التقارير' },
    { key: Permission.GENERATE_REPORTS, label: 'إنشاء التقارير', category: 'التقارير' },
    { key: Permission.EXPORT_REPORTS, label: 'تصدير التقارير', category: 'التقارير' },
    
    // صلاحيات المستخدمين
    { key: Permission.VIEW_USERS, label: 'عرض المستخدمين', category: 'المستخدمين' },
    { key: Permission.CREATE_USERS, label: 'إنشاء مستخدمين', category: 'المستخدمين' },
    { key: Permission.EDIT_USERS, label: 'تعديل المستخدمين', category: 'المستخدمين' },
    { key: Permission.DELETE_USERS, label: 'حذف المستخدمين', category: 'المستخدمين' },
    { key: Permission.MANAGE_PERMISSIONS, label: 'إدارة الصلاحيات', category: 'المستخدمين' },
    
    // صلاحيات النظام
    { key: Permission.VIEW_SYSTEM_STATS, label: 'عرض إحصائيات النظام', category: 'النظام' },
    { key: Permission.MANAGE_SYSTEM, label: 'إدارة النظام', category: 'النظام' },
    { key: Permission.VIEW_AUDIT_LOGS, label: 'عرض سجلات التدقيق', category: 'النظام' },
  ]
}
