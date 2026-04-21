/**
 * Security Validation Module
 * وحدة التحقق من المدخلات الأمنية
 * 
 * تمنع هجمات XSS, SQL Injection, وغيرها
 */

import { z } from 'zod'

/**
 * تنظيف النص من الأحرف الخطرة
 */
export function sanitizeString(input: string): string {
  if (!input) return ''
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#x3D;')
}

/**
 * تنظيف النص للعرض في HTML
 */
export function sanitizeHTML(input: string): string {
  return sanitizeString(input)
}

/**
 * تنظيف النص للاستخدام في JavaScript
 */
export function sanitizeForJS(input: string): string {
  if (!input) return ''
  
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E')
}

/**
 * إزالة الأحرف غير المرغوبة
 */
export function stripDangerousChars(input: string): string {
  if (!input) return ''
  
  // إزالة null bytes
  let cleaned = input.replace(/\x00/g, '')
  
  // إزالة أحرف التحكم
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')
  
  return cleaned
}

/**
 * التحقق من صحة المعرف (ID)
 */
export function isValidId(id: string): boolean {
  // CUID format أو UUID format
  const cuidRegex = /^c[a-z0-9]{24}$/
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return cuidRegex.test(id) || uuidRegex.test(id)
}

/**
 * التحقق من صحة اسم المستخدم
 */
