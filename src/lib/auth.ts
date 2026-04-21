/**
 * Authentication Utilities - Enhanced Security
 * تشفير كلمات المرور والتحقق منها - معزز أمنياً
 */

import bcrypt from 'bcryptjs'
import { randomBytes, timingSafeEqual } from 'crypto'
import { hash as secureHash, generateSecureToken } from './security/crypto'

const SALT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

/**
 * تشفير كلمة المرور
 */
export async function hashPassword(password: string): Promise<string> {
  // التحقق من الطول
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be less than ${MAX_PASSWORD_LENGTH} characters`)
  }
  
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * التحقق من كلمة المرور (مع توقيت ثابت لمنع timing attacks)
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || !hashedPassword) {
    return false
  }
  
  try {
    return bcrypt.compare(password, hashedPassword)
  } catch {
    // في حالة الخطأ، نعيد false بدون إفصاح عن السبب
    return false
  }
}

/**
 * التحقق مما إذا كانت كلمة المرور مشفرة
 * كلمات المرور المشفرة بـ bcrypt تبدأ بـ $2a$ أو $2b$
 */
export function isPasswordHashed(password: string): boolean {
  return password.startsWith('$2a$') || password.startsWith('$2b$')
}

/**
 * توليد معرّف جلسة آمن (مُحسّن)
 * يستخدم Node.js crypto بدلاً من Math.random
 */
export function generateSessionToken(): string {
  return generateSecureToken(32)
}

/**
 * توليد معرّف جلسة آمن مع توقيت انتهاء
 */
export function generateSessionWithExpiry(): {
  token: string
  expiresAt: Date
  createdAt: Date
} {
  return {
    token: generateSecureToken(32),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ساعة
  }
}

/**
 * التحقق من قوة كلمة المرور (مُحسّن)
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  message: string
  score: number
  errors: string[]
} {
  const errors: string[] = []
  
  if (!password) {
    return { 
      valid: false, 
      message: 'كلمة المرور مطلوبة', 
      score: 0,
      errors: ['كلمة المرور مطلوبة'] 
    }
  }
  
  // التحقق من الطول
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`)
  }
  
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`كلمة المرور يجب أن تكون أقل من ${MAX_PASSWORD_LENGTH} حرف`)
  }
  
  let score = 0
  
  // طول كافٍ
  if (password.length >= 10) score++
  if (password.length >= 14) score++
  
  // أحرف متنوعة
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score += 2
  
  // التحقق من الأنماط الشائعة
  const commonPatterns = [
    'password', '123456', 'qwerty', 'abc123', 'admin',
    'password123', 'letmein', 'welcome', 'monkey', 'dragon'
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
  
  // تحديد الرسالة بناءً على النتيجة
  let message = ''
  if (errors.length > 0) {
    message = 'كلمة المرور ضعيفة'
  } else if (score < 3) {
    message = 'كلمة المرور ضعيفة - يُنصح بإضافة أحرف متنوعة'
  } else if (score < 5) {
    message = 'كلمة المرور متوسطة القوة'
  } else {
    message = 'كلمة مرور قوية'
  }
  
  return {
    valid: errors.length === 0 && score >= 3,
    message,
    score: Math.min(5, score),
    errors
  }
}

/**
 * التحقق من قوة كلمة المرور (للتوافق مع النظام القديم)
 */
export function validatePasswordStrengthLegacy(password: string): {
  valid: boolean
  message: string
  score: number
} {
  const result = validatePasswordStrength(password)
  return {
    valid: result.valid,
    message: result.message,
    score: result.score
  }
}

/**
 * مقارنة توكن آمنة (تمنع timing attacks)
 */
export function secureCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false
  }
  
  try {
    return timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    )
  } catch {
    return false
  }
}

/**
 * إنشاء hash للتوكن (للتخزين الآمن)
 */
export function hashToken(token: string): string {
  return secureHash(token)
}

/**
 * ثوابت أمنية
 */
export const SECURITY_CONSTANTS = {
  SESSION_DURATION_HOURS: 24,
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  PASSWORD_MIN_LENGTH: MIN_PASSWORD_LENGTH,
  PASSWORD_MAX_LENGTH: MAX_PASSWORD_LENGTH,
  TOKEN_LENGTH: 32,
  BCRYPT_SALT_ROUNDS: SALT_ROUNDS
}

/**
 * حساب وقت انتهاء الجلسة
 */
export function calculateSessionExpiry(): Date {
  return new Date(Date.now() + SECURITY_CONSTANTS.SESSION_DURATION_MS)
}

/**
 * التحقق من انتهاء الجلسة
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

/**
 * إنشاء معرف فريد للطلب (للتتبع)
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(8).toString('hex')
  return `req_${timestamp}_${random}`
}