export function isValidUsername(username: string): { valid: boolean; error?: string } {
  if (!username) {
    return { valid: false, error: 'اسم المستخدم مطلوب' }
  }
  
  if (username.length < 3) {
    return { valid: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  
  if (username.length > 50) {
    return { valid: false, error: 'اسم المستخدم يجب أن يكون أقل من 50 حرف' }
  }
  
  // فقط أحرف وأرقام وشرطات سفلية
  const validPattern = /^[a-zA-Z0-9_\u0600-\u06FF]+$/
  if (!validPattern.test(username)) {
    return { valid: false, error: 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط' }
  }
  
  // التحقق من عدم وجود كلمات محجوزة
  const reservedWords = ['admin', 'root', 'system', 'administrator', 'api', 'test']
  if (reservedWords.includes(username.toLowerCase())) {
    return { valid: false, error: 'هذا الاسم محجوز' }
  }
  
  return { valid: true }
}

/**
 * التحقق من قوة كلمة المرور
 */
export function validatePasswordStrength(password: string): { 
  valid: boolean
  score: number
  errors: string[]
  suggestions: string[]
} {
  const errors: string[] = []
  const suggestions: string[] = []
  let score = 0
  
  if (!password) {
    return { valid: false, score: 0, errors: ['كلمة المرور مطلوبة'], suggestions: [] }
  }
  
  // الطول
  if (password.length < 8) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  } else if (password.length >= 12) {
    score += 2
  } else {
    score += 1
    suggestions.push('يُنصح باستخدام 12 حرف أو أكثر')
  }
  
  // التنوع
  if (/[a-z]/.test(password)) score++
  else suggestions.push('أضف أحرف صغيرة')
  
  if (/[A-Z]/.test(password)) score++
  else suggestions.push('أضف أحرف كبيرة')
  
  if (/[0-9]/.test(password)) score++
  else suggestions.push('أضف أرقام')
  
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 2
  else suggestions.push('أضف رموز خاصة (!@#$%^&*)')
  
  // التحقق من الأنماط الشائعة
  const commonPatterns = [
    'password', '123456', 'qwerty', 'abc123', 'admin',
    'password123', 'letmein', 'welcome', 'monkey'
  ]
  
  const lowerPassword = password.toLowerCase()
  for (const pattern of commonPatterns) {
    if (lowerPassword.includes(pattern)) {
      errors.push('كلمة المرور تحتوي على نمط شائع')
      score = Math.max(0, score - 2)
      break
    }
  }
  
  // التحقق من التكرار
  if (/(.)\1{2,}/.test(password)) {
    errors.push('كلمة المرور تحتوي على أحرف متكررة')
    score = Math.max(0, score - 1)
  }
  
  // التحقق من التسلسل
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('كلمة المرور تحتوي على تسلسل')
    score = Math.max(0, score - 1)
  }
  
  return {
    valid: errors.length === 0 && score >= 3,
    score: Math.min(5, score),
    errors,
    suggestions
  }
}

/**
 * التحقق من صحة البريد الإلكتروني
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * التحقق من صحة رقم الهاتف
 */
export function isValidPhone(phone: string): boolean {
  // يدعم الأرقام السعودية والعالمية
  const phoneRegex = /^(\+966|0)?5[0-9]{8}$|^(\+\d{1,3})?[\d\s-]{10,}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

/**
 * التحقق من صحة URL
 */
export function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    // فقط http و https مسموح بهما
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * التحقق من عدم وجود SQL Injection
 */
export function detectSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b)\s*['"]?\d+['"]?\s*[=<>]/i,
    /UNION\s+(ALL\s+)?SELECT/i,
    /'\s*(OR|AND)\s*'/i,
    /\bEXEC\b|\bEXECUTE\b/i,
    /xp_cmdshell/i,
    /CONCAT\s*\(/i,
    /CHAR\s*\(/i,
    /0x[0-9a-f]+/i
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * التحقق من عدم وجود XSS
 */
export function detectXSS(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /<style/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:/gi
  ]
  
  return xssPatterns.some(pattern => pattern.test(input))
}

/**
 * التحقق من عدم وجود Path Traversal
 */
export function detectPathTraversal(input: string): boolean {
  const traversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /\.\.%2F/i,
    /\.\.%5C/i,
    /%2e%2e%2f/i,
    /%2e%2e\//i,
    /\.\.%252f/i
  ]
  
  return traversalPatterns.some(pattern => pattern.test(input))
}

/**
 * التحقق الشامل من المدخلات
 */
export function validateInput(input: string, options: {
  maxLength?: number
  minLength?: number
  required?: boolean
  pattern?: RegExp
  sanitize?: boolean
  checkSQL?: boolean
  checkXSS?: boolean
  checkPathTraversal?: boolean
} = {}): { valid: boolean; value: string; errors: string[] } {
  const errors: string[] = []
  let value = input
  
  // إزالة المسافات الزائدة
  value = value?.trim() || ''
  
  // التحقق من الحاجة
  if (options.required && !value) {
    return { valid: false, value: '', errors: ['هذا الحقل مطلوب'] }
  }
  
  if (!value) {
    return { valid: true, value: '', errors: [] }
  }
  
  // التحقق من الطول
  if (options.minLength && value.length < options.minLength) {
    errors.push(`الحد الأدنى ${options.minLength} أحرف`)
  }
  
  if (options.maxLength && value.length > options.maxLength) {
    errors.push(`الحد الأقصى ${options.maxLength} حرف`)
    value = value.slice(0, options.maxLength)
  }
  
  // التحقق من النمط
  if (options.pattern && !options.pattern.test(value)) {
    errors.push('الصيغة غير صحيحة')
  }
  
  // فحوصات الأمان
  if (options.checkSQL && detectSQLInjection(value)) {
    errors.push('يحتوي على أحرف غير مسموح بها')
    value = ''
  }
  
  if (options.checkXSS && detectXSS(value)) {
    errors.push('يحتوي على كود غير مسموح به')
    value = ''
  }
  
  if (options.checkPathTraversal && detectPathTraversal(value)) {
    errors.push('مسار غير صالح')
    value = ''
  }
  
  // التنظيف
  if (options.sanitize && value) {
    value = sanitizeString(value)
  }
  
  return {
    valid: errors.length === 0,
    value,
    errors
  }
}

/**
 * Zod schemas شائعة
 */
export const commonSchemas = {
  username: z.string()
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .max(50, 'اسم المستخدم يجب أن يكون أقل من 50 حرف')
    .regex(/^[a-zA-Z0-9_\u0600-\u06FF]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط'),
  
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(128, 'كلمة المرور طويلة جداً'),
  
  name: z.string()
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .max(100, 'الاسم طويل جداً'),
  
  id: z.string()
    .refine(isValidId, 'معرف غير صالح'),
  
  system: z.enum(['hoz', 'mwsal', 'life_saving', 'narcotic', 'vaccine', 'strategic', 'smoking', 'kidney', 'central']),
  
  fileName: z.string()
    .max(255, 'اسم الملف طويل جداً')
    .refine(name => !name.includes('..'), 'اسم الملف غير صالح')
    .refine(name => !detectPathTraversal(name), 'اسم الملف غير صالح'),
  
  pageNumber: z.coerce.number().int().min(1).max(10000).default(1),
  
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
}

/**
 * إنشاء schema للبحث
 */
export function createSearchSchema() {
  return z.object({
    q: z.string().max(100).optional(),
    page: commonSchemas.pageNumber,
    limit: commonSchemas.pageSize,
    sort: z.string().max(50).optional(),
    order: z.enum(['asc', 'desc']).optional()
  })
}
